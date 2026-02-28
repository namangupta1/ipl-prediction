# Analytics Spec Compiler Skill

## Purpose

Compile a deterministic, implementation-ready analytics instrumentation spec from the PRD. This is not a brainstorming tool. It reads the PRD, extracts trackable surfaces, and produces a strict event dictionary with validation rules.

---

## Required Input

The primary input is `docs/PRD.md`. The skill must read and extract:

- **User Flows** (Section 5) — each flow step is a candidate event trigger.
- **Component Specifications** (Section 6) — each component state is a candidate event trigger.
- **API Contract** (Section 11) — each endpoint is a candidate backend event source.
- **Game Logic** (Section 9) — lock, settlement, and scoring transitions.
- **CMS Workflow** (Section 8) — editor actions.

If `docs/PRD.md` does not exist or is missing any of the above sections, **enter Clarification Mode**.

---

## Clarification Mode

When the PRD is missing required details, the skill must **not** generate the full spec. Instead, output a clarification block using this exact format:

```
## CLARIFICATIONS_NEEDED

### 1. [missing_detail]

**WHY_IT_MATTERS:** [1 sentence explaining what cannot be instrumented without this.]

**OPTIONS:**
- **A:** [plausible default]
- **B:** [alternative]
- **C:** [alternative, if applicable]
- **D:** [alternative, if applicable]

**CHOOSE:** A / B / C / D or provide a custom value.
```

### Behavior Rules
1. List **all** missing details in a single response. Do not ask one at a time.
2. Propose **2–4 concrete options** per missing detail, labeled A / B / C / D.
3. After all clarifications are answered, generate the full spec.
4. If the editor's response introduces new ambiguity, re-enter Clarification Mode for only the unresolved items.

---

## Required Output

Generate the following sections **in this exact order**. Do not add, remove, or reorder sections.

### A. Tracking Principles

Define the rules that govern all events in this spec:

| Principle | Rule |
|-----------|------|
| **Naming** | All event names: `snake_case`, prefixed `ipl_` (game) or `ipl_cms_` (CMS). |
| **Stability** | Event names must not change after launch. Deprecate by adding `_v2` suffix, never rename. |
| **Privacy** | No PII in event properties. No phone numbers, emails, full names, or IP addresses in game-side events. |
| **Deduplication** | Every event must define a dedupe rule. Default: one fire per `(user_key, event_name, match_id, timestamp_minute)` unless overridden. |
| **Timestamps** | All timestamps in UTC. Property name: `fired_at` (ISO 8601). |
| **Cardinality** | Avoid high-cardinality params (free-text, raw URLs). If justified, document why. |

### B. Entities & Identifiers

Define the identifiers used across all events:

| Identifier | Type | Source | Description |
|------------|------|--------|-------------|
| `user_key` | string (UUID) | Cookie / auth | Anonymous or authenticated user identifier. |
| `session_id` | string (UUID) | Client-generated | Browser session, rotates on tab close or 30 min inactivity. |
| `match_id` | string (UUID) | Supabase `matches.id` | The match this event relates to. |
| `question_id` | string (UUID) | Supabase `questions.id` | The question this event relates to. |
| `cms_user_id` | string (UUID) | Supabase Auth | CMS editor performing the action. |

### C. Event Dictionary

The core of this spec. One subsection per event. Each event must include **all** fields below.

#### Event Entry Format

```
#### [event_name]

**Purpose:** [1 sentence]
**Trigger Condition:** [Exact condition that causes this event to fire]
**Fires From:** frontend | backend | both
**Related Flow Step:** [PRD Section 5 step reference, e.g., "Flow 1, Step 3"]

**Required Params:**
| Param | Type | Example |
|-------|------|---------|
| | | |

**Optional Params:**
| Param | Type | Example |
|-------|------|---------|
| | | |

**User Properties Updated:** [list or "none"]

**Dedupe Rule:** [exact rule, e.g., "once per user_key + match_id per session"]

**Test Case:** [1-2 sentences: how to verify this event fires correctly]

**Example Payload:**
```json
{
  "event": "[event_name]",
  "properties": { ... }
}
```
```

#### Minimum Required Events — Game

The spec must include at least these events. Additional events may be added only if they map to a PRD flow step or component state.

| Event Name | Trigger |
|------------|---------|
| `ipl_page_view` | User navigates to any game page. |
| `ipl_match_loaded` | Match data renders on screen. |
| `ipl_question_impression` | A question card enters the viewport. |
| `ipl_option_selected` | User taps/clicks an answer option (before submit). |
| `ipl_answer_submitted_success` | Server confirms answer save (API 200). |
| `ipl_answer_edit` | User changes a previously submitted answer (before lock). |
| `ipl_question_locked_view` | User views a question that is past lock time. |
| `ipl_my_answers_opened` | User opens the "My Answers" / review section. |
| `ipl_leaderboard_opened` | User opens the leaderboard view. |
| `ipl_share_clicked` | User clicks any share button (score, result, invite). |
| `ipl_winners_opened` | User opens the winners section. |
| `ipl_rewards_opened` | User opens the rewards section. |

#### Minimum Required Events — CMS

