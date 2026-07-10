import type { SocketModeClient } from "@slack/socket-mode";
import type { WebClient } from "@slack/web-api";
import type { WebSocket } from "bun";
import { registerSlashCommands } from "./handlers/slash-commands";
import { registerSelfbotEvents } from "./handlers/selfbot-events";

export function registerEvents(web: WebClient, socketModeClient: SocketModeClient, selfbotSocket: WebSocket) {
  registerSlashCommands(web, socketModeClient)
  registerSelfbotEvents(selfbotSocket)
}
