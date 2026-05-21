import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/request-auth";
import { toErrorResponse } from "@/lib/errors";
import {
  createServiceRequest,
  listServiceRequests,
} from "@/server/services/service-request-service";

export const runtime = "nodejs";

const createServiceRequestSchema = z.object({
  title: z.string().min(2).max(200),
  serviceType: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
  clientId: z.string().optional(),
  clientUserId: z.string().optional(),
  branchId: z.string().optional(),
  callReferenceNumber: z.string().optional(),
  costName: z.string().optional(),
  servicePartnerId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const filters = {
      servicePartnerId: searchParams.get("servicePartnerId") ?? undefined,
      clientId: searchParams.get("clientId") ?? undefined,
      clientUserId: searchParams.get("clientUserId") ?? undefined,
    };

    const data = await listServiceRequests(auth, filters);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const input = createServiceRequestSchema.parse(await request.json());
    const data = await createServiceRequest(auth, input);

    return NextResponse.json(
      {
        success: true,
        message: "Service request created successfully",
        data,
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
