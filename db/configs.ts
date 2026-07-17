import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { groupConfigs } from "./schema";

export async function get(channelId: string, groupIds: string[]) {
  return await db
    .select()
    .from(groupConfigs)
    .where(
      and(
        eq(groupConfigs.channelId, channelId),
        inArray(groupConfigs.groupId, groupIds),
      ),
    );
}

export async function list(channelId: string) {
  return await db
    .select()
    .from(groupConfigs)
    .where(eq(groupConfigs.channelId, channelId));
}

export async function updateOrCreate(config: typeof groupConfigs.$inferInsert) {
  await db
    .insert(groupConfigs)
    .values(config)
    .onConflictDoUpdate({
      target: [groupConfigs.channelId, groupConfigs.groupId],
      set: {
        enabled: config.enabled,
        message: config.message,
      },
    });
}
