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
  <section class="space-y-6">
    <div class="space-y-4 border-b border-stone-200/80 pb-6">
      <a class="text-sm text-stone-500 transition hover:text-stone-800" href="/"
        >&larr; Channels</a
      >

      <div class="flex items-start gap-4">
        <Avatar
          alt={channelPage.current.channel.name}
          size="lg"
          src={channelPage.current.channel.avatarUrl}
        />

        <div class="space-y-2">
          <h1 class="text-2xl font-semibold tracking-tight text-stone-950">
            <a
              class="transition hover:text-stone-700"
              href={channelPage.current.channel.youtubeUrl}
              rel="noreferrer"
              target="_blank"
            >
              {channelPage.current.channel.name}
            </a>
          </h1>
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
            <span>
              {formatCount(channelPage.current.channel.subscriberCount)} subs
            </span>
            <span>{channelPage.current.channel.videoCount ?? 0} videos</span>
            {#if channelPage.current.channel.ytCustomUrl}
              <span>{channelPage.current.channel.ytCustomUrl}</span>
            {/if}
          </div>
          {#if channelPage.current.channel.description}
            <RichText
              class="max-w-3xl text-sm leading-6 text-stone-500"
              text={channelPage.current.channel.description}
            />
          {/if}
        </div>
      </div>
    </div>

    <div class="divide-y divide-stone-200/80">
      {#each channelPage.current.videos as video (video.id)}
        <article
          class="grid items-start gap-4 py-4 sm:grid-cols-[13rem_minmax(0,1fr)_auto]"
        >
          <a
            class="relative aspect-video overflow-hidden rounded-lg bg-stone-200"
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
              class="absolute bottom-1.5 right-1.5 rounded bg-stone-950/80 px-1.5 py-0.5 text-xs text-stone-50"
            >
              {formatDuration(video.durationSeconds)}
            </span>
          </a>

          <a
            class="min-w-0 space-y-1.5"
            href={`/channel/${channelId}/video/${video.id}`}
          >
            <h2 class="line-clamp-2 text-base font-medium text-stone-950">
              {video.title}
            </h2>
            <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-500">
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
