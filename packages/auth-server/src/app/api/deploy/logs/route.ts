import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { getBuildStatus } from "@/lib/flyctl";
import { flyctlSync } from "@/lib/flyctl";

/**
 * GET /api/deploy/logs?appName=X
 * Get deployment logs (build output + runtime logs).
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
      `SELECT fly_app_name FROM deployments
       WHERE user_id = $1 AND app_name = $2`,
      [userId, appName],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "No deployment found" },
        { status: 404 },
      );
    }

    const flyAppName = result.rows[0].fly_app_name as string | null;
    if (!flyAppName) {
      return NextResponse.json(
        { error: "No deployment found" },
        { status: 404 },
      );
    }

    // Get build output from in-memory tracking
    const build = getBuildStatus(flyAppName);
    const buildLog = build?.output || null;

    // Get runtime logs via flyctl
    let serviceLogs: string | null = null;
    try {
      serviceLogs = flyctlSync(["logs", "-a", flyAppName, "--no-tail"]);
    } catch {
      // App might not have any logs yet
    }

    return NextResponse.json({
      data: {
        buildLog,
        serviceLogs,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to get logs: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }
}
