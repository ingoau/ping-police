import * as api from "./api";

// Member counts are looked up whenever someone gets a whole-channel warning,
// so they're cached for a while to stay clear of rate limits.
const CACHE_TTL_MS = 10 * 60 * 1000;
// After a failed lookup, wait this long before trying that channel again
const FAILURE_BACKOFF_MS = 60 * 1000;

const cache = new Map<string, { count: number; fetchedAt: number }>();
const failedAt = new Map<string, number>();
const inflight = new Map<string, Promise<number | undefined>>();

export function clearCache() {
  cache.clear();
  failedAt.clear();
  inflight.clear();
}

async function fetchCount(channelId: string) {
  const params = { channel: channelId, include_num_members: "true" };
  // The bot can't see private channels it isn't in, but the selfbot can
  let result = await api.bot("conversations.info", params);
  if (!result.ok || result.channel?.num_members === undefined) {
    result = await api.selfbot("conversations.info", params);
  }

  const count = result.channel?.num_members;
  if (!result.ok || count === undefined) {
    throw new Error(`conversations.info failed: ${result.error}`);
  }
  return count;
}

export async function getChannelMemberCount(channelId: string) {
  const cached = cache.get(channelId);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.count;

  // A stale count is better than none
  const lastFailure = failedAt.get(channelId);
  if (lastFailure !== undefined && now - lastFailure < FAILURE_BACKOFF_MS) {
    return cached?.count;
  }

  let request = inflight.get(channelId);
  if (!request) {
    request = fetchCount(channelId)
      .then((count) => {
        cache.set(channelId, { count, fetchedAt: Date.now() });
        failedAt.delete(channelId);
        return count;
      })
      .catch((err) => {
        console.error(
          `[channel-members] failed to get member count for ${channelId}`,
          err,
        );
        failedAt.set(channelId, Date.now());
        return cached?.count;
      })
      .finally(() => inflight.delete(channelId));
    inflight.set(channelId, request);
  }
  return await request;
}
