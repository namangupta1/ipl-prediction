# PRD: DB IPL — Guess & Earn

**Phase:** 1
**Date:** 2026-03-01
**Status:** Draft

---

## 1. Executive Summary

**Product:** DB IPL — Guess & Earn
**Phase:** 1 — Core prediction game, CMS, and match-level leaderboard
**Objective:** Enable users to predict IPL match outcomes by answering scenario-based questions and earn points for correct predictions.

- Dedicated web page for match prediction gameplay with phase-based question delivery
- Anonymous user participation via cookie-based UUID identity (no login required)
- CMS for editors to manage matches, questions, prizes, correct answers, and winners
- Match-level leaderboard with top 100 ranking and social sharing via WhatsApp
- Manual settlement: editors mark correct answers and upload winner lists offline

---

## 2. Objectives

1. Enable anonymous users to answer prediction questions for live IPL matches and accumulate points for correct answers (5 points per correct answer).
2. Deliver questions in a phased sequence (pre-match → innings 1 phase 1/2/3 → innings 2 phase 1/2/3) controlled by CMS-managed match state.
3. Provide a match-level leaderboard showing top 100 users ranked by score, with tiebreaker by earliest participation.
4. Enable CMS editors to create matches, upload questions with options, mark correct answers, upload prize details (image + name), and publish winner lists.
5. Support social sharing of game participation via WhatsApp from the game page, leaderboard, and winners list.

---

## 3. Non-Goals

1. **Android widget** — No native app widget. Web-only in Phase 1.
2. **Real-time cricket API integration** — Match state (phase, innings) is manually controlled by CMS editors. No external data feeds.
3. **Tournament-level leaderboard** — Leaderboard is per-match only. No season-long or multi-match aggregation.
4. **Over-level questions** — Deferred to Phase 2. Phase 1 supports only pre-match and phase-level questions.
5. **Match scorecard display** — No cricket scorecard on the game page in Phase 1.
6. **Analytics instrumentation** — Handled separately by `analytics_skill.md`.

---

## 4. User Personas

### 4.1 Game Player

- **Role:** Anonymous user accessing the prediction game via a shared link.
- **Goal:** Answer prediction questions correctly to earn points, rank on the leaderboard, and win prizes.
- **Key Actions:** View questions → select answers → submit → check leaderboard → view my answers → share on WhatsApp → check rewards.
- **Identity:** UUID stored in cookie/localStorage. No login required.

### 4.2 CMS Editor

- **Role:** Internal team member managing match content and results.
- **Goal:** Set up matches, publish questions before each match, update match state during play, mark correct answers post-phase, and upload winners.
- **Key Actions:** Login via phone allowlist → create match → upload questions → publish → advance match state → mark answers → upload prize → upload winners.
- **Identity:** Phone number on env-var allowlist, authenticated via hardcoded OTP (`0000`).

---

## 5. Deterministic User Flows

### 5.1 Game Play Flow

**Entry Condition:** User navigates to `/ipl`. At least one match exists in the database.
**Exit Condition:** User has answered all available questions and has been prompted for a display name.

1. User opens `/ipl`. → System loads the current/most recent match and its `match_state`.
2. System determines which questions to display based on `match_state`:
   - `upcoming`: Pre-match questions (4 questions).
   - `toss_completed`: Innings 1 phase-level questions in order (phase 1, then 2, then 3).
   - `innings_1_phase_1`: Innings 1 questions — all three phases shown, but only phase 1 is still answerable. Phase 2 and 3 are visible and answerable.
   - `innings_1_phase_2`: Innings 1 phase 2 + phase 3 questions (phase 1 is locked).
   - `innings_1_phase_3`: Innings 1 phase 3 questions only (phase 1 and 2 are locked).
   - `innings_1_completed`: Innings 2 phase-level questions in order (same sub-logic as innings 1).
   - `innings_2_phase_1` through `innings_2_phase_3`: Same display logic as innings 1, applied to innings 2 questions.
   - `completed`: Show message — "Competition has ended. Come back tomorrow for the next match."
3. System displays the first unanswered question with its options. → User sees the question card.
4. User taps an option. → System highlights the selected option. System sends POST to `/api/matches/[matchId]/answers`. Server validates the question is not locked. If valid → save, return 200, advance to next question. If locked → return 403, show "This question has been locked" message.
5. User can navigate back to review/edit previous answers while the question is still active (unlocked).
6. After all currently available questions are answered → System checks localStorage for `name_prompted_{matchId}`. If not set → display NamePrompt modal.
7. User enters a display name (max 10 chars) or dismisses. → If dismissed, system generates a random alphanumeric name (10 chars). System saves via POST `/api/users/profile`. Sets `name_prompted_{matchId}` in localStorage.

**Error Branches:**
- No active match: Show "No matches available" empty state.
- Network error on answer submit: Show retry prompt. Do not advance to next question.
- Question locked between selection and submission: Show "This question has been locked." Disable editing, advance to next unlocked question.

### 5.2 Social Sharing Flow

**Entry Condition:** User is on game page, leaderboard, or winners list. Share button is visible.
**Exit Condition:** WhatsApp share dialog opens.

