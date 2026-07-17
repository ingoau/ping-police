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
    const eventData = JSON.parse(event.data) as Event;
    if (
      eventData.type === "message" &&
      (!eventData.subtype /* Regular message */ ||
        eventData.subtype === "bot_message" ||
        eventData.subtype === "thread_broadcast")
    ) {
      await threads.store({
        ts: eventData.thread_ts || eventData.ts,
        channelId: eventData.channel,
        mentionedGroups: [...(eventData.text ?? "").matchAll(SUBTEAM_RE)].map(
          (m) => m[1]!,
        ),
      });
    }
    if (eventData.type === "user_typing") {
      if (!eventData.thread_ts) return;
      const mentionedGroups = await threads.getMentionedGroups(
        eventData.thread_ts,
        eventData.channel,
      );
      const appliedConfigs = (
        await configs.get(eventData.channel, mentionedGroups)
      ).filter((config) => config.enabled);
      const messages = appliedConfigs.map(
        (config) => `${config.message} (<!subteam^${config.groupId}>)`,
      );
      if (messages.length === 0) return;

      const key = `${eventData.channel}:${eventData.thread_ts}:${eventData.user}`;
      const existingTimestamp = ephemerals.get(key);
      if (existingTimestamp !== undefined && existingTimestamp > Date.now())
        return;
      ephemerals.set(key, Date.now() + EPHEMRAL_TTL_MS);

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
    }
    if (eventData.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", reply_to: eventData.id }));
    }
  });
}
