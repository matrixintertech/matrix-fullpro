import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/request-auth";
import { toErrorResponse } from "@/lib/errors";
import {
  deleteServiceRequest,
  getServiceRequestById,
  updateServiceRequest,
} from "@/server/services/service-request-service";

export const runtime = "nodejs";

const updateServiceRequestSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  serviceType: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).optional(),
  clientId: z.string().nullable().optional(),
  clientUserId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  callReferenceNumber: z.string().nullable().optional(),
  costName: z.string().nullable().optional(),
  pmAssignedId: z.string().nullable().optional(),
  smAssignedId: z.string().nullable().optional(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(request);
    const { id } = await context.params;
    const data = await getServiceRequestById(auth, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(request);
    const { id } = await context.params;
    const data = await deleteServiceRequest(auth, id);
    return NextResponse.json({
      success: true,
      message: "Service request deleted successfully",
      data,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(request);
    const { id } = await context.params;
    const payload = updateServiceRequestSchema.parse(await request.json());
    const data = await updateServiceRequest(auth, id, payload);

    return NextResponse.json({
      success: true,
      message: "Service request updated successfully",
      data,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
