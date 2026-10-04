import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { threads } from "./schema";

export async function store(message: {
  ts: string;
  channelId: string;
  mentionedGroups: string[];
}) {
  // Only threads that mention a group are worth tracking. A thread row is
  // created the first time any message in it (parent or reply) mentions one.
  if (message.mentionedGroups.length === 0) return;

  let groups: string[] = [];

  const [existing] = await db
    .select()
    .from(threads)
    .where(
      and(eq(threads.ts, message.ts), eq(threads.channelId, message.channelId)),
    )
    .limit(1);

  if (existing) {
    groups = existing.mentionedGroups;
  }

  groups = [...groups, ...message.mentionedGroups];

  // Deduplicate groups
  groups = [...new Set(groups)];

  await db
    .insert(threads)
    .values(message)
    .onConflictDoUpdate({
      target: [threads.ts, threads.channelId],
      set: { mentionedGroups: groups },
    });
}

export async function getMentionedGroups(ts: string, channelId: string) {
  const [existing] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.ts, ts), eq(threads.channelId, channelId)))
    .limit(1);

  return existing?.mentionedGroups ?? [];
}
