---
name: compile-workflow
description: Update workflow implementation from its embedded description. Use this after modifying workflow or node descriptions.
---

# Compile Workflow

Updates the `run()` method of a workflow in `generated/workflows/*.ts` based on its embedded `description` field and the `description` fields in referenced nodes/agents.

**Announce at start:** "I'm using the compile-workflow skill to update the workflow implementation from its description."

---

## Pre-Flight Checks

1. **Verify workflow files exist:**
   - `generated/workflows/` must exist with at least one `.ts` file
   - If no `.ts` files found, tell user to run `/0pflow:create-workflow` first

2. **If no workflow name provided:**
   - List all workflows in `generated/workflows/`
   - Ask user to select which one to compile

3. **If workflow name provided:**
   - Verify `generated/workflows/<name>.ts` exists
   - If not, list available workflows and ask user to choose

---

## Description Parsing

### Workflow Description

Read the `description` field from the `Workflow.create()` call in `generated/workflows/<name>.ts`. The description contains flow-level information:

- **Summary** — first line/paragraph
- **`## Tasks`** — ordered list of tasks with:
  - `**Node:**` references (name + type)
  - `**Condition:**` / `**If true:**` / `**If false:**` for decisions
  - `**Loop:**` for iteration
  - `**Return:**` for terminal tasks

### Node/Agent Descriptions

For each task's `**Node:**` reference, read the `description` field from the node/agent file to get:

- **What the node does** — first paragraph
- `**Input Description:**` — plain language inputs
- `**Output Description:**` — plain language outputs

### Task Formats

**Standard task:**
```markdown
### N. Task Name
**Node:** `node-name` (agent|node)
```

Node file contains:
```markdown
<Description>

**Input Description:** what it needs
**Output Description:** what it produces
```

**Decision task** (no Node):
```markdown
### N. Decision Name
**Condition:** `expression`
**If true:** continue to task M
**If false:** return:
  - field1: value
  - field2: value
```

**Terminal task** (ends with Return):
```markdown
**Return:**
  - field1: value
  - field2: value
```

---

## Node Resolution

For each task's `**Node:**` reference, determine what it is and where it lives.

### Node Types

| Type | Location | Import Pattern |
|------|----------|----------------|
| `(builtin)` | Built-in nodes from 0pflow | `import { webRead } from "0pflow"` |
| `(node)` | User-defined in `src/nodes/` | `import { nodeName } from "../../src/nodes/<name>.js"` |
| `(agent)` | `agents/<name>.ts` | `import { agentName } from "../../agents/<name>.js"` |

**Note:** Agent imports reference the executable file (`agents/<name>.ts`), not the spec file (`specs/agents/<name>.md`). The executable contains the runtime code that loads the spec.

### Resolution Steps

1. **Parse node reference:** Extract name and type from `**Node:** \`name\` (type)` in the workflow description

2. **For builtin nodes:**
   - Check if it's a built-in node (`web_read`, etc.)
   - Import from `"0pflow"`

3. **For user-defined nodes:**
   - Look for `src/nodes/<name>.ts`
   - Read its `description` field for Input/Output info
   - If missing: ask user to create it (nodes require user implementation)

4. **For agents:**
   - Look for `agents/<name>.ts`
   - Read its `description` field for Input/Output info
   - If missing but task has enough context: create agent stub (see Stub Generation)
   - If missing and context is insufficient: ask clarifying questions

---

## Stub Generation

When an agent is referenced but doesn't exist, generate a stub using the workflow description context.

### Tool Types

There are three types of tools that can be used in agents:

| Type | Description | Import | Example |
|------|-------------|--------|---------|
| **Provider tools** | Tools from AI SDK providers (OpenAI, Anthropic) | `import { createOpenAI } from "@ai-sdk/openai"` | `openai.tools.webSearch()` |
| **Built-in nodes** | Nodes that ship with 0pflow | `import { webRead } from "0pflow"` | `webRead` |
| **User nodes** | Custom nodes implemented in `src/nodes/` | `import { myNode } from "../../src/nodes/my-node.js"` | `myNode` |

### Enriched Node Description (from refine-node)

After refinement, node descriptions include extra fields used to generate the agent executable:

