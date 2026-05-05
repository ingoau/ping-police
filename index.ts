import type { Event, TypingEvent } from "./types";

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
    console.log(typingEventData);
  }
});
