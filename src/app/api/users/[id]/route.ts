import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/request-auth";
import { toErrorResponse } from "@/lib/errors";
import { deleteUser, getUserById, updateUser } from "@/server/services/user-service";

export const runtime = "nodejs";

const userTypeSchema = z.enum(["ADMIN", "SERVICE_PARTNER_USER"]);

const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  mobile: z.string().min(8).max(20).optional(),
  roleId: z.string().nullable().optional(),
  profileImage: z.string().nullable().optional(),
  userType: userTypeSchema.optional(),
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
    const data = await getUserById(auth, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(request);
    const { id } = await context.params;
    const payload = updateUserSchema.parse(await request.json());
    const data = await updateUser(auth, id, payload);

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      data,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(request);
    const { id } = await context.params;
    const data = await deleteUser(auth, id);

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
      data,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
