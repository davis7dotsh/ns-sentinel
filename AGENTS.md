Project guidelines:

- use `bun` as the package manager and command runner
- when installing new packages, use `bun install` instead of manually editing `package.json`
- use modern svelte and sveltekit patterns and primitives
- avoid `as any` at all costs, lean on inference and real types
- use effect v4
- use tailwindcss for styling whenever possible, only fall back to custom css when needed
- every svelte component should have `lang="ts"`
- when making changes in effect, use the effect generator syntax whenever possible. if you need to call an async function use `Effect.tryPromise`. helper functions should be generators, the backend should be composed of effects
- after changes, format, lint, and check the package/app you touched

## Cursor Cloud specific instructions

### Repository overview

Turborepo monorepo (`bun` workspaces). Primary product is a YouTube/X channel monitoring platform.

| Area | Path | Purpose |
|------|------|---------|
| Dashboard | `apps/dashboard` | SvelteKit 5 + Tailwind v4 web app (main UI) |
| Web | `apps/web` | Minimal SvelteKit app (placeholder) |
| Live Crawler | `apps/live-crawler` | Background polling service for YouTube data |
| Core | `packages/core` | Shared env loading and Effect helpers |
| DB | `packages/db` | Drizzle ORM schema + database layer (PostgreSQL) |
| Crawl Helpers | `packages/crawl-helpers` | Crawl orchestration logic |
| youtube-read, x-read, notion-read, gmail-read, slack-read | `packages/*-read` | API integration libraries/tests |

### Key commands (run from repo root)

- `bun install` — install all workspace dependencies
- `bun run format:check` / `bun run format` — prettier check/fix
- `bun run check` — turbo type-check across all packages
- `bun run dev:dash` — start dashboard dev server (Vite, port 5173)
- `bun run db:start` — start PostgreSQL 17 via Docker
- `bun run db:push` — push Drizzle schema (use `--force` to skip interactive prompt in CI/non-TTY)
- `bun run db:studio` — open Drizzle Studio

### Non-obvious caveats

- **Docker required**: PostgreSQL runs in Docker (`postgres:17`). The `db:start` script manages the container. In Cloud Agent VMs, Docker must be installed with `fuse-overlayfs` storage driver and `iptables-legacy`. After installing, run `sudo chmod 666 /var/run/docker.sock` so the non-root user can access Docker.
- **Non-TTY drizzle-kit push**: `bun run db:push` requires interactive confirmation. Pass `--force` flag: `bunx drizzle-kit push --config=packages/db/drizzle.config.ts --force`.
- **`.env` file**: Copy `.env.example` to `.env` at the repo root. The default `DATABASE_URL` points to the local Docker Postgres. API keys (YouTube, X, Notion, Slack, Gmail) are only needed for their respective crawl packages.
- **Pre-existing type errors in `crawl-helpers`**: `bun run check` fails for `@ns-sentinel/crawl-helpers` due to drizzle-orm type mismatches. This is a known pre-existing issue on `main` and is unrelated to your changes.
- **Dashboard depends on `drizzle-orm`**: The dashboard directly imports `drizzle-orm` in `src/lib/server/dashboard.ts`. It must be listed in the dashboard's `package.json` dependencies for Vite SSR resolution to work.
