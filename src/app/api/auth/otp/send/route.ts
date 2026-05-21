import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/errors";
import { sendOtp } from "@/server/services/otp-service";

export const runtime = "nodejs";

const sendOtpSchema = z.object({
  phoneNumber: z.string().min(8).max(20),
  isNew: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const payload = sendOtpSchema.parse(await request.json());
    const data = await sendOtp(payload);

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
      data,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
