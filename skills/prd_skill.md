# PRD Generation Skill

## Purpose
Generate a structured Product Requirements Document for a feature or phase of the IPL Prediction Game.

## Instructions
When the user asks to generate a PRD, follow this template strictly. Do not add sections beyond what is listed. Keep language concise and actionable.

## Template

```markdown
# PRD: [Feature Name]

**Author:** [Name]
**Date:** [YYYY-MM-DD]
**Status:** Draft | In Review | Approved
**Phase:** [Phase number]

## 1. Problem Statement
[1-2 sentences describing the user problem this feature solves.]

## 2. Goals
- [Goal 1]
- [Goal 2]

## 3. Non-Goals
- [Explicitly out of scope items]

## 4. User Stories
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | | | |

## 5. Functional Requirements
| ID | Requirement | Priority (P0/P1/P2) |
|----|-------------|----------------------|
| FR-01 | | |

## 6. API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| | | |

## 7. Database Schema Changes
[Tables, columns, types, constraints. Use SQL or table format.]

## 8. UI/UX
[Key screens or flows. Reference wireframes if available.]

## 9. Success Metrics
| Metric | Target |
|--------|--------|
| | |

## 10. Open Questions
- [Question 1]
```

## Rules
- Every PRD must have a clear Problem Statement before anything else.
- User Stories must follow the "As a... I want... So that..." format.
- Requirements must be prioritized P0 (must-have), P1 (should-have), P2 (nice-to-have).
- Do not include implementation details in the PRD. Keep it product-focused.
- Output the PRD as a markdown file in `/docs/prd/`.
