# TestDesk — QA Command Center

Bug tracking & test management platform for mobile app testing teams. Developers upload CSV test cases, AI expands them into detailed steps, and testers execute daily batches in a focused wizard. Failed tests become bug reports with screenshots; fixed bugs auto-retest on the tester's next day.

## Stack

- React 18 + Vite + React Router v6
- Tailwind CSS (Obsidian Deep theme)
- Firebase Auth + Firestore + Storage
- Google Gemini API (`gemini-2.5-flash`) for test case expansion

## Getting started

```bash
npm install
cp .env.example .env
# fill in Firebase + Gemini keys
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). First run lands on the admin setup screen — create the first developer account.

### Required environment variables

| Variable | Where to get it |
| --- | --- |
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_APP_ID` | Firebase console → Project settings → General → Your apps → Web app → SDK setup |
| `VITE_GEMINI_API_KEY` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — free tier works |

> Security note: `VITE_GEMINI_API_KEY` ships to the browser. Acceptable for an internal MVP but replace with a Firebase Cloud Function proxy before exposing the app publicly.

## Firebase setup

1. Create a Firebase project (or use an existing one).
2. Enable **Authentication → Email/Password**.
3. Enable **Firestore** (Native mode). All collections are prefixed `td_` to avoid clashes.
4. Enable **Storage**. Default bucket is fine.
5. Deploy security rules + indexes:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add   # pick your project, alias "default"
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
6. Copy the web-app SDK config values into `.env`.

## Architecture

- **Routes** — see `src/App.jsx`. Developer and tester paths diverge at `/dashboard` vs `/my-tests`.
- **State** — `AuthContext` (role + first-run setup), `ProjectContext` (multi-project selector).
- **Services** — `src/services/`
  - `firebaseService.js` — all Firestore CRUD, real-time listeners, Storage uploads
  - `csvParser.js` — PapaParse wrapper with column auto-detect
  - `aiService.js` — Gemini client (`gemini-2.5-flash`) with rolling 5-case batches + short gap; deterministic fallback when the API key is missing
  - `batchSplitter.js` — priority-weighted split (Crit=3, High=2, Med=1.5, Low=1; cap=35 cases or 120 weight), weekend-skip, carry-over + retest injection
- **Pages** — `src/pages/`. Biggest ones are `ExecutionPage` (tester wizard) and `BugDetailPage` (split view + discussion).

## Firestore collections

| Collection | Purpose |
| --- | --- |
| `td_users` | Auth profile + role (`developer` / `tester`) |
| `td_projects` | Multi-project container |
| `td_rounds` | Test round meta (1..N per module) |
| `td_testcases` | Individual cases w/ AI-expanded steps, batch day, retest flags |
| `td_batches` | Daily slice totals, filled on round creation |
| `td_bugs` | Bug reports with screenshots, severity, status |
| `td_comments` | Discussion thread per bug (markdown + attachments) |

## End-to-end flow

1. Dev signs up first admin → creates a project → invites a tester from Settings.
2. Dev uploads a CSV at `/rounds/new` → reviews AI expansions → confirms the batch split → round is live.
3. Tester opens `/my-tests` → "Start Testing" → wizard walks them one case at a time. PASS advances; FAIL opens a slide-in bug report drawer with screenshot upload.
4. Dev reviews bugs from `/bugs` or the dashboard; opens any bug for the split Expected vs Actual view + discussion.
5. Dev clicks **Mark as Fixed** → bug moves to `fixed`, its test case flips to `retest`, and the tester sees it auto-injected as a purple RETEST at the top of their next day.
6. When a module's failures reach 0, `/rounds/:id` shows the funnel and regression table ready to export.

## Deployment

- **Frontend (Vercel)**: `vercel --prod` from project root. Add the same `VITE_*` env vars in the Vercel project settings.
- **Backend**: `firebase deploy --only firestore:rules,firestore:indexes,storage` after any rules change.

## Known dev-mode limitations

- Inviting a tester uses the client-side Firebase Auth SDK, which briefly replaces the developer's session with the new tester's. After inviting, sign back in as the developer. For production, move tester invites to a Firebase Cloud Function using the Admin SDK.
- The Gemini key is in the client bundle for MVP speed; proxy through a Cloud Function before public release.
- CSV uploads are practical up to ~1,500 rows given Gemini free-tier rate limits; tune `batchSize` / `delayMs` in `aiService.js` if needed.
