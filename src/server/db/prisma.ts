import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function assertDatabaseUrl(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new ApiError(
      "DATABASE_URL is missing in frontend/.env.local. Add your Neon PostgreSQL URL.",
      500,
      "DATABASE_URL_MISSING"
    );
  }

  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    throw new ApiError(
      "DATABASE_URL must be a PostgreSQL URL (postgresql://...).",
      500,
      "DATABASE_URL_INVALID"
    );
  }
}

function createPrismaClient(): PrismaClient {
  assertDatabaseUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

let prismaInstance = globalForPrisma.prisma;

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (!prismaInstance) {
      prismaInstance = createPrismaClient();
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = prismaInstance;
      }
    }

    const value = Reflect.get(prismaInstance as PrismaClient, prop, receiver);
    return typeof value === "function" ? value.bind(prismaInstance) : value;
  },
});
