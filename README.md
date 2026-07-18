# Ping Police

A Slack bot to solve a problem we have in the Hack Club Slack

You know when you ping a group with a lot of people in it, subscribing them to the thread that seems logical to reply in? And then someone replies, pinging the whole group again?

Usually, it's an accident, and this bot is built to prevent it. Basically, when someone starts typing a message in a thread that will ping a group, a message will be displayed to them, reminding them that they are about to ping the group.

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

## AI use disclosure

AI was used in development of this, mainly for annoying refactors, but also to implement some features. All commits primarily authored with AI have attribution in the commit message (eg. `(codex)` prefix) and/or are co-authored by the AI.
