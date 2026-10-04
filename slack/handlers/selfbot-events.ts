import type { MessageEvent } from "@slack/web-api";
import type { Event, TypingEvent } from "@/slack/types/events";
import * as threads from "@/db/threads";
import * as configs from "@/db/configs";
import * as analytics from "@/db/analytics";
import { blocks, context, mrkdwn, section, type App } from "slack.ts";
import { env } from "@/env";
import { Cooldowns } from "@/slack/cooldowns";
import { getMemberCount } from "@/slack/usergroups";
import { renderWarning, usesCount } from "@/slack/warning";

const SUBTEAM_RE = /<!subteam\^([A-Z0-9]+)(?:\|[^>]*)?>/g;

export function extractMentionedGroups(text: string) {
  return [...text.matchAll(SUBTEAM_RE)].map((m) => m[1]!);
}

// keyed by channel:thread_ts:user
const EPHEMERAL_TTL_MS = 60 * 1000;
const ephemerals = new Cooldowns(EPHEMERAL_TTL_MS);

export function clearCooldowns() {
  ephemerals.sweep(Infinity);
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

  // A reply in a thread notifies everyone subscribed to it, so if the author
  // was warned about this thread they've ignored the warning
  const userId = "user" in message ? message.user : undefined;
  if (threadTs && threadTs !== message.ts && userId) {
    try {
      await analytics.markIgnored({
        channelId: message.channel,
        threadTs,
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
    threadTs: string;
    blocks: ReturnType<typeof warningBlocks>;
  }) => Promise<unknown>,
  logError: Logger,
) {
  const threadTs = typing.thread_ts;
  if (!threadTs) return;

  const key = `${typing.channel}:${threadTs}:${typing.user}`;
  if (ephemerals.isActive(key)) return;
  // Claim the cooldown before any async work, so typing events that arrive
  // while the member count is being looked up don't send duplicate warnings
  ephemerals.start(key);

  let groupIds: string[] = [];
  let messages: string[] = [];
  try {
    const mentionedGroups = await threads.getMentionedGroups(
      threadTs,
      typing.channel,
    );
    if (mentionedGroups.length === 0) {
      ephemerals.clear(key);
      return;
    }

    const appliedConfigs = (
      await configs.get(typing.channel, mentionedGroups)
    ).filter((config) => config.enabled);

    groupIds = appliedConfigs.map((config) => config.groupId);
    messages = await Promise.all(
      appliedConfigs.map(async (config) =>
        renderWarning(
          config.message,
          config.groupId,
          usesCount(config.message)
            ? await getMemberCount(config.groupId)
            : undefined,
        ),
      ),
    );
  } catch (err) {
    logError(`failed to fetch group configs`, err);
  }

  if (messages.length === 0) {
    ephemerals.clear(key);
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
    ephemerals.clear(key);
    logError(`failed to send ephemeral message`, err);
    return;
  }

  try {
    await analytics.recordWarnings({
      channelId: typing.channel,
      threadTs,
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
