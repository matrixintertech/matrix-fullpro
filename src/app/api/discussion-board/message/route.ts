import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/errors";
import { sendConversationMessage } from "@/server/integrations/twilio";

export const runtime = "nodejs";

const schema = z.object({
  conversationSid: z.string().min(1),
  author: z.string().min(1),
  message: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const payload = schema.parse(await request.json());
    const data = await sendConversationMessage(
      payload.conversationSid,
      payload.author,
      payload.message
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
