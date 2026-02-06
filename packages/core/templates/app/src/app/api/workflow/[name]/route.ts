import { type NextRequest, NextResponse } from "next/server";
import { getPflow } from "~/lib/pflow";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const pflow = await getPflow();
    const result = await pflow.triggerWorkflow(name, {});
    return NextResponse.json({ status: "completed", result });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const pflow = await getPflow();
    const body: unknown = await request.json();
    const result = await pflow.triggerWorkflow(name, body);
    return NextResponse.json({ status: "completed", result });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
