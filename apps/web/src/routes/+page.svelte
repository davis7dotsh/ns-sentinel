<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>NS Sentinel Effect v4</title>
</svelte:head>

<main>
  <section class="hero">
    <p class="eyebrow">Effect v4 migration</p>
    <h1>
      NS Sentinel is now being shaped around services, layers, and programs.
    </h1>
    <p class="lede">
      The workspace is pinned to <code>{data.packageManager}</code> and the main
      verification command is <code>{data.workspaceCheck}</code>.
    </p>
  </section>

  <section class="grid" aria-label="Workspace modules">
    {#each data.modules as module (module.name)}
      <article class="card">
        <div class="card-header">
          <h2>{module.name}</h2>
          <span class:ready={module.effectVersion !== null}>
            {module.effectVersion ?? "missing effect"}
          </span>
        </div>

        <p>{module.description}</p>

        <dl>
          <div>
            <dt>Effect</dt>
            <dd>{module.effectVersion ?? "Not installed"}</dd>
          </div>
          <div>
            <dt>Node Platform</dt>
            <dd>{module.nodePlatformVersion ?? "Not installed"}</dd>
          </div>
          <div>
            <dt>Check</dt>
            <dd>{module.checkCommand ?? "None"}</dd>
          </div>
          <div>
            <dt>Start</dt>
            <dd>{module.startCommand ?? "N/A"}</dd>
          </div>
        </dl>
      </article>
    {/each}
  </section>
</main>
