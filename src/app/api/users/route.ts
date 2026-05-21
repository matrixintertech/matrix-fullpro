import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/request-auth";
import { toErrorResponse } from "@/lib/errors";
import { createUser, listUsers } from "@/server/services/user-service";

export const runtime = "nodejs";

const userTypeSchema = z.enum(["ADMIN", "SERVICE_PARTNER_USER"]);

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  mobile: z.string().min(8).max(20),
  roleId: z.string().nullable().optional(),
  profileImage: z.string().nullable().optional(),
  servicePartnerId: z.string().optional(),
  userType: userTypeSchema,
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const userType = searchParams.get("userType");
    const data = await listUsers(auth, {
      servicePartnerId: searchParams.get("servicePartnerId") ?? undefined,
      roleId: searchParams.get("roleId") ?? undefined,
      userType: userType ? userTypeSchema.parse(userType) : undefined,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const payload = createUserSchema.parse(await request.json());
    const data = await createUser(auth, payload);

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully",
        data,
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
