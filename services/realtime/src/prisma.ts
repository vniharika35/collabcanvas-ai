import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  realtimePrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.realtimePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.realtimePrisma = prisma;
}
