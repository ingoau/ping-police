import getChannelInfo from "../channel-info";
import {
  manageGroupSettingsModal,
  manageSettingsModal,
  notSetUp,
  privateChannelInitialSetup,
  publicChannelInitialSetup,
} from "../blocks";
import { blocks, R, richText, type App } from "slack.ts";
import addBots from "../add-bots";
import * as configs from "@/db/configs";
import * as selfbot from "@/slack/selfbot";

async function handleEvent(
  name: string,
  event: unknown,
  handler: () => Promise<void> | void,
) {
  try {
    await handler();
  } catch (err) {
    console.error(
      `[bot] failed to handle ${name}`,
      err,
      `\nEvent data: ${JSON.stringify(event)}`,
    );
  }
}

export function registerBotEvents(app: App<"socket">) {
  for (const command of ["/ping-police", "/dev-ping-police"] as const) {
    app.on(command, (slash) => handleEvent(command, slash, async () => {
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

      await slash.respond.modal(
        manageSettingsModal(
          slash.channel_id,
          channelConfigs,
          channelInfo.managerIds.includes(slash.user_id),
        ),
      );
    }));
  }
  app.on("action.dismiss", (action) =>
    handleEvent("action.dismiss", action, () => action.respond.delete()),
  );
  app.on("action.setup", (action) => handleEvent("action.setup", action, async () => {
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
  }));
  app.on("action.add_bots", (action) => handleEvent("action.add_bots", action, async () => {
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
  }));
  app.on("action.manual_add_prompt", (action) => handleEvent("action.manual_add_prompt", action, async () => {
    await action.respond.edit({
      text: "Ok, once you've added the bots, run /ping-police to get started!",
    });
  }));
  app.on("action:button.edit_config", (action) => handleEvent("action:button.edit_config", action, async () => {
    if (!action.value) return;

    const [groupId, channelId] = action.value.split(":");
    if (!groupId || !channelId) return;

    const managerIds = await selfbot.getManagers(channelId);

    if (
      // user not CM
      !managerIds.includes(action.event.user.id)
    )
      return;

    const [config] = await configs.get(channelId, [groupId]);
    if (!config) return;

    await app.request("views.push", {
      trigger_id: action.event.trigger_id,
      view: manageGroupSettingsModal(config),
    });
  }));

  app.on("action:button.add_group", (action) => handleEvent("action:button.add_group", action, async () => {
    if (!action.value) return;

    const managerIds = await selfbot.getManagers(action.value);
    if (!managerIds.includes(action.event.user.id)) return;

    await app.request("views.push", {
      trigger_id: action.event.trigger_id,
      view: manageGroupSettingsModal({ channelId: action.value }),
    });
  }));

  app.on("action:button.toggle_enabled", (action) => handleEvent("action:button.toggle_enabled", action, async () => {
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
      view: manageGroupSettingsModal(config),
    });
    await app.request("views.update", {
      view_id: action.event.view?.root_view_id,
      view: manageSettingsModal(channelId, await configs.list(channelId), true),
    });
  }));
  app.on("action:button.delete", (action) => handleEvent("action:button.delete", action, async () => {
    if (!action.value) return;

    const [groupId, channelId] = action.value.split(":");

    if (!groupId || !channelId) return;

    const managerIds = await selfbot.getManagers(channelId);

    if (
      // user not CM
      !managerIds.includes(action.event.user.id)
    )
      return;

    await configs.deleteConfig(channelId, groupId);
    await app.request("views.update", {
      view_id: action.event.view?.root_view_id,
      view: manageSettingsModal(channelId, await configs.list(channelId), true),
    });
    await app.request("views.update", {
      view_id: action.event.view?.id,
      view: {
        title: { type: "plain_text" as const, text: "Ping Police" },
        type: "modal" as const,
        close: { type: "plain_text" as const, text: "Back" },
        blocks: blocks(richText(R.section("User group has been removed"))),
      },
    });
  }));
  app.on("submit.edit_group_settings", (submission) => handleEvent("submit.edit_group_settings", submission, async () => {
    let [groupId, channelId] = submission.view.private_metadata.split(":");

    const values = submission.view.state.values as Record<
      string,
      Record<string, { type: string; value?: string }>
    >;

    groupId ||= values.group_id_input?.group_id?.value ?? "";
    const input = values.message_input?.message;

    if (
      !groupId ||
      !channelId ||
      input?.type !== "plain_text_input" ||
      input.value === undefined
    )
      return;

    const message = input.value;

    await configs.updateOrCreate({
      channelId,
      groupId,
      message,
    });

    if (submission.view.root_view_id) {
      await app.request("views.update", {
        view_id: submission.view.root_view_id,
        view: manageSettingsModal(
          channelId,
          await configs.list(channelId),
          true,
        ),
      });
    }
  }));
}
