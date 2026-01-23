---
name: compile-workflow
description: Compile workflow specs from markdown to TypeScript
---

# Compile Workflow Skill

This skill compiles workflow specifications from `specs/workflows/*.md` into TypeScript code in `generated/workflows/*.ts`.

## Usage

Invoke this skill when:
- A new workflow spec has been created
- An existing workflow spec has been modified
- The user asks to compile or regenerate workflows

## Process

1. Read workflow spec from `specs/workflows/<name>.md`
2. Parse frontmatter (name, version)
3. Extract inputs, steps, and outputs sections
4. Generate TypeScript workflow using the 0pflow SDK
5. Write to `generated/workflows/<name>.ts`

## Compiler Principles

1. **No invention** - Only emit code that directly maps to spec
2. **Fail closed** - Missing info → TODO comments + build failure, not guesses
3. **Deterministic** - Same spec → same output (modulo formatting)
4. **Readable output** - Generated code should be understandable

## Output Format

Generated workflows follow this structure:

```typescript
import { Workflow, WorkflowContext } from '0pflow';

interface <Name>Inputs {
  // ... from ## Inputs section
}

interface <Name>Outputs {
  // ... from ## Outputs section
}

export const <name> = Workflow.create({
  name: '<name>',
  version: <version>,

  async run(ctx: WorkflowContext, inputs: <Name>Inputs): Promise<<Name>Outputs> {
    // ... steps from ## Steps section
  },
});
```

## Handling Ambiguity

If a step is ambiguous or missing required information, emit:

```typescript
// TODO: <specific issue>
// UNRESOLVED: This step cannot be compiled until TODOs are addressed
throw new WorkflowCompilationError('Unresolved TODOs in step N');
```
