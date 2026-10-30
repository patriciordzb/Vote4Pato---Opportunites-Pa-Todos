# SHPE 2026 | Career Intelligence Command Center

A personal career-intelligence platform and networking CRM for the **2026 SHPE National Convention** (Oct 28–31, 2026, Indiana Convention Center, Indianapolis). It ranks companies against your real engineering background, prepares what to say at each booth, tracks everyone you meet, and drafts follow-ups.

Next.js 15 (App Router, React 19, TypeScript) · Tailwind CSS · Recharts · lucide icons · PostgreSQL (Supabase, or embedded PGlite) · Claude API (server-side) · LinkedIn OpenID Connect.

---

## Quick start (local)

```bash
cd career-platform
npm install
cp .env.example .env.local      # optional locally; everything has a working default
npm run dev                     # http://localhost:3000
```

With no environment variables, the app runs in **local mode**:

- **Database:** an embedded PostgreSQL (PGlite) stored in `.data/pglite/`. Data persists across restarts.
- **Sign-in:** no password (a "Local mode" badge is shown). Set `APP_PASSWORD` to require one.
- **AI:** rule-based engine (scores, pitches, messages, mock interviews and assistant answers still work).
- **LinkedIn:** shows the setup steps in a "not configured" state.

On first start the app creates its tables, loads the research snapshot (`data/shpe2026-dataset.json`) and creates your profile from `data/profile.seed.json` (built from the resume and GRX-810 poster you shared; phone, email and GPA are intentionally *not* stored in the repo).

## Pages

| Page | What it does |
|---|---|
| **Dashboard** `/` | KPIs (verified companies, recruiters, relevant jobs, visits, LinkedIn connections, applications, follow-ups), daily action plan, top matches, stacked compatibility chart, progress bars, activity charts |
| **Company Explorer** `/companies` | Search + filters (industry, score, specialty, job type, HQ location, eligibility, sponsorship info, booth, verification, priority, saved); sort by compatibility, name, industry, opportunities, booth; save / mark visited |
| **Company Intelligence Profile** `/companies/[slug]` | All 14 sections: overview, technologies, developments, why you fit, compatibility breakdown, opportunities, work authorization, recruiters, 15/30/60-s pitches, talking points, questions + tough-question prep, booth & evidence, LinkedIn links, notes/interactions/tasks |
| **Recruiter Directory** `/recruiters` | Add/save people, attendance status (Confirmed requires sourced evidence), notes, mutual connections, per-recruiter prep, connection message and follow-up email |
| **Job Tracker** `/jobs` | Real postings with match score, stated eligibility, verification and listing status; save to tracker, application status, resume-to-job match, add postings |
| **Networking CRM** `/crm` | Kanban pipeline (Want to Meet … Offer Received) for companies and people, quick log, interaction log, follow-up tasks, analytics |
| **Convention Strategy** `/strategy` | Ordered booth checklist with what to say/ask, strongest technical matches, promising opportunities, recruiters to prioritize, pending follow-ups |
| **Recruiter Coach** `/coach` | Pitches, talking points, questions, tough questions, and a mock recruiter chat with feedback on clarity, confidence, technical depth, relevance, professionalism and follow-up questions |
| **LinkedIn Messages** `/messages` | Seven message types personalized with company, recruiter, job and your conversation notes; copy, open LinkedIn, save drafts. Never sends anything |
| **AI Career Assistant** `/assistant` | Grounded Q&A over your profile, database and notes; labels `[Sourced]` vs `[AI advice]`; rule-based answers when AI is off |
| **Profile & LinkedIn** `/profile` | Connect/disconnect LinkedIn, upload resume / LinkedIn PDF / posters / portfolio (review-then-approve extraction), edit profile, career & eligibility settings, experience analysis, LinkedIn improvements, export & delete data |
| **Data & Sources** `/data` | Every source with access date, the confidence system, CSV/JSON import, import history, known limitations |
| **Career-Fair Mode** `/fair` | Phone-first: big search, booth lookup, priority/saved lists, one-tap pitch, one-tap status, quick note + automatic 48-hour reminder, follow-up list |

## How scoring works (explainable)

`src/lib/taxonomy.ts` defines ~33 engineering domains. Your approved profile is turned into per-domain strengths, each backed by the specific evidence it came from (`src/lib/intel.ts`). Each company record tags the domains it works in, with a weight and a sentence of context. `src/lib/scoring.ts` then computes:

| Factor | Weight | Basis |
|---|---|---|
| Technical skill alignment | 30 | weighted overlap of company domains with your skill strengths |
| Research & project relevance | 25 | same, using only research, publications and projects |
| Relevant career opportunities | 20 | best-matching posting on file (halved if it explicitly restricts you); low default plus an evidence gap if none |
| Industry interests & growth | 15 | your ranked industry preferences |
| Networking potential | 10 | participation verification, published booth, recruiters on file, interactions |

