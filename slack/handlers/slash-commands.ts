import type { SocketModeClient } from "@slack/socket-mode";
import type { WebClient } from "@slack/web-api";
import type { SlashCommandEvent } from "../types/events";

export function registerSlashCommands(
  web: WebClient,
  socketModeClient: SocketModeClient,
) {
  socketModeClient.on("slash_commands", async (event: SlashCommandEvent) => {
    console.log(event);
    const conversationInfo = await web.conversations.info({
      channel: event.body.channel_id,
    });
    await fetch(event.body.response_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: JSON.stringify(conversationInfo) }),
    });
    // web.chat.postEphemeral({
    //   channel: event.body.channel_id,
    //   text: "Kevin",
    //   user: event.body.user_id,
    // });
    await event.ack();
  });
}
