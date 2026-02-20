import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { startDeploy, getBuildStatus } from "@/lib/flyctl";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

/**
 * Generate a fly.toml for the user's app.
 */
function generateFlyToml(flyAppName: string): string {
  return `app = "${flyAppName}"
primary_region = "iad"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
`;
}

/**
 * POST /api/deploy/push
 * Upload app code + env vars, kick off Docker build via flyctl.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const body = (await req.json()) as {
      appName?: string;
      archive?: string; // base64 tar.gz
      envVars?: Record<string, string>;
    };

    if (!body.appName || !body.archive) {
      return NextResponse.json(
        { error: "appName and archive are required" },
        { status: 400 },
      );
    }

    const { appName, archive, envVars } = body;
    const db = await getPool();

    // Look up deployment and verify ownership
    const result = await db.query(
      `SELECT fly_app_name, deploy_status FROM deployments
       WHERE user_id = $1 AND app_name = $2`,
      [userId, appName],
    );

    if (result.rows.length === 0 || !result.rows[0].fly_app_name) {
      return NextResponse.json(
        { error: "No deployment found. Run prepare first." },
        { status: 404 },
      );
    }

    const flyAppName = result.rows[0].fly_app_name as string;

    // Check if a build is already in progress
    const existingBuild = getBuildStatus(flyAppName);
    if (existingBuild && existingBuild.exitCode === null) {
      return NextResponse.json(
        { error: "A deploy is already in progress for this app." },
        { status: 409 },
      );
    }

    // Create temp directory and extract tarball
    const tempDir = mkdtempSync(join(tmpdir(), `deploy-${flyAppName}-`));
    console.log(`[deploy/push] Extracting to ${tempDir}`);

    const tarBuffer = Buffer.from(archive, "base64");
    const tarPath = join(tempDir, "app.tar.gz");
    writeFileSync(tarPath, tarBuffer);
    execSync("tar xzf app.tar.gz && rm app.tar.gz", { cwd: tempDir });

    // Generate fly.toml (Dockerfile and .dockerignore come from the app template)
    writeFileSync(join(tempDir, "fly.toml"), generateFlyToml(flyAppName));

    // Write .env file for build-time vars
    if (envVars && Object.keys(envVars).length > 0) {
      const envContent = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
      writeFileSync(join(tempDir, ".env"), envContent);
    }

    // Set runtime secrets via flyctl secrets import (stdin)
    if (envVars && Object.keys(envVars).length > 0) {
      console.log(`[deploy/push] Setting secrets for ${flyAppName}`);
      const envLines = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

      // Write env to a temp file and pipe it to flyctl
      const secretsFile = join(tmpdir(), `secrets-${flyAppName}.env`);
      writeFileSync(secretsFile, envLines);
      try {
        execSync(
          `flyctl secrets import -a ${flyAppName} --stage < ${secretsFile}`,
          {
            env: { ...process.env, FLY_API_TOKEN: process.env.FLY_API_TOKEN },
            stdio: "pipe",
            timeout: 15000,
            shell: "/bin/bash",
          },
        );
      } catch (err) {
        console.log(
          `[deploy/push] Secrets import warning: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        try {
          require("node:fs").unlinkSync(secretsFile);
        } catch {
          // ignore
        }
      }
    }

    // Start flyctl deploy in background
    console.log(`[deploy/push] Starting deploy for ${flyAppName}`);
    startDeploy(flyAppName, tempDir, async (exitCode, output) => {
      // Update DB on completion
      try {
        const pool = await getPool();
        if (exitCode === 0) {
          await pool.query(
            `UPDATE deployments SET deploy_status = 'deployed', deploy_error = NULL, updated_at = NOW()
             WHERE fly_app_name = $1`,
            [flyAppName],
          );
        } else {
          const errorSnippet = output.slice(-500);
          await pool.query(
            `UPDATE deployments SET deploy_status = 'error', deploy_error = $1, updated_at = NOW()
             WHERE fly_app_name = $2`,
            [errorSnippet, flyAppName],
          );
        }
      } catch {
        // ignore DB errors in callback
      }
    });

    // Update status in DB
    await db.query(
      `UPDATE deployments SET deploy_status = 'building', deploy_error = NULL, updated_at = NOW()
       WHERE user_id = $1 AND app_name = $2`,
      [userId, appName],
    );

    return NextResponse.json({
      data: { status: "deploying" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Push failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }
}
