---
name: skill-creator
description: Systematic guide and template for creating standardized, high-quality Antigravity skills with validated YAML frontmatter, triggering criteria, and execution workflows.
---

# Skill Creator

This skill guides the authoring, structuring, and validation of new Antigravity skills.

---

## 1. Skill Concept & Progressive Disclosure

Skills are self-contained markdown documents (`SKILL.md`) that teach Antigravity multi-step procedures, domain-specific runbooks, tool orchestration, and coding conventions.

- **Progressive Disclosure**: Only the YAML frontmatter (`name` and `description`) is injected into the context window initially. The main markdown body is loaded into context **on-demand** only when the skill is relevant or activated.
- **Description Quality**: The `description` field in the frontmatter is critical: it serves as the semantic trigger for the agent to know *when* and *why* to activate the skill.

---

## 2. Directory Layout & Conventions

Skills live in `.agents/skills/<skill-name>/`:

```
.agents/skills/<skill-name>/
├── SKILL.md                 # Primary instruction file (required)
├── scripts/                 # Optional helper scripts (bash, python, node)
├── examples/                # Optional reference implementations
└── docs/                    # Optional detailed reference documentation
```

### Naming Conventions
- **Skill Name (`name`)**: Lowercase, kebab-case (e.g., `laravel-boost`, `code-review`, `deploy-pipeline`). Must match the parent directory name.
- **Trigger Description (`description`)**: 1–3 clear sentences summarizing the domain, capabilities, and triggering scenarios.

---

## 3. Skill Template

Every `SKILL.md` must adhere to this structure:

````markdown
---
name: skill-name
description: Clear, concise summary of what this skill does and the specific scenarios/tasks that should trigger its activation.
---

# Skill Title

Brief 1-2 sentence overview of the skill's purpose and scope.

---

## 1. Core Principles & Philosophy
- Key guardrails, invariants, or concepts.
- Non-negotiables and safety rules.

---

## 2. Step-by-Step Workflow
1. **Phase 1: Preparation & Discovery**
   - Commands or steps to inspect state.
2. **Phase 2: Execution & Implementation**
   - Concrete patterns, code snippets, or commands.
3. **Phase 3: Verification & Testing**
   - Exact test or validation commands to run.

---

## 3. Code Patterns & Examples
```language
// Practical, idiomatic example demonstrating the skill's core pattern
```

---

## 4. Common Pitfalls & Troubleshooting
- **Pitfall 1**: Description and how to avoid.
- **Pitfall 2**: Remediation steps.

---

## 5. Verification Checklist
- [ ] Item 1 verified
- [ ] Item 2 verified
````

---

## 4. Workflow to Create a New Skill

1. **Identify the Need**:
   - Determine whether the procedure is a **Rule** (universal invariant) or a **Skill** (procedural runbook / workflow).
2. **Determine Name & Triggering Criteria**:
   - Write a precise, action-oriented description.
3. **Draft `SKILL.md`**:
   - Place in `.agents/skills/<skill-name>/SKILL.md`.
   - Ensure clear step-by-step instructions, copy-pasteable commands, and verification criteria.
4. **Validate Frontmatter & Syntax**:
   - Ensure valid YAML frontmatter between `---` markers.
   - Verify that markdown links, code blocks, and math blocks (if any) are properly formatted.

