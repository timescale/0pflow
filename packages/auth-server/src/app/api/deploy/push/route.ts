import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  writeFile,
  putService,
  startService,
  stopService,
  deleteService,
  wakeSprite,
} from "@/lib/sprites";

/**
 * build.sh template — runs inside the Sprite.
 * Extracts code, installs deps, builds, then creates the "app" service.
 */
function generateBuildScript(): string {
  return `#!/bin/bash

# Clean previous markers
rm -f /app/.build-complete /app/.build-error

# Start a temporary HTTP server on port 3000 to keep the Sprite awake.
# Incoming TCP connections from status polling prevent idle hibernation.
sprite-env services stop app 2>/dev/null || true
sprite-env services delete app 2>/dev/null || true
sprite-env services create app \\
  --cmd node --args "-e,require('http').createServer((q,r)=>{r.end('building')}).listen(3000)" \\
  --http-port 3000 \\
  --no-stream

# Extract app code
mkdir -p /app
cd /app
tar xzf /tmp/app.tar.gz || { echo "Failed to extract archive" > /app/.build-error; exit 1; }

# Install dependencies and build
npm install 2>&1 | tee /app/build.log || { echo "npm install failed" > /app/.build-error; exit 1; }
npm run build 2>&1 | tee -a /app/build.log || { echo "npm run build failed" > /app/.build-error; exit 1; }

# Signal build completion
touch /app/.build-complete

# Replace temp server with real app
sprite-env services stop app 2>/dev/null || true
sprite-env services delete app 2>/dev/null || true
sprite-env services create app \\
  --cmd bash --args "-c,cd /app && npm run start" \\
  --http-port 3000 \\
  --no-stream
`;
}

/**
 * POST /api/deploy/push
 * Upload app code + env vars, kick off build inside the Sprite.
 *
 * The build runs as a Sprite service ("build") so the Sprite stays
 * awake for the duration. When the build finishes, the script creates
 * the "app" service which runs `npm run start`.
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
      `SELECT sprite_name FROM deployments
       WHERE user_id = $1 AND app_name = $2`,
      [userId, appName],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "No deployment found. Run prepare first." },
        { status: 404 },
      );
    }

    const spriteName = result.rows[0].sprite_name as string;

    // Wake the Sprite from hibernation before writing files
    console.log(`[deploy/push] Waking sprite ${spriteName}...`);
    await wakeSprite(spriteName);

    // Upload tarball to Sprite
    const tarBuffer = Buffer.from(archive, "base64");
    await writeFile(spriteName, "/tmp/app.tar.gz", tarBuffer);

    // Write .env file if env vars provided
    if (envVars && Object.keys(envVars).length > 0) {
      const envContent = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
      await writeFile(spriteName, "/app/.env", envContent);
    }

    // Write build script
    const buildScript = generateBuildScript();
    await writeFile(spriteName, "/tmp/build.sh", buildScript, "0755");

    // Stop previous build service if still running
    await stopService(spriteName, "build").catch(() => {});
    await deleteService(spriteName, "build").catch(() => {});

    // Create and start "build" service — keeps the Sprite awake
    await putService(spriteName, "build", {
      cmd: "bash",
      args: ["/tmp/build.sh"],
    });
    await startService(spriteName, "build");

    // Update timestamp
    await db.query(
      `UPDATE deployments SET updated_at = NOW() WHERE user_id = $1 AND app_name = $2`,
      [userId, appName],
    );

    return NextResponse.json({
      data: { status: "building" },
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
