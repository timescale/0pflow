import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { getServiceLogs, readFile } from "@/lib/sprites";

/**
 * GET /api/deploy/logs?appName=X
 * Get deployment logs (build log + service logs).
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
      `SELECT sprite_name FROM deployments
       WHERE user_id = $1 AND app_name = $2`,
      [userId, appName],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "No deployment found" },
        { status: 404 },
      );
    }

    const spriteName = result.rows[0].sprite_name as string;

    // Try to get build log first
    const buildLog = await readFile(spriteName, "/app/build.log");

    // Try to get service logs
    let serviceLogs = "";
    try {
      serviceLogs = await getServiceLogs(spriteName, "app");
    } catch {
      // Service might not exist yet
    }

    return NextResponse.json({
      data: {
        buildLog: buildLog ? buildLog.toString("utf-8") : null,
        serviceLogs: serviceLogs || null,
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
