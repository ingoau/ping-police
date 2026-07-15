import type { SocketModeClient } from "@slack/socket-mode";
import type { WebClient } from "@slack/web-api";
import type { SlashCommandEvent } from "../types/events";
import getChannelInfo from "../channel-info";
import { notSetUp } from "../blocks";
import type { App, SlashCommandInstance } from "slack.ts";

export function registerSlashCommands(app: App<"socket">) {
  app.on("/ping-police", handlePingPoliceCommand);
  app.on("/dev-ping-police", handlePingPoliceCommand);
}

async function handlePingPoliceCommand(slash: SlashCommandInstance) {
  if (!slash.channel_id.startsWith("C")) {
    await slash.respond.message({
      text: "This command can only be used in a channel.",
    });
    return;
  }

  const channelInfo = await getChannelInfo(slash.channel_id);

  await slash.respond.message({ blocks: notSetUp(), ephemeral: true });
}
