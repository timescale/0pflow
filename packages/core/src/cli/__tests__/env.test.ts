// packages/cli/src/__tests__/env.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { findEnvFile } from "../env.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("findEnvFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  it("finds .env in current directory", () => {
    fs.writeFileSync(path.join(tempDir, ".env"), "TEST=1");
    const result = findEnvFile(tempDir);
    expect(result).toBe(path.join(tempDir, ".env"));
  });

  it("finds .env in parent directory", () => {
    const subDir = path.join(tempDir, "sub");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(tempDir, ".env"), "TEST=1");
    const result = findEnvFile(subDir);
    expect(result).toBe(path.join(tempDir, ".env"));
  });

  it("returns null if no .env found", () => {
    const result = findEnvFile(tempDir);
    expect(result).toBeNull();
  });
});
