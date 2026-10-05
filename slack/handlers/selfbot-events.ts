import type { MessageEvent } from "@slack/web-api";
import type { Event, TypingEvent } from "@/slack/types/events";
import * as threads from "@/db/threads";
import * as configs from "@/db/configs";
import * as analytics from "@/db/analytics";
import { blocks, context, mrkdwn, section, type App } from "slack.ts";
import { env } from "@/env";
import { Cooldowns } from "@/slack/cooldowns";
import { getMemberCount } from "@/slack/usergroups";
import { getChannelMemberCount } from "@/slack/channel-members";
import {
  CHANNEL_TARGET,
  isChannelTarget,
  renderWarning,
  usesCount,
} from "@/slack/warning";

const SUBTEAM_RE = /<!subteam\^([A-Z0-9]+)(?:\|[^>]*)?>/g;

export function extractMentionedGroups(text: string) {
  return [...text.matchAll(SUBTEAM_RE)].map((m) => m[1]!);
}

// keyed by channel:thread_ts:user
const EPHEMERAL_TTL_MS = 60 * 1000;
const ephemerals = new Cooldowns(EPHEMERAL_TTL_MS);
// keyed by channel:user. People chatting in a busy channel would otherwise be
// warned about nearly every message, so whole-channel warnings wait longer.
const CHANNEL_EPHEMERAL_TTL_MS = 5 * 60 * 1000;
const channelEphemerals = new Cooldowns(CHANNEL_EPHEMERAL_TTL_MS);

export function clearCooldowns() {
  ephemerals.sweep(Infinity);
  channelEphemerals.sweep(Infinity);
}

type Logger = (msg: string, err?: unknown) => void;

export async function handleMessage(message: MessageEvent, logError: Logger) {
  if (
    message.subtype /* Regular messages have no subtype */ &&
    message.subtype !== "bot_message" &&
    message.subtype !== "thread_broadcast"
  ) {
    return;
  }

  const threadTs = "thread_ts" in message ? message.thread_ts : undefined;

  try {
    await threads.store({
      ts: threadTs || message.ts,
      channelId: message.channel,
      mentionedGroups: extractMentionedGroups(message.text ?? ""),
    });
  } catch (err) {
    logError(`failed to store thread`, err);
  }

  const userId = "user" in message ? message.user : undefined;
  if (!userId) return;

  // A reply in a thread notifies everyone subscribed to it, and a new message
  // in the channel (or a reply also sent to it) notifies everyone following
  // the channel. If the author was warned about either, they've ignored it.
  const postedIn: string[] = [];
  const isReply = !!threadTs && threadTs !== message.ts;
  if (isReply) postedIn.push(threadTs);
  if (!isReply || message.subtype === "thread_broadcast") {
    postedIn.push(analytics.TOP_LEVEL_TS);
  }

  for (const ts of postedIn) {
    try {
      await analytics.markIgnored({
        channelId: message.channel,
        threadTs: ts,
        userId,
      });
    } catch (err) {
      logError(`failed to record ignored warning`, err);
    }
  }
}

export function warningBlocks(messages: string[]) {
  // One section per group keeps each under Slack's 3000 character limit
  return blocks(
    ...messages.map((message) => section(mrkdwn(message))),
    context(
      mrkdwn(
        "This message is provided by a manager of this channel" +
          (env.REPORT_USER_ID
            ? ` · DM <@${env.REPORT_USER_ID}> to report it`
            : ""),
      ),
    ),
  );
}

export async function handleTyping(
  typing: TypingEvent,
  sendWarning: (warning: {
    channel: string;
    user: string;
    // Unset for whole-channel warnings
    threadTs?: string;
    blocks: ReturnType<typeof warningBlocks>;
  }) => Promise<unknown>,
  logError: Logger,
) {
  // Typing outside a thread starts a new message in the channel, which only
  // the whole-channel warning applies to
  const threadTs = typing.thread_ts;
  const cooldowns = threadTs ? ephemerals : channelEphemerals;

  const key = threadTs
    ? `${typing.channel}:${threadTs}:${typing.user}`
    : `${typing.channel}:${typing.user}`;
  if (cooldowns.isActive(key)) return;
  // Claim the cooldown before any async work, so typing events that arrive
  // while the member count is being looked up don't send duplicate warnings
  cooldowns.start(key);

  let groupIds: string[] = [];
  let messages: string[] = [];
  try {
    const targets = threadTs
      ? await threads.getMentionedGroups(threadTs, typing.channel)
      : [CHANNEL_TARGET];
    if (targets.length === 0) {
      cooldowns.clear(key);
      return;
    }

    const appliedConfigs = (
      await configs.get(typing.channel, targets)
    ).filter((config) => config.enabled);

    groupIds = appliedConfigs.map((config) => config.groupId);
    messages = await Promise.all(
      appliedConfigs.map(async (config) =>
        renderWarning(
          config.message,
          config.groupId,
          usesCount(config.message, config.groupId)
            ? await (isChannelTarget(config.groupId)
                ? getChannelMemberCount(typing.channel)
                : getMemberCount(config.groupId))
            : undefined,
        ),
      ),
    );
  } catch (err) {
    logError(`failed to fetch group configs`, err);
  }

  if (messages.length === 0) {
    cooldowns.clear(key);
    return;
  }

  try {
    await sendWarning({
      channel: typing.channel,
      user: typing.user,
      threadTs,
      blocks: warningBlocks(messages),
    });
  } catch (err) {
    cooldowns.clear(key);
    logError(`failed to send ephemeral message`, err);
    return;
  }

  try {
    await analytics.recordWarnings({
      channelId: typing.channel,
      threadTs: threadTs ?? analytics.TOP_LEVEL_TS,
      userId: typing.user,
      groupIds,
    });
  } catch (err) {
    logError(`failed to record warning`, err);
  }
}

export function registerSelfbotEvents(socket: WebSocket, app: App<"socket">) {
  const sendWarning: Parameters<typeof handleTyping>[1] = (warning) =>
    app.channel(warning.channel).send({
      ephemeral: true,
      blocks: warning.blocks,
      user: warning.user,
      thread_ts: warning.threadTs,
    });

  socket.addEventListener("message", async (event) => {
    const logError: Logger = (msg, err) =>
      console.error(
        `[selfbot] ${msg}`,
        err ?? "",
        `\nEvent data: ${JSON.stringify(eventData)}`,
      );

    let eventData: Event;

    try {
      eventData = JSON.parse(event.data);
    } catch (err) {
      logError(`failed to parse websocket message`, err);
      return;
    }

    if (eventData.type === "message") {
      await handleMessage(eventData, logError);
    }

    if (eventData.type === "user_typing") {
      await handleTyping(eventData, sendWarning, logError);
    }

    if (eventData.type === "ping") {
      try {
        socket.send(JSON.stringify({ type: "pong", reply_to: eventData.id }));
      } catch (err) {
        logError(`failed to send pong`, err);
      }
    }
  });
}
