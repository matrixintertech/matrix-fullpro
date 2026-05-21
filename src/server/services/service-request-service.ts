import type { AccessTokenPayload } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import type {
  CreateServiceRequestInput,
  ServiceRequestFilters,
  UpdateServiceRequestInput,
} from "@/server/interfaces/service-request";
import {
  countServiceRequests,
  createServiceRequest as createServiceRequestRepo,
  deleteServiceRequestById,
  getServiceRequestById as getServiceRequestByIdRepo,
  listServiceRequests as listServiceRequestsRepo,
  updateServiceRequestById,
} from "@/server/repositories/service-request-repository";

function assertCanAccessServiceRequest(
  token: AccessTokenPayload,
  servicePartnerId?: string | null
): void {
  if (token.servicePartnerId && servicePartnerId && token.servicePartnerId !== servicePartnerId) {
    throw new ApiError("Forbidden for this service partner scope", 403, "FORBIDDEN");
  }
}

async function generateServiceNumber(servicePartnerId?: string): Promise<string> {
  const count = await countServiceRequests(servicePartnerId);

  const now = new Date();
  const year = now.getUTCFullYear();
  const next = String(count + 1).padStart(5, "0");
  return `SR-${year}-${next}`;
}

export async function listServiceRequests(
  token: AccessTokenPayload,
  filters: ServiceRequestFilters
) {
  const servicePartnerId = token.servicePartnerId ?? filters.servicePartnerId;
  if (token.servicePartnerId && filters.servicePartnerId && token.servicePartnerId !== filters.servicePartnerId) {
    throw new ApiError("Forbidden for this service partner scope", 403, "FORBIDDEN");
  }

  return listServiceRequestsRepo({
    ...filters,
    servicePartnerId,
  });
}

export async function getServiceRequestById(token: AccessTokenPayload, id: string) {
  const serviceRequest = await getServiceRequestByIdRepo(id);

  if (!serviceRequest) {
    throw new ApiError("Service request not found", 404, "NOT_FOUND");
  }

  assertCanAccessServiceRequest(token, serviceRequest.servicePartnerId);
  return serviceRequest;
}

export async function createServiceRequest(
  token: AccessTokenPayload,
  input: CreateServiceRequestInput
) {
  const resolvedServicePartnerId = token.servicePartnerId ?? input.servicePartnerId;

  if (!resolvedServicePartnerId && token.userFrom === "User") {
    throw new ApiError(
      "Service partner scope is required for service partner users",
      400,
      "SERVICE_PARTNER_REQUIRED"
    );
  }

  if (token.servicePartnerId && input.servicePartnerId && token.servicePartnerId !== input.servicePartnerId) {
    throw new ApiError("Forbidden for this service partner scope", 403, "FORBIDDEN");
  }

  const serviceNumber = await generateServiceNumber(resolvedServicePartnerId);

  const created = await createServiceRequestRepo({
    ...input,
    servicePartnerId: resolvedServicePartnerId,
    createdByServicePartnerUserId: token.userFrom === "User" ? token.sub : undefined,
    createdByClientUserId: token.userFrom === "ClientUser" ? token.sub : undefined,
    serviceRequestedDate: new Date(),
    serviceNumber,
  });

  return created;
}

export async function deleteServiceRequest(token: AccessTokenPayload, id: string) {
  const existing = await getServiceRequestByIdRepo(id);

  if (!existing) {
    throw new ApiError("Service request not found", 404, "NOT_FOUND");
  }

  assertCanAccessServiceRequest(token, existing.servicePartnerId);

  await deleteServiceRequestById(id);
  return { id };
}

export async function updateServiceRequest(
  token: AccessTokenPayload,
  id: string,
  input: UpdateServiceRequestInput
) {
  const existing = await getServiceRequestByIdRepo(id);
  if (!existing) {
    throw new ApiError("Service request not found", 404, "NOT_FOUND");
  }

  assertCanAccessServiceRequest(token, existing.servicePartnerId);
  return updateServiceRequestById(id, input);
}