1. User taps the share button. → System constructs a WhatsApp share URL with the game link (`APP_BASE_URL/ipl`).
2. System opens WhatsApp share intent with pre-filled message and link. → User completes sharing in WhatsApp.

### 5.3 My Answers Flow

**Entry Condition:** User taps "My Answers" tab on the game page.
**Exit Condition:** User views all their answered questions with statuses.

1. User taps "My Answers". → System fetches answers via GET `/api/matches/[matchId]/my-answers?user_key={user_key}`.
2. System displays a list of all questions the user has answered, showing all options and highlighting the user's selection.
3. Each question renders in one of four display states:
   - `active`: Question still open. User's answer is highlighted. "Edit" action is available.
   - `locked`: Question locked (match_state advanced past it). User's answer highlighted. No edit. Lock indicator shown.
   - `correct`: Settled. User's answer was correct. Green indicator.
   - `incorrect`: Settled. User's answer was wrong. Red indicator on user's choice. Green on the correct answer.
4. User taps "Edit" on an active question. → System navigates to that question in the question flow for editing.

### 5.4 Leaderboard Flow

**Entry Condition:** User taps "Leaderboard" tab on game page.
**Exit Condition:** User views the leaderboard.

1. User taps "Leaderboard". → System fetches via GET `/api/matches/[matchId]/leaderboard?user_key={user_key}`.
2. System displays:
   - Header: Match number + team names. Left/right arrows to navigate to other matches.
   - User's own card: Their rank and score (always shown at the top, regardless of position).
   - Top 100 list: Ranked by score descending. Tied users share the same rank. Among ties, the user who submitted their first answer earliest appears higher.
3. User taps left/right arrow. → System loads leaderboard for the adjacent match.

### 5.5 Winners Flow

**Entry Condition:** User taps "Winners" tab on game page.
**Exit Condition:** User views the winners list.

1. User taps "Winners". → System fetches via GET `/api/matches/[matchId]/winners`.
2. System displays:
   - Header: Match number + team names. Left/right arrows for match navigation.
   - List of up to 50 winner names (uploaded by CMS editor).
   - If no winners uploaded: "Winners will be announced soon."
3. User taps left/right arrow. → System loads winners for the adjacent match.

### 5.6 My Rewards Flow

**Entry Condition:** User taps "My Rewards" on game page.
**Exit Condition:** User views their rewards or is redirected to game.

1. User taps "My Rewards". → System opens rewards page at `/ipl/my-rewards`.
2. System fetches via GET `/api/users/rewards?user_key={user_key}`. Server matches user's `display_name` against winner names across all matches.
3. If user has won: Display list of matches won with prize details.
4. If user has not won: Display "No rewards yet" with a "Play Now" CTA that redirects to `/ipl`.

**Known Limitation:** Winner matching is by `display_name`. If the user changes their name after being added to a winner list, matching breaks. This is accepted for Phase 1 since winners are uploaded as names only.

---

## 6. Component Specifications

### 6.1 PrizeBanner

| Field | Value |
|-------|-------|
| `purpose` | Display the prize of the day (image + name) at the top of the game page. |
| `inputs` | `prizeName: string \| null`, `prizeImageUrl: string \| null` |
| `data_source` | `matches` table: `prize_name`, `prize_image_url` fields for the current match. |
| `states` | **loading**: Skeleton placeholder. **populated**: Shows prize image and name. **empty**: Both fields null — hide component entirely. **error**: Image failed to load — show prize name with fallback background. |
| `edge_cases` | Image fails to load: Show prize name only. Prize name null but image exists: Show image only. Both null: Do not render. |

### 6.2 QuestionCard

| Field | Value |
|-------|-------|
| `purpose` | Display a single question with its 2 or 4 answer options and handle user selection. |
| `inputs` | `question: Question`, `selectedOptionId: UUID \| null`, `isLocked: boolean`, `onSelect: (optionId: UUID) => void` |
| `data_source` | Props from parent `QuestionFlow`. |
| `states` | **unanswered**: All options neutral. **selected**: One option highlighted. **locked**: Selection disabled, lock indicator. **correct**: Settled, user was correct — green highlight. **incorrect**: Settled, user was wrong — red on user's pick, green on correct. |
| `edge_cases` | 2 options: Render in single-column layout. 4 options: Render in 2×2 grid. Option text > 80 chars: Truncate with ellipsis. |

### 6.3 QuestionFlow

| Field | Value |
|-------|-------|
| `purpose` | Manage the sequential display of questions, navigation between them, and answer submission. |
| `inputs` | `matchId: UUID`, `userKey: UUID`, `matchState: MatchState` |
| `data_source` | GET `/api/matches/[matchId]/questions` + GET `/api/matches/[matchId]/my-answers?user_key={userKey}`. |
| `states` | **loading**: Fetching questions. **empty**: No questions available (match completed or none published). **active**: Showing questions in sequence. **all_answered**: All available questions answered — trigger name prompt. **error**: API failure with retry. |
| `edge_cases` | User refreshes mid-flow: Restore position from existing answers (show first unanswered). Match state changes while answering: On next submit, server returns 403 — show lock message, advance to next unlocked question. No questions for current phase: "Check back soon for more questions." |

### 6.4 SocialShareButton

