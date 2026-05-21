import { prisma } from "@/server/db/prisma";
import type { ServicePartnerStatus } from "@prisma/client";

export interface AuthPrincipal {
  id: string;
  userFrom: "User" | "ClientUser" | "Supplier";
  role?: string;
  servicePartnerId?: string;
  servicePartnerStatus?: ServicePartnerStatus | null;
  email?: string | null;
  mobile?: string | null;
  isVerified?: boolean;
}

export async function findPrincipalByPhone(
  phoneNumber: string
): Promise<AuthPrincipal | null> {
  const user = await prisma.user.findFirst({
    where: { mobile: phoneNumber },
    include: {
      role: true,
      servicePartner: true,
    },
  });

  if (user) {
    return {
      id: user.id,
      userFrom: "User",
      role: user.role?.name,
      servicePartnerId: user.servicePartnerId,
      servicePartnerStatus: user.servicePartner?.status,
      email: user.email,
      mobile: user.mobile,
    };
  }

  const clientUser = await prisma.clientUser.findFirst({
    where: { mobile: phoneNumber },
  });

  if (clientUser) {
    return {
      id: clientUser.id,
      userFrom: "ClientUser",
      email: clientUser.email,
      mobile: clientUser.mobile,
    };
  }

  const supplier = await prisma.supplier.findFirst({
    where: { mobile: phoneNumber },
    include: { servicePartner: true },
  });

  if (supplier) {
    return {
      id: supplier.id,
      userFrom: "Supplier",
      servicePartnerId: supplier.servicePartnerId ?? undefined,
      servicePartnerStatus: supplier.servicePartner?.status ?? null,
      email: supplier.email,
      mobile: supplier.mobile,
      isVerified: supplier.isVerified,
    };
  }

  return null;
}
