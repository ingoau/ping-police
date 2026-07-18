import getChannelInfo from "../channel-info";
import {
  manageGroupSettings,
  manageSettings,
  notSetUp,
  privateChannelInitialSetup,
  publicChannelInitialSetup,
} from "../blocks";
import { type App } from "slack.ts";
import addBots from "../add-bots";
import * as configs from "@/db/configs";
import * as selfbot from "@/slack/selfbot";

export function registerBotEvents(app: App<"socket">) {
  for (const command of ["/ping-police", "/dev-ping-police"] as const) {
    app.on(command, async (slash) => {
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

      const channelConfigs = await configs.list(slash.channel_id);

      await slash.respond.message({
        blocks: manageSettings(
          slash.channel_id,
          channelConfigs,
          channelInfo.managerIds.includes(slash.user_id),
        ),
        ephemeral: true,
      });
    });
  }
  app.on("action.dismiss", (action) => {
    action.respond.delete();
  });
  app.on("action.setup", async (action) => {
    if (!action.event.channel || !action.event.channel.id.startsWith("C"))
      return;
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
  });
  app.on("action.add_bots", async (action) => {
    if (!action.event.channel || !action.event.channel.id.startsWith("C"))
      return;
    const managerIds = await selfbot.getManagers(action.event.channel.id);
    if (
      // user not CM
      !managerIds.includes(action.event.user.id)
    )
      return;

    await addBots(action.event.channel.id);

    await action.respond.edit({
      text: "I've added the bots to your channel! Run /ping-police to get started.",
    });
  });
  app.on("action.manual_add_prompt", async (action) => {
    await action.respond.edit({
      text: "Ok, once you've added the bots, run /ping-police to get started!",
    });
  });
  app.on("action:button.edit_config", async (action) => {
    if (!action.event.channel || !action.value) return;

    const managerIds = await selfbot.getManagers(action.event.channel.id);

    if (
      // user not CM
      !managerIds.includes(action.event.user.id)
    )
      return;

    const [config] = await configs.get(action.event.channel.id, [action.value]);
    if (!config) return;

    await action.respond.modal({
      blocks: manageGroupSettings(config),
      title: { type: "plain_text", text: "Ping Police" },
      type: "modal",
      submit: {
        type: "plain_text",
        text: "Save",
      },
      close: {
        type: "plain_text",
        text: "Cancel",
      },
    });
  });

  app.on("action:button.toggle_enabled", async (action) => {
    if (!action.value) return;

    const [groupId, channelId] = action.value.split(":");

    if (!groupId || !channelId) return;

    const managerIds = await selfbot.getManagers(channelId);

    if (
      // user not CM
      !managerIds.includes(action.event.user.id)
    )
      return;

    await configs.toggle(channelId, groupId);
    const [config] = await configs.get(channelId, [groupId]);
    if (!config) return;

    await app.request("views.update", {
      view_id: action.event.view?.id,
      view: {
        blocks: manageGroupSettings(config),
        title: { type: "plain_text", text: "Ping Police" },
        type: "modal",
        submit: {
          type: "plain_text",
          text: "Save",
        },
        close: {
          type: "plain_text",
          text: "Cancel",
        },
      },
    });
  });
}
