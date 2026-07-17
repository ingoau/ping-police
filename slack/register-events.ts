import type { SocketModeClient } from "@slack/socket-mode";
import type { WebClient } from "@slack/web-api";
import type { WebSocket } from "bun";
import { registerBotEvents } from "./handlers/bot-events";
import { registerSelfbotEvents } from "./handlers/selfbot-events";
import type { App } from "slack.ts";

export function registerEvents(app: App<"socket">, selfbotSocket: WebSocket) {
  registerBotEvents(app);
  registerSelfbotEvents(selfbotSocket, app);
}
