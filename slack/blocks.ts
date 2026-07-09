import type { Block, KnownBlock } from "@slack/web-api";

type Blocks = (KnownBlock | Block)[];

const divider = {
  type: "divider",
} as const;

const introduction: Blocks = [
  {
    type: "rich_text",
    elements: [
      {
        type: "rich_text_section",
        elements: [
          {
            type: "text",
            text: "Ping Police is a bot to prevent people from pinging large groups of people. It does this by showing a warning as the user starts typing in a thread that will ping specified groups.",
          },
        ],
      },
    ],
  },
];

const setupPrompt: Blocks = [
  {
    type: "rich_text",
    elements: [
      {
        type: "rich_text_section",
        elements: [
          {
            type: "text",
            text: "Would you like to set up Ping Police in this channel?",
          },
        ],
      },
    ],
  },
  {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Yes",
          emoji: true,
        },
        value: "[channel]",
        action_id: "setup",
        style: "primary",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "No",
          emoji: true,
        },
        value: "[channel]",
        action_id: "dismiss",
      },
    ],
  },
];

const notSetUp: Blocks = [...introduction, divider, ...setupPrompt];

const publicChannelInitialSetup = {
  blocks: [
    {
      type: "rich_text",
      elements: [
        {
          type: "rich_text_section",
          elements: [
            {
              type: "text",
              text: "To continue, you need to add ",
            },
            {
              type: "user",
              user_id: "U0B29PM729E",
            },
            {
              type: "text",
              text: " and ",
            },
            {
              type: "user",
              user_id: "U0B18U7A9DH",
            },
            {
              type: "text",
              text: " to the channel.\nWould you like me to do this for you?",
            },
          ],
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Yes",
            emoji: true,
          },
          value: "[channel]",
          action_id: "setup",
          style: "primary",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "No",
            emoji: true,
          },
          value: "[channel]",
          action_id: "dismiss",
        },
      ],
    },
  ],
};

const privateChannelInitialSetup = {
  blocks: [
    {
      type: "rich_text",
      elements: [
        {
          type: "rich_text_section",
          elements: [
            {
              type: "text",
              text: "To continue, you need to add ",
            },
            {
              type: "user",
              user_id: "U0B29PM729E",
            },
            {
              type: "text",
              text: " and ",
            },
            {
              type: "user",
              user_id: "U0B18U7A9DH",
            },
            {
              type: "text",
              text: " to the channel.\nSince this is a private channel, you need to do it yourself.\nYou can run the following commands:",
            },
          ],
        },
      ],
    },
    {
      type: "markdown",
      text: "```text\n/invite @[Dev] Ping Police\n```\n```text\n/invite @Ping Police (Selfbot) \n```",
    },
  ],
};

const manageSettings = {
  blocks: [
    {
      type: "rich_text",
      elements: [
        {
          type: "rich_text_section",
          elements: [
            {
              type: "text",
              text: "Manage settings for ",
            },
            {
              type: "channel",
              channel_id: "C0BEVRMGY23",
            },
          ],
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "<!subteam^S0B1M8N1PLJ> - Enabled\n Message: `Message here`",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Edit",
          emoji: true,
        },
        value: "click_me_123",
        action_id: "button-action",
      },
    },
  ],
};

const permissionDenied = {
  blocks: [
    {
      type: "rich_text",
      elements: [
        {
          type: "rich_text_section",
          elements: [
            {
              type: "text",
              text: "You must have channel manager to do this",
            },
          ],
        },
      ],
    },
  ],
};

const manageGroupSettings = {
  type: "modal",
  title: {
    type: "plain_text",
    text: "Ping Police",
    emoji: true,
  },
  submit: {
    type: "plain_text",
    text: "Save",
    emoji: true,
  },
  close: {
    type: "plain_text",
    text: "Cancel",
    emoji: true,
  },
  blocks: [
    {
      type: "rich_text",
      elements: [
        {
          type: "rich_text_section",
          elements: [
            {
              type: "text",
              text: "Manage settings for ",
              style: {
                bold: true,
              },
            },
            {
              type: "usergroup",
              usergroup_id: "S0B1M8N1PLJ",
              style: {
                bold: true,
              },
            },
            {
              type: "text",
              text: " in ",
              style: {
                bold: true,
              },
            },
            {
              type: "channel",
              channel_id: "C0BEVRMGY23",
              style: {
                bold: true,
              },
            },
            {
              type: "text",
              text: " ",
              style: {
                bold: true,
              },
            },
          ],
        },
      ],
    },
    {
      type: "input",
      element: {
        type: "rich_text_input",
        action_id: "rich_text_input-action",
      },
      label: {
        type: "plain_text",
        text: "Message",
        emoji: true,
      },
      optional: false,
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Disable",
            emoji: true,
          },
          value: "click_me_123",
          action_id: "disable",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Delete",
            emoji: true,
          },
          value: "click_me_123",
          action_id: "delete",
          style: "danger",
        },
      ],
    },
  ],
};
