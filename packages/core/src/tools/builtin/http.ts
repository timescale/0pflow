// packages/core/src/tools/builtin/http.ts
import { z } from "zod";
import { Tool } from "../tool.js";

/**
 * HTTP GET tool - fetches content from a URL
 */
export const httpGet = Tool.create({
  name: "http.get",
  description: "Fetch content from a URL using HTTP GET request",
  inputSchema: z.object({
    url: z.string().refine((val) => {
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    }, "Invalid URL").describe("The URL to fetch"),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe("Optional HTTP headers to include"),
  }),
  outputSchema: z.object({
    status: z.number(),
    body: z.string(),
    headers: z.record(z.string(), z.string()),
  }),
  execute: async ({ url, headers }) => {
    const response = await fetch(url, {
      method: "GET",
      headers: headers as Record<string, string> | undefined,
    });

    const body = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      body,
      headers: responseHeaders,
    };
  },
});