```markdown
<What the agent does.>

**Tools needed:**
  - webRead (builtin)
  - openai.tools.webSearch() (provider)
  - myCustomNode (user node)
**Guidelines:** specific guidelines for the agent

**Input Description:** what it needs
**Output Description:** what it produces
```

### Agent Stub Template

When creating a new agent, generate TWO files:

1. **Spec file:** `specs/agents/<name>.md` - The agent prompt/config
2. **Executable file:** `agents/<name>.ts` - TypeScript executable that references the spec

#### Spec File (`specs/agents/<name>.md`)

The spec contains only the system prompt and optional model/maxSteps config. **Tools are defined in code, not in the spec.**

```markdown
---
name: <agent-name>
model: openai/gpt-4o  # optional
maxSteps: 10          # optional
---

# <Agent Title>

<First paragraph of task description>

## Task

<Derived from task description and inputs>

## Guidelines

<From **Guidelines:** field, or defaults:>
- Prefer primary sources over aggregators
- If information is unavailable, say so rather than guessing
- Keep output structured and consistent

## Output Format

Return a JSON object with:
<Derived from the node's outputSchema>
```

#### Executable File (`agents/<name>.ts`)

**IMPORTANT:**
- Always use absolute path resolution for `specPath` to ensure the agent works regardless of the current working directory
- Tools are defined as a record in `Agent.create()`, not in the spec file
- **Agents must declare their AI model provider in `integrations`** (e.g. `["openai"]`) so the framework fetches the API key at runtime via `ctx.getConnection()`. Do NOT rely on env vars like `OPENAI_API_KEY`.

```typescript
// agents/<name>.ts
// Agent executable for <name>
import { z } from "zod";
import { Agent, webRead } from "0pflow";               // Built-in nodes
import { createOpenAI } from "@ai-sdk/openai";         // Provider tools
// import { myNode } from "../src/nodes/my-node.js";   // User nodes
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize provider for provider-specific tools (only if using provider tools)
const openai = createOpenAI({});

export const <camelCaseName> = Agent.create({
  name: "<name>",
  integrations: ["openai"],  // REQUIRED: declares which API keys to fetch at runtime (e.g. "openai", "anthropic", "salesforce")
  description: `
<What this agent does.>

**Input Description:** <plain language>
**Output Description:** <plain language>
`,
  inputSchema: z.object({
    // ... derived from Input Description
  }),
  outputSchema: z.object({
    // ... derived from Output Description
  }),
  // Tools from **Tools needed:** - only include what the description specifies
  tools: {
    web_read: webRead,                     // (builtin)
    web_search: openai.tools.webSearch(),  // (provider)
    // my_node: myNode,                    // (user node)
  },
  specPath: path.resolve(__dirname, "../specs/agents/<name>.md"),
});
```

The `path.resolve(__dirname, ...)` pattern ensures the spec file is found relative to the executable file's location, not the current working directory.

#### Generating Tools from Description

The `**Tools needed:**` section in the node description explicitly specifies each tool with its type. Generate imports and tools record directly:

```markdown
**Tools needed:**
  - webRead (builtin)
  - openai.tools.webSearch() (provider)
  - enrichCompany (user node in src/nodes/enrich-company.ts)
```

Generates:

```typescript
import { webRead } from "0pflow";
import { createOpenAI } from "@ai-sdk/openai";
import { enrichCompany } from "../../src/nodes/enrich-company.js";

const openai = createOpenAI({});

// In Agent.create():
tools: {
  web_read: webRead,
  web_search: openai.tools.webSearch(),
  enrich_company: enrichCompany,
},
```

### When Context Is Insufficient

If the node description lacks `**Tools needed:**`, `**Guidelines:**`, or clear output type, ask:

"Task N references `<agent-name>` agent but the description is missing details:
- Tools needed: [missing/present]
- Guidelines: [missing/present]
- Output format: [missing/present]

Would you like me to ask clarifying questions, or should I create a minimal stub with TODOs?"

---

## Handling Ambiguities

When task logic is unclear, make your best guess and generate the code. The user can correct after. Don't block on questions.

### Common Ambiguities and Defaults

| Pattern | Problem | Default |
|---------|---------|---------|
| "if good fit" | Undefined criteria | Use `score >= 80` and add a comment noting the threshold is a guess |
| "check if valid" | Undefined validation | Check for presence of required fields |
| Untyped output | Can't generate schema | Infer from node description and context |
| Missing condition | Decision has no **Condition:** | Infer from surrounding task context, add a TODO comment if truly unknowable |

