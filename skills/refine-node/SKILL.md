---
name: refine-node
description: Refine node definitions in a workflow spec - determines HOW each node is implemented (SDKs, libraries, input/output structures, tools, guidelines).
---

# Refine Node

Refine node definitions in an existing workflow spec. While create-workflow determines **WHAT** each node does, this phase determines **HOW**:

- **Input/Output structures** - Exact typed schemas (field names, types)
- **Implementation approach** - Which SDKs, libraries, or APIs to use
- **Tools** - For agent nodes, which tools they need
- **Guidelines** - Behavioral guidelines for agent nodes

---

## Usage

```
/0pflow:refine-node <workflow-name>
/0pflow:refine-node <workflow-name> <node-name>
```

- With just workflow name: refines all unrefined nodes
- With node name: refines only that specific node

---

## Process

### Step 1: Load and Assess

Read `specs/workflows/<workflow-name>.md` and identify nodes needing refinement.

A node **needs refinement** if it has `**Input Description:**` / `**Output Description:**` (plain language) but is missing `**Input:**` / `**Output:**` (typed schemas).

### Step 2: Research Implementation Approaches

Before drafting, gather the information needed:

1. **For nodes that interact with external systems** (Salesforce, HubSpot, Slack, etc.):
   - Invoke `/0pflow:integrations` to determine which SDK/library/API to use
   - For listed integrations: read the specific file (e.g., `salesforce.md`)
   - For unlisted systems: read `unlisted.md` and research the best option

2. **For agent nodes**, check AI SDK provider docs for available tools:
   - **OpenAI:** https://ai-sdk.dev/providers/ai-sdk-providers/openai
   - **Anthropic:** https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
   - Use `WebFetch` to read these pages for provider tool options

3. **For simple compute nodes**: determine if any libraries are needed

### Step 3: Draft All Refinements

Draft the complete refined definition for **every node that needs it**, then update the spec file with all refinements at once.

For each node, determine:

- **Implementation approach** — SDK, library, or "pure TypeScript"
- **Typed input schema** — derived from the Input Description
- **Typed output schema** — derived from the Output Description
- **Tools** (agent nodes only) — selected from the three categories below
- **Guidelines** (agent nodes only) — behavioral rules, preferred sources, edge case handling

Use your judgment to propose reasonable schemas and tool selections based on the descriptions. The user can correct anything after.

### Tool Categories (Agent Nodes)

| Category | Description | Examples |
|----------|-------------|---------|
| **Built-in nodes** | Ships with 0pflow | `webRead` |
| **Provider tools** | From AI SDK providers | `openai.tools.webSearch()`, `openai.tools.codeInterpreter()` |
| **User nodes** | Custom nodes in `src/nodes/` | `enrichCompany`, `sendSlackMessage` |

Common mappings:

| Need | Tool | Category |
|------|------|----------|
| Fetch web pages | `webRead` | builtin |
| Search the web | `openai.tools.webSearch()` | provider |
| Run Python code | `openai.tools.codeInterpreter()` | provider |
| Domain-specific (CRM, email) | User must implement | user node |

### Refined Spec Format

**Agent nodes:**
```markdown
### N. Task Name

<Expanded description>

**Implementation:** <SDK, library, or approach>
**Tools needed:**
  - webRead (builtin)
  - openai.tools.webSearch() (provider)
  - myCustomNode (user node in src/nodes/my-custom-node.ts)
**Guidelines:** <specific guidelines>

**Node:** `node-name` (agent)
**Input Description:** <original from create-workflow>
**Input:** `var_name: type` or `{ field: type, field2: type }`
**Output Description:** <original from create-workflow>
**Output:** `var_name: { field: type, field2?: type }`
```

**Function/node nodes:**
```markdown
### N. Task Name

<Description>

**Implementation:** <SDK, library, or approach>
**Node:** `node-name` (node)
**Input Description:** <original>
**Input:** `var_name: type` or `{ field: type }`
**Output Description:** <original>
**Output:** `var_name: { field: type, field2?: type }`
```

### Type Syntax

- Simple: `string`, `number`, `boolean`
- Objects: `{ field1: string, field2?: number }` (? = optional)
- Arrays: `string[]` or `{ name: string }[]`
- Nullable: `string | null`

### Step 4: Write and Continue

After writing all refinements to the spec:

- Tell the user the spec has been updated
- Invoke `/0pflow:compile-workflow` to generate TypeScript

---

## Principles

1. **Draft first, ask later** — propose complete schemas based on descriptions; let the user correct rather than interrogating
2. **Preserve descriptions** — keep the original Input/Output Description fields alongside the new typed schemas
3. **Concrete types** — every field needs a type; no `any` or untyped fields
4. **Research before guessing** — check integration skills and provider docs before selecting tools/SDKs
