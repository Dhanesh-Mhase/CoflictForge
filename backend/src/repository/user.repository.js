import prisma from '../config/prisma.js';

export const userRepository = {
  async upsertGoogleUser({ email, name, avatarUrl, googleId }) {
    return prisma.user.upsert({
      where: { email },
      update: {
        name,
        avatarUrl,
        googleId,
      },
      create: {
        email,
        name,
        avatarUrl,
        googleId,
      },
    });
  },

  async findById(id) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
    });
  },
};
