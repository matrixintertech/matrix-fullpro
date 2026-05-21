import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/errors";
import { verifyOtp } from "@/server/services/otp-service";

export const runtime = "nodejs";

const verifyOtpSchema = z.object({
  phoneNumber: z.string().min(8).max(20),
  otp: z.string().min(4).max(10),
  isNew: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const payload = verifyOtpSchema.parse(await request.json());
    const data = await verifyOtp(payload);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
