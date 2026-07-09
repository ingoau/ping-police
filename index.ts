import type {
  Event,
  SlashCommandEvent,
  TypingEvent,
} from "@/slack/types/events";
import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";

const token = process.env.SLACK_TOKEN;
const appToken = process.env.SLACK_APP_TOKEN!;

const web = new WebClient(token);
const socketModeClient = new SocketModeClient({ appToken });

const websocketUrl = new URL("wss://wss-primary.slack.com/");
websocketUrl.searchParams.set("token", process.env.SLACK_SELFBOT_XOXC || "");

const socket = new WebSocket(websocketUrl.toString(), {
  headers: {
    Cookie: `d=${process.env.SLACK_SELFBOT_XOXD || ""}`,
  },
});

socketModeClient.on("slash_commands", async (event: SlashCommandEvent) => {
  console.log(event);
  const conversationInfo = await web.conversations.info({
    channel: event.body.channel_id,
  });
  await fetch(event.body.response_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: JSON.stringify(conversationInfo) }),
  });
  // web.chat.postEphemeral({
  //   channel: event.body.channel_id,
  //   text: "Kevin",
  //   user: event.body.user_id,
  // });
  await event.ack();
});

socket.addEventListener("message", (event) => {
  const eventData = JSON.parse(event.data) as Event;
  // if (eventData.type === "user_typing") {
  //   const typingEventData = eventData as TypingEvent;
  //   if (typingEventData.channel === "C0BEVRMGY23") {
  //     web.chat.postEphemeral({
  //       channel: typingEventData.channel,
  //       text: "HEY STOP",
  //       user: typingEventData.user,
  //       thread_ts: typingEventData.thread_ts,
  //     });
  //   }
  //   console.log(typingEventData);
  // }
  if (eventData.type === "ping") {
    socket.send(JSON.stringify({ type: "pong", reply_to: eventData.id }));
  }
});

await socketModeClient.start();
