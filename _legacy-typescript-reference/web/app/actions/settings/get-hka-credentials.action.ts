'use server';

import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('HKA-Credentials');

export async function getHKACredentials() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const credentials = await prisma.hKACredential.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!credentials) {
      return {
        success: true,
        data: null
      };
    }

    return {
      success: true,
      data: {
        tokenUser: credentials.tokenUser,
        environment: credentials.environment,
      },
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch HKA credentials');
    return {
      success: false,
      error: 'Failed to load credentials'
    };
  }
}
