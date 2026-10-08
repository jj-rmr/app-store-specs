# Team setup (5 minutes)

1. Clone the repo and enter it:
   `git clone <repo-url>` then `cd app-store-specs`
2. Install dependencies: `npm install`
3. Copy the env template: copy `.env.example` to `.env`
4. Ask the team lead for the `VITE_GOOGLE_CLIENT_ID` value and paste it into `.env`
5. Run it: `npm run dev` → open http://localhost:3000

Notes:

- `.env` is gitignored and never pushed. Only `.env.example` is committed.
- Everyone gets a fresh local database (browser localStorage). Seeds load automatically.
- Sign in with a Google account. There is no demo account.
- Never commit `dist/` — it is build output.
