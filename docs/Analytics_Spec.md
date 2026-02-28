# Analytics Spec: DB IPL — Guess & Earn

**Phase:** 1
**Date:** 2026-03-01
**Related PRD:** [`docs/PRD.md`](./PRD.md)

---

## A. Tracking Principles

| Principle | Rule |
|-----------|------|
| **Naming** | All event names: `snake_case`, prefixed `ipl_` (game) or `ipl_cms_` (CMS). |
| **Stability** | Event names must not change after launch. Deprecate by adding `_v2` suffix, never rename. |
| **Privacy** | No PII in event properties. No phone numbers, emails, full names, or IP addresses in game-side events. CMS events use hashed `cms_user_id`, never raw phone numbers. |
| **Deduplication** | Every event must define a dedupe rule. Default: one fire per `(user_key, event_name, match_id, timestamp_minute)` unless overridden. |
| **Timestamps** | All timestamps in UTC. Property name: `fired_at` (ISO 8601, must end with `Z`). |
| **Cardinality** | Avoid high-cardinality params (free-text, raw URLs). If justified, document why. |

---

## B. Entities & Identifiers

| Identifier | Type | Source | Description |
|------------|------|--------|-------------|
| `user_key` | string (UUID) | Cookie / localStorage | Anonymous game player identifier. Persists across sessions. |
| `session_id` | string (UUID) | Client-generated | Browser session. Rotates on tab close or 30 min inactivity. |
| `match_id` | string (UUID) | Supabase `matches.id` | The match this event relates to. |
| `question_id` | string (UUID) | Supabase `questions.id` | The question this event relates to. |
| `cms_user_id` | string (UUID) | Derived from CMS auth token | CMS editor identifier. SHA-256 hash of phone number, not raw PII. |

---

## C. Event Dictionary

### Game Events

---

#### ipl_page_view

**Purpose:** Track when a user navigates to any game page.
**Trigger Condition:** The `/ipl` or `/ipl/my-rewards` route mounts and renders in the browser.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.1, Step 1; PRD Section 5.6, Step 1

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `session_id` | string (UUID) | `"s9s8s7s6-s5s4-s3s2-s1s0-s0s1s2s3s4s5"` |
| `page_path` | string | `"/ipl"` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T14:30:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `referrer` | string | `"whatsapp"` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `page_path` + `session_id` per minute.

**Test Case:** Open `/ipl` in a browser. Confirm one `ipl_page_view` event appears in the analytics debugger with `page_path: "/ipl"`. Refresh the page — a second event must fire.

**Example Payload:**
```json
{
  "event": "ipl_page_view",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "session_id": "s9s8s7s6-s5s4-s3s2-s1s0-s0s1s2s3s4s5",
    "page_path": "/ipl",
    "fired_at": "2026-04-01T14:30:00Z"
  }
}
```

---

#### ipl_match_loaded

**Purpose:** Track when match data successfully renders on screen.
**Trigger Condition:** The API response from GET `/api/matches/current` returns 200 and the match data renders in the GamePage component.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.1, Step 1 (system loads the current match)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `match_state` | string (enum) | `"innings_1_phase_1"` |
| `match_number` | integer | `12` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T14:30:01Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `session_id` | string (UUID) | `"s9s8s7s6-s5s4-s3s2-s1s0-s0s1s2s3s4s5"` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `match_id` per session.

**Test Case:** Navigate to `/ipl`. Confirm `ipl_match_loaded` fires after match data renders. Verify `match_state` matches the current match state in the database.

**Example Payload:**
```json
{
  "event": "ipl_match_loaded",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "match_state": "innings_1_phase_1",
    "match_number": 12,
    "fired_at": "2026-04-01T14:30:01Z"
  }
}
```

---

#### ipl_question_impression

**Purpose:** Track when a question card becomes visible to the user.
**Trigger Condition:** A `QuestionCard` component enters the viewport (via Intersection Observer) or becomes the active card in the `QuestionFlow` sequence.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.1, Step 3 (system displays the first unanswered question)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `question_id` | string (UUID) | `"q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5"` |
| `question_category` | string (enum) | `"innings_1_phase_1"` |
| `question_position` | integer | `3` |
| `is_locked` | boolean | `false` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T14:30:05Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `has_existing_answer` | boolean | `true` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `question_id` per session. Re-fires if user navigates away and returns.

