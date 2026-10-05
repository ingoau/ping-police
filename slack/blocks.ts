import type { groupConfigs } from "@/db/schema";
import {
  WARNING_WINDOW_MS,
  type GroupWarningStats,
  type WarningStats,
} from "@/db/analytics";
import { env } from "@/env";
import {
  CHANNEL_TARGET,
  COUNT_PLACEHOLDER,
  defaultMessage,
  hasCustomMessage,
  isChannelTarget,
  targetLabel,
} from "./warning";
import {
  actions,
  blocks,
  button,
  context,
  divider,
  header,
  input,
  mrkdwn,
  plainTextInput,
  R,
  richText,
  section,
  select,
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
        "Ping Police is a bot to prevent people from pinging large groups of people. It does this by showing a warning as the user starts typing in a thread that will ping specified groups, or, if turned on, as they start typing a new message in a busy channel.",
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

// Keeps settings and warning sections under Slack's 3000 character limit
export const MAX_MESSAGE_LENGTH = 1000;
const MAX_LISTED_MESSAGE_LENGTH = 300;

const shorten = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;
export const formatWarningStats = ({ warnings, ignored }: WarningStats) =>
  `*${warnings.toLocaleString("en-US")}* ${warnings === 1 ? "warning" : "warnings"} shown · *${ignored.toLocaleString("en-US")}* replied anyway` +
  (warnings > 0 ? ` (${Math.round((ignored / warnings) * 100)}%)` : "");

const NO_STATS: WarningStats = { warnings: 0, ignored: 0 };

export interface SettingsView {
  channelId: string;
  configs: (typeof groupConfigs.$inferSelect)[];
  isManager: boolean;
  analyticsEnabled: boolean;
  groupStats: Map<string, WarningStats>;
  notice?: string;
}

export const manageSettings = ({
  channelId,
  configs,
  isManager,
  analyticsEnabled,
  groupStats,
  notice,
}: SettingsView) => {
  // The whole-channel warning, if set up, is listed before the groups
  const sorted = [...configs].sort(
    (a, b) =>
      Number(isChannelTarget(b.groupId)) - Number(isChannelTarget(a.groupId)),
  );

  return blocks(
    ...(notice ? [section(mrkdwn(`:warning: ${notice}`))] : []),
    richText(
      R.section(
        `${isManager ? "Manage" : "View"} rules for `,
        R.channel(channelId),
        R.text(":"),
      ),
    ),
    ...sorted.map((config) => {
      const stats = groupStats.get(config.groupId);
      const lines = [
        `${isChannelTarget(config.groupId) ? "*Whole channel*" : targetLabel(config.groupId)} - ${config.enabled ? "Enabled" : "Disabled"}`,
        `Message: ${
          hasCustomMessage(config.message)
            ? `\`${shorten(config.message!, MAX_LISTED_MESSAGE_LENGTH)}\``
            : "_default_"
        }`,
        // Keep showing stats collected before analytics were turned off
        ...(analyticsEnabled || stats
          ? [formatWarningStats(stats ?? NO_STATS)]
          : []),
      ];
      const block = section(lines.join("\n"));
      return isManager
        ? block.accessory(
            button("Edit")
              .value(`${config.groupId}:${channelId}`)
              .id("edit_config"),
          )
        : block;
    }),
    context(
      mrkdwn(
        analyticsEnabled
          ? "Analytics are on: Ping Police counts how often people are warned, and how often they post anyway."
          : "Analytics are off for this channel.",
      ),
    ),
    ...(isManager
      ? [
          actions(
            button("Add rule").value(channelId).id("add_rule"),
            button(analyticsEnabled ? "Disable analytics" : "Enable analytics")
              .value(channelId)
              .id("toggle_analytics"),
          ),
        ]
      : []),
  );
};

export const manageSettingsModal = (view: SettingsView) => ({
  blocks: manageSettings(view),
  title: { type: "plain_text" as const, text: "Ping Police" },
  type: "modal" as const,
  close: { type: "plain_text" as const, text: "Close" },
});

// Stats

const MAX_GROUP_STATS = 20;

export interface StatsView {
  configuredChannels: number;
  rules: number;
  global: WarningStats;
  channel?: {
    channelId: string;
    analyticsEnabled: boolean;
    stats: WarningStats;
    groups: GroupWarningStats[];
  };
}

export const statsMessage = ({
  configuredChannels,
  rules,
  global,
  channel,
}: StatsView) => {
  const groupLines =
    channel?.groups
      .slice(0, MAX_GROUP_STATS)
      .map(
        (group) =>
          `• ${targetLabel(group.groupId)} ${formatWarningStats(group)}`,
      ) ?? [];
  const hiddenGroups = (channel?.groups.length ?? 0) - groupLines.length;
  if (hiddenGroups > 0) groupLines.push(`_…and ${hiddenGroups} more_`);

  return blocks(
    header("Ping Police stats"),
    section(
      mrkdwn(
        [
          "*Everywhere*",
          `Set up in *${configuredChannels.toLocaleString("en-US")}* ${configuredChannels === 1 ? "channel" : "channels"} with *${rules.toLocaleString("en-US")}* ${rules === 1 ? "rule" : "rules"}`,
          formatWarningStats(global),
        ].join("\n"),
      ),
    ),
    ...(channel
      ? [
          divider(),
          section(
            mrkdwn(
              [
                `*In <#${channel.channelId}>*`,
                formatWarningStats(channel.stats),
                ...(channel.analyticsEnabled
                  ? []
                  : ["_Analytics are off for this channel._"]),
              ].join("\n"),
            ),
          ),
          section(
            mrkdwn(
              [
                `*By rule in <#${channel.channelId}>*`,
                ...(groupLines.length > 0
                  ? groupLines
                  : ["_No rules set up or warned about here yet._"]),
              ].join("\n"),
            ),
          ),
        ]
      : []),
    context(
      mrkdwn(
        `“Replied anyway” counts warnings where the person replied in the thread (or, for whole-channel rules, posted in the channel) within ${WARNING_WINDOW_MS / 60_000} minutes.`,
      ),
    ),
  );
};

