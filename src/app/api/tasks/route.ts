import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/request-auth";
import { toErrorResponse } from "@/lib/errors";
import { createTask, listTasks } from "@/server/services/task-service";

export const runtime = "nodejs";

const schema = z.object({
  serviceRequestId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  taskDate: z.string().min(1),
  fileUrl: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const serviceRequestId = request.nextUrl.searchParams.get("serviceRequestId") ?? undefined;
    const data = await listTasks(auth, serviceRequestId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const payload = schema.parse(await request.json());
    const data = await createTask(auth, payload);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