**Test Case:** Open the game page during an active match. Confirm one `ipl_question_impression` fires for the first displayed question. Navigate to the next question — confirm a second impression fires with the new `question_id`.

**Example Payload:**
```json
{
  "event": "ipl_question_impression",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "question_id": "q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5",
    "question_category": "innings_1_phase_1",
    "question_position": 3,
    "is_locked": false,
    "fired_at": "2026-04-01T14:30:05Z"
  }
}
```

---

#### ipl_option_selected

**Purpose:** Track when a user taps/clicks an answer option before submission.
**Trigger Condition:** User taps an option in the `QuestionCard` component. Fires on the click handler, before the API call.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.1, Step 4 (user taps an option)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `question_id` | string (UUID) | `"q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5"` |
| `option_id` | string (UUID) | `"o1o2o3o4-o5o6-o7o8-o9o0-o0o1o2o3o4o5"` |
| `option_position` | integer | `2` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T14:30:10Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `time_since_impression_ms` | integer | `5000` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `question_id` + `option_id` per minute. Allows tracking if user changes selection within the same question.

**Test Case:** Open a question. Tap option B. Confirm `ipl_option_selected` fires with the correct `option_id` and `option_position: 2`. Tap option A — confirm a second event fires with updated values.

**Example Payload:**
```json
{
  "event": "ipl_option_selected",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "question_id": "q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5",
    "option_id": "o1o2o3o4-o5o6-o7o8-o9o0-o0o1o2o3o4o5",
    "option_position": 2,
    "time_since_impression_ms": 5000,
    "fired_at": "2026-04-01T14:30:10Z"
  }
}
```

---

#### ipl_answer_submitted_success

**Purpose:** Track when the server confirms a successful answer save.
**Trigger Condition:** POST `/api/matches/[matchId]/answers` returns HTTP 200. Fires after the API response is received on the client.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.1, Step 4 (server validates and saves, returns 200)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `question_id` | string (UUID) | `"q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5"` |
| `option_id` | string (UUID) | `"o1o2o3o4-o5o6-o7o8-o9o0-o0o1o2o3o4o5"` |
| `question_category` | string (enum) | `"pre_match"` |
| `is_first_answer` | boolean | `true` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T14:30:11Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `time_since_impression_ms` | integer | `6000` |
| `questions_answered_count` | integer | `3` |
| `questions_available_count` | integer | `7` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `question_id` per session. If user edits, `ipl_answer_edit` fires instead.

**Test Case:** Select an option and confirm the answer saves (API 200). Verify `ipl_answer_submitted_success` fires with `is_first_answer: true`. Check that `question_category` matches the question's category from the database.

**Example Payload:**
```json
{
  "event": "ipl_answer_submitted_success",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "question_id": "q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5",
    "option_id": "o1o2o3o4-o5o6-o7o8-o9o0-o0o1o2o3o4o5",
    "question_category": "pre_match",
    "is_first_answer": true,
    "questions_answered_count": 3,
    "questions_available_count": 7,
    "fired_at": "2026-04-01T14:30:11Z"
  }
}
```

---

#### ipl_answer_edit

**Purpose:** Track when a user changes a previously submitted answer before the question locks.
**Trigger Condition:** PUT `/api/matches/[matchId]/answers` returns HTTP 200. The user had a prior answer for this question and changed it.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.1, Step 5 (user navigates back to edit); PRD Section 5.3, Step 4 (user taps Edit)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `question_id` | string (UUID) | `"q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5"` |
| `old_option_id` | string (UUID) | `"o1o2o3o4-o5o6-o7o8-o9o0-o0o1o2o3o4o5"` |
| `new_option_id` | string (UUID) | `"o2o3o4o5-o6o7-o8o9-o0o1-o1o2o3o4o5o6"` |
| `edit_source` | string (enum: `question_flow`, `my_answers`) | `"my_answers"` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T14:35:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `time_since_first_answer_ms` | integer | `300000` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `question_id` + `new_option_id` per minute.

**Test Case:** Submit an answer. Navigate back (or use My Answers → Edit). Select a different option and confirm the PUT succeeds. Verify `ipl_answer_edit` fires with both `old_option_id` and `new_option_id`.

**Example Payload:**
```json
{
  "event": "ipl_answer_edit",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "question_id": "q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5",
    "old_option_id": "o1o2o3o4-o5o6-o7o8-o9o0-o0o1o2o3o4o5",
    "new_option_id": "o2o3o4o5-o6o7-o8o9-o0o1-o1o2o3o4o5o6",
    "edit_source": "my_answers",
    "fired_at": "2026-04-01T14:35:00Z"
  }
}
```