| Field | Value |
|-------|-------|
| `purpose` | Trigger a WhatsApp share with a pre-filled message containing the game link. |
| `inputs` | `shareText: string`, `shareUrl: string` |
| `data_source` | `APP_BASE_URL` env var for link construction. |
| `states` | **idle**: Button visible and tappable. |
| `edge_cases` | WhatsApp not installed: Browser opens WhatsApp web or system share sheet. Share URL empty: Fallback to `window.location.origin`. |

### 6.5 MyAnswersView

| Field | Value |
|-------|-------|
| `purpose` | Display all questions the user has answered for the current match with answer status indicators. |
| `inputs` | `matchId: UUID`, `userKey: UUID` |
| `data_source` | GET `/api/matches/[matchId]/my-answers?user_key={userKey}`. |
| `states` | **loading**: Skeleton list. **empty**: "You haven't answered any questions yet" with CTA to play. **populated**: List of questions with status indicators. **error**: API failure with retry. |
| `edge_cases` | No answers yet: Show empty state with CTA. Mixed states in list (some settled, some locked, some active): Render each with its own indicator. User taps edit on a question that locked since page load: Show "Question locked" toast. |

### 6.6 Leaderboard

| Field | Value |
|-------|-------|
| `purpose` | Display the user's rank/score and the top 100 users for a match. |
| `inputs` | `matchId: UUID`, `userKey: UUID` |
| `data_source` | GET `/api/matches/[matchId]/leaderboard?user_key={userKey}`. |
| `states` | **loading**: Skeleton. **populated**: User card + ranked list. **empty**: "No scores yet." **error**: API failure with retry. |
| `edge_cases` | User has not participated: Rank = "—", score = 0, shown at top. Fewer than 100 participants: Show all. All users tied at 0: All rank 1, ordered by first submission time. |

### 6.7 MatchNavigator

| Field | Value |
|-------|-------|
| `purpose` | Display current match identifier and allow navigation to previous/next matches. |
| `inputs` | `currentMatchId: UUID`, `onNavigate: (matchId: UUID) => void` |
| `data_source` | GET `/api/matches` — ordered by `match_number`. |
| `states` | **loading**: Skeleton bar. **populated**: "Match #X: Team A vs Team B" with arrows. **single_match**: One match exists — hide arrows. |
| `edge_cases` | At first match: Disable left arrow. At last match: Disable right arrow. Teams not set: Show "Match #X" only. |

### 6.8 WinnersPage

| Field | Value |
|-------|-------|
| `purpose` | Display the list of winners for a match. |
| `inputs` | `matchId: UUID` |
| `data_source` | GET `/api/matches/[matchId]/winners`. |
| `states` | **loading**: Skeleton. **populated**: Numbered list of winner names. **empty**: "Winners will be announced soon." **error**: API failure with retry. |
| `edge_cases` | Fewer than 50 winners: Show only uploaded names. Winners uploaded before match completed: Show winners (CMS controls timing). |

### 6.9 MyRewards

| Field | Value |
|-------|-------|
| `purpose` | Show rewards the user has won across matches, or nudge them to participate. |
| `inputs` | `userKey: UUID` |
| `data_source` | GET `/api/users/rewards?user_key={userKey}`. |
| `states` | **loading**: Skeleton. **has_rewards**: List of match prizes won. **no_rewards**: "No rewards yet" with "Play Now" CTA to `/ipl`. **error**: API failure. |
| `edge_cases` | Winner matching is by `display_name` — if user changes name after winning, match breaks. Accepted Phase 1 limitation. |

### 6.10 NamePrompt

| Field | Value |
|-------|-------|
| `purpose` | Prompt the user to enter a display name for the leaderboard after answering all available questions. Shown once per match. |
| `inputs` | `userKey: UUID`, `matchId: UUID`, `onComplete: (name: string) => void` |
| `data_source` | POST `/api/users/profile`. |
| `states` | **visible**: Modal with text input + submit button. **submitting**: Loading on submit. **dismissed**: User closed modal — system generates random 10-char name. |
| `edge_cases` | Name > 10 chars: Truncate to 10 on server. Special characters: Allow alphanumeric + spaces only, strip others. Empty on submit: Treat as dismissed, generate random name. Already prompted: Check `localStorage name_prompted_{matchId}`, do not re-show. |

### 6.11 RulesSection

| Field | Value |
|-------|-------|
| `purpose` | Display the game rules at the bottom of the game page. |
| `inputs` | None (static content). |
| `data_source` | Hardcoded. |
| `states` | **rendered**: Always visible at page bottom. |
| `edge_cases` | None. Static component. |

### 6.12 TabNavigation

| Field | Value |
|-------|-------|
| `purpose` | Tab bar for switching between Questions, My Answers, Leaderboard, and Winners views. |
| `inputs` | `activeTab: string`, `onTabChange: (tab: string) => void` |
| `data_source` | None (UI-only). |
| `states` | **active_tab**: One tab highlighted, others neutral. |
| `edge_cases` | Deep link to a specific tab via URL hash: Parse on mount, set active tab. |

---

## 7. State Machines

### 7.1 Match State (`match_state`)

