import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { groupConfigs } from "./schema";
import { CHANNEL_TARGET } from "@/slack/warning";

// Whether each channel's whole-channel rule is enabled, for channels that have
// one. Typing events and messages in every channel check this, so it's kept in
// memory and reloaded after any change to the configs.
let channelRules: Promise<Map<string, boolean>> | undefined;

export function clearChannelRuleCache() {
  channelRules = undefined;
}

async function loadChannelRules() {
  const rows = await db
    .select({
      channelId: groupConfigs.channelId,
      enabled: groupConfigs.enabled,
    })
    .from(groupConfigs)
    .where(eq(groupConfigs.groupId, CHANNEL_TARGET));
  return new Map(rows.map((row) => [row.channelId, row.enabled]));
}

// true or false if the channel has a whole-channel rule (enabled or not),
// undefined if it doesn't
export async function getChannelRule(channelId: string) {
  if (!channelRules) {
    const loading = loadChannelRules().catch((err) => {
      // Try again next time, unless a newer load has already started
      if (channelRules === loading) channelRules = undefined;
      throw err;
    });
    channelRules = loading;
  }
  return (await channelRules).get(channelId);
}

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
  clearChannelRuleCache();
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

  clearChannelRuleCache();
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
  clearChannelRuleCache();
}
