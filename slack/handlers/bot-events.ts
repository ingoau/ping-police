import getChannelInfo from "../channel-info";
import {
  manageSettings,
  notSetUp,
  privateChannelInitialSetup,
  publicChannelInitialSetup,
} from "../blocks";
import { Action, type App, type SlashCommandInstance } from "slack.ts";
import addBots from "../add-bots";

export function registerBotEvents(app: App<"socket">) {
  app.on("/ping-police", handlePingPoliceCommand);
  app.on("/dev-ping-police", handlePingPoliceCommand);
  app.on("action.dismiss", (action) => {
    action.respond.delete();
  });
  app.on("action.setup", setupAction);
  app.on("action.add_bots", addBotsAction);
  app.on("action.manual_add_prompt", manualAddPromptAction);
}

async function handlePingPoliceCommand(slash: SlashCommandInstance) {
  if (!slash.channel_id.startsWith("C")) {
    await slash.respond.message({
      text: "This command can only be used in a channel.",
    });
    return;
  }

  const channelInfo = await getChannelInfo(slash.channel_id);

  // If both bots are not in channel
  if (!(channelInfo.inChannel && channelInfo.selfbotInChannel)) {
    await slash.respond.message({
      blocks: notSetUp(slash.channel_id),
      ephemeral: true,
    });
    return;
  }

  await slash.respond.message({
    blocks: manageSettings(slash.channel_id, [], true),
    ephemeral: true,
  });
}

async function setupAction(action: Action) {
  if (!action.event.channel || !action.event.channel.id.startsWith("C")) return;
  const channelInfo = await getChannelInfo(action.event.channel.id);
  if (
    // user must be a CM or the channel must be private for code to continue
    !(
      channelInfo.managerIds.includes(action.event.user.id) ||
      channelInfo.private
    ) ||
    // already added
    (channelInfo.inChannel && channelInfo.selfbotInChannel)
  )
    return;

  if (channelInfo.private) {
    await action.respond.edit({ blocks: privateChannelInitialSetup() });
  } else {
    await action.respond.edit({
      blocks: publicChannelInitialSetup(action.event.channel.id),
    });
  }
}

async function addBotsAction(action: Action) {
  if (!action.event.channel || !action.event.channel.id.startsWith("C")) return;
  const channelInfo = await getChannelInfo(action.event.channel.id);
  if (
    // user not CM
    !channelInfo.managerIds.includes(action.event.user.id)
  )
    return;

  await addBots(action.event.channel.id);

  await action.respond.edit({
    text: "I've added the bots to your channel! Run /ping-police to get started.",
  });
}

async function manualAddPromptAction(action: Action) {
  await action.respond.edit({
    text: "Ok, once you've added the bots, run /ping-police to get started!",
  });
}
