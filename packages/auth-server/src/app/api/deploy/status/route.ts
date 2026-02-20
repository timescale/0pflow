import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { getBuildStatus } from "@/lib/flyctl";
import { listMachines } from "@/lib/fly";

/**
 * Extract a human-readable build step from Docker build output.
 */
function parseBuildStep(output: string): string {
  const lines = output.split("\n");

  // Walk backwards to find the last meaningful Docker build step
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();

    // Docker buildkit step lines like "#8 [deps 3/3] RUN npm ci"
    const stepMatch = line.match(/^#\d+\s+\[(\w+)\s+\d+\/\d+\]\s+(.+)/);
    if (stepMatch) {
      const stage = stepMatch[1];
      const cmd = stepMatch[2];
      if (cmd.startsWith("RUN")) {
        const runCmd = cmd.replace(/^RUN\s+/, "");
        if (runCmd.includes("npm ci") || runCmd.includes("npm install")) return "Installing dependencies...";
        if (runCmd.includes("npm run build")) return "Building application...";
        return `Running: ${runCmd.slice(0, 60)}`;
      }
      if (cmd.startsWith("COPY")) return `Copying files (${stage})...`;
      return `${stage}: ${cmd.slice(0, 60)}`;
    }

    // "==> Building image" or "==> Creating release"
    if (line.includes("Creating release")) return "Creating release...";
    if (line.includes("Pushing image")) return "Pushing image...";
    if (line.includes("Building image")) return "Building image...";

    // flyctl deploy progress
    if (line.includes("Waiting for")) return line;
  }

  return "Building...";
}

/**
 * GET /api/deploy/status?appName=X
 * Check deployment status: build progress + machine state.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const appName = req.nextUrl.searchParams.get("appName");
  if (!appName) {
    return NextResponse.json(
      { error: "appName query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const db = await getPool();
    const result = await db.query(
      `SELECT fly_app_name, app_url, deploy_status, deploy_error FROM deployments
       WHERE user_id = $1 AND app_name = $2`,
      [userId, appName],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        data: { status: "not_found" },
      });
    }

    const flyAppName = result.rows[0].fly_app_name as string | null;
    const appUrl = result.rows[0].app_url as string | null;
    const deployStatus = result.rows[0].deploy_status as string;
    const deployError = result.rows[0].deploy_error as string | null;

    if (!flyAppName) {
      return NextResponse.json({
        data: { status: "not_found" },
      });
    }

    // Check in-memory build status first
    const build = getBuildStatus(flyAppName);
    if (build && build.exitCode === null) {
      const buildMessage = parseBuildStep(build.output);
      console.log(`[deploy/status] ${appName}: building — ${buildMessage}`);
      return NextResponse.json({
        data: { status: "building", message: buildMessage, url: appUrl },
      });
    }

    // Check DB status for build errors
    if (deployStatus === "error") {
      console.log(`[deploy/status] ${appName}: build_error`);
      return NextResponse.json({
        data: { status: "build_error", error: deployError, url: appUrl },
      });
    }

    if (deployStatus === "building") {
      // Build process may have been lost (server restart) — check machine state
      console.log(`[deploy/status] ${appName}: building (db status)`);
      return NextResponse.json({
        data: { status: "building", url: appUrl },
      });
    }

    // Build is done (deployed or idle) — check machine state
    if (deployStatus === "deployed" || deployStatus === "idle") {
      try {
        const machines = await listMachines(flyAppName);
        if (machines.length === 0) {
          console.log(`[deploy/status] ${appName}: no machines yet`);
          return NextResponse.json({
            data: { status: "starting", url: appUrl },
          });
        }

        const machine = machines[0];
        const state = machine.state?.toLowerCase();
        console.log(
          `[deploy/status] ${appName}: machine ${machine.id} state=${state}`,
        );

        if (state === "started" || state === "running") {
          // Ping the app URL to verify it responds
          try {
            const resp = await fetch(appUrl!, {
              signal: AbortSignal.timeout(3000),
            });
            if (resp.ok || resp.status < 500) {
              return NextResponse.json({
                data: { status: "running", url: appUrl },
              });
            }
          } catch {
            // App not responding yet
          }
          return NextResponse.json({
            data: { status: "starting", url: appUrl },
          });
        }

        if (state === "stopped" || state === "suspended") {
          // Ping to wake it up (auto-start)
          if (appUrl) {
            fetch(appUrl, { signal: AbortSignal.timeout(3000) }).catch(
              () => {},
            );
          }
          return NextResponse.json({
            data: { status: "starting", url: appUrl },
          });
        }

        // Other states (created, destroying, etc.)
        return NextResponse.json({
          data: { status: "starting", url: appUrl },
        });
      } catch (err) {
        console.log(
          `[deploy/status] Machine check failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        // Fall through — return based on DB status
      }
    }

    // Default: return DB status
    return NextResponse.json({
      data: { status: deployStatus, url: appUrl },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Status check failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }
}