**Enum values:** `upcoming`, `toss_completed`, `innings_1_phase_1`, `innings_1_phase_2`, `innings_1_phase_3`, `innings_1_completed`, `innings_2_phase_1`, `innings_2_phase_2`, `innings_2_phase_3`, `completed`

**Valid transitions:**

| From | To | Trigger |
|------|----|---------|
| `upcoming` | `toss_completed` | CMS editor advances match state. |
| `toss_completed` | `innings_1_phase_1` | CMS editor advances match state. |
| `innings_1_phase_1` | `innings_1_phase_2` | CMS editor advances match state. |
| `innings_1_phase_2` | `innings_1_phase_3` | CMS editor advances match state. |
| `innings_1_phase_3` | `innings_1_completed` | CMS editor advances match state. |
| `innings_1_completed` | `innings_2_phase_1` | CMS editor advances match state. |
| `innings_2_phase_1` | `innings_2_phase_2` | CMS editor advances match state. |
| `innings_2_phase_2` | `innings_2_phase_3` | CMS editor advances match state. |
| `innings_2_phase_3` | `completed` | CMS editor advances match state. |

**Invalid transitions:** Any transition that skips a state (e.g., `upcoming` → `innings_1_phase_2`) must be rejected by the API. Backward transitions must be rejected.

### 7.2 Question Status (`question_status`)

**Enum values:** `draft`, `published`, `locked`, `settled`

**Valid transitions:**

| From | To | Trigger |
|------|----|---------|
| `draft` | `published` | CMS editor publishes the question. |
| `published` | `locked` | Match state advances past the question's `question_category`. Server batch-updates automatically. |
| `locked` | `settled` | CMS editor marks the correct answer for this question. |

**Invalid transitions:** `settled` → any (terminal). `published` → `draft` (no unpublish). `locked` → `published` (no unlock). `draft` → `locked` (must publish first).

### 7.3 Answer Display State (derived, not stored)

**Enum values:** `active`, `locked`, `correct`, `incorrect`

| State | Derivation |
|-------|-----------|
| `active` | `question_status` = `published` AND user has answered. |
| `locked` | `question_status` = `locked` AND not yet settled. |
| `correct` | `question_status` = `settled` AND user's selected option = correct option. |
| `incorrect` | `question_status` = `settled` AND user's selected option ≠ correct option. |

---

## 8. CMS Workflow Specification

### 8.1 Editor Actions

| Action | Description | Endpoint |
|--------|-------------|----------|
| **Login** | Enter phone number + OTP (`0000`). Server validates phone is in `CMS_ALLOWED_PHONES`. | POST `/api/cms/auth` |
| **Create Match** | Enter match number, team A, team B, match date, prize name, prize image. Created in `upcoming` state. | POST `/api/cms/matches` |
| **Upload Questions** | Create questions for a match. Each: text, 2 or 4 options, `question_category`, `display_order`. Created in `draft` status. | POST `/api/cms/matches/[matchId]/questions` |
| **Publish Questions** | Batch-change question status from `draft` to `published`. Makes them visible to game users. | PATCH `/api/cms/questions/publish` |
| **Advance Match State** | Move match to the next state in the state machine. Triggers automatic locking of questions whose category has been passed. | PATCH `/api/cms/matches/[matchId]` |
| **Mark Correct Answer** | Select the correct option for a locked question. Changes status to `settled`. | PATCH `/api/cms/questions/[questionId]/settle` |
| **Upload Prize** | Set prize name and prize image URL for a match. | PATCH `/api/cms/matches/[matchId]` |
| **Upload Winners** | Upload a list of up to 50 winner names for a match. | POST `/api/cms/matches/[matchId]/winners` |

### 8.2 Field-Level Validation

| Entity | Field | Validation |
|--------|-------|------------|
| Match | `match_number` | Positive integer, unique across all matches. |
| Match | `team_a`, `team_b` | Non-empty string, max 50 characters. |
| Match | `match_date` | Valid ISO 8601 date. |
| Match | `prize_name` | String, max 100 characters. Nullable. |
| Match | `prize_image_url` | Valid URL or Supabase storage path. Nullable. |
| Question | `question_text` | Non-empty string, max 200 characters. |
| Question | `question_category` | Must be a valid `QuestionCategory` enum value. |
| Question | `display_order` | Positive integer, unique within (`match_id`, `question_category`). |
| Option | `option_text` | Non-empty string, max 80 characters. |
| Option | count per question | Exactly 2 or exactly 4 options. |
| Winner | `winner_name` | Non-empty string, max 50 characters. |
| Winner | count per match | Maximum 50. |

### 8.3 Role-Based Access

| Role | Permissions |
|------|-------------|
| **CMS Editor** (phone-allowlisted) | All CMS actions: create/edit matches, upload/publish questions, advance state, mark answers, upload prizes, upload winners. |
| **Game Player** (anonymous) | Read: published questions, leaderboard, winners. Write: own answers only (server-validated). |
| **Unauthenticated** | No CMS access. Game page is publicly readable. |

### 8.4 Content Lifecycle

- **Questions:** `draft` → `published` → `locked` (automatic on match state advance) → `settled` (editor marks correct answer).
- **Matches:** `upcoming` → (sequential state progression) → `completed`.
- **Winners:** Created (uploaded via CMS) → immediately visible to all users.
- **Prizes:** Set on match creation or updated later via CMS. Displayed on game page.

