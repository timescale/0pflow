import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { createSprite, getSprite, updateSprite } from "@/lib/sprites";

/**
 * POST /api/deploy/prepare
 * Create or retrieve a Sprite for the user's app.
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
      `SELECT id, sprite_name, sprite_url FROM deployments
       WHERE user_id = $1 AND app_name = $2`,
      [userId, appName],
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      // Ensure Sprite still exists
      const sprite = await getSprite(row.sprite_name as string);
      if (sprite) {
        return NextResponse.json({
          data: {
            spriteName: row.sprite_name,
            spriteUrl: row.sprite_url ?? sprite.url,
          },
        });
      }
      // Sprite was deleted — recreate below
    }

    // Create new deployment record (or get existing ID for naming)
    const upsert = await db.query(
      `INSERT INTO deployments (user_id, app_name, sprite_name, sprite_url)
       VALUES ($1, $2, '', '')
       ON CONFLICT (user_id, app_name) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [userId, appName],
    );
    const deploymentId = upsert.rows[0].id as number;
    const spriteName = `opflow-${deploymentId}`;

    // Create Sprite
    const sprite = await createSprite(spriteName);

    // Make URL public
    await updateSprite(spriteName, { url_settings: { auth: "public" } });

    // Update deployment record with sprite info
    await db.query(
      `UPDATE deployments SET sprite_name = $1, sprite_url = $2, updated_at = NOW()
       WHERE id = $3`,
      [spriteName, sprite.url ?? "", deploymentId],
    );

    return NextResponse.json({
      data: {
        spriteName,
        spriteUrl: sprite.url,
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
