import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";

const token = process.env.SLACK_TOKEN;
const appToken = process.env.SLACK_APP_TOKEN!;

const websocketUrl = new URL("wss://wss-primary.slack.com/");
websocketUrl.searchParams.set("token", process.env.SLACK_SELFBOT_XOXC || "");

export function createClients() {
  const web = new WebClient(token);
  const socketModeClient = new SocketModeClient({ appToken });
  const selfbotSocket = new WebSocket(websocketUrl.toString(), {
    headers: {
      Cookie: `d=${process.env.SLACK_SELFBOT_XOXD || ""}`,
    },
  });

  return { web, socketModeClient, selfbotSocket };
}
