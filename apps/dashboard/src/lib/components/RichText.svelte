<script lang="ts">
  let { text, class: className = "" } = $props<{
    text: string;
    class?: string;
  }>();

  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const html = $derived.by(() => {
    const escaped = escapeHtml(text);

    return escaped
      .replace(
        /(https?:\/\/[^\s<]+)/gu,
        (url) =>
          `<a class="underline decoration-stone-300 underline-offset-4 hover:decoration-stone-700" href="${url}" rel="noreferrer" target="_blank">${url}</a>`,
      )
      .replaceAll("\n", "<br />");
  });
</script>

<div class={className}>
  {@html html}
</div>
