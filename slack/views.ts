import * as analytics from "@/db/analytics";
import * as configs from "@/db/configs";
import { manageSettingsModal, statsMessage } from "./blocks";

export async function settingsModal(
  channelId: string,
  isManager: boolean,
  notice?: string,
) {
  const [channelConfigs, analyticsEnabled, groupStats] = await Promise.all([
    configs.list(channelId),
    analytics.isEnabled(channelId),
    analytics.getGroupStats(channelId),
  ]);

  return manageSettingsModal({
    channelId,
    configs: channelConfigs,
    isManager,
    analyticsEnabled,
    groupStats: new Map(groupStats.map((stats) => [stats.groupId, stats])),
    notice,
  });
}

// channelId is the channel the stats command was run in, if any
export async function stats(channelId?: string) {
  const [allConfigs, global] = await Promise.all([
    configs.listAll(),
    analytics.getStats(),
  ]);

  let channel;
  if (channelId) {
    const [stats, groupStats, analyticsEnabled] = await Promise.all([
      analytics.getStats(channelId),
      analytics.getGroupStats(channelId),
      analytics.isEnabled(channelId),
    ]);

    // Groups set up here but never warned about still get a line
    const groups = [...groupStats];
    for (const config of allConfigs) {
      if (
        config.channelId === channelId &&
        !groups.some((group) => group.groupId === config.groupId)
      ) {
        groups.push({ groupId: config.groupId, warnings: 0, ignored: 0 });
      }
    }

    channel = { channelId, analyticsEnabled, stats, groups };
  }

  return statsMessage({
    configuredChannels: new Set(allConfigs.map((config) => config.channelId))
      .size,
    rules: allConfigs.length,
    global,
    channel,
  });
}
