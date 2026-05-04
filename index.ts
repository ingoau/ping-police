import type { Event } from "./types";

const websocketUrl = new URL("wss://wss-primary.slack.com/");
websocketUrl.searchParams.set("token", process.env.SLACK_SELFBOT_XOXC || "");

const socket = new WebSocket(websocketUrl.toString(), {
  headers: {
    Cookie: `d=${process.env.SLACK_SELFBOT_XOXD || ""}`,
  },
});

socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data) as Event;
  if (data.type === "user_typing") {
    console.log(data);
  }
});
