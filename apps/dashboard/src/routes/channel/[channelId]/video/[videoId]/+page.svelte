<script lang="ts">
  import { page } from "$app/state";
  import { getVideoPage } from "$lib/dashboard.remote";
  import {
    formatCount,
    formatDate,
    formatDuration,
    formatLongCount,
  } from "$lib/format";

  const channelId = $derived(page.params.channelId ?? "");
  const videoId = $derived(page.params.videoId ?? "");
  const videoPage = $derived(
    getVideoPage({
      channelId,
      videoId,
    }),
  );
</script>

<svelte:head>
  <title>Video</title>
</svelte:head>

{#if videoPage.ready}
  <section class="space-y-8">
    <div class="space-y-4 border-b border-stone-300/80 pb-6">
      <a class="text-sm text-stone-500" href={`/channel/${channelId}`}>
        Back to {videoPage.current.channel.name}
      </a>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div class="space-y-4">
          <div class="overflow-hidden rounded-sm bg-stone-200">
            {#if videoPage.current.video.thumbnailUrl}
              <img
                alt={videoPage.current.video.title}
                class="aspect-video w-full object-cover"
                src={videoPage.current.video.thumbnailUrl}
              />
            {/if}
          </div>

          <div class="space-y-3">
            <h1 class="text-3xl font-semibold tracking-tight text-stone-950">
              {videoPage.current.video.title}
            </h1>

            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
              <span
                >{formatLongCount(videoPage.current.video.stats.viewCount)} views</span
              >
              <span
                >{formatLongCount(videoPage.current.video.stats.likeCount)} likes</span
              >
              <span
                >{formatLongCount(videoPage.current.video.stats.commentCount)} comments</span
              >
              <span>{formatDate(videoPage.current.video.publishedAt)}</span>
              <span
                >{formatDuration(videoPage.current.video.durationSeconds)}</span
              >
            </div>

            {#if videoPage.current.video.description}
              <p class="whitespace-pre-wrap text-sm leading-6 text-stone-700">
                {videoPage.current.video.description}
              </p>
            {/if}
          </div>
        </div>

        <aside
          class="space-y-3 border-t border-stone-300 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
        >
          <p class="text-xs uppercase tracking-[0.24em] text-stone-500">Meta</p>
          <dl class="space-y-3 text-sm text-stone-700">
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">Video ID</dt>
              <dd class="text-right">{videoPage.current.video.ytVideoId}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">Kind</dt>
              <dd>{videoPage.current.video.contentKind}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">Language</dt>
              <dd>{videoPage.current.video.defaultLanguage ?? "n/a"}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">Category</dt>
              <dd>{videoPage.current.video.categoryId ?? "n/a"}</dd>
            </div>
          </dl>

          {#if videoPage.current.video.tags.length > 0}
            <div class="flex flex-wrap gap-2 pt-2">
              {#each videoPage.current.video.tags as tag (tag)}
                <span
                  class="border border-stone-300 px-2 py-1 text-xs text-stone-600"
                >
                  {tag}
                </span>
              {/each}
            </div>
          {/if}
        </aside>
      </div>
    </div>

    <section class="space-y-4">
      <div class="flex items-baseline justify-between">
        <h2 class="text-xl font-semibold text-stone-950">Comments</h2>
        <p class="text-sm text-stone-500">
          {formatCount(videoPage.current.comments.length)} stored
        </p>
      </div>

      <div class="border-y border-stone-300/80">
        {#each videoPage.current.comments as comment (comment.id)}
          <article class="space-y-2 border-b border-stone-200/80 py-4">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <p class="font-medium text-stone-900">
                {comment.authorDisplayName ?? "Unknown"}
              </p>
              <p class="text-stone-500">{formatDate(comment.publishedAt)}</p>
              <p class="text-stone-500">
                {formatCount(comment.likeCount)} likes
              </p>
              <p class="text-stone-500">{comment.replyCount ?? 0} replies</p>
            </div>

            <p class="whitespace-pre-wrap text-sm leading-6 text-stone-700">
              {comment.bodyText}
            </p>
          </article>
        {/each}
      </div>
    </section>
  </section>
{:else}
  <p class="text-sm text-stone-500">Loading video...</p>
{/if}
