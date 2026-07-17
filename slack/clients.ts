import { env } from "@/env";
import { App } from "slack.ts";

const token = env.SLACK_TOKEN;
const appToken = env.SLACK_APP_TOKEN!;

const websocketUrl = new URL("wss://wss-primary.slack.com/");
websocketUrl.searchParams.set("token", env.SLACK_SELFBOT_XOXC || "");

export function createClients() {
  const app = new App({
    token,
    receiver: { type: "socket", appToken },
  });

  const selfbotSocket = new WebSocket(websocketUrl.toString(), {
    headers: {
      Cookie: `d=${env.SLACK_SELFBOT_XOXD || ""}`,
    },
  });

  return { app, selfbotSocket };
}
