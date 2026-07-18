import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
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
