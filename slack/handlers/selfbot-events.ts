import type { Event } from "@/slack/types/events";
import * as threads from "@/db/threads";
import * as configs from "@/db/configs";
import { blocks, context, mrkdwn, section, type App } from "slack.ts";

const SUBTEAM_RE = /<!subteam\^([A-Z0-9]+)(?:\|[^>]*)?>/g;

// channel:thread_ts:user
const ephemerals = new Map<string, number>();
const EPHEMRAL_TTL_MS = 60 * 1000;

export function registerSelfbotEvents(socket: WebSocket, app: App<"socket">) {
  socket.addEventListener("message", async (event) => {
    const logError = (msg: string, err?: unknown) =>
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

    if (
      eventData.type === "message" &&
      (!eventData.subtype /* Regular message */ ||
        eventData.subtype === "bot_message" ||
        eventData.subtype === "thread_broadcast")
    ) {
      try {
        await threads.store({
          ts: eventData.thread_ts || eventData.ts,
          channelId: eventData.channel,
          mentionedGroups: [...(eventData.text ?? "").matchAll(SUBTEAM_RE)].map(
            (m) => m[1]!,
          ),
        });
      } catch (err) {
        logError(`failed to store thread`, err);
      }
    }

    if (eventData.type === "user_typing") {
      let messages: string[] = [];
      try {
        if (!eventData.thread_ts) return;
        const mentionedGroups = await threads.getMentionedGroups(
          eventData.thread_ts,
          eventData.channel,
        );
        const appliedConfigs = (
          await configs.get(eventData.channel, mentionedGroups)
        ).filter((config) => config.enabled);

        messages = appliedConfigs.map(
          (config) => `${config.message} (<!subteam^${config.groupId}>)`,
        );
      } catch (err) {
        logError(`failed to fetch group configs`, err);
      }

      if (messages.length === 0) return;

      const key = `${eventData.channel}:${eventData.thread_ts}:${eventData.user}`;
      const existingTimestamp = ephemerals.get(key);
      if (existingTimestamp !== undefined && existingTimestamp > Date.now()) {
        ephemerals.delete(key);
        return;
      }

      try {
        await app.channel(eventData.channel).send({
          ephemeral: true,
          blocks: blocks(
            section(mrkdwn(messages.join("\n"))),
            context(
              mrkdwn(
                "This message is provided by a manager of this channel · DM <@U0923H02Y3B> to report it",
              ),
            ),
          ),
          user: eventData.user,
          thread_ts: eventData.thread_ts,
        });

        ephemerals.set(key, Date.now() + EPHEMRAL_TTL_MS);
      } catch (err) {
        logError(`failed to send ephemeral message`, err);
      }
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
