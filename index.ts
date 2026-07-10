import { createClients } from "./slack/clients";
import { registerEvents } from "./slack/register-events";

const { web, socketModeClient, selfbotSocket} = createClients();

registerEvents(web, socketModeClient, selfbotSocket)

await socketModeClient.start();
