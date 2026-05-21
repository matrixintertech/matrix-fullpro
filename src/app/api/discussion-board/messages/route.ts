import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/errors";
import { getConversationMessages } from "@/server/integrations/twilio";

export const runtime = "nodejs";

const schema = z.object({
  conversationSid: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const conversationSid = request.nextUrl.searchParams.get("conversationSid") ?? "";
    const payload = schema.parse({ conversationSid });
    const data = await getConversationMessages(payload.conversationSid);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
