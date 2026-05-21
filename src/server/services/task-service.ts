import type { AccessTokenPayload } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/server/db/prisma";

export interface CreateTaskInput {
  serviceRequestId: string;
  title: string;
  description: string;
  taskDate: string;
  fileUrl?: string[];
}

function generateTaskNumber(): string {
  return `TASK-${Date.now()}`;
}

function assertScope(token: AccessTokenPayload, servicePartnerId?: string | null) {
  if (token.servicePartnerId && servicePartnerId && token.servicePartnerId !== servicePartnerId) {
    throw new ApiError("Forbidden for this service partner scope", 403, "FORBIDDEN");
  }
}

export async function listTasks(token: AccessTokenPayload, serviceRequestId?: string) {
  return prisma.task.findMany({
    where: {
      ...(serviceRequestId ? { serviceRequestId } : {}),
      serviceRequest: token.servicePartnerId
        ? { servicePartnerId: token.servicePartnerId }
        : undefined,
    },
    include: {
      serviceRequest: true,
      createdBy: { select: { id: true, name: true, email: true } },
      user: { select: { id: true, name: true, email: true } },
      logs: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTask(token: AccessTokenPayload, input: CreateTaskInput) {
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

  return prisma.task.create({
    data: {
      taskId: generateTaskNumber(),
      serviceRequestId: input.serviceRequestId,
      title: input.title,
      description: input.description,
      taskDate: input.taskDate,
      fileUrl: input.fileUrl ?? [],
      createdById: token.userFrom === "User" ? token.sub : null,
    },
  });
}
