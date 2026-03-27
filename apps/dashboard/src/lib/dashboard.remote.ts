import { query } from "$app/server";

import {
  getChannelPageData,
  getChannelsData,
  getVideoPageData,
} from "$lib/server/dashboard";

export const getChannels = query(() => getChannelsData());

export const getChannelPage = query("unchecked", (channelId: string) =>
  getChannelPageData(channelId),
);

export const getVideoPage = query(
  "unchecked",
  (input: { channelId: string; videoId: string }) => getVideoPageData(input),
);
