import { createClients } from "./slack/clients";
import { registerEvents } from "./slack/register-events";

const { app, selfbotSocket } = createClients();

registerEvents(app, selfbotSocket);

process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandled rejection:", reason);
});
process.on("uncaughtException", (reason) => {
  console.error("[process] uncaught exception:", reason);
});

await app.start();
