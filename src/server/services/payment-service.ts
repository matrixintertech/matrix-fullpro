import type { AccessTokenPayload } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/server/db/prisma";

export interface CreatePaymentInput {
  serviceRequestId: string;
  amount: number;
  desc: string;
  remark?: string;
}

function assertScope(token: AccessTokenPayload, servicePartnerId?: string | null) {
  if (token.servicePartnerId && servicePartnerId && token.servicePartnerId !== servicePartnerId) {
    throw new ApiError("Forbidden for this service partner scope", 403, "FORBIDDEN");
  }
}

export async function listPayments(token: AccessTokenPayload, serviceRequestId?: string) {
  return prisma.payment.findMany({
    where: {
      ...(serviceRequestId ? { serviceRequestId } : {}),
      serviceRequest: token.servicePartnerId
        ? { servicePartnerId: token.servicePartnerId }
        : undefined,
    },
    include: {
      serviceRequest: true,
      user: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      markAsPaidBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPayment(token: AccessTokenPayload, input: CreatePaymentInput) {
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: input.serviceRequestId },
    select: {
      id: true,
      servicePartnerId: true,
    },
  });
  if (!serviceRequest) {
    throw new ApiError("Service request not found", 404, "NOT_FOUND");
  }
  assertScope(token, serviceRequest.servicePartnerId);

  return prisma.payment.create({
    data: {
      serviceRequestId: input.serviceRequestId,
      amount: input.amount,
      desc: input.desc,
      remark: input.remark,
      servicePartnerId: serviceRequest.servicePartnerId,
      userId: token.userFrom === "User" ? token.sub : null,
    },
  });
}
