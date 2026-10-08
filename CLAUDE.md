# CLAUDE.md — AI assistant working agreement for CodeCanvas

Read this before writing code. It encodes decisions from past security audits;
violating them reintroduces fixed bugs.

## Stack & commands

React 18 + TypeScript (strict) + Vite 8 + Tailwind v4. No test runner was
historical — there is one now: put it to work.

```bash
npm run dev      # http://localhost:3000
npm run build    # production build (dist/ is gitignored, never commit it)
npm test         # vitest, colocated src/**/*.test.ts — add tests with features
npx tsc --noEmit # typecheck; must pass before you report done
```

`VITE_DATA_SOURCE=local|supabase|http` (`.env`, see `.env.example`).

## Architecture (non-negotiable)

- UI talks ONLY to `AuthRepo` / `AppRepo` / `ProfileRepo`
  (`src/data/repositories.ts`) via `src/data/factory.ts`. Never touch
  localStorage, fetch, or Supabase clients from components (one narrow,
  env-gated exception: the local-only demo-data reset in SettingsView).
- Same contract, three backends (`local/`, `supabase/`, `http/`). A repo
  method added in one must be implemented in all three.

## Security — authorization lives in RLS, never only in the UI

- Every mutation must be enforceable by the database, not by hiding buttons.
  Ownership checks exist in BOTH layers: repo pre-check (fast failure) +
  RLS policy or SECURITY DEFINER function (real enforcement).
- RLS conventions (`supabase/schema.sql`): public read everywhere; owners
  manage their own rows; own-row deletes for vote/like/cheer/comment rows;
  counters mutate ONLY through RPCs (`security definer`, `set search_path =
public`, grants to `authenticated` only, identity re-verified inside).
- Never add `UNIQUE` on display names — duplicates are legal and the
  claim/merge flow reconciles them. Never trust client-sent OAuth claims;
  the server verifies with the provider.

## Security — validation has three layers, use all three

1. **Forms**: length limits, URL shapes — this is UX, not protection.
2. **Repos**: every mutating method re-validates (lengths, `https?://`
   protocols, image budgets, allowlists). Never accept a patch field the UI
   didn't validate without re-checking it here.
3. **Database**: CHECK constraints mirror the repo limits
   (`supabase/migration_constraints.sql` + `schema.sql`). If you change a
   repo limit, change the constraint in both places.

## Security — XSS rules

- No `dangerouslySetInnerHTML`, ever. Markdown renders via react-markdown
  WITHOUT rehype-raw (raw HTML is ignored), and every link href passes
  through `sanitizeMarkdownUrl` (`src/components/Markdown.tsx`):
  http/https/mailto/relative only, everything else becomes `#`.
- Never render a user URL into `href`/`src` without a protocol allowlist.
  Uploaded images are safe by construction: they are canvas re-encoded to
  JPEG data URLs (`src/utils/images.ts`) — never store raw uploads.
- Never log, commit, or display secrets. Anon keys are public by design;
  service-role keys must never enter this repo.

## Conventions that keep the codebase coherent

- Prettier is law (`npm run format:check` in CI spirit — keep YOUR lines
  clean; don't mass-reformat files with pre-existing debt).
- Migrations: one `supabase/migration_<thing>.sql` per change (drop-if-exists
  so reruns are safe) + the same change in `schema.sql` for fresh installs.
  Document each file's purpose in its header + BACKEND_READINESS if it adds
  an endpoint.
- Notifications are derived client-side (no table): stable ids per event,
  content-versioned arrival keys, snapshot baselines in
  `cc.notif.v1:<userId>`. Read `src/utils/notifications.ts` header before
  extending. New sounds go in `soundEffects/` (bundled imports) + a mute
  path in `src/utils/sounds.ts` — sounds are decoration, never load-bearing.
- State writes to shared localStorage keys must preserve unknown fields
  (spread-then-override); a save that drops a field wipes it.
- Effects that prune/delete persisted state must not run on empty,
  still-loading data — that's how read receipts get resurrected.

## How to work here

Inspect the repo before inventing. Smallest correct change. Reuse the toon
visual language, phosphor icons, and existing dialog/portal patterns. Verify
with `tsc` + `vitest` + `vite build` and say what you actually ran — never
claim verification you didn't perform.
