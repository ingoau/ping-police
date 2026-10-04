import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { MessageEvent } from "@slack/web-api";
import { db } from "@/db/client";
import { channelSettings, groupConfigs, threads, warnings } from "@/db/schema";
import * as analytics from "@/db/analytics";
import * as configs from "@/db/configs";
import { clearCache } from "@/slack/usergroups";
import { DEFAULT_MESSAGE } from "@/slack/warning";
import {
  clearCooldowns,
  extractMentionedGroups,
  handleMessage,
  handleTyping,
} from "./selfbot-events";

const realFetch = globalThis.fetch;
const logError = mock(() => {});

beforeEach(async () => {
  await db.delete(threads);
  await db.delete(groupConfigs);
  await db.delete(warnings);
  await db.delete(channelSettings);
  clearCooldowns();
  clearCache();
  logError.mockClear();
  globalThis.fetch = mock(async () =>
    Response.json({
      ok: true,
      usergroups: [{ id: "S1", handle: "staff", name: "Staff", user_count: 1234 }],
    }),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  clearCache();
});

const message = (fields: Record<string, unknown>) =>
  ({ type: "message", channel: "C1", ...fields }) as unknown as MessageEvent;

const typing = (fields: Partial<{ user: string; thread_ts: string }> = {}) => ({
  type: "user_typing" as const,
  id: 1,
  channel: "C1",
  user: "U1",
  thread_ts: "1.0",
  ...fields,
});

describe("extractMentionedGroups", () => {
  test("finds group mentions with and without labels", () => {
    expect(
      extractMentionedGroups("hi <!subteam^S1|@staff> and <!subteam^S2> <@U1>"),
    ).toEqual(["S1", "S2"]);
    expect(extractMentionedGroups("no mentions")).toEqual([]);
  });
});

describe("handleTyping", () => {
  async function setUpThread(groupMessage: string | null = null) {
    await handleMessage(message({ ts: "1.0", text: "<!subteam^S1>" }), logError);
    await configs.updateOrCreate({
      channelId: "C1",
      groupId: "S1",
      message: groupMessage,
    });
  }

  test("warns with the member count and records the warning", async () => {
    await setUpThread();
    const send = mock(async () => {});

    await handleTyping(typing(), send, logError);

    expect(send).toHaveBeenCalledTimes(1);
    const warning = (send.mock.calls[0] as unknown as [any])[0];
    expect(warning).toMatchObject({ channel: "C1", user: "U1", threadTs: "1.0" });
    expect(JSON.stringify(warning.blocks)).toContain(
      DEFAULT_MESSAGE.replace("{count}", "1,234"),
    );
    expect(await analytics.getStats("C1")).toEqual({ warnings: 1, ignored: 0 });
    expect(logError).not.toHaveBeenCalled();
  });

  test("doesn't warn again for the same user and thread during the cooldown", async () => {
    await setUpThread("custom");
    const send = mock(async () => {});

    await handleTyping(typing(), send, logError);
    await handleTyping(typing(), send, logError);
    await handleTyping(typing({ user: "U2" }), send, logError);

    expect(send).toHaveBeenCalledTimes(2);
  });

  test("doesn't warn outside threads, in unmentioned threads, or for disabled groups", async () => {
    await setUpThread();
    const send = mock(async () => {});

    await handleTyping(typing({ thread_ts: undefined }), send, logError);
    await handleTyping(typing({ thread_ts: "2.0" }), send, logError);
    await configs.toggle("C1", "S1");
    await handleTyping(typing(), send, logError);

    expect(send).not.toHaveBeenCalled();
  });

  test("doesn't record a warning that failed to send", async () => {
    await setUpThread();
    const send = mock(async () => {
      throw new Error("nope");
    });

    await handleTyping(typing(), send, logError);

    expect(logError).toHaveBeenCalled();
    expect(await analytics.getStats()).toEqual({ warnings: 0, ignored: 0 });
  });
});

describe("handleMessage", () => {
  test("marks the warning as ignored when the warned user replies", async () => {
    await handleMessage(message({ ts: "1.0", text: "<!subteam^S1>" }), logError);
    await configs.updateOrCreate({ channelId: "C1", groupId: "S1", message: null });
    await handleTyping(typing(), async () => {}, logError);

    // Someone else replying doesn't count
    await handleMessage(
      message({ ts: "1.1", thread_ts: "1.0", user: "U2", text: "hi" }),
      logError,
    );
    expect(await analytics.getStats()).toEqual({ warnings: 1, ignored: 0 });

    await handleMessage(
      message({ ts: "1.2", thread_ts: "1.0", user: "U1", text: "hi" }),
      logError,
    );
    expect(await analytics.getStats()).toEqual({ warnings: 1, ignored: 1 });
  });

  test("ignores edits and other message subtypes", async () => {
    await handleMessage(
      message({ ts: "1.0", subtype: "message_changed", text: "<!subteam^S1>" }),
      logError,
    );
    expect(await db.select().from(threads)).toEqual([]);
  });
});
