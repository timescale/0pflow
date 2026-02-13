// __tests__/workflows.e2e.test.ts
// End-to-end tests for generated uptime-app workflows

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { create0pflow, webRead, type Pflow } from "0pflow";
import { urlCheck } from "../generated/workflows/url-check.js";
import { urlSummarizer } from "../generated/workflows/url-summarizer.js";
import { httpHead } from "../src/nodes/http-head.js";
import { pageSummarizer } from "../agents/page-summarizer.js";

const DATABASE_URL = process.env.DATABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function resetDatabase(): Promise<void> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS dbos CASCADE");
  } finally {
    await client.end();
  }
}

describe.skipIf(!DATABASE_URL)("uptime-app workflows", () => {
  let pflow: Pflow;

  beforeAll(async () => {
    await resetDatabase();

    pflow = await create0pflow({
      databaseUrl: DATABASE_URL!,
      appName: "uptime_app",
      workflows: {
        "url-check": urlCheck,
        "url-summarizer": urlSummarizer,
      },
      nodes: {
        "http-head": httpHead,
      },
      agents: {
        "page-summarizer": pageSummarizer,
      },
      tools: {
        web_read: webRead,
      },
    });
  }, 30000);

  afterAll(async () => {
    await pflow.shutdown();
  });

  describe("url-check workflow", () => {
    it("returns status code for reachable URL", async () => {
      const result = await pflow.triggerWorkflow("url-check", {
        url: "https://example.com",
      });

      expect(result.status_code).toBe(200);
      expect(result.response_time_ms).toBeGreaterThan(0);
      expect(result.error).toBeNull();
      expect(result.checked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("returns error for unreachable URL", async () => {
      const result = await pflow.triggerWorkflow("url-check", {
        url: "https://this-domain-does-not-exist-12345.com",
        timeout_ms: 2000,
      });

      expect(result.status_code).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.checked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("respects timeout", async () => {
      const result = await pflow.triggerWorkflow("url-check", {
        url: "https://httpstat.us/200?sleep=5000",
        timeout_ms: 100,
      });

      expect(result.status_code).toBeNull();
      expect(result.error).toContain("abort");
    });
  });

  describe.skipIf(!OPENAI_API_KEY)("url-summarizer workflow", () => {
    it("summarizes a page successfully", async () => {
      const result = await pflow.triggerWorkflow("url-summarizer", {
        url: "https://example.com",
      });

      expect(result.status).toBe("success");
      expect(result.status_code).toBe(200);
      expect(result.summary).not.toBeNull();
      expect(result.summary!.length).toBeGreaterThan(10);
      expect(result.error).toBeNull();
    }, 30000);

    it("returns error status for non-200 response", async () => {
      const result = await pflow.triggerWorkflow("url-summarizer", {
        url: "https://example.com/this-page-does-not-exist-404",
      });

      expect(result.status).toBe("error");
      expect(result.status_code).toBe(404);
      expect(result.summary).toBeNull();
    });
  });
});
