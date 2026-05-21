import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/errors";
import { getOrCreateConversation } from "@/server/integrations/twilio";

export const runtime = "nodejs";

const schema = z.object({
  serviceId: z.string().min(1),
  serviceName: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const payload = schema.parse(await request.json());
    const data = await getOrCreateConversation(payload.serviceId, payload.serviceName);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
