# Backend readiness (Supabase cutover plan)

The prototype runs 100% on browser localStorage today. This document makes the
future database/server swap mechanical. Nothing here changes localhost behavior.

## What is already backend-shaped

- UI code only touches `AuthRepo` / `AppRepo` / `ProfileRepo` (`src/data/repositories.ts`).
  No component reads localStorage directly.
- `VITE_DATA_SOURCE=local` (default) keeps everything as-is. `supabase` switches
  every screen to `src/data/supabase/` (live Supabase Auth + PostgREST, anon key).
  `http` switches to `src/data/http/` for a custom REST backend (needs `VITE_API_URL`).
- `supabase/schema.sql` mirrors every prototype store as real tables with RLS.

## Cutover checklist (finalize phase)

1. Create the Supabase project. Run `supabase/schema.sql` in the SQL editor.
2. Auth: Authentication → Providers → enable **Google** with your Google Cloud
   OAuth client ID + secret, and add `http://localhost:3000/store` (plus the
   production URL later) under URL Configuration → Redirect URLs.
   Then set `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL`, and
   `VITE_SUPABASE_ANON_KEY` in `.env` and restart.
   Note: Supabase Auth issues fresh UUID identities, so the cloud database starts
   empty — prototype ids (`user-1`, `google-<sub>`) do not transfer. Migrate rows
   to the new ids at finalize time (same technique as `src/data/local/claim.ts`).
3. Images: prototype screenshots are ~500KB data URLs. Move them to a Supabase
   Storage bucket and store public URLs in `screenshots` / `image_url`.
4. Implement the endpoint contract (thin server or Supabase Edge Functions):
   - `GET /auth/session` → `{ user }` (401 when signed out)
   - `POST /auth/signin {email, password}` → `{ user, token }`
   - `POST /auth/signup {name, email, password}` → `{ user, token }`
   - `POST /auth/google {accessToken}` → `{ user, token, picture? }`.
     Server MUST fetch Google userinfo itself and match verified email → account.
     Never trust client-sent claims.
   - `POST /auth/signout` → 204 · `PATCH /auth/name {name}` → `{ user }`
   - `GET /apps?query=&category=&limit=&offset=` → `{ apps }` (server fills
     `viewer_has_voted` / `comments_count` from the session)
   - `GET /apps/:id` → `{ app }` · `POST /apps` → `{ app }`
     · `PATCH /apps/:id` → `{ app }` (owner only) · `DELETE /apps/:id` → 204
   - `POST /apps/:id/vote` → `{ app }` (toggle)
   - `GET /apps/:id/voters` → `{ voters }` (profiles of upvoters, any order)
   - `GET /apps/:id/comments` → `{ comments }` (flat, `parent_id` nests replies)
   - `POST /apps/:id/comments {body, parentId?}` → `{ comment }`
   - `POST /apps/:id/comments/:commentId/like` → `{ comment }` (toggle)
   - `DELETE /apps/:id/comments/:commentId` → 204 (author only, replies cascade)
   - `GET /milestones` → `{ milestones }` (newest first)
   - `POST /milestones {body, appId?}` → `{ milestone }`
   - `POST /milestones/:id/cheer` → `{ milestone }` (toggle)
   - `GET /profiles` → `{ profiles }` · `GET /profiles/:id` → `{ profile }`
   - `GET /profiles/by-name/:name` → `{ profile }` (404 → null)
   - `POST /profiles/ensure {id, email, name}` → `{ profile }`
   - `PATCH /profiles/:id` → `{ profile }` (owner only)
   - `POST /profiles/claim {duplicateProfileId}` → `{ profile }` (same-name only)
   - Errors as `{ message }` with proper HTTP status (404 drives not-found UI).
5. Set `VITE_DATA_SOURCE=http` and `VITE_API_URL=https://<your-api>` in `.env`.
6. Rate limits + abuse controls (votes, comments, uploads) — none exist today.
7. Tighten RLS (moderation roles), add CSP headers, move Google to auth-code flow
   with server-side verification. See the security review notes before real users.

## What NOT to do

- Do not ship the localStorage build to real users as "the backend".
- Do not accept `signinWithGoogleAccount` claims without server verification —
  the local repo trusts them only because there is no server to lie to.
