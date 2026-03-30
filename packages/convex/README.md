# Convex Package

This package owns the application state for generated pages.

Current scope:

- page records
- page versions
- generated code blob references
- simple generation state (`working`, `ready`, `error`)

Notes:

- Postgres remains the long-term store for crawl/domain content.
- Generated page state and artifacts should not be added back to Postgres.
- Runtime execution remains same-origin for now, but that will need to split to a dedicated origin later.
- Private Convex bridge functions will be added after this package is initialized with generated Convex types.

## Vercel deploy

To deploy the dashboard and Convex together on Vercel:

- Create the Vercel project from the repo root, not `apps/dashboard`.
- Set `CONVEX_DEPLOY_KEY` in Vercel for the environment you want to deploy.
- Use the build command from `vercel.json`, or run `pnpm run deploy:dashboard:vercel`.

That command deploys Convex from `packages/convex`, builds `apps/dashboard` with the injected `CONVEX_URL`, and moves the generated `.vercel/output` into the repo root for Vercel to publish.
