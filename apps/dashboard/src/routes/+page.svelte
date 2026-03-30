<script lang="ts">
  import Avatar from "$lib/components/Avatar.svelte";
  import { getChannels } from "$lib/dashboard.remote";
  import { formatCount, formatDate } from "$lib/format";

  const channels = getChannels();
</script>

<svelte:head>
  <title>Sentinel Dashboard</title>
</svelte:head>

<section class="space-y-6">
  <div class="space-y-2">
    <p class="text-xs uppercase tracking-[0.28em] text-stone-500">Channels</p>
    <h1 class="text-2xl font-semibold tracking-tight text-stone-950">
      YouTube channels
    </h1>
  </div>

  {#if channels.ready}
    <div class="divide-y divide-stone-200/80 border-t border-stone-200/80">
      {#each channels.current as channel (channel.id)}
        <article
          class="grid items-center gap-4 py-4 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto]"
        >
          <a
            class="flex min-w-0 items-center gap-3"
            href={`/channel/${channel.id}`}
          >
            <Avatar alt={channel.name} size="md" src={channel.avatarUrl} />

            <div class="min-w-0">
              <h2 class="truncate text-base font-medium text-stone-950">
                {channel.name}
              </h2>
              <p class="truncate text-sm text-stone-500">
                {channel.ytCustomUrl ?? channel.ytChannelId}
              </p>
            </div>
          </a>

          <p class="text-sm text-stone-600">
            {formatCount(channel.subscriberCount)} subs
          </p>
          <p class="text-sm text-stone-600">
            {channel.videoCount ?? 0} videos
          </p>
          <p class="text-sm text-stone-500">
            {formatDate(channel.lastYoutubeSyncedAt)}
          </p>
          <a
            class="text-sm text-stone-500 transition hover:text-stone-800"
            href={channel.youtubeUrl}
            rel="noreferrer"
            target="_blank"
          >
            YouTube &nearr;
          </a>
        </article>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-stone-500">Loading channels...</p>
  {/if}
</section>
