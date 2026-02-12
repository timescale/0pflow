import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getNango } from "@/lib/nango";

/**
 * GET /api/integrations
 * List available Nango integrations. Requires Bearer token.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const nango = getNango();
    const result = await nango.listIntegrations();
    const integrations = (result.configs ?? []).map(
      (c: { unique_key: string; provider: string }) => ({
        id: c.unique_key,
        provider: c.provider,
      }),
    );

    return NextResponse.json({ data: integrations });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list integrations" },
      { status: 500 },
    );
  }
}
