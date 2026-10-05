import * as api from "./api";

// Member counts are looked up whenever someone gets a whole-channel warning,
// so they're cached for a while to stay clear of rate limits.
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, { count: number; fetchedAt: number }>();

export function clearCache() {
  cache.clear();
}

export async function getChannelMemberCount(channelId: string) {
  const cached = cache.get(channelId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.count;
  }

  try {
    const result = await api.bot("conversations.info", {
      channel: channelId,
      include_num_members: "true",
    });
    const count = result.channel?.num_members;
    if (!result.ok || count === undefined) {
      throw new Error(`conversations.info failed: ${result.error}`);
    }

    cache.set(channelId, { count, fetchedAt: Date.now() });
    return count;
  } catch (err) {
    console.error(
      `[channel-members] failed to get member count for ${channelId}`,
      err,
    );
    // A stale count is better than none
    return cached?.count;
  }
}
