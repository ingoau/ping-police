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

  return { app };
}

export function createSelfbotSocket(
  onConnect: (socket: WebSocket) => void,
) {
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    const socket = new WebSocket(websocketUrl.toString(), {
      headers: {
        Cookie: `d=${env.SLACK_SELFBOT_XOXD}`,
      },
    });

    onConnect(socket);

    socket.addEventListener("open", () => {
      attempt = 0;
      console.log("[selfbot] connected");
    });

    socket.addEventListener("error", (event) => {
      console.error("[selfbot] websocket error", event);
      socket.close();
    });

    socket.addEventListener("close", () => {
      if (reconnectTimer) return;

      const delay = Math.min(1_000 * 2 ** attempt++, 30_000);
      console.error(`[selfbot] disconnected; retrying in ${delay}ms`);

      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        connect();
      }, delay);
    });
  };

  connect();
}
