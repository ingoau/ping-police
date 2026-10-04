import { beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { db } from "./client";
import { threads as threadsTable } from "./schema";
import * as threads from "./threads";

beforeEach(async () => {
  await db.delete(threadsTable);
});

describe("threads.store", () => {
  test("does not create a row when no group is mentioned", async () => {
    await threads.store({ ts: "1.0", channelId: "C1", mentionedGroups: [] });
    expect(await db.select().from(threadsTable)).toEqual([]);
  });

  test("creates a row when a reply mentions a group in an untracked thread", async () => {
    await threads.store({ ts: "1.0", channelId: "C1", mentionedGroups: ["S1"] });
    expect(await threads.getMentionedGroups("1.0", "C1")).toEqual(["S1"]);
  });

  test("merges and deduplicates groups across messages", async () => {
    await threads.store({ ts: "1.0", channelId: "C1", mentionedGroups: ["S1", "S2"] });
    await threads.store({ ts: "1.0", channelId: "C1", mentionedGroups: [] });
    await threads.store({ ts: "1.0", channelId: "C1", mentionedGroups: ["S2", "S3"] });
    expect(await threads.getMentionedGroups("1.0", "C1")).toEqual(["S1", "S2", "S3"]);
  });

  test("keeps threads in different channels separate", async () => {
    await threads.store({ ts: "1.0", channelId: "C1", mentionedGroups: ["S1"] });
    await threads.store({ ts: "1.0", channelId: "C2", mentionedGroups: ["S2"] });
    expect(await threads.getMentionedGroups("1.0", "C1")).toEqual(["S1"]);
    expect(await threads.getMentionedGroups("1.0", "C2")).toEqual(["S2"]);
  });

  test("returns no groups for an unknown thread", async () => {
    expect(await threads.getMentionedGroups("9.9", "C1")).toEqual([]);
  });
});

describe("delete_threads_without_mentions migration", () => {
  test("removes only threads with no mentioned groups", async () => {
    const dir = `${import.meta.dir}/../drizzle`;
    const sqlite = new Database(":memory:");
    for (const statement of (
      await Bun.file(`${dir}/0000_lively_adam_warlock.sql`).text()
    ).split("--> statement-breakpoint")) {
      sqlite.run(statement);
    }
    const insert = sqlite.prepare(
      "INSERT INTO threads (ts, channel_id, mentioned_groups) VALUES (?, ?, ?)",
    );
    insert.run("1", "C1", "[]");
    insert.run("2", "C1", '["S1"]');
    insert.run("3", "C1", "not json");
    sqlite.run("INSERT INTO threads (ts, channel_id) VALUES ('4', 'C1')");

    sqlite.run(
      await Bun.file(`${dir}/0001_delete_threads_without_mentions.sql`).text(),
    );

    expect(sqlite.query("SELECT ts FROM threads").all()).toEqual([{ ts: "2" }]);
  });
});
