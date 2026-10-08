# CodeCanvas by SPECS

A campus community app store where SPECS student developers publish software, exchange feedback, find collaborators, and celebrate progress together.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Create an account on the sign-in page (email + password) or continue with Google. No demo credentials — sign up to get your own developer profile.

## Scripts

| Command                | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Start the dev server                                    |
| `npm run build`        | Typecheck-free production build to `dist/` (gitignored) |
| `npm run preview`      | Serve the production build locally                      |
| `npm test`             | Run the Vitest suite (`src/**/*.test.ts`)               |
| `npm run format`       | Prettier-write the repo                                 |
| `npm run format:check` | Fail if anything is unformatted                         |

## Data backends

The UI only talks to repo interfaces (`src/data/repositories.ts`), so the storage swaps without UI changes. Pick one in `.env` (see `.env.example`):

| `VITE_DATA_SOURCE` | Behavior                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `local` (default)  | Everything in browser localStorage. No setup.                                                                                                                                                                |
| `supabase`         | Live Supabase Auth + PostgREST. Needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, then run `supabase/schema.sql` once, plus every `supabase/migration_*.sql` file (each is independent and re-runnable). |
| `http`             | Custom REST backend. Needs `VITE_API_URL` implementing the endpoint contract in `BACKEND_READINESS.md`.                                                                                                      |

## Features

- **Discover** — search/filter student projects; tap anywhere on a card to open it; upload stamps show freshness (`5m ago` → date after 24h)
- **Feedback** — nested reply threads with likes; authors can delete their own comments/replies from the ⋯ menu
- **Notifications inbox** — bell for comments, replies, upvotes, collaborator tags, new projects, and wall updates; newest-first with arrival topping, sounds, mark-read, and delete-all
- **Voters viewer** — see exactly who upvoted any project, with profile links
- **Collaborators** — tag developers (picker or @mentions); they get notified, including on re-tags after edits
- **Profiles** — editable name/role/bio/photo, avatar colors, and a theme palette visitors see on the page
- **Docs** — import READMEs from GitHub or upload `.md`, read long docs page by page
- **Community** — milestones wall with cheers, developer leaderboard with trophies
- **Settings** (`/settings`) — sound mute toggle with chime preview, local demo-data reset
- **Accounts** — email/password signup, Google sign-in, duplicate-profile claiming, logout confirmation

## Project layout

```text
src/
  pages/        # Main (router), Store (app shell + views), Login, Landing, About
  components/   # Cards, dialogs, bell, voters, paged markdown, boundaries, …
  data/         # Repo contracts + local / supabase / http implementations
  utils/        # Notification builder, time stamps, sounds, scroll helper
  auth/         # Session provider + mock credentials
supabase/       # schema.sql (fresh installs) + migration_*.sql (existing DBs)
soundEffects/   # Bundled vote/notification chimes
```

## Docs worth reading

- `BACKEND_READINESS.md` — backend swap plan + HTTP endpoint contract
- `TEAM_SETUP.md` — team onboarding
- `src/data/team.ts` — edit this to update the About page (features, team, contact)
- `supabase/*.sql` — run migrations in the Supabase SQL editor; each file says what it's for
