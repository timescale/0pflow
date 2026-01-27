// packages/cli/vitest.config.ts
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  test: {
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
