/**
 * Getting started:
 * 1. Create a Slack app at api.slack.com/apps.
 * 2. Add bot token scopes for the read surface you want. For this hello-world example, `channels:read` is enough.
 * 3. Install the app to your workspace and export `SLACK_BOT_TOKEN`.
 * 4. Optionally export `SLACK_CHANNEL_ID` if you also want this script to read recent messages from one public channel.
 *
 * Useful links:
 * - https://api.slack.com/apps
 * - https://docs.slack.dev/reference/scopes
 * - https://docs.slack.dev/reference/methods/conversations.list
 * - https://docs.slack.dev/reference/methods/conversations.history
 */

import { WebClient } from "@slack/web-api";

const slackToken = process.env.SLACK_BOT_TOKEN;

if (!slackToken) {
  throw new Error("Missing SLACK_BOT_TOKEN.");
}

const slack = new WebClient(slackToken);
const auth = await slack.auth.test();
const channelsResponse = await slack.conversations.list({
  limit: 5,
  exclude_archived: true,
  types: "public_channel",
});

const output = {
  team: auth.team,
  teamId: auth.team_id,
  botUserId: auth.user_id,
  channels: (channelsResponse.channels ?? []).map((channel) => ({
    id: channel.id,
    name: channel.name,
    isPrivate: channel.is_private ?? false,
  })),
};

const channelId = process.env.SLACK_CHANNEL_ID;

if (!channelId) {
  console.log(JSON.stringify(output, null, 2));
} else {
  const historyResponse = await slack.conversations.history({
    channel: channelId,
    limit: 5,
  });

  console.log(
    JSON.stringify(
      {
        ...output,
        history: (historyResponse.messages ?? []).map((message) => ({
          user: message.user,
          text: message.text,
          ts: message.ts,
        })),
      },
      null,
      2,
    ),
  );
}
