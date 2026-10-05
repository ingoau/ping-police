export const COUNT_PLACEHOLDER = "{count}";

// Stored in place of a user group ID for the warning shown to anyone starting a
// new message in the channel. User group IDs are uppercase, so it can't clash.
export const CHANNEL_TARGET = "channel";

export const DEFAULT_MESSAGE = `Heads up: replying in this thread will notify everyone in this group (${COUNT_PLACEHOLDER} people). Please only reply here if they all need to see it.`;

export const DEFAULT_CHANNEL_MESSAGE = `Heads up: this channel has ${COUNT_PLACEHOLDER} members, and many of them get notified about every new message. Please only post here if everyone needs to see it, and keep replies in threads.`;

// Used in place of the member count when it can't be looked up
const UNKNOWN_COUNT = "lots of";

export function isChannelTarget(groupId: string | null | undefined) {
  return groupId === CHANNEL_TARGET;
}

// How a group (or the whole channel) is referred to in settings and stats
export function targetLabel(groupId: string) {
  return isChannelTarget(groupId) ? "Whole channel" : `<!subteam^${groupId}>`;
}

export function defaultMessage(groupId?: string | null) {
  return isChannelTarget(groupId) ? DEFAULT_CHANNEL_MESSAGE : DEFAULT_MESSAGE;
}

export function hasCustomMessage(message: string | null | undefined) {
  return !!message?.trim();
}

export function resolveMessage(
  message: string | null | undefined,
  groupId?: string | null,
) {
  return hasCustomMessage(message) ? message! : defaultMessage(groupId);
}

export function usesCount(
  message: string | null | undefined,
  groupId?: string | null,
) {
  return resolveMessage(message, groupId).includes(COUNT_PLACEHOLDER);
}

// Turns a group's configured message into the line shown to someone typing
// in a thread that will notify the group, or in a channel with a whole-channel
// warning.
export function renderWarning(
  message: string | null | undefined,
  groupId: string,
  memberCount?: number,
) {
  const count =
    memberCount === undefined
      ? UNKNOWN_COUNT
      : memberCount.toLocaleString("en-US");
  const text = resolveMessage(message, groupId).replaceAll(
    COUNT_PLACEHOLDER,
    count,
  );
  return isChannelTarget(groupId) ? text : `${text} (<!subteam^${groupId}>)`;
}
