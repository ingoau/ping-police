import type { Event } from "@/slack/types/events";
import * as threads from "@/db/threads";
import * as configs from "@/db/configs";

const SUBTEAM_RE = /<!subteam\^([A-Z0-9]+)(?:\|[^>]*)?>/g;

export function registerSelfbotEvents(socket: WebSocket) {
  socket.addEventListener("message", async (event) => {
    const eventData = JSON.parse(event.data) as Event;
    if (
      eventData.type === "message" &&
      (!eventData.subtype /* Regular message */ ||
        eventData.subtype === "bot_message" ||
        eventData.subtype === "thread_broadcast")
    ) {
      threads.store({
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
      const messages = appliedConfigs.map((config) => config.message);
      console.log(messages.join("\n"));
    }
    if (eventData.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", reply_to: eventData.id }));
    }
  });
}
