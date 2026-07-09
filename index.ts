import type {
  Event,
  SlashCommandEvent,
  TypingEvent,
} from "@/slack/types/events";
import { createClients } from "./slack/clients";
import { registerSlashCommands } from "./slack/handlers/slash-commands";
import { registerSelfbotEvents } from "./slack/handlers/selfbot-events";

const { web, socketModeClient, socket } = createClients();

registerSlashCommands(web, socketModeClient);
registerSelfbotEvents(socket);

await socketModeClient.start();
