import type { groupConfigs } from "@/db/schema";
import { env } from "@/env";
import { COUNT_PLACEHOLDER, DEFAULT_MESSAGE, hasCustomMessage } from "./warning";
import {
  actions,
  blocks,
  button,
  divider,
  input,
  plainTextInput,
  R,
  richText,
  section,
} from "slack.ts";

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
    R.user(env.PING_POLICE_USER_ID),
    " and ",
    R.user(env.SELF_BOT_USER_ID),
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
      textCodeBlock("/invite @Ping Police"),
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
        `<!subteam^${config.groupId}> - ${config.enabled ? "Enabled" : "Disabled"}\n Message: ${
          hasCustomMessage(config.message)
            ? `\`${config.message}\``
            : "_default_"
        }`,
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
  config: Pick<typeof groupConfigs.$inferSelect, "channelId"> &
    Partial<typeof groupConfigs.$inferSelect>,
) => {
  return blocks(
    richText(
      config.groupId
        ? R.section(
            R.text("Manage settings for ").bold(),
            R.usergroup(config.groupId).bold(),
            R.text(" in ").bold(),
            R.channel(config.channelId).bold(),
            R.text(":").bold(),
          )
        : R.section("Add a user group in ", R.channel(config.channelId)),
    ),
    ...(config.groupId
      ? []
      : [
          input("Group ID", plainTextInput().id("group_id"))
            .id("group_id_input")
            .optional(false),
        ]),
    input(
      "Message",
      plainTextInput()
        .multiline()
        .id("message")
        .placeholder("Leave empty to use the default message")
        .default(config.message || ""),
    )
      .id("message_input")
      .hint(
        `Use ${COUNT_PLACEHOLDER} to include how many people are in the group. Default message: ${DEFAULT_MESSAGE}`,
      )
      .optional(true),
    ...(config.groupId
      ? [
          actions(
            button(config.enabled ? "Disable" : "Enable")
              .value(`${config.groupId}:${config.channelId}`)
              .id("toggle_enabled"),
            button("Delete")
              .value(`${config.groupId}:${config.channelId}`)
              .id("delete")
              .style("danger"),
          ),
        ]
      : []),
  );
};

export const manageGroupSettingsModal = (
  config: Pick<typeof groupConfigs.$inferSelect, "channelId"> &
    Partial<typeof groupConfigs.$inferSelect>,
) => ({
  blocks: manageGroupSettings(config),
  title: { type: "plain_text" as const, text: "Ping Police" },
  type: "modal" as const,
  submit: { type: "plain_text" as const, text: "Save" },
  close: { type: "plain_text" as const, text: "Cancel" },
  callback_id: "edit_group_settings",
  private_metadata: `${config.groupId ?? ""}:${config.channelId}`,
});
