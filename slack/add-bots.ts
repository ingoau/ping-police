import { env } from "@/env";
import * as api from "./api";

export default async function addBots(channelId: string) {
  await api.selfbot("conversations.join", { channel: channelId });
  await api.selfbot("conversations.invite", {
    channel: channelId,
    users: env.PING_POLICE_USER_ID,
  });
}
