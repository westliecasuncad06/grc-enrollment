---
name: superpowers
description: Meta-agent workflows, strategic task decomposition, execution planning, subtask delegation, and multi-skill orchestration.
---

# Superpowers: Meta-Agent & Workflow Orchestration

This skill provides an advanced framework for orchestrating complex software engineering tasks, strategic planning, test-driven decomposition, and subagent delegation.

---

## 1. Core Principles

- **Plan Before Execution**: For non-trivial tasks, build an explicit, reviewable implementation plan before modifying code.
- **Vertical Slice Architecture**: Implement end-to-end vertical slices (Database -> Backend Action -> API Endpoint -> Frontend Query -> UI Component) rather than disconnected horizontal layers.
- **Test-Driven Verification**: Write or run failing tests (RED) before implementing fixes/features (GREEN), followed by linting and regression suites (REFACTOR).
- **Idempotency & Safe Rollbacks**: Design all operations and commands so they can be re-run safely without corrupting system state.

---

## 2. Planning & Execution Lifecycle

```
[ Understand Request & PRD ]
              ↓
[ Research & Code Exploration ]
              ↓
[ Implementation Plan Artifact ]  ← (User Review / Approval)
              ↓
[ Vertical Slice Execution Loop ]
   ├── Write/Identify Failing Test (RED)
   ├── Implement Minimal Code (GREEN)
   └── Run Quality Checks & Lint (REFACTOR)
              ↓
[ End-to-End Verification ]
              ↓
[ Update PROGRESS.md & Walkthrough ]
```

---

## 3. Subagent Delegation & Orchestration

When a task involves parallel research, isolated refactoring, or independent subsystem analysis, utilize subagents effectively:

1. **Subagent Specialization**:
   - **Research Subagents**: Read-only exploration of large codebases, documentation, or dependency graphs without polluting parent context.
   - **Task-Specific Subagents**: Focused execution of independent modules or isolated tests.
2. **Clear Prompts & Boundaries**:
   - Provide concrete input data, file paths, and exact expected return formats.
   - Specify constraints (e.g., "Do not modify database migrations", "Return a structured diff list").
3. **Synthesis & Integration**:
   - Aggregate subagent outputs in the primary agent context before performing system-level verification.

---

## 4. Multi-Skill Orchestration

Coordinate specialized skills across the project lifecycle:

| Phase | Skill | Role |
| :--- | :--- | :--- |
| **Strategy & Planning** | `superpowers` | Task breakdown, dependency mapping, and planning artifacts |
| **Backend Implementation** | `laravel-boost` | Clean REST endpoints, Eloquent queries, Form Requests, DB transactions |
| **Frontend Implementation** | `frontend-design` | Accessible UI, Tailwind styling, TanStack Query, responsive layouts |
| **Quality & Auditing** | `code-review` | Static analysis, security auditing, and refactor suggestions |
| **Skill Authoring** | `skill-creator` | Expanding agent capabilities with new runbooks and tools |

---

## 5. Execution Checklist

- [ ] Requirements validated against `PRD.md` and repository instructions.
- [ ] Implementation plan created and approved.
- [ ] Code changes implemented in discrete, testable vertical slices.
- [ ] Automated tests executed and passed (Unit, Feature, End-to-End).
- [ ] Type checks (`tsc --noEmit`) and linters pass with zero errors.
- [ ] `PROGRESS.md` updated with chronological milestone details.

