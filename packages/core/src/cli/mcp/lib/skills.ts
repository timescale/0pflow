import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, posix } from "node:path";
import matter from "gray-matter";
import { skillsDir } from "../config.js";

export interface SkillEntry {
  name: string;
  description: string;
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
 * Normalize and validate a relative path within a skill directory.
 * Prevents directory traversal attacks.
 */
function normalizePath(path: string): string {
  const normalized = posix
    .normalize(path.replace(/\\/g, "/"))
    .replace(/^(\.?\/)+/, "");
  if (
    normalized.split("/").some((s) => s === "..") ||
    normalized.includes("\0")
  ) {
    throw new Error(`Invalid path: ${path}`);
  }
  return normalized;
}

/**
 * List all available skills with names and descriptions.
 */
export async function listSkills(): Promise<SkillEntry[]> {
  const dir = resolveSkillsDir();
  if (!dir) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const skills: SkillEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMdPath = join(dir, entry.name, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;

    try {
      const raw = await readFile(skillMdPath, "utf-8");
      const { data } = matter(raw);
      skills.push({
        name: entry.name,
        description: (data.description as string) || "",
      });
    } catch {
      // skip unparseable skills
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

/**
 * View content within a skill directory.
 *
 * - skill_name="." → list all available skills
 * - path="" or path="SKILL.md" → read the skill's SKILL.md
 * - path="." → list the skill's root directory
 * - path="scripts/fetch-schema.ts" → read a specific file
 */
export async function viewSkillContent(
  skillName: string,
  path?: string,
): Promise<string> {
  const dir = resolveSkillsDir();
  if (!dir) throw new Error("Skills directory not found.");

  // List all skills
  if (!skillName || skillName === ".") {
    const skills = await listSkills();
    if (skills.length === 0) {
      return "No skills found. The skills directory may not be bundled.";
    }
    return skills
      .map((s) => `- **${s.name}**: ${s.description}`)
      .join("\n");
  }

  // Resolve skill root
  const skillRoot = resolve(join(dir, skillName));
  if (!skillRoot.startsWith(resolve(dir))) {
    throw new Error(`Invalid skill name: ${skillName}`);
  }
  if (!existsSync(skillRoot)) {
    const skills = await listSkills();
    throw new Error(
      `Skill "${skillName}" not found. Available skills: ${skills.map((s) => s.name).join(", ")}`,
    );
  }

  // Determine target path
  const targetPath = path || "SKILL.md";
  const normalizedPath = normalizePath(targetPath);
  const target = resolve(join(skillRoot, normalizedPath));

  // Security check: must be within skill root
  if (targetPath !== "." && !target.startsWith(skillRoot)) {
    throw new Error(`Invalid path: ${targetPath}`);
  }

  const s = await stat(target).catch(() => {
    throw new Error(`Path not found: ${skillName}/${targetPath}`);
  });

  if (s.isDirectory()) {
    const entries = await readdir(target, { withFileTypes: true });
    const listing = entries
      .map((e) => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
      .join("\n");
    return `Directory listing for ${skillName}/${normalizedPath}:\n${listing}`;
  }

  const raw = await readFile(target, "utf-8");

  // Strip frontmatter from .md files
  if (target.endsWith(".md")) {
    const { content } = matter(raw);
    return content.trim();
  }

  return raw;
}
