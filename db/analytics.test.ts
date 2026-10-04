import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "./client";
import { channelSettings, warnings } from "./schema";
import * as analytics from "./analytics";

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 0, minutes));
const thread = { channelId: "C1", threadTs: "1.0", userId: "U1" };

beforeEach(async () => {
  await db.delete(warnings);
  await db.delete(channelSettings);
});

describe("channel analytics setting", () => {
  test("is enabled by default", async () => {
    expect(await analytics.isEnabled("C1")).toBe(true);
  });

  test("toggles per channel", async () => {
    expect(await analytics.toggle("C1")).toBe(false);
    expect(await analytics.isEnabled("C1")).toBe(false);
    expect(await analytics.isEnabled("C2")).toBe(true);
    expect(await analytics.toggle("C1")).toBe(true);
    expect(await analytics.isEnabled("C1")).toBe(true);
  });
});

describe("recordWarnings", () => {
  test("records one row per group", async () => {
    await analytics.recordWarnings({ ...thread, groupIds: ["S1", "S2"] }, at(0));
    expect(await analytics.getStats()).toEqual({ warnings: 2, ignored: 0 });
  });

  test("counts repeat warnings in the same thread once", async () => {
    await analytics.recordWarnings({ ...thread, groupIds: ["S1"] }, at(0));
    await analytics.recordWarnings({ ...thread, groupIds: ["S1", "S2"] }, at(5));
    expect(await analytics.getStats()).toEqual({ warnings: 2, ignored: 0 });
  });

  test("counts a new warning once the window has passed", async () => {
    await analytics.recordWarnings({ ...thread, groupIds: ["S1"] }, at(0));
    await analytics.recordWarnings({ ...thread, groupIds: ["S1"] }, at(31));
    expect(await analytics.getStats()).toEqual({ warnings: 2, ignored: 0 });
  });

  test("counts a new warning after the previous one was ignored", async () => {
    await analytics.recordWarnings({ ...thread, groupIds: ["S1"] }, at(0));
    await analytics.markIgnored(thread, at(1));
    await analytics.recordWarnings({ ...thread, groupIds: ["S1"] }, at(2));
    expect(await analytics.getStats()).toEqual({ warnings: 2, ignored: 1 });
  });

  test("records nothing when analytics are disabled", async () => {
    await analytics.setEnabled("C1", false);
    await analytics.recordWarnings({ ...thread, groupIds: ["S1"] }, at(0));
    expect(await analytics.getStats()).toEqual({ warnings: 0, ignored: 0 });
  });
});

describe("markIgnored", () => {
  test("marks recent warnings for that user and thread", async () => {
    await analytics.recordWarnings({ ...thread, groupIds: ["S1", "S2"] }, at(0));
    await analytics.recordWarnings(
      { ...thread, userId: "U2", groupIds: ["S1"] },
      at(0),
    );
    await analytics.recordWarnings(
      { ...thread, threadTs: "2.0", groupIds: ["S1"] },
      at(0),
    );

    await analytics.markIgnored(thread, at(10));

    expect(await analytics.getStats()).toEqual({ warnings: 4, ignored: 2 });
  });

  test("ignores replies long after the warning", async () => {
    await analytics.recordWarnings({ ...thread, groupIds: ["S1"] }, at(0));
    await analytics.markIgnored(thread, at(45));
    expect(await analytics.getStats()).toEqual({ warnings: 1, ignored: 0 });
  });

  test("does nothing when analytics are disabled", async () => {
    await analytics.recordWarnings({ ...thread, groupIds: ["S1"] }, at(0));
    await analytics.setEnabled("C1", false);
    await analytics.markIgnored(thread, at(1));
    expect(await analytics.getStats()).toEqual({ warnings: 1, ignored: 0 });
  });
});

describe("stats", () => {
  test("filters by channel and groups by user group", async () => {
    await analytics.recordWarnings({ ...thread, groupIds: ["S1", "S2"] }, at(0));
    await analytics.recordWarnings(
      { ...thread, userId: "U2", groupIds: ["S1"] },
      at(0),
    );
    await analytics.recordWarnings(
      { ...thread, channelId: "C2", groupIds: ["S3"] },
      at(0),
    );
    await analytics.markIgnored(thread, at(1));

    expect(await analytics.getStats()).toEqual({ warnings: 4, ignored: 2 });
    expect(await analytics.getStats("C1")).toEqual({ warnings: 3, ignored: 2 });
    expect(await analytics.getStats("C9")).toEqual({ warnings: 0, ignored: 0 });

    expect(await analytics.getGroupStats("C1")).toEqual([
      { groupId: "S1", warnings: 2, ignored: 1 },
      { groupId: "S2", warnings: 1, ignored: 1 },
    ]);
    expect(await analytics.getGroupStats()).toHaveLength(3);
  });
});
