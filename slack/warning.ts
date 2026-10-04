export const COUNT_PLACEHOLDER = "{count}";

export const DEFAULT_MESSAGE = `Heads up: replying in this thread will notify everyone in this group (${COUNT_PLACEHOLDER} people). Please only reply here if they all need to see it.`;

// Used in place of the member count when it can't be looked up
const UNKNOWN_COUNT = "lots of";

export function hasCustomMessage(message: string | null | undefined) {
  return !!message?.trim();
}

export function resolveMessage(message: string | null | undefined) {
  return hasCustomMessage(message) ? message! : DEFAULT_MESSAGE;
}

export function usesCount(message: string | null | undefined) {
  return resolveMessage(message).includes(COUNT_PLACEHOLDER);
}

// Turns a group's configured message into the line shown to someone typing
// in a thread that will notify the group.
export function renderWarning(
  message: string | null | undefined,
  groupId: string,
  memberCount?: number,
) {
  const count =
    memberCount === undefined
      ? UNKNOWN_COUNT
      : memberCount.toLocaleString("en-US");
  const text = resolveMessage(message).replaceAll(COUNT_PLACEHOLDER, count);
  return `${text} (<!subteam^${groupId}>)`;
}
