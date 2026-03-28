<script lang="ts">
  import { page } from "$app/state";
  import Avatar from "$lib/components/Avatar.svelte";
  import RichText from "$lib/components/RichText.svelte";
  import { getChannelPage } from "$lib/dashboard.remote";
  import { formatCount, formatDate, formatDuration } from "$lib/format";

  const channelId = $derived(page.params.channelId ?? "");
  const channelPage = $derived(getChannelPage(channelId));
</script>

<svelte:head>
  <title>Channel</title>
</svelte:head>

{#if channelPage.ready}
  <section class="space-y-8">
    <div class="space-y-4 border-b border-stone-300/80 pb-6">
      <a class="text-sm text-stone-500" href="/">Back to channels</a>

      <div class="flex items-start gap-4">
        <Avatar
          alt={channelPage.current.channel.name}
          size="lg"
          src={channelPage.current.channel.avatarUrl}
        />

        <div class="space-y-2">
          <h1 class="text-3xl font-semibold tracking-tight text-stone-950">
            <a
              class="underline decoration-stone-300 underline-offset-6 hover:decoration-stone-900"
              href={channelPage.current.channel.youtubeUrl}
              rel="noreferrer"
              target="_blank"
            >
              {channelPage.current.channel.name}
            </a>
          </h1>
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
            <span>
              {formatCount(channelPage.current.channel.subscriberCount)} subs
            </span>
            <span>{channelPage.current.channel.videoCount ?? 0} videos</span>
            {#if channelPage.current.channel.ytCustomUrl}
              <a
                class="underline decoration-stone-300 underline-offset-4 hover:decoration-stone-700"
                href={channelPage.current.channel.youtubeUrl}
                rel="noreferrer"
                target="_blank"
              >
                {channelPage.current.channel.ytCustomUrl}
              </a>
            {/if}
          </div>
          {#if channelPage.current.channel.description}
            <RichText
              class="max-w-3xl text-sm leading-6 text-stone-600"
              text={channelPage.current.channel.description}
            />
          {/if}
        </div>
      </div>
    </div>

    <div class="space-y-1">
      {#each channelPage.current.videos as video (video.id)}
        <article
          class="grid gap-4 border-b border-stone-200/80 py-4 sm:grid-cols-[13rem_minmax(0,1fr)_auto]"
        >
          <a
            class="relative aspect-video overflow-hidden rounded-sm bg-stone-200 transition hover:opacity-95"
            href={`/channel/${channelId}/video/${video.id}`}
          >
            {#if video.thumbnailUrl}
              <img
                alt={video.title}
                class="h-full w-full object-cover"
                src={video.thumbnailUrl}
              />
            {/if}
            <span
              class="absolute bottom-2 right-2 bg-stone-950/80 px-2 py-1 text-xs text-stone-50"
            >
              {formatDuration(video.durationSeconds)}
            </span>
          </a>

          <a
            class="min-w-0 space-y-2 transition hover:bg-stone-50/80"
            href={`/channel/${channelId}/video/${video.id}`}
          >
            <h2 class="line-clamp-2 text-lg font-medium text-stone-950">
              {video.title}
            </h2>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
              <span>{formatCount(video.stats.viewCount)} views</span>
              <span>{formatCount(video.stats.likeCount)} likes</span>
              <span>{formatCount(video.stats.commentCount)} comments</span>
            </div>
          </a>

          <p class="text-sm text-stone-500">{formatDate(video.publishedAt)}</p>
        </article>
      {/each}
    </div>
  </section>
{:else}
  <p class="text-sm text-stone-500">Loading channel...</p>
{/if}
