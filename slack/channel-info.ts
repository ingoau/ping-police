import * as api from "./api";
import * as selfbot from "./selfbot";

export default async function getChannelInfo(channelId: string) {
  const channelInfo = await api.bot("conversations.info", {
    channel: channelId,
  });
  const selfbotChannelInfo = await api.selfbot("conversations.info", {
    channel: channelId,
  });

  if (
    channelInfo.error === "channel_not_found" &&
    selfbotChannelInfo.error === "channel_not_found"
  ) {
    return {
      private: true,
      inChannel: false,
      selfbotInChannel: false,
      managerIds: [],
    };
  }

  const managerIds = await selfbot.getManagers(channelId);

  return {
    private:
      channelInfo.error === "channel_not_found" ||
      channelInfo.channel?.is_private,
    inChannel:
      !(channelInfo.error === "channel_not_found") &&
      channelInfo.channel?.is_member,
    selfbotInChannel:
      !(selfbotChannelInfo.error === "channel_not_found") &&
      selfbotChannelInfo.channel?.is_member,
    managerIds,
  };
}
