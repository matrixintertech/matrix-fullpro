import { prisma } from "@/server/db/prisma";
import type {
  CreateServiceRequestInput,
  ServiceRequestFilters,
  UpdateServiceRequestInput,
} from "@/server/interfaces/service-request";

export function countServiceRequests(servicePartnerId?: string) {
  return prisma.serviceRequest.count({
    where: servicePartnerId ? { servicePartnerId } : undefined,
  });
}

export function listServiceRequests(filters: ServiceRequestFilters) {
  return prisma.serviceRequest.findMany({
    where: {
      servicePartnerId: filters.servicePartnerId,
      clientId: filters.clientId,
      clientUserId: filters.clientUserId,
    },
    include: {
      client: true,
      clientUser: true,
      servicePartner: true,
      pmAssigned: { select: { id: true, name: true, email: true } },
      smAssigned: { select: { id: true, name: true, email: true } },
      teamMembers: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getServiceRequestById(id: string) {
  return prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      client: true,
      clientUser: true,
      servicePartner: true,
      quotations: true,
      tasks: true,
      payments: true,
      expenses: true,
      serviceTargetStatusLogs: {
        orderBy: { date: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
}

export function createServiceRequest(data: CreateServiceRequestInput & {
  serviceNumber: string;
  serviceRequestedDate: Date;
  createdByServicePartnerUserId?: string;
  createdByClientUserId?: string;
}) {
  return prisma.serviceRequest.create({
    data,
    include: {
      client: true,
      clientUser: true,
      servicePartner: true,
    },
  });
}

export function updateServiceRequestById(id: string, data: UpdateServiceRequestInput) {
  return prisma.serviceRequest.update({
    where: { id },
    data,
    include: {
      client: true,
      clientUser: true,
      servicePartner: true,
      pmAssigned: { select: { id: true, name: true, email: true } },
      smAssigned: { select: { id: true, name: true, email: true } },
    },
  });
}

export function deleteServiceRequestById(id: string) {
  return prisma.serviceRequest.delete({ where: { id } });
}
