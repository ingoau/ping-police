import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "@/db/client";
import { channelSettings, groupConfigs, warnings } from "@/db/schema";
import * as analytics from "@/db/analytics";
import * as configs from "@/db/configs";
import * as views from "./views";
import { manageGroupSettingsModal } from "./blocks";
import { CHANNEL_TARGET } from "./warning";

const text = (value: unknown) => JSON.stringify(value);

beforeEach(async () => {
  await db.delete(groupConfigs);
  await db.delete(warnings);
  await db.delete(channelSettings);

  await configs.updateOrCreate({ channelId: "C1", groupId: "S1", message: null });
  await configs.updateOrCreate({ channelId: "C1", groupId: "S2", message: "hi" });
  await configs.updateOrCreate({ channelId: "C2", groupId: "S3", message: null });

  const at = new Date();
  await analytics.recordWarnings(
    { channelId: "C1", threadTs: "1", userId: "U1", groupIds: ["S1"] },
    at,
  );
  await analytics.recordWarnings(
    { channelId: "C1", threadTs: "1", userId: "U2", groupIds: ["S1"] },
    at,
  );
  await analytics.recordWarnings(
    { channelId: "C2", threadTs: "1", userId: "U1", groupIds: ["S3"] },
    at,
  );
  await analytics.markIgnored({ channelId: "C1", threadTs: "1", userId: "U1" });
});

describe("stats", () => {
  test("shows global, channel, and per-group stats", async () => {
    const blocks = text(await views.stats("C1"));

    expect(blocks).toContain("Set up in *2* channels with *3* rules");
    expect(blocks).toContain("*3* warnings shown · *1* replied anyway (33%)");
    expect(blocks).toContain("*In <#C1>*");
    expect(blocks).toContain("*2* warnings shown · *1* replied anyway (50%)");
    expect(blocks).toContain(
      "<!subteam^S1> *2* warnings shown · *1* replied anyway (50%)",
    );
    // Configured but never warned about
    expect(blocks).toContain("<!subteam^S2> *0* warnings shown · *0* replied anyway");
    expect(blocks).not.toContain("<!subteam^S3>");
  });

  test("labels the whole-channel warning", async () => {
    await configs.updateOrCreate({
      channelId: "C1",
      groupId: CHANNEL_TARGET,
      message: null,
    });
    expect(text(await views.stats("C1"))).toContain(
      "• Whole channel *0* warnings shown",
    );
  });

  test("only shows global stats outside a channel", async () => {
    const blocks = text(await views.stats());
    expect(blocks).toContain("*Everywhere*");
    expect(blocks).not.toContain("*In <#");
  });

  test("notes when analytics are off in the channel", async () => {
    await analytics.setEnabled("C1", false);
    expect(text(await views.stats("C1"))).toContain(
      "Analytics are off for this channel.",
    );
  });
});

describe("settingsModal", () => {
  test("shows per-group stats and the analytics button for managers", async () => {
    const modal = text(await views.settingsModal("C1", true));

    expect(modal).toContain("*2* warnings shown · *1* replied anyway (50%)");
    expect(modal).toContain("Message: _default_");
    expect(modal).toContain("Message: `hi`");
    expect(modal).toContain('"action_id":"add_group"');
    expect(modal).toContain('"action_id":"toggle_analytics"');
    expect(modal).toContain("Disable analytics");
    expect(modal).toContain('"action_id":"add_channel_warning"');
  });

  test("lists the whole-channel warning first, once it's set up", async () => {
    await configs.updateOrCreate({
      channelId: "C1",
      groupId: CHANNEL_TARGET,
      message: null,
    });
    const modal = text(await views.settingsModal("C1", true));

    expect(modal).toContain("*Whole channel* - Enabled");
    expect(modal.indexOf("Whole channel")).toBeLessThan(
      modal.indexOf("<!subteam^S1>"),
    );
    expect(modal).not.toContain("add_channel_warning");
    expect(modal).toContain(`"value":"${CHANNEL_TARGET}:C1"`);
  });

  test("hides manager buttons from everyone else", async () => {
    const modal = text(await views.settingsModal("C1", false));
    expect(modal).not.toContain("toggle_analytics");
    expect(modal).not.toContain("add_group");
    expect(modal).not.toContain("add_channel_warning");
  });

  test("offers to re-enable analytics and shows a notice", async () => {
    await analytics.setEnabled("C1", false);
    const modal = text(await views.settingsModal("C1", true, "Oops"));
    expect(modal).toContain("Enable analytics");
    expect(modal).toContain("Analytics are off for this channel.");
    expect(modal).toContain(":warning: Oops");
  });
});

describe("manageGroupSettingsModal", () => {
  test("only offers enable and delete for a saved whole-channel warning", () => {
    const fresh = text(
      manageGroupSettingsModal({ channelId: "C1", groupId: CHANNEL_TARGET }),
    );
    expect(fresh).toContain("Warn anyone starting a new message in ");
    expect(fresh).toContain("how many people are in the channel");
    expect(fresh).not.toContain("toggle_enabled");
    expect(fresh).not.toContain('"action_id":"delete"');
    expect(fresh).not.toContain("group_select");

    const saved = text(
      manageGroupSettingsModal({
        channelId: "C1",
        groupId: CHANNEL_TARGET,
        enabled: true,
        message: null,
      }),
    );
    expect(saved).toContain("toggle_enabled");
    expect(saved).toContain('"action_id":"delete"');
  });
});