---

## 9. Game Logic Specification

### 9.1 Scoring Rules

**Formula:** `score = COUNT(correct_answers) × 5`

- Correct answer: **+5 points**.
- Incorrect answer: **0 points**.
- Unanswered question: **0 points**.
- Score is calculated per match. No cross-match accumulation in Phase 1.

### 9.2 Lock Conditions

Questions become immutable (locked) based on their `question_category` and the current `match_state`:

| Question Category | Locked When `match_state` Advances Past |
|-------------------|------------------------------------------|
| `pre_match` | `upcoming` (locked at `toss_completed`) |
| `innings_1_phase_1` | `innings_1_phase_1` (locked at `innings_1_phase_2`) |
| `innings_1_phase_2` | `innings_1_phase_2` (locked at `innings_1_phase_3`) |
| `innings_1_phase_3` | `innings_1_phase_3` (locked at `innings_1_completed`) |
| `innings_2_phase_1` | `innings_2_phase_1` (locked at `innings_2_phase_2`) |
| `innings_2_phase_2` | `innings_2_phase_2` (locked at `innings_2_phase_3`) |
| `innings_2_phase_3` | `innings_2_phase_3` (locked at `completed`) |

**Enforcement:** Server-side only. The API must check `match_state` against the question's `question_category` and reject submissions (HTTP 403) if locked. Client-side lock indicators are cosmetic only.

**Automatic batch update:** When `match_state` changes, the server must update all questions whose `question_category` maps to a now-passed state from `published` → `locked`.

### 9.3 Settlement Logic

1. After a question is locked, the CMS editor marks the correct option via PATCH `/api/cms/questions/[questionId]/settle`.
2. Server sets `is_correct = true` on the chosen option and updates `question_status` to `settled`.
3. Settlement can happen at any time after lock. No automatic settlement exists.
4. Winner list is determined offline and uploaded manually via CMS. System ranking is informational — it does not determine winners.

### 9.4 Tiebreaker Rules

1. Users with the same score for a match receive the same rank.
2. Among tied users, the one whose first answer for that match has the earliest `created_at` timestamp appears higher in the list.
3. Rank formula: `rank = 1 + COUNT(DISTINCT users with score > this_user's score)`.

### 9.5 Time References

- All timestamps stored in the database must be UTC (`timestamptz`).
- UI must display dates/times in IST (UTC+5:30) for user-facing content.
- Lock enforcement uses `match_state` enum comparisons, not time-based comparisons.

---

## 10. Data Model

### 10.1 `matches`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `match_number` | integer | NOT NULL, UNIQUE |
| `team_a` | text | NOT NULL, max 50 chars |
| `team_b` | text | NOT NULL, max 50 chars |
| `match_date` | date | NOT NULL |
| `match_state` | `match_state_enum` | NOT NULL, default `upcoming` |
| `prize_name` | text | NULLABLE, max 100 chars |
| `prize_image_url` | text | NULLABLE |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL, default `now()` |

**`match_state_enum`:** `upcoming`, `toss_completed`, `innings_1_phase_1`, `innings_1_phase_2`, `innings_1_phase_3`, `innings_1_completed`, `innings_2_phase_1`, `innings_2_phase_2`, `innings_2_phase_3`, `completed`

### 10.2 `questions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `match_id` | UUID | NOT NULL, FK → `matches.id` |
| `question_text` | text | NOT NULL, max 200 chars |
| `question_category` | `question_category_enum` | NOT NULL |
| `display_order` | integer | NOT NULL |
| `question_status` | `question_status_enum` | NOT NULL, default `draft` |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL, default `now()` |

**`question_category_enum`:** `pre_match`, `innings_1_phase_1`, `innings_1_phase_2`, `innings_1_phase_3`, `innings_2_phase_1`, `innings_2_phase_2`, `innings_2_phase_3`

**`question_status_enum`:** `draft`, `published`, `locked`, `settled`

**Unique constraint:** (`match_id`, `question_category`, `display_order`)

### 10.3 `options`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `question_id` | UUID | NOT NULL, FK → `questions.id` ON DELETE CASCADE |
| `option_text` | text | NOT NULL, max 80 chars |
| `display_order` | integer | NOT NULL |
| `is_correct` | boolean | NULLABLE, default NULL (set on settlement) |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL, default `now()` |

### 10.4 `answers`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `user_key` | UUID | NOT NULL |
| `match_id` | UUID | NOT NULL, FK → `matches.id` |
| `question_id` | UUID | NOT NULL, FK → `questions.id` |
| `option_id` | UUID | NOT NULL, FK → `options.id` |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL, default `now()` |

**Unique constraint:** (`user_key`, `question_id`) — one answer per user per question. Upsert on conflict.

### 10.5 `user_profiles`

| Column | Type | Constraints |
|--------|------|-------------|
| `user_key` | UUID | PK |
| `display_name` | text | NOT NULL, max 10 chars |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL, default `now()` |

### 10.6 `winners`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `match_id` | UUID | NOT NULL, FK → `matches.id` |
| `winner_name` | text | NOT NULL, max 50 chars |
| `display_order` | integer | NOT NULL |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL, default `now()` |

