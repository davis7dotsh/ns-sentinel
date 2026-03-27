<script lang="ts">
  import "../app.css";
</script>

<div class="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
  <header
    class="mb-10 flex items-baseline justify-between border-b border-stone-300/80 pb-4"
  >
    <a class="text-sm uppercase tracking-[0.28em] text-stone-600" href="/">
      Sentinel
    </a>
    <p class="text-sm text-stone-500">dashboard</p>
  </header>

  <slot />
</div>