After generating code, tell the user what you assumed so they can correct anything.

---

## Code Generation

Rewrite the `run()` method in the existing `generated/workflows/<name>.ts` file. Also update imports and schemas as needed. Preserve the `description` field as-is.

### Generated run() Structure

```typescript
async run(ctx, inputs: <Name>Input): Promise<<Name>Output> {
  // Task 1: <Task Name>
  // <task description as comment>
  const <output_var> = await ctx.run(<nodeRef>, { <inputs> });

  // Task 2: <Decision or next task>
  if (<condition>) {
    // ...
  }

  return { <output fields> };
},
```

### Naming Conventions

- Workflow export: `camelCase` (e.g., `urlSummarizer`)
- Schema names: `PascalCase` + Schema/Input/Output (e.g., `UrlSummarizerInputSchema`)
- Type names: `PascalCase` + Input/Output (e.g., `UrlSummarizerInput`)

---

## Worked Example

A workflow enriches Gmail leads and sends results to Slack. Here's how the compiler turns descriptions into the `run()` method.

### Input: Workflow description

```markdown
Enrich the 10 most recent Gmail leads from Salesforce with web research and DM results on Slack.

## Tasks

### 1. Fetch Gmail Leads
**Node:** `fetch-gmail-leads` (node)

### 2. Enrich Lead
**Node:** `enrich-lead` (agent)
**Loop:** for each lead in leads

### 3. Send Slack DM
**Node:** `send-slack-dm` (node)
```

### Input: Node schemas (from refined node files)

- **fetch-gmail-leads** — `inputSchema: z.object({})`, `outputSchema: z.object({ leads: z.array(LeadSchema) })`
- **enrich-lead** — `inputSchema: z.object({ name: z.string(), email: z.string(), company: z.string().nullable(), title: z.string().nullable() })`, `outputSchema: z.object({ name: z.string(), email: z.string(), linkedinUrl: z.string().nullable(), ... })`
- **send-slack-dm** — `inputSchema: z.object({ enrichedLeads: z.array(EnrichedLeadSchema) })`, `outputSchema: z.object({ success: z.boolean(), channel: z.string() })`

### Output: Generated run() method

```typescript
async run(ctx, inputs: LeadEnrichmentInput): Promise<LeadEnrichmentOutput> {
  // Task 1: Fetch the 10 most recent Gmail leads from Salesforce
  const leadsResult = await ctx.run(fetchGmailLeads, {});

  // Task 2: Enrich each lead with web research
  const enrichedLeads = [];
  for (const lead of leadsResult.leads) {
    const enriched = await ctx.run(enrichLead, {
      name: lead.name ?? "",
      email: lead.email ?? "",
      company: lead.company,
      title: lead.title,
    });
    enrichedLeads.push(enriched);
  }

  // Task 3: Send enriched lead summary as Slack DM
  const slackResult = await ctx.run(sendSlackDm, { enrichedLeads });

  return { success: slackResult.success, channel: slackResult.channel };
},
```

Key things the compiler did:
1. **Data flow** — wired `leadsResult.leads` fields into `enrichLead`'s input schema, and `enrichedLeads` array into `sendSlackDm`'s input
2. **Loop** — translated `**Loop:** for each lead in leads` into a `for...of` loop over `leadsResult.leads`
3. **Schema alignment** — matched field names from output schemas to input schemas (e.g., `lead.name` → `name`, `lead.company` → `company`)

### After Compilation

Tell the user:
1. "Updated `generated/workflows/<name>.ts`"
2. If stubs created: "Created agent stub(s): `agents/<name>.ts` + `specs/agents/<name>.md`"
3. If function nodes missing: "Missing function node(s) that you need to implement: `src/nodes/<name>.ts`"

---

## Compiler Principles

1. **Draft first, ask later** — make your best guess and let the user correct, rather than blocking on questions
2. **No invention** — only emit code that maps to descriptions; guesses should be flagged with comments
3. **Deterministic** — same descriptions → same output
4. **Readable output** — generated code should be understandable
5. **Update descriptions** — when clarifying, update the description field so it stays canonical