### Relationships

- `matches` 1 → N `questions` (via `questions.match_id`)
- `questions` 1 → N `options` (via `options.question_id`)
- `questions` 1 → N `answers` (via `answers.question_id`)
- `matches` 1 → N `answers` (via `answers.match_id`)
- `matches` 1 → N `winners` (via `winners.match_id`)
- `user_profiles.user_key` referenced by `answers.user_key` (no FK constraint — anonymous users may submit answers before creating a profile)

---

## 11. API Contract

### 11.1 GET `/api/matches/current`

| Field | Value |
|-------|-------|
| `method` | GET |
| `path` | `/api/matches/current` |
| `request_body` | None |
| `response_body` | `{ match: { id, match_number, team_a, team_b, match_date, match_state, prize_name, prize_image_url } }` |
| `auth` | None (public) |
| `errors` | `404`: No active match found. |

### 11.2 GET `/api/matches`

| Field | Value |
|-------|-------|
| `method` | GET |
| `path` | `/api/matches` |
| `request_body` | None |
| `response_body` | `{ matches: [{ id, match_number, team_a, team_b, match_date, match_state }] }` |
| `auth` | None (public) |
| `errors` | Returns empty array if no matches. |

### 11.3 GET `/api/matches/[matchId]/questions`

| Field | Value |
|-------|-------|
| `method` | GET |
| `path` | `/api/matches/[matchId]/questions` |
| `request_body` | None |
| `response_body` | `{ questions: [{ id, question_text, question_category, display_order, question_status, options: [{ id, option_text, display_order }] }] }` |
| `auth` | None (public). Returns only `published`, `locked`, `settled` questions. Excludes `draft`. For `settled` questions, includes `is_correct` on options. |
| `errors` | `404`: Match not found. |

### 11.4 POST `/api/matches/[matchId]/answers`

| Field | Value |
|-------|-------|
| `method` | POST |
| `path` | `/api/matches/[matchId]/answers` |
| `request_body` | `{ user_key: UUID, question_id: UUID, option_id: UUID }` |
| `response_body` | `{ answer: { id, user_key, question_id, option_id, created_at } }` |
| `auth` | None (public). `user_key` from client cookie. |
| `errors` | `400`: `option_id` does not belong to `question_id`. `403`: Question is locked. `404`: Match or question not found. `409`: Answer already exists — use PUT to update. |

### 11.5 PUT `/api/matches/[matchId]/answers`

| Field | Value |
|-------|-------|
| `method` | PUT |
| `path` | `/api/matches/[matchId]/answers` |
| `request_body` | `{ user_key: UUID, question_id: UUID, option_id: UUID }` |
| `response_body` | `{ answer: { id, user_key, question_id, option_id, updated_at } }` |
| `auth` | None (public). |
| `errors` | `400`: Invalid `option_id`. `403`: Question is locked. `404`: No existing answer to update. |

### 11.6 GET `/api/matches/[matchId]/my-answers`

| Field | Value |
|-------|-------|
| `method` | GET |
| `path` | `/api/matches/[matchId]/my-answers?user_key={user_key}` |
| `request_body` | None |
| `response_body` | `{ answers: [{ question_id, question_text, question_category, question_status, options: [{ id, option_text, is_correct }], selected_option_id }] }` |
| `auth` | None (public). |
| `errors` | `400`: Missing `user_key`. `404`: Match not found. |

### 11.7 GET `/api/matches/[matchId]/leaderboard`

| Field | Value |
|-------|-------|
| `method` | GET |
| `path` | `/api/matches/[matchId]/leaderboard?user_key={user_key}` |
| `request_body` | None |
| `response_body` | `{ user: { rank, score, display_name }, leaderboard: [{ rank, score, display_name }] }` |
| `auth` | None (public). Top 100 entries returned. |
| `errors` | `404`: Match not found. |

### 11.8 POST `/api/users/profile`

| Field | Value |
|-------|-------|
| `method` | POST |
| `path` | `/api/users/profile` |
| `request_body` | `{ user_key: UUID, display_name: string }` |
| `response_body` | `{ profile: { user_key, display_name } }` |
| `auth` | None (public). Upsert — creates or updates. |
| `errors` | `400`: `display_name` empty or exceeds 10 chars after sanitization. |

### 11.9 GET `/api/matches/[matchId]/winners`

| Field | Value |
|-------|-------|
| `method` | GET |
| `path` | `/api/matches/[matchId]/winners` |
| `request_body` | None |
| `response_body` | `{ winners: [{ winner_name, display_order }] }` |
| `auth` | None (public). |
| `errors` | `404`: Match not found. |

### 11.10 GET `/api/users/rewards`

| Field | Value |
|-------|-------|
| `method` | GET |
| `path` | `/api/users/rewards?user_key={user_key}` |
| `request_body` | None |
| `response_body` | `{ rewards: [{ match_number, team_a, team_b, prize_name, prize_image_url }] }` |
| `auth` | None (public). |
| `errors` | `400`: Missing `user_key`. |

### 11.11 POST `/api/cms/auth`

