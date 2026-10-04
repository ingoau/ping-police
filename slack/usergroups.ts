import * as api from "./api";

// User group lookups go through the selfbot so the bot token doesn't need the
// usergroups:read scope. The workspace can have thousands of groups, so the
// full list is cached in memory and searched locally.

export interface UserGroup {
  id: string;
  handle: string;
  name: string;
  userCount?: number;
}

interface GroupCache {
  groups: UserGroup[];
  byId: Map<string, UserGroup>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
// After a failed fetch, wait this long before calling the (rate limited) list
// call again. Callers get the stale cache meanwhile, or fail fast without one
const FAILURE_BACKOFF_MS = 60 * 1000;
// Slack rejects external_select responses with more than 100 options
export const MAX_OPTIONS = 100;
const MAX_OPTION_TEXT = 75;

let cache: GroupCache | undefined;
let inflight: Promise<GroupCache> | undefined;
// Bumped by clearCache so a fetch started before it doesn't repopulate the cache
let generation = 0;
let lastFailureAt: number | undefined;

async function fetchGroups(): Promise<GroupCache> {
  const result = await api.selfbot("usergroups.list", {
    include_count: "true",
    include_disabled: "false",
  });
  if (!result.ok) {
    throw new Error(`usergroups.list failed: ${result.error}`);
  }

  const groups = (result.usergroups ?? []).flatMap((group) =>
    group.id
      ? [
          {
            id: group.id,
            handle: group.handle ?? "",
            name: group.name ?? "",
            userCount: group.user_count,
          },
        ]
      : [],
  );

  return {
    groups,
    byId: new Map(groups.map((group) => [group.id, group])),
    fetchedAt: Date.now(),
  };
}

function refresh() {
  if (inflight) return inflight;

  const startedIn = generation;
  const request = fetchGroups()
    .then((fresh) => {
      if (startedIn === generation) {
        cache = fresh;
        lastFailureAt = undefined;
      }
      console.log(`[usergroups] loaded ${fresh.groups.length} user groups`);
      return fresh;
    })
    .catch((err) => {
      if (startedIn === generation) lastFailureAt = Date.now();
      throw err;
    })
    .finally(() => {
      if (inflight === request) inflight = undefined;
    });
  inflight = request;
  return request;
}

// Returns the cached groups, fetching them if there is no cache yet. A stale
// cache is returned immediately while it is refreshed in the background.
export async function getGroups(): Promise<GroupCache> {
  const backingOff =
    lastFailureAt !== undefined &&
    Date.now() - lastFailureAt < FAILURE_BACKOFF_MS;

  if (!cache) {
    if (backingOff) {
      throw new Error("usergroups.list failed recently; not retrying yet");
    }
    return await refresh();
  }

  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS && !backingOff) {
    refresh().catch((err) =>
      console.error("[usergroups] background refresh failed", err),
    );
  }

  return cache;
}

export function clearCache() {
  generation++;
  cache = undefined;
  inflight = undefined;
  lastFailureAt = undefined;
}

const GROUP_ID_RE = /^S[A-Z0-9]{6,}$/;
const GROUP_MENTION_RE = /^<!subteam\^(S[A-Z0-9]+)(?:\|[^>]*)?>$/;

// Accepts a raw group ID ("S0123ABCD") or a pasted mention
// ("<!subteam^S0123ABCD|@group>") and returns the ID.
export function parseGroupId(input: string) {
  const trimmed = input.trim();
  const mention = trimmed.match(GROUP_MENTION_RE);
  if (mention) return mention[1]!;
  const upper = trimmed.toUpperCase();
  // Group IDs contain digits, which stops search words like "security" from
  // being mistaken for an ID
  return GROUP_ID_RE.test(upper) && /\d/.test(upper) ? upper : undefined;
}

function score(group: UserGroup, query: string) {
  const handle = group.handle.toLowerCase();
  const name = group.name.toLowerCase();
  if (group.id.toLowerCase() === query || handle === query) return 0;
  if (handle.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (handle.includes(query)) return 3;
  if (name.includes(query)) return 4;
  return undefined;
}

// Ranks groups matching the query: exact matches first, then prefix matches,
// then substring matches on handle and name.
export function searchGroups(
  groups: UserGroup[],
  query: string,
  limit = MAX_OPTIONS,
) {
  const normalized = query.trim().replace(/^@/, "").toLowerCase();
  const id = parseGroupId(query);

  if (!normalized) {
    return [...groups]
      .sort((a, b) => a.handle.localeCompare(b.handle))
      .slice(0, limit);
  }

  return groups
    .flatMap((group) => {
      const s = id && group.id === id ? 0 : score(group, normalized);
      return s === undefined ? [] : [{ group, s }];
    })
    .sort((a, b) => a.s - b.s || a.group.handle.localeCompare(b.group.handle))
    .slice(0, limit)
    .map(({ group }) => group);
}

// Truncates to at most max UTF-16 code units without splitting an emoji
function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  let result = "";
  for (const char of text) {
    if (result.length + char.length > max - 1) break;
    result += char;
  }
  return `${result}…`;
}

export function formatMemberCount(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "member" : "members"}`;
}

export function groupOptionLabel(group: UserGroup) {
  const parts = [`@${group.handle || group.id}`];
  if (group.name && group.name !== group.handle) parts.push(`(${group.name})`);
  if (group.userCount !== undefined) {
    parts.push(`· ${formatMemberCount(group.userCount)}`);
  }
  return truncate(parts.join(" "), MAX_OPTION_TEXT);
}

// Options for the group picker. If the query looks like a group ID that isn't
// in the list (e.g. a group the cache hasn't picked up yet), it is offered as
// a raw ID so it can still be selected.
export function groupOptions(groups: UserGroup[], query: string) {
  const matches = searchGroups(groups, query);
  const options = matches.map((group) => ({
    text: groupOptionLabel(group),
    value: group.id,
  }));

  const id = parseGroupId(query);
  if (id && !matches.some((group) => group.id === id)) {
    options.unshift({ text: `Use group ID ${id}`, value: id });
    options.splice(MAX_OPTIONS);
  }

  return options;
}

// Looks a group up by ID, falling back to the API for groups that aren't in
// the cache. Returns undefined if the group doesn't exist.
export async function resolveGroup(
  groupId: string,
): Promise<UserGroup | undefined> {
  try {
    const cached = (await getGroups()).byId.get(groupId);
    if (cached) return cached;
  } catch (err) {
    console.error("[usergroups] failed to list groups", err);
  }

  const result = await api.selfbot("usergroups.users.list", {
    usergroup: groupId,
  });
  if (!result.ok) return undefined;

  return {
    id: groupId,
    handle: "",
    name: "",
    userCount: result.users?.length,
  };
}

export async function getMemberCount(groupId: string) {
  try {
    return (await resolveGroup(groupId))?.userCount;
  } catch (err) {
    console.error(`[usergroups] failed to get member count for ${groupId}`, err);
    return undefined;
  }
}
