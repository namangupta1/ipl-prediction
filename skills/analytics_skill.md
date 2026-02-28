# Analytics Plan Generation Skill

## Purpose
Generate a structured analytics instrumentation plan for a feature of the IPL Prediction Game.

## Instructions
When the user asks to generate an analytics plan, follow this template strictly. Every tracked event must have a clear trigger and defined properties. No vague event names.

## Template

```markdown
# Analytics Plan: [Feature Name]

**Date:** [YYYY-MM-DD]
**Phase:** [Phase number]
**Related PRD:** [Link to PRD if applicable]

## 1. Key Metrics
| Metric | Definition | Target |
|--------|-----------|--------|
| | | |

## 2. Events
| Event Name | Trigger | Properties | Priority (P0/P1/P2) |
|------------|---------|------------|----------------------|
| | | | |

## 3. Funnels
| Funnel Name | Steps |
|-------------|-------|
| | Step 1 → Step 2 → ... |

## 4. Dashboards
| Dashboard | Charts | Owner |
|-----------|--------|-------|
| | | |
```

## Naming Convention
- Events: `snake_case`, verb-first (e.g., `submit_prediction`, `view_leaderboard`).
- Properties: `snake_case` (e.g., `match_id`, `prediction_type`).
- Prefix with feature area when ambiguous (e.g., `leaderboard_filter_applied`).

## Rules
- Every event must have at least one property beyond the default context (user_id, timestamp).
- P0 events are required before feature launch. P1/P2 can follow.
- Funnel steps must map to real user actions, not page views.
- Do not track PII (emails, phone numbers) in event properties.
- Output the analytics plan as a markdown file in `/docs/analytics/`.
