import { error } from "@sveltejs/kit";
import {
  getGeneratedDemoRun,
  getLatestGeneratedDemoRunForSlug,
} from "$lib/server/generated-demo-runs";

const toSandboxDocument = (input: {
  readonly slug: string;
  readonly title: string;
}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <title>${input.title}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(245, 180, 116, 0.22), transparent 28rem),
          linear-gradient(180deg, #fffaf3 0%, #f5efe5 100%);
        color: #1c1917;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
      }

      main {
        max-width: 1040px;
        margin: 0 auto;
        padding: 12px 24px 80px;
      }

      .layout {
        display: grid;
        gap: 20px;
      }

      .card {
        border: 1px solid rgba(120, 113, 108, 0.18);
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.72);
        box-shadow: 0 18px 48px rgba(28, 25, 23, 0.08);
        backdrop-filter: blur(14px);
      }

      .channel-card {
        padding: 24px;
      }

      .channel-title {
        margin: 0;
        font-size: clamp(2.1rem, 3.8vw, 3.4rem);
        line-height: 0.95;
      }

      .channel-meta {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .avatar {
        width: 64px;
        height: 64px;
        border-radius: 999px;
        object-fit: cover;
        background: #e7e5e4;
      }

      .channel-stats {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 16px;
      }

      .pill {
        border-radius: 999px;
        padding: 8px 12px;
        background: #fafaf9;
        color: #57534e;
        font-size: 14px;
      }

      .grid {
        display: grid;
        gap: 20px;
      }

      .stack {
        padding: 24px;
      }

      .stack h2 {
        margin: 0 0 16px;
        font-size: 1rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #78716c;
      }

      .item-list {
        display: grid;
        gap: 14px;
      }

      .item {
        display: grid;
        gap: 10px;
        padding: 16px;
        border-radius: 18px;
        background: #fffcf7;
        border: 1px solid rgba(120, 113, 108, 0.14);
      }

      .item-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .item-title {
        margin: 0;
        font-size: 1rem;
        line-height: 1.35;
      }

      .item-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        color: #57534e;
        font-size: 14px;
      }

      .item-text {
        margin: 0;
        color: #44403c;
        line-height: 1.55;
      }

      .empty {
        color: #78716c;
        margin: 0;
      }

      @media (min-width: 860px) {
        .layout {
          grid-template-columns: 1.25fr 0.95fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section id="app" class="layout">
        <article class="card channel-card">
          <p class="empty">Loading generated view...</p>
        </article>
      </section>
    </main>

    <script>
      const formatCount = (value) => {
        if (value === null || value === undefined) return "n/a";
        return new Intl.NumberFormat("en-US", { notation: "compact" }).format(
          typeof value === "string" ? Number(value) : value
        );
      };

      const formatDate = (value) => {
        return new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
        }).format(new Date(value));
      };

      const render = async () => {
        const response = await fetch("/internal/read/demo/channel-overview");
        const data = await response.json();
        const root = document.getElementById("app");

        if (!data.channel) {
          root.innerHTML = '<article class="card channel-card"><p class="empty">No channel data is available yet.</p></article>';
          return;
        }

        const videoItems = data.videos
          .map(
            (video) => \`
              <article class="item">
                <div class="item-header">
                  <h3 class="item-title">\${video.title}</h3>
                  <span class="pill">\${formatDate(video.publishedAt)}</span>
                </div>
                <div class="item-meta">
                  <span>\${formatCount(video.stats.viewCount)} views</span>
                  <span>\${formatCount(video.stats.likeCount)} likes</span>
                  <span>\${formatCount(video.stats.commentCount)} comments</span>
                </div>
              </article>
            \`,
          )
          .join("");

        const postItems = data.posts
          .map(
            (post) => \`
              <article class="item">
                <div class="item-header">
                  <h3 class="item-title">X post</h3>
                  <span class="pill">\${formatDate(post.sourceCreatedAt)}</span>
                </div>
                <p class="item-text">\${post.text}</p>
                <div class="item-meta">
                  <span>\${formatCount(post.stats.viewCount)} views</span>
                  <span>\${formatCount(post.stats.likeCount)} likes</span>
                  <span>\${formatCount(post.stats.repostCount)} reposts</span>
                </div>
              </article>
            \`,
          )
          .join("");

        root.innerHTML = \`
          <article class="card channel-card">
            <div class="channel-meta">
              <img class="avatar" alt="\${data.channel.name}" src="\${data.channel.avatarUrl ?? ""}" />
              <div>
                <h1 class="channel-title">\${data.channel.name}</h1>
                <p class="item-text">\${data.channel.description ?? "No description available yet."}</p>
              </div>
            </div>
            <div class="channel-stats">
              <span class="pill">\${formatCount(data.channel.subscriberCount)} subscribers</span>
              <a class="pill" href="\${data.channel.youtubeUrl}" rel="noreferrer" target="_blank">Open YouTube</a>
            </div>
          </article>

          <div class="grid">
            <section class="card stack">
              <h2>Recent Videos</h2>
              <div class="item-list">\${videoItems || '<p class="empty">No videos yet.</p>'}</div>
            </section>

            <section class="card stack">
              <h2>Recent X Posts</h2>
              <div class="item-list">\${postItems || '<p class="empty">No posts yet.</p>'}</div>
            </section>
          </div>
        \`;
      };

      render().catch((cause) => {
        const root = document.getElementById("app");
        root.innerHTML = '<article class="card channel-card"><p class="empty">The generated page failed to load its data.</p></article>';
        console.error(cause);
      });
    </script>
  </body>
</html>`;

export const GET = ({ params, url }) => {
  const runId = url.searchParams.get("run");
  const run = runId
    ? getGeneratedDemoRun(runId)
    : getLatestGeneratedDemoRunForSlug(params.slug);

  if (!run || run.slug !== params.slug) {
    throw error(404, "Generated sandbox page not found.");
  }

  return new Response(
    toSandboxDocument({
      slug: run.slug,
      title: run.title,
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
};
