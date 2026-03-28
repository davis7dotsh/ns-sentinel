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
              <a
                class="underline decoration-stone-300 underline-offset-6 hover:decoration-stone-900"
                href={videoPage.current.video.youtubeUrl}
                rel="noreferrer"
                target="_blank"
              >
                {videoPage.current.video.title}
              </a>
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
              <a
                class="underline decoration-stone-300 underline-offset-4 hover:decoration-stone-700"
                href={videoPage.current.video.youtubeUrl}
                rel="noreferrer"
                target="_blank"
              >
                Watch on YouTube
              </a>
            </div>

            {#if videoPage.current.video.description}
              <RichText
                class="text-sm leading-6 text-stone-700"
                text={videoPage.current.video.description}
              />
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
        <div class="flex items-center gap-4">
          <p class="text-sm text-stone-500">
            {formatCount(videoPage.current.comments.length)} stored
          </p>
          <label class="flex items-center gap-2 text-sm text-stone-600">
            <span>Sort</span>
            <select
              bind:value={commentSort}
              class="border border-stone-300 bg-transparent px-2 py-1 text-sm text-stone-700 outline-none"
            >
              <option value="likes">Most likes</option>
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
        </div>
      </div>

      <div class="border-y border-stone-300/80">
        {#each sortedComments as comment (comment.id)}
          <article class="space-y-2 border-b border-stone-200/80 py-4">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {#if comment.authorChannelUrl}
                <a
                  class="font-medium text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-700"
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
              <p class="text-stone-500">{formatDate(comment.publishedAt)}</p>
              <p class="text-stone-500">
                {formatCount(comment.likeCount)} likes
              </p>
              <p class="text-stone-500">{comment.replyCount ?? 0} replies</p>
              <a
                class="text-stone-500 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-700"
                href={comment.youtubeUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open
              </a>
            </div>

            <RichText
              class="text-sm leading-6 text-stone-700"
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
