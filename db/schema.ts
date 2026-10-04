import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";

export const groupConfigs = sqliteTable(
  "group_configs",
  {
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    channelId: text("channel_id").notNull(),
    groupId: text("group_id").notNull(),
    message: text("message"),
  },
  (table) => [primaryKey({ columns: [table.channelId, table.groupId] })],
);

export const threads = sqliteTable(
  "threads",
  {
    ts: text("ts").notNull(),
    channelId: text("channel_id").notNull(),
    mentionedGroups: text("mentioned_groups", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`(json_array())`),
  },
  (table) => [primaryKey({ columns: [table.channelId, table.ts] })],
);

export const channelSettings = sqliteTable("channel_settings", {
  channelId: text("channel_id").primaryKey(),
  analyticsEnabled: integer("analytics_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
});

// One row per group a user was warned about while typing in a thread.
// ignoredAt is set if they replied in the thread anyway.
export const warnings = sqliteTable(
  "warnings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    channelId: text("channel_id").notNull(),
    threadTs: text("thread_ts").notNull(),
    userId: text("user_id").notNull(),
    groupId: text("group_id").notNull(),
    warnedAt: integer("warned_at", { mode: "timestamp_ms" }).notNull(),
    ignoredAt: integer("ignored_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("warnings_channel_group_idx").on(table.channelId, table.groupId),
    index("warnings_thread_user_idx").on(
      table.channelId,
      table.threadTs,
      table.userId,
    ),
  ],
);
