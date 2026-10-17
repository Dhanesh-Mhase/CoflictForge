import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.isProduction ? ['error', 'warn'] : ['query', 'error', 'warn'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
