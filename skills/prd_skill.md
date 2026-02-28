# PRD Compiler Skill

## Purpose
Compile a deterministic, implementation-ready Product Requirements Document from structured inputs. This is not a brainstorming tool. It transforms defined inputs into a strict output format.

---

## Required Input

All fields below are **mandatory**. If any are missing or ambiguous, **enter Clarification Mode** (see below) before generating output. Do not proceed to full PRD generation until all inputs are resolved.

```
product_name:        string
objective:           string (1-2 lines, measurable)
phase_scope:         string (what is included in this phase)
non_goals:           list   (explicitly excluded from this phase)
target_users:        list   (user types with 1-line description each)
components:          list   (component name + 1-line purpose each)
user_flows:          list   (step-by-step sequences, one per flow)
game_rules:          object (scoring, locking, settlement logic)
cms_workflow:        object (editor actions, publish/unpublish, scheduling)
platform_constraints: object (tech stack, auth method, infra assumptions)
```

### Input Validation
- `objective` must be outcome-oriented, not activity-oriented. Reject "build X" — require "enable users to Y".
- `phase_scope` must list concrete deliverables, not themes.
- `non_goals` must be specific. Reject "out of scope for now" without detail.
- `components` must each have a clear single responsibility.
- `user_flows` must be sequential numbered steps, not prose.
- `game_rules` must define all three: scoring formula, lock trigger, settlement condition.
- `platform_constraints` must specify: framework, database, auth provider, hosting.

---

## Clarification Mode

When any required input field is missing, ambiguous, or fails validation, the skill must **not** generate the full PRD. Instead, output a **Clarifications Needed** section using the exact format below.

### Clarification Output Format

```
## CLARIFICATIONS_NEEDED

### 1. [field_name]

**WHY_IT_MATTERS:** [1 sentence explaining why this field is required and what breaks without it.]

**OPTIONS:**
- **A:** [plausible default for this project]
- **B:** [alternative default]
- **C:** [alternative default, if applicable]
- **D:** [alternative default, if applicable]

**CHOOSE:** A / B / C / D or provide a custom value.

### 2. [field_name]
...
```

### Behavior Rules
1. List **all** missing/ambiguous fields in a single clarification response. Do not ask one at a time.
2. Propose **2–4 plausible defaults** per field, labeled A / B / C / D. Options must be concrete and project-appropriate for the IPL Prediction Game.
3. The editor must either choose a letter or provide a custom value. No field may remain unresolved.
4. After all clarifications are answered, generate the full PRD using the Required Output structure.
5. If the editor's response introduces new ambiguity, re-enter Clarification Mode for only the unresolved fields.

### Project-Specific Default Options

Use these as starting points when suggesting options. Adjust based on the phase and scope provided.

| Field | Option A | Option B | Option C | Option D |
|-------|----------|----------|----------|----------|
| `platform_constraints.auth` | Anonymous `user_key` via cookie | Supabase magic link | Supabase OAuth (Google) | — |
| `game_rules.lock_trigger` | `match_start_time - 5 min` | `match_start_time - 10 min` | At toss (manual trigger) | — |
| `game_rules.scoring` | +10 correct winner | +10 winner, +5 toss, +25 exact margin | +10 winner, +5 toss, +5 MoM | — |
| `components.leaderboard` | Match-only leaderboard | Daily leaderboard | Season-long cumulative | Daily + Season |
| `cms_workflow.access` | Simple shared password | Supabase Auth (admin role) | Invite-only magic link | — |
| `game_rules.settlement` | Auto-settle from API feed | Manual settle by admin via CMS | Auto with manual override | — |
| `platform_constraints.hosting` | Vercel | Vercel + Supabase Edge Functions | Self-hosted (Docker) | — |

---

## Required Output

Generate the following sections **in this exact order**. Do not add, remove, or reorder sections.

### 1. Executive Summary
- Product name, phase, objective.
- 3-5 bullet points summarizing what this PRD covers.

### 2. Objectives
- Numbered list. Each objective must be measurable.

### 3. Non-Goals
- Numbered list. Each item states what is excluded and why.

### 4. User Personas
- One subsection per `target_users` entry.
- Each persona: role, goal, key actions.

### 5. Deterministic User Flows
- One subsection per flow from `user_flows`.
- Format: numbered steps. Each step = one user action + one system response.
- Include: entry condition, exit condition, error branches.

