import { db } from "./client";
import { threads } from "./schema";

export async function store(message: {
  ts: string;
  channelId: string;
  mentionedGroups: string[];
}) {
  await db
    .insert(threads)
    .values(message)
    .onConflictDoUpdate({
      target: [threads.ts, threads.channelId],
      set: { mentionedGroups: message.mentionedGroups },
    });
}
