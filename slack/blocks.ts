import type { groupConfigs } from "@/db/schema";
import {
  actions,
  blocks,
  button,
  divider,
  input,
  mrkdwn,
  plainTextInput,
  R,
  richText,
  section,
} from "slack.ts";

const PING_POLICE_USER_ID = "U0B29PM729E";
const SELF_BOT_USER_ID = "U0B18U7A9DH";
const CHANNEL_ID = "C0BEVRMGY23";
const USERGROUP_ID = "S0B1M8N1PLJ";

const textCodeBlock = (text: string) => {
  const builder = R.pre(R.text(text));
  const build = builder.build.bind(builder);
  builder.build = () =>
    ({ ...build(), language: "text" }) as ReturnType<typeof build>;
  return builder;
};

export const requiredMembersPrompt = (suffix: string) =>
  R.section(
    "To continue, you need to add ",
    R.user(PING_POLICE_USER_ID),
    " and ",
    R.user(SELF_BOT_USER_ID),
    suffix,
  );

// Setup flow stuff

export const notSetUp = (channelId: string) =>
  blocks(
    richText(
      R.section(
        "Ping Police is a bot to prevent people from pinging large groups of people. It does this by showing a warning as the user starts typing in a thread that will ping specified groups.",
      ),
    ),
    divider(),
    richText(
      R.section("Would you like to set up Ping Police in this channel?"),
    ),
    actions(
      button("Yes").value(channelId).id("setup").style("primary"),
      button("No").value(channelId).id("dismiss"),
    ),
  );

export const publicChannelInitialSetup = (channelId: string) =>
  blocks(
    richText(
      requiredMembersPrompt(
        " to the channel.\nWould you like me to do this for you?",
      ),
    ),
    actions(
      button("Do that for me").value(channelId).id("add_bots").style("primary"),
      button("I'll do it myself").id("manual_add_prompt"),
    ),
  );

export const privateChannelInitialSetup = () =>
  blocks(
    richText(
      requiredMembersPrompt(
        " to the channel.\nSince this is a private channel, you need to do it yourself.\nYou can run the following commands:",
      ),
      textCodeBlock("/invite @[Dev] Ping Police"),
      textCodeBlock("/invite @Ping Police (Selfbot)"),
      R.section("Then run /ping-police to get started"),
    ),
  );

// Settings
export const manageSettings = (
  channelId: string,
  configs: (typeof groupConfigs.$inferSelect)[],
  isManager: boolean,
) =>
  blocks(
    richText(
      R.section(
        `${isManager ? "Manage" : "View"} user group settings for `,
        R.channel(channelId),
        R.text(":"),
      ),
    ),
    ...configs.map((config) => {
      const block = section(
        `<!subteam^${config.groupId}> - ${config.enabled ? "Enabled" : "Disabled"}\n Message: \`${config.message}\``,
      );
      return isManager
        ? block.accessory(
            button("Edit")
              .value(`${config.groupId}:${channelId}`)
              .id("edit_config"),
          )
        : block;
    }),
    ...(isManager
      ? [actions(button("Add group").value(channelId).id("add_group"))]
      : []),
  );

export const manageSettingsModal = (
  channelId: string,
  configs: (typeof groupConfigs.$inferSelect)[],
  isManager: boolean,
) => ({
  blocks: manageSettings(channelId, configs, isManager),
  title: { type: "plain_text" as const, text: "Ping Police" },
  type: "modal" as const,
  close: { type: "plain_text" as const, text: "Close" },
});

const permissionDenied = () => ({
  blocks: blocks(
    richText(R.section("You must have channel manager to do this")),
  ),
});

export const manageGroupSettings = (
  config: typeof groupConfigs.$inferSelect,
) => {
  return blocks(
    richText(
      R.section(
        R.text("Manage settings for ").bold(),
        R.usergroup(config.groupId).bold(),
        R.text(" in ").bold(),
        R.channel(config.channelId).bold(),
        R.text(":").bold(),
      ),
    ),
    input(
      "Message",
      plainTextInput()
        .multiline()
        .id("message")
        .default(config.message || ""),
    ).optional(false),
    actions(
      button(config.enabled ? "Disable" : "Enable")
        .value(`${config.groupId}:${config.channelId}`)
        .id("toggle_enabled"),
      button("Delete")
        .value(`${config.groupId}:${config.channelId}`)
        .id("delete")
        .style("danger"),
    ),
  );
};

export const manageGroupSettingsModal = (
  config: typeof groupConfigs.$inferSelect,
) => ({
  blocks: manageGroupSettings(config),
  title: { type: "plain_text" as const, text: "Ping Police" },
  type: "modal" as const,
  submit: { type: "plain_text" as const, text: "Save" },
  close: { type: "plain_text" as const, text: "Cancel" },
});
