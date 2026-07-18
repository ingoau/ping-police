import type { RichTextBlockElement } from "@slack/types";
import {
  actions,
  blocks,
  button,
  divider,
  input,
  mrkdwn,
  plain,
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

export const setupActions = (channelId: string) =>
  actions(
    button("Yes").value(channelId).id("setup").style("primary"),
    button("No").value(channelId).id("dismiss"),
  );

export const requiredMembersPrompt = (suffix: string) =>
  richText(
    R.section(
      "To continue, you need to add ",
      R.user(PING_POLICE_USER_ID),
      " and ",
      R.user(SELF_BOT_USER_ID),
      suffix,
    ),
  );

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
    setupActions(channelId),
  );

export const publicChannelInitialSetup = (channelId: string) =>
  blocks(
    requiredMembersPrompt(
      " to the channel.\nWould you like me to do this for you?",
    ),
    actions(
      button("Do that for me").value(channelId).id("add_bots").style("primary"),
      button("I'll do it myself").value(channelId).id("dismiss"),
    ),
  );

export const privateChannelInitialSetup = () =>
  blocks(
    requiredMembersPrompt(
      " to the channel.\nSince this is a private channel, you need to do it yourself.\nYou can run the following commands:",
    ),
    richText(
      textCodeBlock("/invite @[Dev] Ping Police"),
      textCodeBlock("/invite @Ping Police (Selfbot)"),
    ),
  );

const manageSettings = () => ({
  blocks: blocks(
    richText(R.section("Manage settings for ", R.channel(CHANNEL_ID))),
    section(
      `<!subteam^${USERGROUP_ID}> - Enabled\n Message: \`Message here\``,
    ).accessory(button("Edit").value("click_me_123").id("button-action")),
  ),
});

const permissionDenied = () => ({
  blocks: blocks(
    richText(R.section("You must have channel manager to do this")),
  ),
});

const manageGroupSettings = () => ({
  type: "modal",
  title: plain("Ping Police").emoji(true).build(),
  submit: plain("Save").emoji(true).build(),
  close: plain("Cancel").emoji(true).build(),
  blocks: blocks(
    richText(
      R.section(
        R.text("Manage settings for ").bold(),
        R.usergroup(USERGROUP_ID).bold(),
        R.text(" in ").bold(),
        R.channel(CHANNEL_ID).bold(),
        R.text(" ").bold(),
      ),
    ),
    input(
      "Message",
      plainTextInput().multiline().id("rich_text_input-action"),
    ).optional(false),
    actions(
      button("Disable").value("click_me_123").id("disable"),
      button("Delete").value("click_me_123").id("delete").style("danger"),
    ),
  ),
});
