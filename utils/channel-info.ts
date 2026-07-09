import * as api from "../utils/api";
import * as selfbot from "../utils/selfbot";

export default async function getChannelInfo(channelId: string) {
  const channelInfo = await api.selfbot("conversations.info", {
    channel: channelId,
  });
  const selfbotChannelInfo = await api.selfbot("conversations.info", {
    channel: channelId,
  });
  const managerIds = await selfbot.getManagers(channelId);

  return {
    private: false,
    inChannel: false,
    selfbotInChannel: false,
    managerIds,
  };
}
