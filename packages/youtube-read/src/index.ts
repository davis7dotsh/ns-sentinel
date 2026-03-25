/**
 * Getting started:
 * 1. In Google Cloud, create or reuse a project and enable the YouTube Data API v3.
 * 2. Create an API key in Google Cloud Credentials and export it as `YOUTUBE_API_KEY`.
 * 3. Optionally export `YOUTUBE_CHANNEL_ID` to look up a specific public channel directly.
 * 4. Otherwise this script uses `YOUTUBE_QUERY` (default: `Google for Developers`) to find a public channel, then loads its public stats.
 *
 * Useful links:
 * - https://developers.google.com/youtube/v3/getting-started
 * - https://developers.google.com/youtube/v3/docs/search/list
 * - https://developers.google.com/youtube/v3/docs/channels/list
 * - https://console.cloud.google.com/apis/credentials
 */

import { google } from "googleapis";

const apiKey = process.env.YOUTUBE_API_KEY;

if (!apiKey) {
  throw new Error("Missing YOUTUBE_API_KEY.");
}

const channelIdFromEnv = process.env.YOUTUBE_CHANNEL_ID;
const query = process.env.YOUTUBE_QUERY ?? "Google for Developers";
const youtube = google.youtube({ version: "v3", auth: apiKey });

const resolveChannelId = async () => {
  if (channelIdFromEnv) {
    return channelIdFromEnv;
  }

  const searchResponse = await youtube.search.list({
    q: query,
    type: ["channel"],
    maxResults: 1,
    part: ["snippet"],
  });

  const channelId = searchResponse.data.items?.[0]?.id?.channelId;

  if (!channelId) {
    throw new Error(
      `No public YouTube channel was found for query "${query}".`,
    );
  }

  return channelId;
};

const channelId = await resolveChannelId();
const response = await youtube.channels.list({
  id: [channelId],
  part: ["snippet", "statistics"],
});
const channel = response.data.items?.[0];

if (!channel) {
  throw new Error(
    `No YouTube channel was returned for channel ID "${channelId}".`,
  );
}

console.log(
  JSON.stringify(
    {
      id: channel.id,
      query,
      title: channel.snippet?.title,
      description: channel.snippet?.description,
      customUrl: channel.snippet?.customUrl,
      publishedAt: channel.snippet?.publishedAt,
      viewCount: channel.statistics?.viewCount,
      subscriberCount: channel.statistics?.subscriberCount,
      videoCount: channel.statistics?.videoCount,
    },
    null,
    2,
  ),
);
