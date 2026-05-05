import type { Event, TypingEvent } from "./types";
import { WebClient } from "@slack/web-api";

const token = process.env.SLACK_TOKEN;

const web = new WebClient(token);

const websocketUrl = new URL("wss://wss-primary.slack.com/");
websocketUrl.searchParams.set("token", process.env.SLACK_SELFBOT_XOXC || "");

const socket = new WebSocket(websocketUrl.toString(), {
  headers: {
    Cookie: `d=${process.env.SLACK_SELFBOT_XOXD || ""}`,
  },
});

socket.addEventListener("message", (event) => {
  const eventData = JSON.parse(event.data) as Event;
  if (eventData.type === "user_typing") {
    const typingEventData = eventData as TypingEvent;
    web.chat.postEphemeral({
      channel: typingEventData.channel,
      text: "HEY STOP",
      user: typingEventData.user,
      thread_ts: typingEventData.thread_ts,
    });
    console.log(typingEventData);
  }
});
