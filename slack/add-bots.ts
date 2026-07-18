import * as api from "./api";

export default async function addBots(channelId: string) {
  await api.selfbot("conversations.join", { channel: channelId });
  await api.selfbot("conversations.invite", {
    channel: channelId,
    users: "U0B18U7A9DH",
  });
}
