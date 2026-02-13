import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import type { IPty } from "node-pty";

const require = createRequire(import.meta.url);

/** Resolve the full path to `claude` using a login shell (which sources .zshrc/.bashrc). */
function resolveClaudePath(): string {
  try {
    const shell = process.env.SHELL || "/bin/bash";
    return execSync(`${shell} -l -c "which claude"`, {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
  } catch {
    return "claude";
  }
}

export interface PtyManager {
  isAlive(): boolean;
  spawn(): number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  getScrollback(): string;
}

export interface PtyManagerOptions {
  projectRoot: string;
  claudeArgs?: string[];
  onData: (data: string) => void;
  onExit: (code: number) => void;
}

const SCROLLBACK_SIZE = 100_000;

export function createPtyManager(options: PtyManagerOptions): PtyManager {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodePty = require("node-pty") as typeof import("node-pty");

  let pty: IPty | null = null;
  let scrollback = "";

  function spawn(): number {
    if (pty) {
      try {
        pty.kill();
      } catch {
        /* ignore */
      }
      pty = null;
      scrollback = "";
    }

    const claudePath = resolveClaudePath();
    pty = nodePty.spawn(claudePath, options.claudeArgs ?? [], {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: options.projectRoot,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        FORCE_COLOR: "1",
      },
    });

    pty.onData((data: string) => {
      scrollback += data;
      if (scrollback.length > SCROLLBACK_SIZE) {
        scrollback = scrollback.slice(-SCROLLBACK_SIZE);
      }
      options.onData(data);
    });

    pty.onExit(({ exitCode }: { exitCode: number }) => {
      options.onExit(exitCode ?? 0);
      pty = null;
    });

    return pty.pid;
  }

  return {
    isAlive: () => pty !== null,
    spawn,
    write: (data: string) => pty?.write(data),
    resize: (cols: number, rows: number) => {
      if (pty) {
        try {
          pty.resize(cols, rows);
        } catch {
          /* ignore if not alive */
        }
      }
    },
    kill: () => {
      if (pty) {
        try {
          pty.kill();
        } catch {
          /* ignore */
        }
        pty = null;
      }
    },
    getScrollback: () => scrollback,
  };
}
