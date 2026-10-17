import prisma from '../config/prisma.js';

export const tokenRepository = {
  async createToken({ tokenHash, userId, expiresAt }) {
    return prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });
  },

  async findByTokenHash(tokenHash) {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });
  },

  async deleteByTokenHash(tokenHash) {
    return prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  },

  async rotateToken({ oldTokenHash, newTokenHash, userId, expiresAt }) {
    return prisma.$transaction([
      prisma.refreshToken.deleteMany({
        where: { tokenHash: oldTokenHash },
      }),
      prisma.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          userId,
          expiresAt,
        },
      }),
    ]);
  },

  async deleteAllUserTokens(userId) {
    return prisma.refreshToken.deleteMany({
      where: { userId },
    });
  },

  async deleteExpiredTokens() {
    return prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  },
};
