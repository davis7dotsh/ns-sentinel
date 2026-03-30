import { command, query } from "$app/server";

import { getChannelPageData, getChannelsData, getVideoPageData } from "$lib/server/dashboard";
import { deleteGeneratedPage } from "$lib/server/generated-pages";
import type { Id } from "@ns-sentinel/convex/data-model";

export const getChannels = query(() => getChannelsData());

export const getChannelPage = query("unchecked", (channelId: string) =>
  getChannelPageData(channelId),
);

export const getVideoPage = query("unchecked", (input: { channelId: string; videoId: string }) =>
  getVideoPageData(input),
);

export const deletePageCommand = command("unchecked", (pageId: string) =>
  deleteGeneratedPage(pageId as Id<"pages">),
);
