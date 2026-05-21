import { prisma } from "@/server/db/prisma";
import type { CreateUserInput, UpdateUserInput, UserFilters } from "@/server/interfaces/user";

export function listUsers(filters: UserFilters) {
  return prisma.user.findMany({
    where: {
      servicePartnerId: filters.servicePartnerId,
      roleId: filters.roleId,
      userType: filters.userType,
    },
    include: {
      role: true,
      servicePartner: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      role: true,
      servicePartner: true,
    },
  });
}

export function findUserByEmail(email: string, excludeId?: string) {
  return prisma.user.findFirst({
    where: {
      email,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
}

export function findUserByMobile(mobile: string, excludeId?: string) {
  return prisma.user.findFirst({
    where: {
      mobile,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
}

export function createUser(data: CreateUserInput & { servicePartnerId: string }) {
  return prisma.user.create({
    data,
    include: {
      role: true,
      servicePartner: true,
    },
  });
}

export function updateUserById(id: string, data: UpdateUserInput) {
  return prisma.user.update({
    where: { id },
    data,
    include: {
      role: true,
      servicePartner: true,
    },
  });
}

export function deleteUserById(id: string) {
  return prisma.user.delete({ where: { id } });
}
