import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import { skillsDir } from "../config.js";

export interface SkillGuideEntry {
  name: string;
  description: string;
}

export interface SkillGuideContent {
  name: string;
  description: string;
  content: string;
}

/**
 * Resolve the skills directory. Checks the package-bundled location first,
 * then falls back to the monorepo root (for dev without build).
 */
function resolveSkillsDir(): string | null {
  if (existsSync(skillsDir)) return skillsDir;
  // Dev mode fallback: monorepo root
  const monorepoSkills = join(skillsDir, "..", "..", "skills");
  if (existsSync(monorepoSkills)) return monorepoSkills;
  return null;
}

/**
 * Recursively collect files from a directory.
 */
async function walkDir(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

/**
 * Derive a guide name from a file path relative to the skills directory.
 *
 * - `create-workflow/SKILL.md` → `"create-workflow"`
 * - `integrations/SKILL.md`    → `"integrations"`
 * - `integrations/salesforce.md` → `"integrations/salesforce"`
 * - `integrations/scripts/fetch-schema.ts` → `"integrations/scripts/fetch-schema"`
 */
function deriveGuideName(relPath: string): string {
  // SKILL.md → use parent directory name
  if (relPath.endsWith("/SKILL.md") || relPath === "SKILL.md") {
    const dir = relPath.replace(/\/?SKILL\.md$/, "");
    return dir || "index";
  }
  // Strip extension
  return relPath.replace(/\.(md|ts)$/, "");
}

/**
 * List all available skill guides with names and descriptions.
 */
export async function listSkillGuides(): Promise<SkillGuideEntry[]> {
  const dir = resolveSkillsDir();
  if (!dir) return [];

  const allFiles = await walkDir(dir);
  const guides: SkillGuideEntry[] = [];

  for (const filePath of allFiles) {
    const rel = relative(dir, filePath);

    // Skip disabled files
    if (rel.includes(".disabled")) continue;

    // Only include .md and .ts files
    if (!rel.endsWith(".md") && !rel.endsWith(".ts")) continue;

    const name = deriveGuideName(rel);
    let description = "";

    if (rel.endsWith(".md")) {
      try {
        const raw = await readFile(filePath, "utf-8");
        const { data } = matter(raw);
        description = (data.description as string) || "";
      } catch {
        // skip files we can't parse
      }
    } else {
      // For .ts files, use the filename as a description hint
      description = `Script template: ${rel}`;
    }

    guides.push({ name, description });
  }

  // Sort: top-level skills first, then sub-guides
  guides.sort((a, b) => {
    const aDepth = a.name.split("/").length;
    const bDepth = b.name.split("/").length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.name.localeCompare(b.name);
  });

  return guides;
}

/**
 * Get the full content of a skill guide by name.
 */
export async function getSkillGuideContent(
  name: string,
): Promise<SkillGuideContent | null> {
  const dir = resolveSkillsDir();
  if (!dir) return null;

  // Try resolving the name to a file path
  const candidates = [
    join(dir, name, "SKILL.md"), // "create-workflow" → create-workflow/SKILL.md
    join(dir, `${name}.md`), // "integrations/salesforce" → integrations/salesforce.md
    join(dir, `${name}.ts`), // "integrations/scripts/fetch-schema" → integrations/scripts/fetch-schema.ts
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;

    const raw = await readFile(filePath, "utf-8");

    if (filePath.endsWith(".md")) {
      const { data, content } = matter(raw);
      return {
        name,
        description: (data.description as string) || "",
        content: content.trim(),
      };
    }

    // .ts file — return raw content
    return {
      name,
      description: `Script template: ${relative(dir, filePath)}`,
      content: raw,
    };
  }

  return null;
}
