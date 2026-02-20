import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { flyctlSync } from "@/lib/flyctl";

const FLY_ORG = process.env.FLY_ORG ?? "tiger-data";

/**
 * POST /api/deploy/prepare
 * Create or retrieve a Fly app for the user's deployment.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const body = (await req.json()) as { appName?: string };
    if (!body.appName) {
      return NextResponse.json(
        { error: "appName is required" },
        { status: 400 },
      );
    }

    const { appName } = body;
    const db = await getPool();

    // Check for existing deployment
    const existing = await db.query(
      `SELECT id, fly_app_name, app_url FROM deployments
       WHERE user_id = $1 AND app_name = $2`,
      [userId, appName],
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.fly_app_name) {
        return NextResponse.json({
          data: {
            appUrl: row.app_url as string,
          },
        });
      }
    }

    // Create new deployment record (or get existing ID for naming)
    const upsert = await db.query(
      `INSERT INTO deployments (user_id, app_name)
       VALUES ($1, $2)
       ON CONFLICT (user_id, app_name) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [userId, appName],
    );
    const deploymentId = upsert.rows[0].id as number;
    const flyAppName = `opflow-${deploymentId}`;
    const appUrl = `https://${flyAppName}.fly.dev`;

    // Create Fly app
    console.log(`[deploy/prepare] Creating Fly app: ${flyAppName}`);
    try {
      flyctlSync(["apps", "create", flyAppName, "--org", FLY_ORG]);
    } catch (err) {
      // App might already exist (idempotent)
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("already exists")) {
        throw err;
      }
      console.log(`[deploy/prepare] App ${flyAppName} already exists`);
    }

    // Allocate shared IPv4
    console.log(`[deploy/prepare] Allocating shared IPv4 for ${flyAppName}`);
    try {
      flyctlSync(["ips", "allocate-v4", "--shared", "-a", flyAppName]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("already") && !msg.includes("shared")) {
        console.log(`[deploy/prepare] IP allocation warning: ${msg}`);
      }
    }

    // Update deployment record
    await db.query(
      `UPDATE deployments SET fly_app_name = $1, app_url = $2, updated_at = NOW()
       WHERE id = $3`,
      [flyAppName, appUrl, deploymentId],
    );

    return NextResponse.json({
      data: {
        appUrl,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Prepare failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }
}
