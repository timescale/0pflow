---
name: create-workflow
description: Collaborative workflow design - guides users through creating well-structured 0pflow workflow specs. Use this when creating new workflows.
---

# Create Workflow

Design and write a workflow specification for 0pflow.

---

## Context Gathering (do silently)

Before drafting, gather context without reporting it to the user:

### 1. Detect Project Type

Check the current working directory and handle one of three cases:

**Case 1: Empty directory** (no files, or only dotfiles like `.git`)
→ Scaffold a new app here. Read `app-scaffolding.md` in this skill directory and follow those instructions. Then re-read context and continue.

**Case 2: Existing 0pflow project** (has `specs/workflows/` or `specs/agents/` directories)
→ Good to go. Continue to step 2.

**Case 3: Existing non-0pflow directory** (has files/projects but no 0pflow structure — e.g., home directory, another repo)
→ Tell the user this directory already contains a project and ask them to provide a subdirectory name for the new 0pflow app. Then scaffold inside that subdirectory using `app-scaffolding.md`. Continue from there.

### 2. Discover Integrations

Call `mcp__plugin_0pflow_0pflow__list_integrations` to see what external systems are available (Slack, Salesforce, etc.).

### 3. Read Existing Context

- Read `specs/workflows/*.md` — existing workflows to reuse or reference
- Read `specs/agents/*.md` — existing agents that could be reused
- Ensure `specs/workflows/` and `specs/agents/` directories exist

---

## Designing the Workflow

Based on the user's description and the context you gathered, **draft a complete workflow design**. Use your judgment to fill in reasonable defaults. Only ask clarifying questions if something is genuinely ambiguous — prefer making a good guess and letting the user correct it.

Think through:
- **Trigger:** What starts the workflow? (webhook, manual input, schedule)
- **Tasks:** What steps are needed? In what order?
- **Decisions:** Are there branching points? What are the conditions?
- **Node types:** Does each task need AI judgment (agent) or is it a function/API call (node)?
- **Existing nodes:** Can any existing agents or built-in nodes (`web_read`, etc.) be reused?
- **Integrations:** Do any connected integrations apply?

### Present an ASCII Diagram

Present the workflow as an ASCII diagram for the user to review:

```
┌─────────────┐
│   Trigger   │
│ (inputs)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Task 1     │
│ node-name   │
└──────┬──────┘
       │
       ▼
   ◇ Decision?
  ╱           ╲
YES             NO
 │               │
 ▼               ▼
┌─────┐      ┌──────┐
│Task2│      │Return│
└──┬──┘      └──────┘
   │
   ▼
┌─────────────┐
│   Return    │
└─────────────┘
```

Use boxes for tasks, diamonds for decisions, arrows for flow. Adapt to the actual workflow.

Ask: **"Does this flow look right?"**

Iterate on the diagram based on feedback until the user is happy.

---

## Writing the Spec

Once the flow is approved, write the full spec to `specs/workflows/<name>.md`.

This phase focuses on **WHAT** each node does, not **HOW**. Capture purpose and intent in plain language. Implementation details (exact fields, API schemas, tool configs) are handled later by `/0pflow:refine-node`.

### Spec Format

```markdown
---
name: <workflow-name>
version: 1
---

# <Workflow Title>

<One-line description>

## Inputs

- input_name (required|optional) - Description of what this input represents

## Tasks

### 1. Task Name

Description of what this task does.

**Node:** `node-name` (agent|node)
**Input Description:** What information this task needs (plain language)
**Output Description:** What this task produces (plain language)

---

### 2. Decision Name

**Condition:** `variable.field >= value`
**If true:** continue to task 3
**If false:** return early with outputs

---

### 3. Another Task

Description.

**Node:** `node-name` (agent|node)
**Input Description:** ...
**Output Description:** ...
**Return:** (if this is the final task, describe what the workflow returns)

## Outputs (optional)

- Description of what the workflow returns when complete

(Omit if workflow only performs side effects)
```

### Node Types

| Type | When to use |
|------|-------------|
| `(agent)` | Needs AI reasoning/judgment |
| `(node)` | Deterministic function or API call |

Built-in nodes: `web_read`

### Naming Conventions

- Workflow names: lowercase with hyphens (e.g., `lead-scoring`)
- Node names: lowercase with hyphens (e.g., `company-researcher`)

### After Writing

Tell the user:
1. Where the spec was written
2. List the nodes that need refinement
3. Suggest running `/0pflow:refine-node` when ready, then `/0pflow:compile-workflow` to generate TypeScript

---

## Principles

1. **Draft first, ask later** — make your best guess and let the user correct, rather than interrogating upfront
2. **Concrete over abstract** — push for specific conditions, not vague descriptions (e.g., `score >= 80` not "if it's good")
3. **Leverage existing** — prefer reusing existing agents/nodes over creating new ones
4. **What, not how** — capture intent in plain language; implementation details come during refinement
