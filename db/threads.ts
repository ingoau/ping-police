import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { threads } from "./schema";

export async function store(message: {
  ts: string;
  channelId: string;
  mentionedGroups: string[];
}) {
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
