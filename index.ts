import { createClients, createSelfbotSocket } from "./slack/clients";
import { registerBotEvents } from "./slack/handlers/bot-events";
import { registerSelfbotEvents } from "./slack/handlers/selfbot-events";
import { getGroups } from "./slack/usergroups";

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

// Warm the user group cache so the first group search answers quickly
getGroups().catch((err) =>
  console.error("[usergroups] failed to load user groups", err),
);

await app.start();