| Event Name | Trigger |
|------------|---------|
| `ipl_cms_login_success` | CMS user authenticates successfully. |
| `ipl_cms_match_state_updated` | Editor changes match status (e.g., upcoming → live → completed). |
| `ipl_cms_questions_created` | Editor creates one or more questions for a match. |
| `ipl_cms_question_edited` | Editor modifies an existing question. |
| `ipl_cms_questions_published` | Editor publishes questions (makes visible to users). |
| `ipl_cms_correct_answer_marked` | Editor marks the correct answer for a question post-match. |
| `ipl_cms_winners_uploaded` | Editor uploads or confirms the winners list. |

### D. Funnels

Define each funnel as an ordered sequence of events. Every step must reference an event from Section C.

| Funnel Name | Steps |
|-------------|-------|
| **Game Participation** | `ipl_page_view` → `ipl_match_loaded` → `ipl_question_impression` → `ipl_option_selected` → `ipl_answer_submitted_success` |
| **Submission Completion** | `ipl_question_impression` → `ipl_option_selected` → `ipl_answer_submitted_success` |
| **Leaderboard Engagement** | `ipl_answer_submitted_success` → `ipl_leaderboard_opened` → `ipl_share_clicked` |
| **Winners Flow** | `ipl_leaderboard_opened` → `ipl_winners_opened` → `ipl_rewards_opened` |
| **CMS Publish** | `ipl_cms_login_success` → `ipl_cms_questions_created` → `ipl_cms_questions_published` |
| **CMS Settlement** | `ipl_cms_match_state_updated` → `ipl_cms_correct_answer_marked` → `ipl_cms_winners_uploaded` |

### E. Metrics Definitions

| Metric | Definition | Derived From |
|--------|-----------|--------------|
| **DAU Participation Rate** | Unique `user_key` count with at least one `ipl_answer_submitted_success` per day / total unique `ipl_page_view` per day. | `ipl_answer_submitted_success`, `ipl_page_view` |
| **Submission Completion Rate** | Count of `ipl_answer_submitted_success` / count of `ipl_question_impression` (per match). | `ipl_answer_submitted_success`, `ipl_question_impression` |
| **Prediction Accuracy Rate** | Count of correct predictions / total predictions settled (per user, per match, or season). | Settlement data + `ipl_answer_submitted_success` |
| **Time to Submit** | Median time between `ipl_question_impression` and `ipl_answer_submitted_success` for the same `question_id`. | `ipl_question_impression`, `ipl_answer_submitted_success` |
| **Share Rate** | Count of `ipl_share_clicked` / count of `ipl_answer_submitted_success`. | `ipl_share_clicked`, `ipl_answer_submitted_success` |
| **Edit Rate** | Count of `ipl_answer_edit` / count of `ipl_answer_submitted_success`. | `ipl_answer_edit`, `ipl_answer_submitted_success` |

### F. QA Checklist

For each event in Section C, validation must confirm:

| Check | How to Verify |
|-------|---------------|
| **Event fires** | Trigger the condition manually. Confirm event appears in the analytics debugger / network tab. |
| **Required params present** | Inspect payload. Every required param must be non-null and match the expected type. |
| **No extra params** | Payload must not contain undocumented properties. |
| **Dedupe works** | Trigger the same condition twice in rapid succession. Confirm only one event is recorded (per dedupe rule). |
| **Correct `fires_from`** | If `frontend`: confirm via browser network tab. If `backend`: confirm via server logs. If `both`: confirm both fire. |
| **No PII** | Inspect all param values. Confirm no emails, phone numbers, names, or IP addresses. |
| **Timestamps are UTC** | Confirm `fired_at` is ISO 8601 in UTC (ends with `Z`). |
| **Funnel order** | Walk through each funnel end-to-end. Confirm events fire in the documented sequence. |

---

## Rules

1. **No vague language.** Do not use "when appropriate", "as needed", "optionally track". Every event must have an exact trigger condition.
2. **No missing triggers.** If a trigger condition cannot be defined, the event must not be included.
3. **No high-cardinality params without justification.** Free-text fields, raw URLs, or unbounded strings must be documented with a reason.
4. **No PII in game-side events.** Phone numbers, emails, full names, and IP addresses must never appear in game event properties.
5. **CMS events are separate.** All CMS events must be prefixed `ipl_cms_`. Game events must be prefixed `ipl_` (without `cms_`).
6. **Every event maps to the PRD.** The `related_flow_step` field must reference a specific PRD section. Events without a PRD reference must not exist.
7. **Do not invent events.** Only instrument surfaces that exist in the PRD. If a surface is missing from the PRD, enter Clarification Mode.

---

## Output Persistence

When executed inside Claude Code, the skill must follow these file-save rules:

1. **Default path:** Save the generated spec to `docs/Analytics_Spec.md`.
2. **If `docs/Analytics_Spec.md` already exists:**
   - Do **not** overwrite automatically.
   - Ask the editor to choose:
     - **A:** Overwrite `docs/Analytics_Spec.md` (replace existing).
     - **B:** Save as `docs/Analytics_Spec_v{n}.md` (where `{n}` is the next available version number).
3. **Before saving, the skill must:**
   - Show a diff of the new spec against the existing file (if one exists).
   - Wait for the editor to confirm the save action.
   - Never silently create, modify, or overwrite documents.
4. **If `docs/` directory does not exist**, create it before saving.

---

## Final Instruction

The Event Dictionary (Section C) must be implementation-ready. A developer must be able to read an event entry and instrument it without referring back to the PRD or asking clarifying questions. If any event entry is incomplete, the spec is incomplete.
