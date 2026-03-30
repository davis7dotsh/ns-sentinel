<script lang="ts">
  import { page } from "$app/state";
  import RichText from "$lib/components/RichText.svelte";
  import { getVideoPage } from "$lib/dashboard.remote";
  import {
    formatCount,
    formatDate,
    formatDuration,
    formatLongCount,
  } from "$lib/format";

  const channelId = $derived(page.params.channelId ?? "");
  const videoId = $derived(page.params.videoId ?? "");
  let commentSort = $state<"likes" | "latest" | "oldest">("likes");
  const videoPage = $derived(
    getVideoPage({
      channelId,
      videoId,
    }),
  );
  const sortedComments = $derived.by(() => {
    if (!videoPage.ready) {
      return [];
    }

    return [...videoPage.current.comments].sort((left, right) => {
      if (commentSort === "latest") {
        return (
          new Date(right.publishedAt).getTime() -
          new Date(left.publishedAt).getTime()
        );
      }

      if (commentSort === "oldest") {
        return (
          new Date(left.publishedAt).getTime() -
          new Date(right.publishedAt).getTime()
        );
      }

      return Number(right.likeCount ?? 0) - Number(left.likeCount ?? 0);
    });
  });
</script>

<svelte:head>
  <title>Video</title>
</svelte:head>

{#if videoPage.ready}
  <section class="space-y-6">
    <div class="space-y-4 border-b border-stone-200/80 pb-6">
      <a
        class="text-sm text-stone-500 transition hover:text-stone-800"
        href={`/channel/${channelId}`}
      >
        &larr; {videoPage.current.channel.name}
      </a>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div class="space-y-4">
          <div class="overflow-hidden rounded-lg bg-stone-200">
            {#if videoPage.current.video.thumbnailUrl}
              <img
                alt={videoPage.current.video.title}
                class="aspect-video w-full object-cover"
                src={videoPage.current.video.thumbnailUrl}
              />
            {/if}
          </div>

          <div class="space-y-3">
            <h1 class="text-2xl font-semibold tracking-tight text-stone-950">
              {videoPage.current.video.title}
            </h1>

            <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-500">
              <span>
                {formatLongCount(videoPage.current.video.stats.viewCount)} views
              </span>
              <span>
                {formatLongCount(videoPage.current.video.stats.likeCount)} likes
              </span>
              <span>
                {formatLongCount(videoPage.current.video.stats.commentCount)} comments
              </span>
              <span>{formatDate(videoPage.current.video.publishedAt)}</span>
              <span>
                {formatDuration(videoPage.current.video.durationSeconds)}
              </span>
              <a
                class="text-stone-500 transition hover:text-stone-800"
                href={videoPage.current.video.youtubeUrl}
                rel="noreferrer"
                target="_blank"
              >
                YouTube &nearr;
              </a>
            </div>

            {#if videoPage.current.video.description}
              <RichText
                class="text-sm leading-6 text-stone-500"
                text={videoPage.current.video.description}
              />
            {/if}
          </div>
        </div>

        <aside
          class="space-y-3 border-t border-stone-200/80 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
        >
          <p class="text-xs uppercase tracking-[0.24em] text-stone-500">Meta</p>
          <dl class="space-y-2.5 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">Video ID</dt>
              <dd class="text-right text-stone-700">
                {videoPage.current.video.ytVideoId}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">Kind</dt>
              <dd class="text-stone-700">
                {videoPage.current.video.contentKind}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">Language</dt>
              <dd class="text-stone-700">
                {videoPage.current.video.defaultLanguage ?? "n/a"}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">Category</dt>
              <dd class="text-stone-700">
                {videoPage.current.video.categoryId ?? "n/a"}
              </dd>
            </div>
          </dl>

          {#if videoPage.current.video.tags.length > 0}
            <div class="flex flex-wrap gap-1.5 pt-1">
              {#each videoPage.current.video.tags as tag (tag)}
                <span
                  class="rounded-full border border-stone-200/80 px-2 py-0.5 text-xs text-stone-500"
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
        <h2 class="text-lg font-semibold text-stone-950">Comments</h2>
        <div class="flex items-center gap-3">
          <p class="text-sm text-stone-500">
            {formatCount(videoPage.current.comments.length)} stored
          </p>
          <select
            bind:value={commentSort}
            class="rounded-lg border border-stone-200/80 bg-transparent px-2.5 py-1 text-sm text-stone-700 outline-none"
          >
            <option value="likes">Most likes</option>
            <option value="latest">Latest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      <div class="divide-y divide-stone-200/80">
        {#each sortedComments as comment (comment.id)}
          <article class="space-y-1.5 py-4">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {#if comment.authorChannelUrl}
                <a
                  class="font-medium text-stone-900 transition hover:text-stone-700"
                  href={comment.authorChannelUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {comment.authorDisplayName ?? "Unknown"}
                </a>
              {:else}
                <p class="font-medium text-stone-900">
                  {comment.authorDisplayName ?? "Unknown"}
                </p>
              {/if}
              <p class="text-stone-400">{formatDate(comment.publishedAt)}</p>
              <p class="text-stone-400">
                {formatCount(comment.likeCount)} likes
              </p>
              <p class="text-stone-400">{comment.replyCount ?? 0} replies</p>
            </div>

            <RichText
              class="text-sm leading-6 text-stone-600"
              text={comment.bodyText}
            />
          </article>
        {/each}
      </div>
    </section>
  </section>
{:else}
  <p class="text-sm text-stone-500">Loading video...</p>
{/if}
