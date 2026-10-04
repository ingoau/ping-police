import { and, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import { channelSettings, warnings } from "./schema";

// A reply only counts as ignoring a warning if it comes within this long of
// the latest warning. Repeat warnings for the same thread, user and group
// within this window are counted once, and push the window back.
export const WARNING_WINDOW_MS = 30 * 60 * 1000;

export interface WarningStats {
  warnings: number;
  ignored: number;
}

export interface GroupWarningStats extends WarningStats {
  groupId: string;
}

export async function isEnabled(channelId: string) {
  const [settings] = await db
    .select({ analyticsEnabled: channelSettings.analyticsEnabled })
    .from(channelSettings)
    .where(eq(channelSettings.channelId, channelId));

  // Analytics are on unless a channel manager turned them off
  return settings?.analyticsEnabled ?? true;
}

export async function setEnabled(channelId: string, enabled: boolean) {
  await db
    .insert(channelSettings)
    .values({ channelId, analyticsEnabled: enabled })
    .onConflictDoUpdate({
      target: channelSettings.channelId,
      set: { analyticsEnabled: enabled },
    });
}

export async function toggle(channelId: string) {
  const enabled = !(await isEnabled(channelId));
  await setEnabled(channelId, enabled);
  return enabled;
}

export async function recordWarnings(
  warning: {
    channelId: string;
    threadTs: string;
    userId: string;
    groupIds: string[];
  },
  now = new Date(),
) {
  if (warning.groupIds.length === 0) return;
  if (!(await isEnabled(warning.channelId))) return;

  const recent = await db
    .select({ id: warnings.id, groupId: warnings.groupId })
    .from(warnings)
    .where(
      and(
        eq(warnings.channelId, warning.channelId),
        eq(warnings.threadTs, warning.threadTs),
        eq(warnings.userId, warning.userId),
        inArray(warnings.groupId, warning.groupIds),
        isNull(warnings.ignoredAt),
        gt(warnings.warnedAt, new Date(now.getTime() - WARNING_WINDOW_MS)),
      ),
    );
  const alreadyWarned = new Set(recent.map((row) => row.groupId));

  if (recent.length > 0) {
    await db
      .update(warnings)
      .set({ warnedAt: now })
      .where(
        inArray(
          warnings.id,
          recent.map((row) => row.id),
        ),
      );
  }

  const rows = warning.groupIds
    .filter((groupId) => !alreadyWarned.has(groupId))
    .map((groupId) => ({
      channelId: warning.channelId,
      threadTs: warning.threadTs,
      userId: warning.userId,
      groupId,
      warnedAt: now,
    }));

  if (rows.length > 0) await db.insert(warnings).values(rows);
}

// Called when someone replies in a thread. Any recent warnings they got in that
// thread are counted as ignored.
export async function markIgnored(
  reply: { channelId: string; threadTs: string; userId: string },
  now = new Date(),
) {
  if (!(await isEnabled(reply.channelId))) return;

  await db
    .update(warnings)
    .set({ ignoredAt: now })
    .where(
      and(
        eq(warnings.channelId, reply.channelId),
        eq(warnings.threadTs, reply.threadTs),
        eq(warnings.userId, reply.userId),
        isNull(warnings.ignoredAt),
        gt(warnings.warnedAt, new Date(now.getTime() - WARNING_WINDOW_MS)),
      ),
    );
}

const warningCount = () => count();
const ignoredCount = () =>
  sql<number>`count(${warnings.ignoredAt})`.mapWith(Number);

export async function getStats(channelId?: string): Promise<WarningStats> {
  const [stats] = await db
    .select({ warnings: warningCount(), ignored: ignoredCount() })
    .from(warnings)
    .where(channelId ? eq(warnings.channelId, channelId) : undefined);

  return { warnings: stats?.warnings ?? 0, ignored: stats?.ignored ?? 0 };
}

export async function getGroupStats(
  channelId?: string,
): Promise<GroupWarningStats[]> {
  return await db
    .select({
      groupId: warnings.groupId,
      warnings: warningCount(),
      ignored: ignoredCount(),
    })
    .from(warnings)
    .where(channelId ? eq(warnings.channelId, channelId) : undefined)
    .groupBy(warnings.groupId)
    .orderBy(desc(warningCount()), warnings.groupId);
}
