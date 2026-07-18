import { createClients, createSelfbotSocket } from "./slack/clients";
import { registerBotEvents } from "./slack/handlers/bot-events";
import { registerSelfbotEvents } from "./slack/handlers/selfbot-events";

const { app } = createClients();

registerBotEvents(app);
createSelfbotSocket((socket) => {
  registerSelfbotEvents(socket, app);
});

process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandled rejection:", reason);
});
process.on("uncaughtException", (reason) => {
  console.error("[process] uncaught exception:", reason);
});

await app.start();
