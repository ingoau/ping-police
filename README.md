# Ping Police

A Slack bot to solve a problem we have in the Hack Club Slack

You know when you ping a group with a lot of people in it, subscribing them to the thread that seems logical to reply in? And then someone replies, pinging the whole group again?

Usually, it's an accident, and this bot is built to prevent it. Basically, when someone starts typing a message in a thread that will ping a group, a message will be displayed to them, reminding them that they are about to ping the group. Busy channels where lots of people get notified about every message can also warn anyone starting a new message in the channel.

## Features

- Pick user groups from a searchable list, or paste a group ID
- Custom warning messages per group, with a default message for groups that don't set one. Use `{count}` in a message to include how many people are in the group
- Whole-channel warnings, for busy channels where lots of people get notified about every message: anyone who starts typing a new message in the channel (not in a thread) gets a warning. Add it with **Add rule** in `/ping-police` and pick **Channel** as the trigger; `{count}` is the number of people in the channel
- Analytics (on by default, can be turned off per channel): how often people are warned, and how often they post anyway
- `/ping-police stats` shows stats everywhere, in the current channel, and per rule

## Stack

- Bun
- Slack.ts
- Slack socket mode
- Drizzle

## Development

```bash
bun install
bun run db:push
bun start
```

Set `REPORT_USER_ID` to have the warning footer tell people who to DM to report a warning.

Run the tests with:

```bash
bun test
```

## AI use disclosure

AI was used in development of this, mainly for annoying refactors, but also to implement some features. All commits primarily authored with AI have attribution in the commit message (eg. `(codex)` prefix) and/or are co-authored by the AI.
