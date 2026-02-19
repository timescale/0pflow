import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { readFile, getService } from "@/lib/sprites";

/**
 * GET /api/deploy/status?appName=X
 * Check deployment status: build progress + service state.
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
      `SELECT sprite_name, sprite_url FROM deployments
       WHERE user_id = $1 AND app_name = $2`,
      [userId, appName],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        data: { status: "not_found" },
      });
    }

    const spriteName = result.rows[0].sprite_name as string;
    const spriteUrl = result.rows[0].sprite_url as string;

    // Ping the Sprite URL to keep it awake (generates TCP connection)
    if (spriteUrl) {
      fetch(spriteUrl, { signal: AbortSignal.timeout(3000) }).catch(() => {});
    }

    // Check for build error first
    const buildError = await readFile(spriteName, "/app/.build-error");
    if (buildError) {
      const error = buildError.toString("utf-8").trim();
      console.log(`[deploy/status] ${appName}: build_error — ${error}`);
      return NextResponse.json({
        data: { status: "build_error", error, url: spriteUrl },
      });
    }

    // Check if build is complete
    const buildComplete = await readFile(spriteName, "/app/.build-complete");
    if (!buildComplete) {
      console.log(`[deploy/status] ${appName}: building`);
      return NextResponse.json({
        data: { status: "building", url: spriteUrl },
      });
    }

    // Build is done — check service status
    const service = await getService(spriteName, "app");
    if (!service) {
      console.log(`[deploy/status] ${appName}: starting (no service yet)`);
      return NextResponse.json({
        data: { status: "starting", url: spriteUrl },
      });
    }

    const serviceStatus = service.state?.status;
    console.log(`[deploy/status] ${appName}: service ${serviceStatus}, restarts: ${service.state?.restart_count ?? 0}`);
    const status = serviceStatus === "running" ? "running" : "starting";
    return NextResponse.json({
      data: { status, url: spriteUrl },
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
