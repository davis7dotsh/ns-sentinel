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
