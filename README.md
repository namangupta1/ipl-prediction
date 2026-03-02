# IPL Prediction Game

A Next.js + Supabase app for running IPL match prediction contests with:
- Public gameplay (`/ipl`)
- Match/question APIs for answering and scoring
- A cookie-authenticated CMS (`/cms`) for operators

## Tech Stack
- Next.js 16 (App Router)
- React 19
- TypeScript
- Supabase (Postgres + REST via `@supabase/supabase-js`)
- Tailwind CSS 4

## Prerequisites
- Node.js 20+
- npm
- A Supabase project

## Environment Variables
Copy `.env.example` to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CMS_OTP_CODE`
- `CMS_SESSION_SECRET`

## Database Setup
This repo includes:
- Base schema: `supabase/schema.sql`
- Migration for lock/settlement fields: `supabase/migrations/20260302143000_question_settlement_columns.sql`

Run both SQL files in your Supabase SQL editor (schema first, then migration).

Key tables:
- `matches`
- `questions`
- `options`
- `answers`
- `user_profiles`
- `winners`
- `cms_allowed_phones`

## Install & Run
```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000/ipl` for gameplay
- `http://localhost:3000/cms` for CMS login

## Scripts
- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - run ESLint

## App Routes
- `/` - placeholder landing page
- `/ipl` - matches listing / entrypoint
- `/ipl/play` - gameplay screen (`match_id` query param)
- `/cms` - CMS login
- `/cms/dashboard` - CMS dashboard

## API Routes (Current)
Public gameplay/data:
- `GET /api/matches`
- `GET /api/match?match_id=<uuid>`
- `GET /api/questions?match_id=<uuid>[&mode=all]`
- `POST /api/answers`
- `GET /api/my-answers?match_id=<uuid>&user_key=<uuid>`
- `GET /api/settled-questions?match_id=<uuid>`

CMS/session:
- `POST /api/cms/login`
- `POST /api/cms/logout`
- `GET /api/cms/me`
- `GET|POST|DELETE /api/cms/allowlist`
- `GET|POST|PATCH /api/cms/matches`
- `GET|POST|PATCH /api/cms/questions`
- `POST /api/cms/settle`
- `GET /api/cms/ops?match_id=<uuid>`

Utility/testing:
- `GET /api/test`
- `GET /api/match/[id]` (debug response for route params)

## CMS Auth Flow
1. Add operator phone(s) to `cms_allowed_phones`.
2. Sign in at `/cms` with:
   - allowlisted phone
   - OTP equal to `CMS_OTP_CODE`
3. Session is stored in an HTTP-only cookie.

## Notes
- This project currently uses manual match state progression and manual settlement.
- Some endpoints under `src/app/api` are operational/debug endpoints; keep this in mind before exposing publicly.
- Product specs are in `docs/PRD.md` and analytics notes in `docs/Analytics_Spec.md`.