| Field | Value |
|-------|-------|
| `method` | POST |
| `path` | `/api/cms/auth` |
| `request_body` | `{ phone: string, otp: string }` |
| `response_body` | `{ token: string }` |
| `auth` | None (this is the auth endpoint). |
| `errors` | `401`: Phone not in `CMS_ALLOWED_PHONES` or OTP ≠ `CMS_OTP_CODE`. |

### 11.12 POST `/api/cms/matches`

| Field | Value |
|-------|-------|
| `method` | POST |
| `path` | `/api/cms/matches` |
| `request_body` | `{ match_number, team_a, team_b, match_date, prize_name?, prize_image_url? }` |
| `response_body` | `{ match: { id, match_number, match_state: "upcoming", ... } }` |
| `auth` | CMS token required. |
| `errors` | `400`: Validation error. `401`: Unauthorized. `409`: `match_number` already exists. |

### 11.13 PATCH `/api/cms/matches/[matchId]`

| Field | Value |
|-------|-------|
| `method` | PATCH |
| `path` | `/api/cms/matches/[matchId]` |
| `request_body` | `{ match_state?, prize_name?, prize_image_url?, team_a?, team_b? }` |
| `response_body` | `{ match: { id, match_state, ... } }` |
| `auth` | CMS token required. |
| `errors` | `400`: Invalid state transition (skip or backward). `401`: Unauthorized. `404`: Match not found. |

### 11.14 POST `/api/cms/matches/[matchId]/questions`

| Field | Value |
|-------|-------|
| `method` | POST |
| `path` | `/api/cms/matches/[matchId]/questions` |
| `request_body` | `{ questions: [{ question_text, question_category, display_order, options: [{ option_text, display_order }] }] }` |
| `response_body` | `{ questions: [{ id, question_text, question_status: "draft", ... }] }` |
| `auth` | CMS token required. |
| `errors` | `400`: Wrong option count (must be 2 or 4), missing fields. `401`: Unauthorized. `404`: Match not found. |

### 11.15 PATCH `/api/cms/questions/[questionId]`

| Field | Value |
|-------|-------|
| `method` | PATCH |
| `path` | `/api/cms/questions/[questionId]` |
| `request_body` | `{ question_text?, question_category?, display_order? }` |
| `response_body` | `{ question: { id, ... } }` |
| `auth` | CMS token required. |
| `errors` | `400`: Validation error. `401`: Unauthorized. `403`: Question not in `draft` status. `404`: Not found. |

### 11.16 PATCH `/api/cms/questions/publish`

| Field | Value |
|-------|-------|
| `method` | PATCH |
| `path` | `/api/cms/questions/publish` |
| `request_body` | `{ question_ids: [UUID] }` |
| `response_body` | `{ updated: int }` |
| `auth` | CMS token required. |
| `errors` | `400`: Some questions not in `draft` status. `401`: Unauthorized. |

### 11.17 PATCH `/api/cms/questions/[questionId]/settle`

| Field | Value |
|-------|-------|
| `method` | PATCH |
| `path` | `/api/cms/questions/[questionId]/settle` |
| `request_body` | `{ correct_option_id: UUID }` |
| `response_body` | `{ question: { id, question_status: "settled" }, correct_option: { id, is_correct: true } }` |
| `auth` | CMS token required. |
| `errors` | `400`: `option_id` does not belong to question. `401`: Unauthorized. `403`: Question not in `locked` status. `404`: Not found. |

### 11.18 POST `/api/cms/matches/[matchId]/winners`

| Field | Value |
|-------|-------|
| `method` | POST |
| `path` | `/api/cms/matches/[matchId]/winners` |
| `request_body` | `{ winners: [{ winner_name, display_order }] }` |
| `response_body` | `{ winners: [{ id, winner_name, display_order }] }` |
| `auth` | CMS token required. |
| `errors` | `400`: More than 50 winners or validation error. `401`: Unauthorized. `404`: Match not found. |

---

## 12. Build Pack

### 12.1 Pages / Routes

| Route | Page Component | Auth Required | Data Dependencies |
|-------|---------------|---------------|-------------------|
| `/ipl` | `GamePage` | None | `matches`, `questions`, `options`, `answers`, `user_profiles` |
| `/ipl/my-rewards` | `MyRewardsPage` | None | `winners`, `matches`, `user_profiles` |
| `/cms` | `CMSLoginPage` | None (login page) | None |
| `/cms/dashboard` | `CMSDashboardPage` | CMS token | `matches`, `questions`, `options`, `winners` |

### 12.2 React Components

| Component | Location | Props | State Source |
|-----------|----------|-------|-------------|
| `PrizeBanner` | `src/components/PrizeBanner.tsx` | `prizeName, prizeImageUrl` | Parent (match data) |
| `QuestionCard` | `src/components/QuestionCard.tsx` | `question, selectedOptionId, isLocked, onSelect` | Parent (QuestionFlow) |
| `QuestionFlow` | `src/components/QuestionFlow.tsx` | `matchId, userKey, matchState` | API: questions + my-answers |
| `SocialShareButton` | `src/components/SocialShareButton.tsx` | `shareText, shareUrl` | Static |
| `MyAnswersView` | `src/components/MyAnswersView.tsx` | `matchId, userKey` | API: my-answers |
| `Leaderboard` | `src/components/Leaderboard.tsx` | `matchId, userKey` | API: leaderboard |
| `MatchNavigator` | `src/components/MatchNavigator.tsx` | `currentMatchId, onNavigate` | API: matches list |
| `WinnersPage` | `src/components/WinnersPage.tsx` | `matchId` | API: winners |
| `MyRewards` | `src/components/MyRewards.tsx` | `userKey` | API: rewards |
| `NamePrompt` | `src/components/NamePrompt.tsx` | `userKey, matchId, onComplete` | API: profile |
| `RulesSection` | `src/components/RulesSection.tsx` | None | Static |
| `TabNavigation` | `src/components/TabNavigation.tsx` | `activeTab, onTabChange` | Parent |

