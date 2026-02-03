// packages/core/src/nodes/builtin/index.ts
import { webRead } from "./web.js";
import type { Executable } from "../../types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyExecutable = Executable<any, any>;

/**
 * All built-in nodes indexed by name
 */
export const builtinNodes: Record<string, AnyExecutable> = {
  "web_read": webRead,
};

export { webRead };
