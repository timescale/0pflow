// packages/core/src/nodes/builtin/web.ts
import { z } from "zod";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { Node } from "../../node.js";

/**
 * Web read node - fetches and extracts readable content from a URL
 *
 * Uses Mozilla's Readability to extract the main content from web pages,
 * removing navigation, ads, and other non-content elements.
 */
export const webRead = Node.create({
  name: "web_read",
  description:
    "Fetch a URL and extract the main readable content using Mozilla Readability",
  inputSchema: z.object({
    url: z
      .string()
      .refine((val) => {
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      }, "Invalid URL")
      .describe("The URL to fetch"),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe("Optional HTTP headers to include"),
  }),
  outputSchema: z.object({
    status: z.number().describe("HTTP status code"),
    title: z.string().nullable().describe("Page title"),
    content: z
      .string()
      .nullable()
      .describe("Extracted text content (null if extraction failed)"),
    byline: z.string().nullable().describe("Author/byline if found"),
    siteName: z.string().nullable().describe("Site name if found"),
    excerpt: z.string().nullable().describe("Article excerpt/description"),
  }),
  execute: async (_ctx, { url, headers }) => {
    const response = await fetch(url, {
      method: "GET",
      headers: headers as Record<string, string> | undefined,
    });

    if (!response.ok) {
      return {
        status: response.status,
        title: null,
        content: null,
        byline: null,
        siteName: null,
        excerpt: null,
      };
    }

    const html = await response.text();

    // Parse HTML and extract readable content
    const { document } = parseHTML(html);
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      // Readability couldn't extract content - return raw text as fallback
      const textContent = document.body?.textContent?.trim() ?? null;
      return {
        status: response.status,
        title: document.title || null,
        content: textContent,
        byline: null,
        siteName: null,
        excerpt: null,
      };
    }

    return {
      status: response.status,
      title: article.title,
      content: article.textContent,
      byline: article.byline,
      siteName: article.siteName,
      excerpt: article.excerpt,
    };
  },
});
