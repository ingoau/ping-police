import type { SocketModeClient } from "@slack/socket-mode";
import type { WebClient } from "@slack/web-api";
import type { SlashCommandEvent } from "../types/events";

export function registerSlashCommands(
  web: WebClient,
  socketModeClient: SocketModeClient,
) {
  socketModeClient.on("slash_commands", async (event: SlashCommandEvent) => {
    await event.ack();

    console.log(event);

    if (!(
      event.body.command === "/ping-police" ||
      event.body.command === "/dev-ping-police"
    )) {
      return;
    }

    if (!event.body.channel_id.startsWith("C")) {
      await fetch(event.body.response_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: "This command can only be used in a channel.",
        }),
      });
      return;
    }
  });
}
