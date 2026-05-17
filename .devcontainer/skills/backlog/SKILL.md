---
name: backlog
description: Work through tasks in open-tasks/ by reading a task file, investigating the codebase, creating a detailed implementation plan, executing it following strict quality gates (all test suites must pass after every change), and archiving completed work.
---

# Backlog Workflow

## Overview

The `open-tasks/` directory at the project root contains task files organized by type:

| Prefix      | Description              |
|-------------|--------------------------|
| `feat__*`   | Feature request          |
| `task__*`   | Implementation task      |
| `bug__*`    | Bug report / fix         |
| `chore__*`  | Maintenance / tooling    |
| `refactor__*` | Code restructuring    |

Task files are plain markdown describing a piece of work that needs to be done.

## Rules

- NEVER write code, create files, or run commands before reading the task file and producing an implementation plan.
- NEVER skip the investigation phase.
- NEVER skip the full test suite after a change (see Quality Gates below).
- NEVER modify tests to make them pass — fix the code.
- If you discover major caveats or the author missed important details, surface them **at the top of the implementation plan** so the author can reconsider.
- You are in charge of keeping the app clean, user-friendly, and performant.

---

## Phase 1 — Read the Task File

```bash
cat open-tasks/<selected-file>.md
```

Read it carefully. Understand exactly what needs to be done. If the task file is ambiguous, identify what clarification is needed before proceeding.

## Phase 2 — Investigate the Codebase

Deeply investigate the current state of the repository. Understand:
- How existing code relates to the task
- What files, modules, and patterns are involved
- What the existing patterns are (refer to `AGENTS.md` sections 3, 6, 7)
- Whether the task is feasible as described or has hidden caveats

## Phase 3 — Create an Implementation Plan

Following the structure of the **plan-first** skill (`~/.pi/agent/skills/plan-first/SKILL.md`), but with these modifications:

### Plan file naming

Write the plan into a file named `name_of_task--implementation.md` (e.g. `add-screenshot-tests--implementation.md`) **instead of** the top-level `TODO.md`.

### Sub-task structure

Each sub-task MUST include:

```
### N. <Sub-task title>

**Files to change:**
- `path/to/file1.ts`
- `path/to/file2.svelte`

**Background:**
Context or rationale if important.

**Definition of done:**
- [ ] <verifiable outcome 1>
- [ ] <verifiable outcome 2>
```

### Caveats section

Before the sub-tasks, include a **Caveats** section at the top if:

- The author may have been unaware of important constraints
- The plan as described has risks or downsides
- There's a smarter / cleaner way to achieve the goal

```markdown
## Caveats

⚠️ The original task description assumes X, but the codebase actually uses Y.
   Consider doing Z instead to keep the architecture consistent.
```

You are in charge — surface issues honestly.

### Review pass

After drafting the full plan, review it one last time to make sure all sub-tasks together:
- Satisfy every requirement in the task file
- Follow code standards and existing patterns
- Are independently verifiable

## Phase 4 — Execute

Once the plan is approved, work through the sub-tasks **in order**, one at a time.

After completing each sub-task, mark it done by changing `- [ ]` to `- [x]`.

## Phase 5 — Quality Gates (⛔ CRITICAL)

**After EVERY change — run the full test suite.** No exceptions.

```bash
npm run test:run      # Unit/integration tests
npm run test:e2e      # Playwright E2E tests
npm run test:visual   # Visual/screenshot tests
```

**All three must pass** before committing or moving to the next sub-task.

### If a test fails

- **Fix the code** — do not modify the test. The test describes the expected behavior.
- Re-run all three suites until green.
- If the test is false-positive (e.g. a flaky selector), investigate the root cause and fix the test setup, not the assertion.

### If you added new functionality

Write new tests covering the change **before** running the suites.

## Phase 6 — Archive

After all sub-tasks are complete and all test suites pass:

1. **Rename the implementation plan** with the correct prefix and move it to `./finished-todos/`:

```bash
mkdir -p finished-todos
mv name_of_task--implementation.md finished-todos/name_of_task--implementation.md
```

2. **Remove the initial task file** from `open-tasks/`:

```bash
rm open-tasks/<original-task-file>.md
```

3. Confirm to the user what was completed and archived.

## Notes

- The `plan-first` skill's general structure (analyze → ask questions → write plan → review → execute → wrap) is followed, but the output format and quality gates are specific to this backlog skill.
- "Keep existing patterns" means check `AGENTS.md` sections on architecture, DI, styling, and testing conventions before writing any code.
- The test run is `npm run test:run`, not `npm run test:unit`. This is intentional.