---

#### ipl_question_locked_view

**Purpose:** Track when a user views a question that is in locked state.
**Trigger Condition:** A `QuestionCard` renders with `isLocked: true` — the question's phase has passed and the user can no longer answer or edit.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.3, Step 3 (`locked` display state); PRD Component 6.2 (`locked` state)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `question_id` | string (UUID) | `"q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5"` |
| `question_category` | string (enum) | `"innings_1_phase_1"` |
| `had_answer` | boolean | `true` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T15:00:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `view_source` | string (enum: `question_flow`, `my_answers`) | `"my_answers"` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `question_id` per session.

**Test Case:** Advance match state in CMS so that a phase 1 question becomes locked. Open the game page or My Answers. Confirm `ipl_question_locked_view` fires with `had_answer` reflecting whether the user answered before lock.

**Example Payload:**
```json
{
  "event": "ipl_question_locked_view",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "question_id": "q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5",
    "question_category": "innings_1_phase_1",
    "had_answer": true,
    "view_source": "my_answers",
    "fired_at": "2026-04-01T15:00:00Z"
  }
}
```

---

#### ipl_my_answers_opened

**Purpose:** Track when a user opens the My Answers tab.
**Trigger Condition:** User taps the "My Answers" tab in `TabNavigation` and the `MyAnswersView` component mounts.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.3, Step 1 (user taps My Answers)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `answers_count` | integer | `5` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T14:40:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `settled_count` | integer | `2` |
| `locked_count` | integer | `1` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `match_id` per session. Re-fires on new session.

**Test Case:** Answer at least one question. Tap "My Answers" tab. Confirm `ipl_my_answers_opened` fires with correct `answers_count`.

**Example Payload:**
```json
{
  "event": "ipl_my_answers_opened",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "answers_count": 5,
    "settled_count": 2,
    "locked_count": 1,
    "fired_at": "2026-04-01T14:40:00Z"
  }
}
```

---

#### ipl_leaderboard_opened

**Purpose:** Track when a user opens the Leaderboard tab.
**Trigger Condition:** User taps the "Leaderboard" tab in `TabNavigation` and the `Leaderboard` component mounts with data.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.4, Step 1 (user taps Leaderboard)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `user_rank` | integer or null | `15` |
| `user_score` | integer | `25` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T14:45:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `total_participants` | integer | `342` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `match_id` per session.

**Test Case:** Tap "Leaderboard" tab. Confirm event fires with the user's rank and score matching the API response. If user has not participated, `user_rank` must be `null`.

**Example Payload:**
```json
{
  "event": "ipl_leaderboard_opened",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "user_rank": 15,
    "user_score": 25,
    "total_participants": 342,
    "fired_at": "2026-04-01T14:45:00Z"
  }
}
```

---

#### ipl_share_clicked

**Purpose:** Track when a user taps any share button.
**Trigger Condition:** User clicks the `SocialShareButton` component on the game page header, leaderboard, or winners list.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.2, Step 1 (user taps share button)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `share_source` | string (enum: `game_header`, `leaderboard`, `winners`) | `"leaderboard"` |
| `share_channel` | string | `"whatsapp"` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T14:50:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_score` | integer | `25` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `match_id` + `share_source` per minute. Allows tracking repeated shares from different locations.

**Test Case:** Tap the share button on the leaderboard. Confirm `ipl_share_clicked` fires with `share_source: "leaderboard"` and `share_channel: "whatsapp"`. Confirm WhatsApp intent opens.

**Example Payload:**
```json
{
  "event": "ipl_share_clicked",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "share_source": "leaderboard",
    "share_channel": "whatsapp",
    "user_score": 25,
    "fired_at": "2026-04-01T14:50:00Z"
  }
}
```

---

#### ipl_winners_opened

**Purpose:** Track when a user opens the Winners tab.
**Trigger Condition:** User taps the "Winners" tab in `TabNavigation` and the `WinnersPage` component mounts.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.5, Step 1 (user taps Winners)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `has_winners` | boolean | `true` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T15:00:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `winners_count` | integer | `50` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` + `match_id` per session.

**Test Case:** Tap "Winners" tab. Confirm event fires. If no winners uploaded, `has_winners` must be `false`.

