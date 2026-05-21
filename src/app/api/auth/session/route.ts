import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/request-auth";
import { toErrorResponse } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
