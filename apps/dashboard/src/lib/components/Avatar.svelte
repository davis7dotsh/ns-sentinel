<script lang="ts">
  let {
    src,
    alt,
    size = "md",
  }: {
    src?: string | null;
    alt: string;
    size?: "sm" | "md" | "lg";
  } = $props();

  let failed = $state(false);

  const initials = $derived(
    alt
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join(""),
  );

  const sizeClass = $derived(
    size === "lg"
      ? "h-16 w-16 text-lg"
      : size === "sm"
        ? "h-10 w-10 text-sm"
        : "h-12 w-12 text-sm",
  );
</script>

<div
  class={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-stone-200 text-stone-600 ${sizeClass}`}
>
  {#if src && !failed}
    <img
      {alt}
      class="h-full w-full object-cover"
      crossorigin="anonymous"
      loading="lazy"
      referrerpolicy="no-referrer"
      {src}
      onerror={() => {
        failed = true;
      }}
    />
  {:else}
    <span class="font-medium">{initials}</span>
  {/if}
</div>
