import type {
  Event,
  SlashCommandEvent,
  TypingEvent,
} from "@/slack/types/events";
import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";
import { registerSlashCommands } from "./slack/handlers/slash-commands";
import { registerSelfbotEvents } from "./slack/handlers/selfbot-events";

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
registerSelfbotEvents(socket);

await socketModeClient.start();
