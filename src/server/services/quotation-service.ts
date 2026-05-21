import type { AccessTokenPayload } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/server/db/prisma";

export interface CreateQuotationInput {
  serviceRequestId: string;
  quotationNumber: string;
  totalAmount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
}

function assertScope(token: AccessTokenPayload, servicePartnerId?: string | null) {
  if (token.servicePartnerId && servicePartnerId && token.servicePartnerId !== servicePartnerId) {
    throw new ApiError("Forbidden for this service partner scope", 403, "FORBIDDEN");
  }
}

export async function listQuotations(token: AccessTokenPayload, serviceRequestId?: string) {
  const data = await prisma.quotation.findMany({
    where: {
      ...(serviceRequestId ? { serviceRequestId } : {}),
      serviceRequest: token.servicePartnerId
        ? { servicePartnerId: token.servicePartnerId }
        : undefined,
    },
    include: {
      serviceRequest: true,
      rcItems: true,
      nonRcItems: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return data;
}

export async function createQuotation(token: AccessTokenPayload, input: CreateQuotationInput) {
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

  return prisma.quotation.create({
    data: {
      serviceRequestId: input.serviceRequestId,
      quotationNumber: input.quotationNumber,
      totalAmount: input.totalAmount,
      cgst: input.cgst,
      sgst: input.sgst,
      igst: input.igst,
      createdById: token.userFrom === "User" ? token.sub : null,
    },
  });
}