**Example Payload:**
```json
{
  "event": "ipl_winners_opened",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "has_winners": true,
    "winners_count": 50,
    "fired_at": "2026-04-01T15:00:00Z"
  }
}
```

---

#### ipl_rewards_opened

**Purpose:** Track when a user opens the My Rewards page.
**Trigger Condition:** User navigates to `/ipl/my-rewards` and the `MyRewards` component mounts.
**Fires From:** frontend
**Related Flow Step:** PRD Section 5.6, Step 1 (user taps My Rewards)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `user_key` | string (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `has_rewards` | boolean | `false` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T15:05:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `rewards_count` | integer | `0` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `user_key` per session.

**Test Case:** Tap "My Rewards". Confirm event fires with `has_rewards` reflecting whether the API returned any rewards.

**Example Payload:**
```json
{
  "event": "ipl_rewards_opened",
  "properties": {
    "user_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "has_rewards": false,
    "rewards_count": 0,
    "fired_at": "2026-04-01T15:05:00Z"
  }
}
```

---

### CMS Events

---

#### ipl_cms_login_success

**Purpose:** Track when a CMS editor authenticates successfully.
**Trigger Condition:** POST `/api/cms/auth` returns HTTP 200 with a valid token.
**Fires From:** backend
**Related Flow Step:** PRD Section 8.1, Login action

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `cms_user_id` | string (UUID) | `"c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5"` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T12:00:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| none | | |

**User Properties Updated:** none

**Dedupe Rule:** Once per `cms_user_id` per hour.

**Test Case:** Log into the CMS with a valid phone number. Confirm `ipl_cms_login_success` appears in server logs with the hashed `cms_user_id`.

**Example Payload:**
```json
{
  "event": "ipl_cms_login_success",
  "properties": {
    "cms_user_id": "c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5",
    "fired_at": "2026-04-01T12:00:00Z"
  }
}
```

---

#### ipl_cms_match_state_updated

**Purpose:** Track when an editor advances the match state.
**Trigger Condition:** PATCH `/api/cms/matches/[matchId]` returns HTTP 200 with an updated `match_state` field.
**Fires From:** backend
**Related Flow Step:** PRD Section 8.1, Advance Match State; PRD Section 7.1, Match State transitions

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `cms_user_id` | string (UUID) | `"c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `from_state` | string (enum) | `"innings_1_phase_1"` |
| `to_state` | string (enum) | `"innings_1_phase_2"` |
| `questions_locked_count` | integer | `3` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T14:30:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| none | | |

**User Properties Updated:** none

**Dedupe Rule:** Once per `match_id` + `to_state`. A given state transition can only happen once.

**Test Case:** In CMS, advance a match from `innings_1_phase_1` to `innings_1_phase_2`. Confirm event fires with correct `from_state` and `to_state`. Verify `questions_locked_count` matches the number of phase 1 questions that were batch-locked.

**Example Payload:**
```json
{
  "event": "ipl_cms_match_state_updated",
  "properties": {
    "cms_user_id": "c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "from_state": "innings_1_phase_1",
    "to_state": "innings_1_phase_2",
    "questions_locked_count": 3,
    "fired_at": "2026-04-01T14:30:00Z"
  }
}
```

---

#### ipl_cms_questions_created

**Purpose:** Track when an editor creates questions for a match.
**Trigger Condition:** POST `/api/cms/matches/[matchId]/questions` returns HTTP 200.
**Fires From:** backend
**Related Flow Step:** PRD Section 8.1, Upload Questions

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `cms_user_id` | string (UUID) | `"c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `questions_count` | integer | `10` |
| `categories` | string[] | `["pre_match", "innings_1_phase_1", "innings_1_phase_2"]` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T10:00:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| none | | |

**User Properties Updated:** none

**Dedupe Rule:** Once per `cms_user_id` + `match_id` per API call (no time-based dedupe — multiple uploads are valid).

**Test Case:** In CMS, upload 10 questions for a match. Confirm event fires with `questions_count: 10` and the correct list of categories.

**Example Payload:**
```json
{
  "event": "ipl_cms_questions_created",
  "properties": {
    "cms_user_id": "c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "questions_count": 10,
    "categories": ["pre_match", "innings_1_phase_1", "innings_1_phase_2"],
    "fired_at": "2026-04-01T10:00:00Z"
  }
}
```

---

#### ipl_cms_question_edited

**Purpose:** Track when an editor modifies an existing draft question.
**Trigger Condition:** PATCH `/api/cms/questions/[questionId]` returns HTTP 200.
**Fires From:** backend
**Related Flow Step:** PRD Section 11.15 (PATCH question endpoint)

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `cms_user_id` | string (UUID) | `"c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `question_id` | string (UUID) | `"q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5"` |
| `fields_changed` | string[] | `["question_text", "display_order"]` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T10:15:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| none | | |

**User Properties Updated:** none

**Dedupe Rule:** Once per `question_id` per API call.

**Test Case:** In CMS, edit a draft question's text. Confirm event fires with `fields_changed` listing the modified fields.

**Example Payload:**
```json
{
  "event": "ipl_cms_question_edited",
  "properties": {
    "cms_user_id": "c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "question_id": "q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5",
    "fields_changed": ["question_text", "display_order"],
    "fired_at": "2026-04-01T10:15:00Z"
  }
}
```

---

#### ipl_cms_questions_published

**Purpose:** Track when an editor publishes draft questions to make them visible to game users.
**Trigger Condition:** PATCH `/api/cms/questions/publish` returns HTTP 200.
**Fires From:** backend
**Related Flow Step:** PRD Section 8.1, Publish Questions

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `cms_user_id` | string (UUID) | `"c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `questions_published_count` | integer | `10` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T11:00:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `question_ids` | string[] | `["q1...", "q2..."]` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `match_id` per API call.

**Test Case:** In CMS, select draft questions and publish them. Confirm event fires with `questions_published_count` matching the number of questions transitioned to `published`.

**Example Payload:**
```json
{
  "event": "ipl_cms_questions_published",
  "properties": {
    "cms_user_id": "c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "questions_published_count": 10,
    "fired_at": "2026-04-01T11:00:00Z"
  }
}
```

---

#### ipl_cms_correct_answer_marked

**Purpose:** Track when an editor settles a question by marking the correct answer.
**Trigger Condition:** PATCH `/api/cms/questions/[questionId]/settle` returns HTTP 200.
**Fires From:** backend
**Related Flow Step:** PRD Section 8.1, Mark Correct Answer; PRD Section 9.3, Settlement Logic

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `cms_user_id` | string (UUID) | `"c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `question_id` | string (UUID) | `"q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5"` |
| `correct_option_id` | string (UUID) | `"o1o2o3o4-o5o6-o7o8-o9o0-o0o1o2o3o4o5"` |
| `question_category` | string (enum) | `"innings_1_phase_1"` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T16:00:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| `total_answers_for_question` | integer | `1523` |
| `correct_answer_percentage` | number | `34.5` |

**User Properties Updated:** none

**Dedupe Rule:** Once per `question_id`. Settlement is a terminal action.

**Test Case:** In CMS, mark the correct answer for a locked question. Confirm event fires with the correct `question_id` and `correct_option_id`. Verify the question status changed to `settled`.

**Example Payload:**
```json
{
  "event": "ipl_cms_correct_answer_marked",
  "properties": {
    "cms_user_id": "c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "question_id": "q1q2q3q4-q5q6-q7q8-q9q0-q0q1q2q3q4q5",
    "correct_option_id": "o1o2o3o4-o5o6-o7o8-o9o0-o0o1o2o3o4o5",
    "question_category": "innings_1_phase_1",
    "total_answers_for_question": 1523,
    "correct_answer_percentage": 34.5,
    "fired_at": "2026-04-01T16:00:00Z"
  }
}
```

---

#### ipl_cms_winners_uploaded

**Purpose:** Track when an editor uploads the winners list for a match.
**Trigger Condition:** POST `/api/cms/matches/[matchId]/winners` returns HTTP 200.
**Fires From:** backend
**Related Flow Step:** PRD Section 8.1, Upload Winners

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| `cms_user_id` | string (UUID) | `"c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5"` |
| `match_id` | string (UUID) | `"m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5"` |
| `winners_count` | integer | `50` |
| `fired_at` | string (ISO 8601) | `"2026-04-01T18:00:00Z"` |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| none | | |

**User Properties Updated:** none

**Dedupe Rule:** Once per `match_id` per API call. Re-upload (replace) is a valid action and must fire again.

**Test Case:** In CMS, upload 50 winner names for a match. Confirm event fires with `winners_count: 50`.

**Example Payload:**
```json
{
  "event": "ipl_cms_winners_uploaded",
  "properties": {
    "cms_user_id": "c1c2c3c4-c5c6-c7c8-c9c0-c0c1c2c3c4c5",
    "match_id": "m1m2m3m4-m5m6-m7m8-m9m0-m0m1m2m3m4m5",
    "winners_count": 50,
    "fired_at": "2026-04-01T18:00:00Z"
  }
}
```

---

## D. Funnels

| Funnel Name | Steps | Drop-off Signal |
|-------------|-------|-----------------|
| **Game Participation** | `ipl_page_view` → `ipl_match_loaded` → `ipl_question_impression` → `ipl_option_selected` → `ipl_answer_submitted_success` | User views page but never answers. |
| **Submission Completion** | `ipl_question_impression` → `ipl_option_selected` → `ipl_answer_submitted_success` | User sees question but does not select or submit. |
| **Leaderboard Engagement** | `ipl_answer_submitted_success` → `ipl_leaderboard_opened` → `ipl_share_clicked` | User answers but never checks leaderboard or shares. |
| **Winners Flow** | `ipl_leaderboard_opened` → `ipl_winners_opened` → `ipl_rewards_opened` | User checks leaderboard but does not explore winners/rewards. |
| **CMS Publish** | `ipl_cms_login_success` → `ipl_cms_questions_created` → `ipl_cms_questions_published` | Editor creates questions but does not publish. |
| **CMS Settlement** | `ipl_cms_match_state_updated` → `ipl_cms_correct_answer_marked` → `ipl_cms_winners_uploaded` | Editor advances state but does not settle or upload winners. |

---

## E. Metrics Definitions

| Metric | Definition | Derived From |
|--------|-----------|--------------|
| **DAU Participation Rate** | Unique `user_key` count with ≥1 `ipl_answer_submitted_success` per day / total unique `user_key` with ≥1 `ipl_page_view` per day. | `ipl_answer_submitted_success`, `ipl_page_view` |
| **Submission Completion Rate** | Count of `ipl_answer_submitted_success` / count of `ipl_question_impression` per match (unique by `user_key` + `question_id`). | `ipl_answer_submitted_success`, `ipl_question_impression` |
| **Prediction Accuracy Rate** | Count of correct predictions / total settled predictions per user per match. Derived from settlement data joined with answers. | Settlement data + `ipl_answer_submitted_success` |
| **Time to Submit** | Median of `time_since_impression_ms` from `ipl_answer_submitted_success` events per match. | `ipl_answer_submitted_success` (`time_since_impression_ms` param) |
| **Share Rate** | Unique `user_key` count with ≥1 `ipl_share_clicked` / unique `user_key` count with ≥1 `ipl_answer_submitted_success` per match. | `ipl_share_clicked`, `ipl_answer_submitted_success` |
| **Edit Rate** | Count of `ipl_answer_edit` / count of `ipl_answer_submitted_success` per match. | `ipl_answer_edit`, `ipl_answer_submitted_success` |

---

## F. QA Checklist

| # | Check | How to Verify |
|---|-------|---------------|
| 1 | **Event fires** | Trigger the condition manually. Confirm the event appears in the analytics debugger or network tab (frontend) / server logs (backend). |
| 2 | **Required params present** | Inspect payload. Every required param must be non-null and match the documented type. |
| 3 | **No extra params** | Payload must not contain properties not listed in required or optional params for that event. |
| 4 | **Dedupe works** | Trigger the same condition twice in rapid succession. Confirm only one event is recorded per the documented dedupe rule. |
| 5 | **Correct `fires_from`** | Frontend events: confirm via browser network tab. Backend events: confirm via server logs. Both: confirm both sources fire. |
| 6 | **No PII** | Inspect all param values across all events. Confirm no phone numbers, emails, full names, or IP addresses appear. CMS events must use hashed `cms_user_id`. |
| 7 | **Timestamps are UTC** | Confirm every `fired_at` value is ISO 8601 ending with `Z`. No local timezone offsets. |
| 8 | **Funnel order** | Walk through each funnel end-to-end in the game/CMS. Confirm events fire in the documented sequence with no gaps. |
| 9 | **Event naming** | All game events prefixed `ipl_`. All CMS events prefixed `ipl_cms_`. No exceptions. |
| 10 | **Cross-match isolation** | Answer questions for Match A, then switch to Match B. Confirm `match_id` changes correctly in all events. No leakage of Match A's ID into Match B's events. |
