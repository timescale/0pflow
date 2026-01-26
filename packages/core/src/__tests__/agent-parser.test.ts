// packages/core/src/__tests__/agent-parser.test.ts
import { describe, it, expect } from "vitest";
import { parseAgentSpecContent } from "../nodes/agent/parser.js";

describe("parseAgentSpecContent()", () => {
  it("parses valid agent spec", () => {
    const content = `---
name: researcher
tools:
  - http_get
  - custom.search
model: anthropic/claude-3-opus
maxSteps: 5
---
You are a research assistant. Search for information and summarize findings.
`;

    const spec = parseAgentSpecContent(content);

    expect(spec.name).toBe("researcher");
    expect(spec.tools).toEqual(["http_get", "custom.search"]);
    expect(spec.model).toBe("anthropic/claude-3-opus");
    expect(spec.maxSteps).toBe(5);
    expect(spec.systemPrompt).toBe(
      "You are a research assistant. Search for information and summarize findings."
    );
  });

  it("parses spec with minimal frontmatter", () => {
    const content = `---
name: simple-agent
---
Do something simple.
`;

    const spec = parseAgentSpecContent(content);

    expect(spec.name).toBe("simple-agent");
    expect(spec.tools).toEqual([]);
    expect(spec.model).toBeUndefined();
    expect(spec.maxSteps).toBeUndefined();
    expect(spec.systemPrompt).toBe("Do something simple.");
  });

  it("throws for missing name", () => {
    const content = `---
tools:
  - http_get
---
System prompt here.
`;

    expect(() => parseAgentSpecContent(content)).toThrow();
  });

  it("throws for empty system prompt", () => {
    const content = `---
name: empty-agent
---

`;

    expect(() => parseAgentSpecContent(content, "test.md")).toThrow(
      "Agent spec test.md has no system prompt"
    );
  });

  it("preserves multiline system prompt", () => {
    const content = `---
name: multiline
---
First line.

Second paragraph.

- List item 1
- List item 2
`;

    const spec = parseAgentSpecContent(content);

    expect(spec.systemPrompt).toContain("First line.");
    expect(spec.systemPrompt).toContain("Second paragraph.");
    expect(spec.systemPrompt).toContain("- List item 1");
  });
});