Each factor shows its evidence and gaps. A separate **confidence** level drops when participation, job data or the company profile isn't verified. **Eligibility** (`src/lib/eligibility.ts`) is computed separately and only compares *your* settings with what a posting *explicitly* states. It never infers authorization, and a restriction applies to that posting only.

Pitches, talking points and messages (`src/lib/coach.ts`) are built from your profile. Every claim is tied to a fact pattern and disappears if that fact is removed from your profile (covered by a unit test).

## Data accuracy and sources

The research snapshot was compiled on **2026-10-30**. In that build environment `shpe.org` and `cvent.com` were blocked by network policy, so the official pages were read through search-engine index snapshots. The *Data & Sources* page lists every URL.

- **Verified (official company or SHPE page):** GE Aerospace, Honeywell Aerospace (Gold), Amazon (Gold), Apple (Gold), Bank of America (Gold), Wells Fargo (Gold + event page), Microsoft (**booth #831**), Mortenson (**booth #1121**), KLA, Merck, Qnity Electronics.
- **Partially verified:** SHPE 2026–27 Industry Partnership Council members (partnership ≠ booth), Cummins and Purdue (TechPoint article), Granite (event page, year not visible).
- **Unverified for 2026:** Boeing and Bechtel (their SHPE pages refer to earlier years).
- **Recruiters:** none seeded. No individual was publicly confirmed as attending, and the app never invents people.
- **Jobs:** three real postings (GE Aerospace R5029659, plus two Honeywell Aerospace Summer 2027 internships from aggregator listings, marked partially verified).
- **Not available:** official floor plan and exhibitor directory, so no booth coordinates or walking routes are shown.

To refresh, import the official exhibitor list as CSV/JSON on the *Data & Sources* page (template included). Imports are validated with zod and upserted.

## Environment variables

See [`.env.example`](.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `APP_PASSWORD` | **production** | Password for this single-owner app |
| `SESSION_SECRET` | **production** | ≥32 chars; HMAC-signs session cookies |
| `ENCRYPTION_KEY` | **production** | 32 bytes base64; AES-256-GCM for LinkedIn tokens |
| `APP_URL` | for LinkedIn | Public base URL, used for the OAuth redirect |
| `DATABASE_URL` | **production on serverless** | PostgreSQL / Supabase connection string |
| `PGLITE_DIR` | no | Embedded DB location when `DATABASE_URL` is unset |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | optional | LinkedIn OpenID Connect |
| `ANTHROPIC_API_KEY` | optional | Enables AI features (server-side only) |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-opus-5-5` |

## Database

- Schema: [`db/migrations/001_init.sql`](db/migrations/001_init.sql). It has 21 tables (users, profiles, LinkedIn connections, documents, sources, companies, convention participation, recruiters, recruiter evidence, jobs, job eligibility, compatibility assessments, company tracking, recruiter contacts, interactions, outreach drafts, applications, tasks, notes, chat threads, data imports), with check constraints, unique keys and cascading deletes.
- Migrations run automatically on first request and are tracked in `schema_migrations`. To run them by hand: `npm run db:migrate` (uses `DATABASE_URL` if set, else PGlite).
- **Supabase setup:**
  1. Create a project → *Project Settings → Database → Connection string* → copy the **Transaction pooler** URI into `DATABASE_URL`.
  2. `DATABASE_URL=... npm run db:migrate`
  3. Optional hardening: run [`db/supabase-rls.sql`](db/supabase-rls.sql) in the SQL editor. It enables RLS and revokes the public `anon`/`authenticated` roles, so the only way in is the authenticated Next.js server.

## LinkedIn developer setup

1. Go to <https://www.linkedin.com/developers/apps> → **Create app** (a LinkedIn Page is required; your own page or your SHPE chapter's works).
2. **Products** tab → request **Sign In with LinkedIn using OpenID Connect** (approved instantly).
3. **Auth** tab → *Authorized redirect URLs* → add `https://YOUR-DOMAIN/api/linkedin/callback` (and `http://localhost:3000/api/linkedin/callback` for local).
4. Copy the Client ID / Client Secret into `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` and set `APP_URL`.

**What LinkedIn shares:** `openid profile email` gives name, photo, email, locale and a stable member ID. LinkedIn does **not** share work history, education, skills, connections or messages with standard apps. Those require LinkedIn partner programs. Import them through *LinkedIn → Me → View profile → More → Save to PDF*, then upload on the Profile page. The flow uses `state` (CSRF) and `nonce`, stores the access token AES-256-GCM-encrypted, and Disconnect deletes it.

## AI

All Claude calls run server-side in `src/lib/ai.ts` (official `@anthropic-ai/sdk`, model `claude-opus-5-5`, server-side refusal fallback enabled). Prompts carry your approved profile, the sourced company/job records and your notes, with mandatory grounding rules. Without a key, each feature falls back to the deterministic engine and says so in the UI.

## Deploying to Vercel

Vercel functions have no persistent disk, so production needs a hosted PostgreSQL (`DATABASE_URL`). The embedded PGlite database is for local use only.

1. **Get the code onto the branch Vercel deploys.** Vercel's production branch is the repo's default branch (`main`). Either merge this branch into `main`, or after step 2 set *Project → Settings → Git → Production Branch* to this branch. The root `index.html` campaign site is unaffected either way.
2. **Import the project:** <https://vercel.com/new> → pick the GitHub repo → **Root Directory: `career-platform`** (framework auto-detects as Next.js; leave build settings at their defaults). Don't deploy yet if it asks; add the variables first.
3. **Add a database** (pick one):
   - **Neon (easiest):** *Project → Storage → Create Database → Neon (Postgres)* → connect it to the project. This sets `DATABASE_URL` automatically.
   - **Supabase:** copy *Project Settings → Database → Connection string → Transaction pooler* into `DATABASE_URL`. If the first page load fails with `self-signed certificate in certificate chain`, also set `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
4. **Add environment variables** (*Project → Settings → Environment Variables*, scope **Production** and **Preview**):
   - `APP_PASSWORD`: the password you'll type to sign in
   - `SESSION_SECRET`: 32+ random characters
   - `ENCRYPTION_KEY`: 32 random bytes, base64 (e.g. `openssl rand -base64 32`)
   - `APP_URL`: your deployment URL, e.g. `https://your-project.vercel.app` (needed for LinkedIn)
   - optional: `ANTHROPIC_API_KEY`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
5. **Deploy** (or *Deployments → ⋯ → Redeploy* so the new variables apply). Tables, the research snapshot and your profile are created automatically on the first request. Visit `/api/health`: it should return `{"ok":true,"db":"postgres"}`.
6. **LinkedIn (optional):** add `https://your-project.vercel.app/api/linkedin/callback` to your LinkedIn app's authorized redirect URLs.

Notes:
- **Upload limit:** Vercel caps request bodies at ~4.5 MB, so on Vercel uploads are limited to 4 MB per PDF (10 MB elsewhere). Compress larger posters before uploading.
- **Preview deployments:** Vercel protects non-production URLs with Vercel login by default. That's fine for you, but use the production URL on your phone.
- Any Node 20+ host works (`npm run build && npm start`). With a persistent disk you can skip `DATABASE_URL` and keep PGlite.

## Security & privacy

- Every page and API route needs a signed, HttpOnly, SameSite=Lax session cookie (middleware), and every mutation re-checks the session (`requireUserId`).
- Every user-owned query filters by `user_id`. Inputs are validated with zod plus database check constraints.
- Uploads: PDF only, verified by magic bytes (not the browser MIME type), max 10 MB, filenames sanitized, served back only to the owner with `no-store`.
- Secrets stay on the server. Security headers are set (`X-Frame-Options: DENY`, `nosniff`, a strict referrer policy).
- No automatic messaging, connection requests or applications. Messages are copied and sent by you.
- Export everything (`/api/export`) or delete documents, networking data, or everything from the Profile page.
- Company logos load from Google's favicon service by company domain. No personal data is sent.

## Tests

```bash
npm test                    # engine unit tests (scoring, eligibility, grounding, dataset, CSV)
npm run typecheck
# End-to-end (needs a running server on a FRESH database, and Playwright with Chromium):
PGLITE_DIR=.data/e2e npm run dev &
BASE_URL=http://localhost:3000 RESUME_PDF=/path/to/resume.pdf node tests/e2e.cjs
```

The e2e suite checks sign-in redirects, 401s on the API, search, tracking, interaction logging, the recruiter evidence rule, persistence, the CRM, job tracking, the eligibility recalculation, PDF validation and upload, message generation, the assistant, the mock interview, CSV import, and phone-width fair mode with no horizontal overflow.

## Known limitations

- The official SHPE exhibitor directory and floor plan weren't retrievable, so most companies have no booth number. Import the official list when you have it.
- AI and LinkedIn features need credentials. They were built against the documented APIs but haven't been exercised against live services here (no credentials in the build environment).
- Single-owner app by design (one password, one profile). The schema is multi-user ready (`user_id` everywhere).
