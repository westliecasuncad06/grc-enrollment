---
name: code-review
description: Static code analysis, security auditing, naming and architectural consistency checks, and actionable refactoring recommendations.
---

# Code Review Skill

This skill provides a systematic approach to analyzing, auditing, and refactoring source code to ensure security, maintainability, architectural integrity, and performance.

---

## 1. Core Principles

- **Security First**: Identify vulnerabilities (injection, auth flaws, privilege escalation, data leaks) before stylistic changes.
- **Architectural Consistency**: Ensure changes conform to existing patterns, modular boundaries, and separation of concerns.
- **Actionable & Specific**: Provide concrete diffs, file links, and line references rather than vague critique.
- **Idempotency & Data Safety**: Prevent race conditions, ensure safe database transactions, and avoid irreversible mutations.

---

## 2. Review Checklist

### A. Security & Authorization
1. **Least-Privilege Authorization**:
   - Are policy checks (`Gate`, `Policy`, middleware, role guards) applied to all sensitive operations?
   - Are multi-tenant or scoped queries properly bounded (e.g., scoping by `college_id`, `department_id`, or `user_id`)?
2. **Input Validation & Sanitization**:
   - Are all incoming payloads validated strictly using Form Requests (backend) or Zod schemas (frontend)?
   - Are unvalidated inputs directly concatenated into SQL, shell commands, or HTML?
3. **Sensitive Data Exposure**:
   - Are passwords, secrets, API keys, or PII exposed in logs, API responses, or error messages?
   - Are sensitive attributes hidden via `$hidden` in Eloquent models or omitted in API resources?

### B. Architecture & Design Patterns
1. **Separation of Concerns**:
   - **Backend**: Are controllers thin, delegating business logic to Actions / Services?
   - **Frontend**: Are UI components isolated from direct API calls, relying on dedicated service modules and TanStack Query hooks?
2. **Reversible & Idempotent Mutations**:
   - Are database state modifications wrapped in DB transactions (`DB::transaction`)?
   - Are external side effects (email, payment capture, queue jobs) idempotent or dispatchable after transaction commit?
3. **Error Handling & Resilience**:
   - Are domain exceptions caught and translated to standard HTTP / API error envelopes?
   - Does frontend code gracefully handle loading, empty, and error states using boundaries?

### C. Performance & Resource Efficiency
1. **Database & Queries**:
   - Are there N+1 queries in loops? Ensure eager loading (`with()`, `loadMissing()`).
   - Are queries using indexed columns for filtering and sorting?
   - Are large datasets paginated or chunked instead of full table scans (`all()`)?
2. **Frontend State & Rendering**:
   - Are expensive calculations memoized where appropriate?
   - Are network requests cached and deduplicated via React Query?
   - Is bundle size impacted by unnecessary heavy dependencies?

### D. Code Quality & Conventions
1. **Naming Conventions**:
   - Clear, descriptive variable and function names following language conventions (e.g., camelCase for JS/TS, camelCase/snake_case per PHP standards).
2. **Type Safety & Contracts**:
   - Strict TypeScript typings (no arbitrary `any`).
   - Strict PHP return typehints and argument types.
3. **Dead Code & Cleanup**:
   - Remove unused imports, dead branches, commented-out code blocks, and debugging statements (`console.log`, `dd()`, `ray()`).

---

## 3. Review Workflow

```
1. Gather Context -> 2. Static Analysis -> 3. Security Audit -> 4. Architecture Check -> 5. Formulate Feedback
```

1. **Context Assessment**:
   - Understand the target PR, diff, or specific files in relation to the system's PRD and guidelines.
2. **Run Static Analysis & Linters**:
   - Backend: PHPStan / Psalm / Pint (`./vendor/bin/pint --test`, `./vendor/bin/phpstan analyse`).
   - Frontend: TypeScript check (`npx tsc --noEmit`), ESLint, Prettier.
3. **Execute Automated Tests**:
   - Verify unit and integration test suites pass before and after refactoring.
4. **Draft Structured Findings**:
   - Structure output by severity: **Critical (Blocker)**, **Major (Warning)**, and **Minor (Suggestion)**.
   - For each finding, include:
     - Issue description & risk
     - Exact file path and line numbers
     - Suggested refactor / diff snippet

---

## 4. Output Template for Code Reviews

When presenting code review findings, format your response as follows:

```markdown
### Summary of Review
- **Files Reviewed**: [List of files]
- **Overall Quality**: [High / Needs Work / Blocked]
- **Key Risks**: [Summary of critical items]

### Critical Issues (Must Fix)
- **[Issue Title]** (`path/to/file.php:line`)
  - **Risk**: Explanation of security or data integrity risk.
  - **Remediation**:
    ```diff
    - oldCode()
    + newSafeCode()
    ```

### Recommendations & Refactoring
- **[Suggestion Title]** (`path/to/file.ts:line`)
  - **Rationale**: Why this improves readability/performance.
  - **Proposed Change**: Code snippet.

### Test & Verification Plan
- Specific test cases needed to prevent regressions.
```

