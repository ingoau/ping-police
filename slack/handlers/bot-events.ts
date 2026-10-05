import getChannelInfo from "../channel-info";
import {
  manageGroupSettingsModal,
  notSetUp,
  privateChannelInitialSetup,
  publicChannelInitialSetup,
} from "../blocks";
import { blocks, option, R, richText, type App } from "slack.ts";
import addBots from "../add-bots";
import * as configs from "@/db/configs";
import * as selfbot from "@/slack/selfbot";
import * as usergroups from "@/slack/usergroups";
import * as analytics from "@/db/analytics";
import * as views from "@/slack/views";
import { CHANNEL_TARGET, isChannelTarget } from "@/slack/warning";

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
    app.on(command, (slash) =>
      handleEvent(command, slash, async () => {
        if (slash.text.trim() === "stats") {
          await slash.respond.message({
            text: "Ping Police stats",
            blocks: await views.stats(
              slash.channel_id.startsWith("C") ? slash.channel_id : undefined,
            ),
            ephemeral: true,
          });
          return;
        }

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

        await slash.respond.modal(
          await views.settingsModal(
            slash.channel_id,
            channelInfo.managerIds.includes(slash.user_id),
          ),
        );
      }),
    );
  }
  app.on("action.dismiss", (action) =>
    handleEvent("action.dismiss", action, () => action.respond.delete()),
  );
  app.on("action.setup", (action) =>
    handleEvent("action.setup", action, async () => {
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
    }),
  );
  app.on("action.add_bots", (action) =>
    handleEvent("action.add_bots", action, async () => {
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
    }),
  );
  app.on("action.manual_add_prompt", (action) =>
    handleEvent("action.manual_add_prompt", action, async () => {
      await action.respond.edit({
        text: "Ok, once you've added the bots, run /ping-police to get started!",
      });
    }),
  );
  app.on("action:button.edit_config", (action) =>
    handleEvent("action:button.edit_config", action, async () => {
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
    }),
  );

  app.on("action:button.add_group", (action) =>
    handleEvent("action:button.add_group", action, async () => {
      if (!action.value) return;

      const managerIds = await selfbot.getManagers(action.value);
      if (!managerIds.includes(action.event.user.id)) return;

      await app.request("views.push", {
        trigger_id: action.event.trigger_id,
        view: manageGroupSettingsModal({ channelId: action.value }),
      });
    }),
  );

  app.on("action:button.add_channel_warning", (action) =>
    handleEvent("action:button.add_channel_warning", action, async () => {
      if (!action.value) return;

      const managerIds = await selfbot.getManagers(action.value);
      if (!managerIds.includes(action.event.user.id)) return;

      // Saving this modal creates the whole-channel warning
      await app.request("views.push", {
        trigger_id: action.event.trigger_id,
        view: manageGroupSettingsModal({
          channelId: action.value,
          groupId: CHANNEL_TARGET,
        }),
      });
    }),
  );

  app.on("action:button.toggle_enabled", (action) =>
    handleEvent("action:button.toggle_enabled", action, async () => {
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
        view: await views.settingsModal(channelId, true),
      });
    }),
  );
  app.on("action:button.delete", (action) =>
    handleEvent("action:button.delete", action, async () => {
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
        view: await views.settingsModal(channelId, true),
      });
      await app.request("views.update", {
        view_id: action.event.view?.id,
        view: {
          title: { type: "plain_text" as const, text: "Ping Police" },
          type: "modal" as const,
          close: { type: "plain_text" as const, text: "Back" },
          blocks: blocks(
            richText(
              R.section(
                isChannelTarget(groupId)
                  ? "Channel warning has been removed"
                  : "User group has been removed",
              ),
            ),
          ),
        },
      });
    }),
  );
  app.on("action:button.toggle_analytics", (action) =>
    handleEvent("action:button.toggle_analytics", action, async () => {
      const channelId = action.value;
      if (!channelId) return;

      const managerIds = await selfbot.getManagers(channelId);
      if (!managerIds.includes(action.event.user.id)) return;

      await analytics.toggle(channelId);

      await app.request("views.update", {
        view_id: action.event.view?.id,
        view: await views.settingsModal(channelId, true),
      });
    }),
  );
  app.on("autocomplete.group_select", (autocomplete) =>
    handleEvent("autocomplete.group_select", autocomplete, async () => {
      let groups: usergroups.UserGroup[] = [];
      try {
        // Slack gives up on option requests after 3 seconds
        groups = (
          await Promise.race([
            usergroups.getGroups(),
            Bun.sleep(2_000).then(() => {
              throw new Error("timed out loading user groups");
            }),
          ])
        ).groups;
      } catch (err) {
        // Still let people pick a pasted group ID if the list can't be loaded
        console.error("[bot] failed to list user groups", err);
      }

      const options = usergroups.groupOptions(groups, autocomplete.raw.value);
      console.log(
        `[bot] group search ${JSON.stringify(autocomplete.raw.value)}: ${options.length} options from ${groups.length} groups`,
      );
      await autocomplete.respond(
        ...options.map((o) => option(o.text, o.value)),
      );
    }),
  );
  app.on("submit.edit_group_settings", (submission) =>
    handleEvent("submit.edit_group_settings", submission, async () => {
      const [existingGroupId, channelId] =
        submission.view.private_metadata.split(":");
      const isNewGroup = !existingGroupId;

      const values = submission.view.state.values as Record<
        string,
        Record<
          string,
          {
            type: string;
            value?: string | null;
            selected_option?: { value?: string } | null;
          }
        >
      >;

      const selectedGroup =
        values.group_select_input?.group_select?.selected_option?.value;
      const groupId = existingGroupId || selectedGroup;
      const input = values.message_input?.message;

      if (!groupId || !channelId || input?.type !== "plain_text_input") return;

      // The modal has already closed, so problems are shown as a notice on the
      // settings modal underneath it
      const showNotice = async (notice: string, isManager = true) => {
        if (!submission.view.root_view_id) return;
        await app.request("views.update", {
          view_id: submission.view.root_view_id,
          view: await views.settingsModal(channelId, isManager, notice),
        });
      };

      // Only channel managers can change settings
      const managerIds = await selfbot.getManagers(channelId);
      if (!managerIds.includes(submission.user.id)) {
        await showNotice(
          "Only channel managers can change these settings, so your changes weren't saved.",
          false,
        );
        return;
      }

      // An empty message means the group uses the default message
      const message = input.value?.trim() ? input.value : null;

      if (isNewGroup) {
        let group;
        try {
          group = await usergroups.resolveGroup(groupId);
        } catch (err) {
          console.error(`[bot] failed to look up user group ${groupId}`, err);
          await showNotice(
            "Couldn't check that user group right now, so it wasn't added. Please try again in a minute.",
          );
          return;
        }
        if (!group) {
          await showNotice(
            `Couldn't find a user group with the ID \`${groupId}\`, so it wasn't added.`,
          );
          return;
        }
        if ((await configs.get(channelId, [groupId])).length > 0) {
          await showNotice(
            `<!subteam^${groupId}> is already set up in this channel. Use its Edit button to change it.`,
          );
          return;
        }
      }

      await configs.updateOrCreate({
        channelId,
        groupId,
        message,
      });

      if (submission.view.root_view_id) {
        await app.request("views.update", {
          view_id: submission.view.root_view_id,
          view: await views.settingsModal(channelId, true),
        });
      }
    }),
  );
}
