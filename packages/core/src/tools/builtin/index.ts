// packages/core/src/tools/builtin/index.ts
import { httpGet } from "./http.js";
import type { ToolExecutable } from "../tool.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolExecutable = ToolExecutable<any, any>;

/**
 * All built-in tools indexed by name
 */
export const builtinTools: Record<string, AnyToolExecutable> = {
  "http_get": httpGet,
};

export { httpGet };