### 6. Component Specifications
One subsection per component. Each must include:

| Field | Description |
|-------|-------------|
| `purpose` | Single sentence. What this component does. |
| `inputs` | Props or parameters it receives. |
| `data_source` | Supabase table/view or API endpoint it reads from. |
| `states` | All visual/logical states (loading, empty, error, populated, locked). |
| `edge_cases` | Boundary conditions and how they are handled. |

### 7. State Machines
- For each entity with a `status` field, define:
  - All possible states (as enum values).
  - All valid transitions: `from_state` → `to_state` + trigger.
  - Invalid transitions must be explicitly noted as rejected.

### 8. CMS Workflow Specification
- Editor actions: create, edit, publish, unpublish, schedule.
- Field-level validation rules.
- Role-based access (who can perform each action).
- Content lifecycle: draft → published → archived.

### 9. Game Logic Specification
- Scoring rules with formula.
- Lock conditions (when predictions become immutable).
- Settlement logic (how outcomes are resolved).
- Tiebreaker rules.
- All time references in UTC.

### 10. Data Model
- Entity name, fields, types, constraints, relationships.
- Format: one table per entity.
- Required fields per table: `id` (UUID, PK), `created_at` (timestamptz), `updated_at` (timestamptz).
- All foreign keys must reference specific table.field.
- All status fields must be defined as enums with explicit values.

### 11. API Contract
One subsection per endpoint:

| Field | Description |
|-------|-------------|
| `method` | HTTP method. |
| `path` | Route path. |
| `request_body` | JSON shape with types. |
| `response_body` | JSON shape with types. |
| `auth` | Required auth level. |
| `errors` | All error codes and conditions. |

### 12. Build Pack
Machine-readable implementation checklist. Must be directly executable by Claude Code without further interpretation.

#### 12.1 Pages / Routes
| Route | Page Component | Auth Required | Data Dependencies |
|-------|---------------|---------------|-------------------|

#### 12.2 React Components
| Component | Location | Props | State Source |
|-----------|----------|-------|-------------|

#### 12.3 DB Tables
| Table | Key Columns | RLS Policy |
|-------|-------------|------------|

#### 12.4 Environment Variables
| Variable | Purpose | Required |
|----------|---------|----------|

#### 12.5 Implementation Order
Numbered sequence. Each step must specify the file(s) to create or modify.

---

## Rules

1. **No ambiguous language.** Do not use "should", "might", "could", "various", "etc.", "as needed". Use "must" for requirements.
2. **All timestamps in UTC.** No local time references.
3. **All identifiers are UUID.** No auto-increment integers for primary keys.
4. **All table names in `snake_case`.** All column names in `snake_case`.
5. **All status fields are explicit enums.** List every possible value. No open-ended strings.
6. **Lock enforcement is server-side.** Client-side locks are cosmetic only. The API must reject locked mutations.
7. **Do not include analytics events.** Analytics instrumentation is handled by `analytics_skill.md`.
8. **Do not invent scope.** Only document what is provided in the input. If a detail is ambiguous, stop and ask.
9. **No placeholder text.** Every field in the output must contain real content from the input or be flagged as `[MISSING — requires input]`.
10. **Build Pack is inline.** The Build Pack (Section 12) must remain inside the PRD file. Do not split it into a separate document.

---

## Output Persistence

When executed inside Claude Code, the skill must follow these file-save rules:

1. **Default path:** Save the generated PRD to `docs/PRD.md`.
2. **If `docs/PRD.md` already exists:**
   - Do **not** overwrite automatically.
   - Ask the editor to choose:
     - **A:** Overwrite `docs/PRD.md` (replace existing).
     - **B:** Save as `docs/PRD_v{n}.md` (where `{n}` is the next available version number).
3. **Before saving, the skill must:**
   - Show a diff of the new PRD against the existing file (if one exists).
   - Wait for the editor to confirm the save action.
   - Never silently create, modify, or overwrite documents.
4. **If `docs/` directory does not exist**, create it before saving.

---

## Final Instruction

The **Build Pack** (Section 12) must be implementation-ready for Claude Code. A developer or coding agent must be able to read it and build the feature without referring back to the rest of the PRD for clarification. If the Build Pack cannot stand alone, the PRD is incomplete.
