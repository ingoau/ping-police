import type { SocketModeClient } from "@slack/socket-mode";
import type { WebClient } from "@slack/web-api";
import type { SlashCommandEvent } from "../types/events";
import getChannelInfo from "../channel-info";
import { notSetUp } from "../blocks";

export function registerSlashCommands(
  web: WebClient,
  socketModeClient: SocketModeClient,
) {
  socketModeClient.on("slash_commands", async (event: SlashCommandEvent) => {
    await event.ack();

    console.log(event);

    const respond = (body: any) => {
      return fetch(event.body.response_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    };

    if (!(
      event.body.command === "/ping-police" ||
      event.body.command === "/dev-ping-police"
    )) {
      return;
    }

    if (!event.body.channel_id.startsWith("C")) {
      await respond({
        text: "This command can only be used in a channel.",
      });
      return;
    }

    const channelInfo = await getChannelInfo(event.body.channel_id);

    await respond({
      blocks: notSetUp,
    });
  });
}
