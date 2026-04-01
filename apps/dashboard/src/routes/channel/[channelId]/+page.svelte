<script lang="ts">
  import { page } from "$app/state";
  import Avatar from "$lib/components/Avatar.svelte";
  import RichText from "$lib/components/RichText.svelte";
  import { getChannelPage } from "$lib/dashboard.remote";
  import { formatCount, formatDate, formatDuration } from "$lib/format";

  const contentTypeOptions = ["all", "video", "short", "livestream"] as const;

  type ContentTypeFilter = (typeof contentTypeOptions)[number];
  type VideoContentType = Exclude<ContentTypeFilter, "all">;

  const channelId = $derived(page.params.channelId ?? "");
  const channelPage = $derived(getChannelPage(channelId));
  let selectedContentType = $state<ContentTypeFilter>("video");
  const statsWindowSize = 15;

  const getVideoContentType = (contentType: string | null | undefined): VideoContentType =>
    contentType === "short" || contentType === "livestream" ? contentType : "video";

  const formatContentTypeLabel = (contentType: ContentTypeFilter) =>
    contentType === "all" ? "All" : contentType[0].toUpperCase() + contentType.slice(1);
  const toViewCount = (value: string | number | null | undefined) => Number(value ?? 0);
  const formatDaysAgo = (value: string | null | undefined) => {
    if (!value) {
      return "";
    }

    const publishedAt = new Date(value);
    const elapsedMs = Date.now() - publishedAt.getTime();
    const elapsedDays = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));

    if (elapsedDays === 0) {
      return "Published today";
    }

    if (elapsedDays === 1) {
      return "Published 1 day ago";
    }

    return `Published ${elapsedDays} days ago`;
  };

  const filteredVideos = $derived.by(() => {
    if (!channelPage.ready) {
      return [];
    }

    return channelPage.current.videos.filter(
      (video) =>
        selectedContentType === "all" || getVideoContentType(video.contentType) === selectedContentType,
    );
  });
  const statsVideos = $derived(filteredVideos.slice(0, statsWindowSize));
  const statsVideoViews = $derived.by(() =>
    statsVideos.reduce((total, video) => total + Number(video.stats.viewCount ?? 0), 0),
  );
  const statsVideoAverageViews = $derived(
    statsVideos.length === 0 ? 0 : Math.round(statsVideoViews / statsVideos.length),
  );
  const statsVideoExtremes = $derived.by(() => {
    if (statsVideos.length === 0) {
      return { lowest: null, highest: null };
    }

    let lowestVideo = statsVideos[0];
    let highestVideo = statsVideos[0];
    let lowestViews = toViewCount(statsVideos[0].stats.viewCount);
    let highestViews = lowestViews;

    for (const video of statsVideos.slice(1)) {
      const videoViews = toViewCount(video.stats.viewCount);

      if (videoViews < lowestViews) {
        lowestVideo = video;
        lowestViews = videoViews;
      }

      if (videoViews > highestViews) {
        highestVideo = video;
        highestViews = videoViews;
      }
    }

    return {
      lowest: {
        video: lowestVideo,
        views: lowestViews,
        deltaFromAverage: Math.max(statsVideoAverageViews - lowestViews, 0),
      },
      highest: {
        video: highestVideo,
        views: highestViews,
        deltaFromAverage: Math.max(highestViews - statsVideoAverageViews, 0),
      },
    };
  });
</script>

<svelte:head>
  <title>Channel</title>
</svelte:head>

{#if channelPage.ready}
  <section class="space-y-6">
    <div class="space-y-5 border-b border-stone-200/80 pb-6">
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

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl border border-stone-200/80 bg-stone-50/80 px-4 py-3">
          <p class="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
            Avg Views Per Video
          </p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            {formatCount(statsVideoAverageViews)}
          </p>
          <p class="mt-1 text-sm text-stone-500">Based on the last {statsVideos.length} videos</p>
        </div>

        <div class="rounded-2xl border border-stone-200/80 bg-stone-50/80 px-4 py-3">
          <p class="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
            Total Views
          </p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            {formatCount(statsVideoViews)}
          </p>
          <p class="mt-1 text-sm text-stone-500">Across the last {statsVideos.length} videos</p>
        </div>

        <div class="rounded-2xl border border-stone-200/80 bg-stone-50/80 px-4 py-3">
          <p class="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
            Lowest Viewed Vid
          </p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            {formatCount(statsVideoExtremes.lowest?.views ?? 0)}
          </p>
          <p class="mt-1 text-sm text-stone-500">
            {#if statsVideoExtremes.lowest}
              {formatCount(statsVideoExtremes.lowest.deltaFromAverage)} below avg
            {:else}
              No videos in window
            {/if}
          </p>
          {#if statsVideoExtremes.lowest}
            <p class="mt-2 text-sm text-stone-600">
              {formatDaysAgo(statsVideoExtremes.lowest.video.publishedAt)}
            </p>
          {/if}
        </div>

        <div class="rounded-2xl border border-stone-200/80 bg-stone-50/80 px-4 py-3">
          <p class="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
            Most Viewed Vid
          </p>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            {formatCount(statsVideoExtremes.highest?.views ?? 0)}
          </p>
          <p class="mt-1 text-sm text-stone-500">
            {#if statsVideoExtremes.highest}
              {formatCount(statsVideoExtremes.highest.deltaFromAverage)} above avg
            {:else}
              No videos in window
            {/if}
          </p>
          {#if statsVideoExtremes.highest}
            <p class="mt-2 text-sm text-stone-600">
              {formatDaysAgo(statsVideoExtremes.highest.video.publishedAt)}
            </p>
          {/if}
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        {#each contentTypeOptions as contentType (contentType)}
          <button
            class={[
              "rounded-full border px-3 py-1.5 text-sm font-medium transition",
              selectedContentType === contentType
                ? "border-stone-900 bg-stone-900 text-stone-50"
                : "border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300 hover:text-stone-950",
            ]}
            onclick={() => {
              selectedContentType = contentType;
            }}
            type="button"
          >
            {formatContentTypeLabel(contentType)}
          </button>
        {/each}
      </div>

      {#if filteredVideos.length === 0}
        <div class="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-8">
          <p class="text-sm text-stone-500">
            No {selectedContentType === "all" ? "" : `${selectedContentType} `}videos found for this
            filter.
          </p>
        </div>
      {:else}
        <div class="divide-y divide-stone-200/80">
          {#each filteredVideos as video (video.id)}
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
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class={[
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                      getVideoContentType(video.contentType) === "livestream"
                        ? "bg-red-100 text-red-700"
                        : getVideoContentType(video.contentType) === "short"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-stone-100 text-stone-600",
                    ]}
                  >
                    {formatContentTypeLabel(getVideoContentType(video.contentType))}
                  </span>

                  <h2 class="line-clamp-2 text-base font-medium text-stone-950">
                    {video.title}
                  </h2>
                </div>
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
      {/if}
    </div>
  </section>
{:else}
  <p class="text-sm text-stone-500">Loading channel...</p>
{/if}
