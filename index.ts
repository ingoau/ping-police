import type {
  Event,
  SlashCommandEvent,
  TypingEvent,
} from "@/slack/types/events";
import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";
import { registerSlashCommands } from "./slack/handlers/slash-commands";

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

registerSlashCommands(web, socketModeClient);

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
