import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/errors";
import { createTwilioAccessToken, isTwilioAvailable } from "@/server/integrations/twilio";

export const runtime = "nodejs";

const schema = z.object({
  identity: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    if (!isTwilioAvailable()) {
      return NextResponse.json(
        { success: false, code: "TWILIO_NOT_CONFIGURED", message: "Twilio is not configured" },
        { status: 503 }
      );
    }

    const identity = request.nextUrl.searchParams.get("identity") ?? "";
    const payload = schema.parse({ identity });
    const token = createTwilioAccessToken(payload.identity);

    return NextResponse.json({ success: true, data: { token } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
