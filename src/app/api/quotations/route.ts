import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/request-auth";
import { toErrorResponse } from "@/lib/errors";
import { createQuotation, listQuotations } from "@/server/services/quotation-service";

export const runtime = "nodejs";

const schema = z.object({
  serviceRequestId: z.string().min(1),
  quotationNumber: z.string().min(1),
  totalAmount: z.number().positive(),
  cgst: z.number().optional(),
  sgst: z.number().optional(),
  igst: z.number().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const serviceRequestId = request.nextUrl.searchParams.get("serviceRequestId") ?? undefined;
    const data = await listQuotations(auth, serviceRequestId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const payload = schema.parse(await request.json());
    const data = await createQuotation(auth, payload);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
