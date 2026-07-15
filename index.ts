import { createClients } from "./slack/clients";
import { registerEvents } from "./slack/register-events";

const { app, selfbotSocket } = createClients();

registerEvents(app, selfbotSocket);

await app.start();
