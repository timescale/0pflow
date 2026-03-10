import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getNango } from "@/lib/nango";

/**
 * POST /api/connections/delete
 * Delete a Nango connection. Verifies ownership via end_user before deleting.
 * Body: { integration_id, connection_id }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    integration_id?: string;
    connection_id?: string;
  };

  if (!body.integration_id || !body.connection_id) {
    return NextResponse.json(
      { error: "integration_id and connection_id are required" },
      { status: 400 },
    );
  }

  try {
    const nango = getNango();

    // Verify the connection belongs to the requesting user
    const connection = await nango.getConnection(body.integration_id, body.connection_id);
    const connAny = connection as unknown as { end_user?: { id: string } | null };
    if (connAny.end_user?.id !== auth.userId) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 },
      );
    }

    await nango.deleteConnection(body.integration_id, body.connection_id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete connection" },
      { status: 500 },
    );
  }
}
