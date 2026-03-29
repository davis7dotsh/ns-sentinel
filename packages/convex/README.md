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