const permissionDenied = () => ({
  blocks: blocks(
    richText(R.section("You must have channel manager to do this")),
  ),
});

export const manageGroupSettings = (
  config: Pick<typeof groupConfigs.$inferSelect, "channelId"> &
    Partial<typeof groupConfigs.$inferSelect>,
) => {
  const isChannel = isChannelTarget(config.groupId);

  return blocks(
    richText(
      isChannel
        ? R.section(
            R.text("Manage the whole-channel rule in ").bold(),
            R.channel(config.channelId).bold(),
            R.text(":").bold(),
          )
        : config.groupId
          ? R.section(
              R.text("Manage settings for ").bold(),
              R.usergroup(config.groupId).bold(),
              R.text(" in ").bold(),
              R.channel(config.channelId).bold(),
              R.text(":").bold(),
            )
          : R.section("Add a rule in ", R.channel(config.channelId)),
    ),
    ...(config.groupId
      ? []
      : [
          input(
            "Trigger",
            select()
              .dynamic()
              .id("trigger_select")
              .minQueryLength(0)
              .placeholder("Channel, or search for a user group"),
          )
            .id("trigger_select_input")
            .hint(
              "Channel warns anyone starting a new message in the channel. A group warns people replying in threads that mention it. Search groups by name or handle, or paste a group ID (like S0123ABCD) or a group mention.",
            )
            .optional(false),
        ]),
    input(
      "Message",
      plainTextInput()
        .multiline()
        .id("message")
        .placeholder("Leave empty to use the default message")
        .max(MAX_MESSAGE_LENGTH)
        .default(config.message || ""),
    )
      .id("message_input")
      .hint(
        !config.groupId
          ? `Use ${COUNT_PLACEHOLDER} to include how many people are in the group or channel. Default for groups: ${defaultMessage()} Default for the channel: ${defaultMessage(CHANNEL_TARGET)}`
          : isChannel
            ? `Shown to anyone who starts typing a new message in the channel (not in threads). Use ${COUNT_PLACEHOLDER} to include how many people are in the channel. Default message: ${defaultMessage(config.groupId)}`
            : `Use ${COUNT_PLACEHOLDER} to include how many people are in the group. Default message: ${defaultMessage(config.groupId)}`,
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