### 12.3 DB Tables

| Table | Key Columns | RLS Policy |
|-------|-------------|------------|
| `matches` | `id`, `match_number`, `match_state` | SELECT: public. INSERT/UPDATE/DELETE: authenticated CMS only. |
| `questions` | `id`, `match_id`, `question_category`, `question_status` | SELECT: public (WHERE `question_status != 'draft'`). INSERT/UPDATE: authenticated CMS only. |
| `options` | `id`, `question_id`, `is_correct` | SELECT: public. INSERT/UPDATE: authenticated CMS only. `is_correct` hidden for non-settled questions via API logic. |
| `answers` | `id`, `user_key`, `question_id`, `option_id` | SELECT/INSERT/UPDATE: public (server-side lock validation). DELETE: none. |
| `user_profiles` | `user_key`, `display_name` | SELECT/INSERT/UPDATE: public (server validates). |
| `winners` | `id`, `match_id`, `winner_name` | SELECT: public. INSERT/DELETE: authenticated CMS only. |

### 12.4 Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client-side) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, never exposed) | Yes |
| `CMS_ALLOWED_PHONES` | Comma-separated phone numbers for CMS access | Yes |
| `CMS_OTP_CODE` | Hardcoded OTP for CMS login | Yes |
| `APP_BASE_URL` | Base URL for share link construction | Yes |

### 12.5 Implementation Order

1. **Supabase schema** — Create all 6 tables, enums, constraints, RLS policies. File: `supabase/migrations/001_initial_schema.sql`
2. **Supabase client lib** — Browser client + server client. Files: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
3. **User key utility** — Generate/persist anonymous UUID in cookie + localStorage. File: `src/lib/user-key.ts`
4. **CMS auth** — POST `/api/cms/auth` + login page. Files: `src/app/api/cms/auth/route.ts`, `src/app/cms/page.tsx`
5. **CMS match management** — Create/update matches + dashboard. Files: `src/app/api/cms/matches/route.ts`, `src/app/api/cms/matches/[matchId]/route.ts`, `src/app/cms/dashboard/page.tsx`
6. **CMS question management** — Create/edit/publish questions. Files: `src/app/api/cms/matches/[matchId]/questions/route.ts`, `src/app/api/cms/questions/[questionId]/route.ts`, `src/app/api/cms/questions/publish/route.ts`
7. **CMS settlement** — Mark correct answers. File: `src/app/api/cms/questions/[questionId]/settle/route.ts`
8. **CMS winner upload** — Upload winner names. File: `src/app/api/cms/matches/[matchId]/winners/route.ts`
9. **Game match APIs** — GET current match + match list. Files: `src/app/api/matches/route.ts`, `src/app/api/matches/current/route.ts`
10. **Game questions API** — GET questions filtered by match_state. File: `src/app/api/matches/[matchId]/questions/route.ts`
11. **Game answer API** — POST/PUT with lock validation. File: `src/app/api/matches/[matchId]/answers/route.ts`
12. **Game page + QuestionFlow + QuestionCard** — Main game UI with question sequence. Files: `src/app/ipl/page.tsx`, `src/components/QuestionFlow.tsx`, `src/components/QuestionCard.tsx`
13. **PrizeBanner** — Prize display component. File: `src/components/PrizeBanner.tsx`
14. **TabNavigation** — Tab bar for game page sections. File: `src/components/TabNavigation.tsx`
15. **NamePrompt + profile API** — Name entry modal + POST endpoint. Files: `src/components/NamePrompt.tsx`, `src/app/api/users/profile/route.ts`
16. **MyAnswersView + API** — Answer review with states. Files: `src/components/MyAnswersView.tsx`, `src/app/api/matches/[matchId]/my-answers/route.ts`
17. **Leaderboard + API** — Scoring, ranking, display. Files: `src/components/Leaderboard.tsx`, `src/app/api/matches/[matchId]/leaderboard/route.ts`
18. **MatchNavigator** — Match navigation component. File: `src/components/MatchNavigator.tsx`
19. **WinnersPage + public API** — Winners list. Files: `src/components/WinnersPage.tsx`, `src/app/api/matches/[matchId]/winners/route.ts` (public GET)
20. **SocialShareButton** — WhatsApp share. File: `src/components/SocialShareButton.tsx`
21. **MyRewards + API** — Rewards page. Files: `src/app/ipl/my-rewards/page.tsx`, `src/components/MyRewards.tsx`, `src/app/api/users/rewards/route.ts`
22. **RulesSection** — Static rules at page bottom. File: `src/components/RulesSection.tsx`
