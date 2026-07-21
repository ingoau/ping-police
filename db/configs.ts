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

export async function listAll() {
  return await db
    .select()
    .from(groupConfigs);
}

export async function updateOrCreate(config: typeof groupConfigs.$inferInsert) {
  await db
    .insert(groupConfigs)
    .values(config)
    .onConflictDoUpdate({
      target: [groupConfigs.channelId, groupConfigs.groupId],
      set: {
        message: config.message,
      },
    });
}

export async function toggle(channelId: string, groupId: string) {
  const [config] = await db
    .select()
    .from(groupConfigs)
    .where(
      and(
        eq(groupConfigs.channelId, channelId),
        eq(groupConfigs.groupId, groupId),
      ),
    );

  if (!config) return;

  await db
    .update(groupConfigs)
    .set({ enabled: !config.enabled })
    .where(
      and(
        eq(groupConfigs.channelId, channelId),
        eq(groupConfigs.groupId, groupId),
      ),
    );

  return !config.enabled;
}

export async function deleteConfig(channelId: string, groupId: string) {
  await db
    .delete(groupConfigs)
    .where(
      and(
        eq(groupConfigs.channelId, channelId),
        eq(groupConfigs.groupId, groupId),
      ),
    );
}
