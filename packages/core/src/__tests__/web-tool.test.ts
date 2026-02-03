// packages/core/src/__tests__/web-tool.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { webRead } from "../nodes/builtin/web.js";
import { createWorkflowContext } from "../context.js";

describe("webRead tool", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("has correct properties", () => {
    expect(webRead.name).toBe("web_read");
    expect(webRead.type).toBe("node");
    expect(webRead.description).toContain("Readability");
  });

  it("extracts content using Readability", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Article</title></head>
        <body>
          <nav>Navigation here</nav>
          <article>
            <h1>Main Article Title</h1>
            <p>This is the main content of the article. It has enough text to be recognized as the main content by Readability.</p>
            <p>Here is another paragraph with more information about the topic being discussed.</p>
          </article>
          <footer>Footer content</footer>
        </body>
      </html>
    `;

    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(html),
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const ctx = createWorkflowContext();
    const result = await webRead.execute(ctx, {
      url: "https://example.com/article",
      headers: { Authorization: "Bearer token" },
    });

    expect(global.fetch).toHaveBeenCalledWith("https://example.com/article", {
      method: "GET",
      headers: { Authorization: "Bearer token" },
    });
    expect(result.status).toBe(200);
    expect(result.title).toBe("Test Article");
    expect(result.content).toContain("main content of the article");
    // Navigation and footer should not be in the extracted content
    expect(result.content).not.toContain("Navigation here");
  });

  it("returns null content for non-ok responses", async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue("Not Found"),
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const ctx = createWorkflowContext();
    const result = await webRead.execute(ctx, {
      url: "https://example.com/missing",
    });

    expect(global.fetch).toHaveBeenCalledWith("https://example.com/missing", {
      method: "GET",
      headers: undefined,
    });
    expect(result.status).toBe(404);
    expect(result.content).toBeNull();
    expect(result.title).toBeNull();
  });

  it("falls back to body text when Readability cannot extract", async () => {
    // Minimal HTML that Readability can't extract as an article
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Simple Page</title></head>
        <body>Just some text</body>
      </html>
    `;

    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(html),
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const ctx = createWorkflowContext();
    const result = await webRead.execute(ctx, {
      url: "https://example.com/simple",
    });

    expect(result.status).toBe(200);
    expect(result.title).toBe("Simple Page");
    // Should fall back to body text content
    expect(result.content).toContain("Just some text");
  });
});
