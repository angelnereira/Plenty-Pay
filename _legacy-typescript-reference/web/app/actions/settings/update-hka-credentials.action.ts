/**
 * Server Action: Update HKA Credentials
 * Actualiza o crea credenciales HKA del usuario
 */

'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import { detectHKAEnvironment } from '@/features/hka/model/services/hka-detection.service';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('HKA-Credentials');

/**
 * Input: Credenciales HKA
 */
export interface UpdateHkaCredentialsInput {
  tokenUser: string;
  tokenPassword?: string; // Opcional: solo se actualiza si se proporciona
}

/**
 * Output: Resultado de actualización
 */
export interface UpdateHkaCredentialsOutput {
  success: boolean;
  error?: string;
}

/**
 * Actualiza credenciales HKA del usuario
 */
export async function updateHkaCredentials(
  input: UpdateHkaCredentialsInput
): Promise<UpdateHkaCredentialsOutput> {
  try {
    // 1. Autenticación
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // 2. Validar input
    if (!input.tokenUser || input.tokenUser.trim().length === 0) {
      return { success: false, error: 'Token User is required' };
    }

    // Buscar credencial existente para validar
    const existingCredential = await prisma.hKACredential.findFirst({
      where: {
        userId,
        isActive: true,
      },
    });

    // Si no hay credencial existente, password es obligatorio
    if (!existingCredential && (!input.tokenPassword || input.tokenPassword.trim().length === 0)) {
      return { success: false, error: 'Token Password is required for new credentials' };
    }

    // 3. Obtener password para validación
    let passwordForValidation = '';

    if (input.tokenPassword && input.tokenPassword.trim().length > 0) {
      passwordForValidation = input.tokenPassword.trim();
    } else if (existingCredential?.tokenPassword) {
      try {
        passwordForValidation = decrypt(existingCredential.tokenPassword);
      } catch (error) {
        logger.error({ err: error }, 'Failed to decrypt existing password for validation');
        return { success: false, error: 'Could not validate current credentials' };
      }
    }

    if (!passwordForValidation) {
      return { success: false, error: 'Token Password is required for validation' };
    }

    // 4. Detectar ambiente automáticamente
    const detectedEnv = await detectHKAEnvironment(input.tokenUser, passwordForValidation);

    if (!detectedEnv) {
      return {
        success: false,
        error: 'No se pudo validar el ambiente con las credenciales proporcionadas. Verifique el token y la contraseña.'
      };
    }

    const hkaEnv = detectedEnv === 'prod' ? 'PROD' : 'DEMO';

    // 5. Encriptar password solo si se proporciona
    let encryptedPassword: string | undefined;
    if (input.tokenPassword && input.tokenPassword.trim().length > 0) {
      try {
        encryptedPassword = encrypt(input.tokenPassword);
      } catch (encryptError) {
        logger.error({ err: encryptError }, 'Password encryption failed');
        return { success: false, error: 'Failed to encrypt password' };
      }
    }

    if (existingCredential) {
      // Actualizar existente - solo actualizar password si se proporcionó
      const updateData: any = {
        tokenUser: input.tokenUser,
        environment: hkaEnv,
        updatedAt: new Date(),
      };

      if (encryptedPassword) {
        updateData.tokenPassword = encryptedPassword;
      }

      await prisma.hKACredential.update({
        where: { id: existingCredential.id },
        data: updateData,
      });

      logger.info('HKA credentials updated');
    } else {
      // Crear nueva - password es obligatorio aquí (ya validado arriba)
      if (!encryptedPassword) {
        return { success: false, error: 'Password encryption failed' };
      }

      await prisma.hKACredential.create({
        data: {
          userId,
          tokenUser: input.tokenUser,
          tokenPassword: encryptedPassword,
          environment: hkaEnv,
          isActive: true,
        },
      });

      logger.info('HKA credentials created');
    }

    // 5. Revalidar settings page
    revalidatePath('/settings');
    revalidatePath('/dashboard/configuracion');

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, 'Failed to update HKA credentials');

    return {
      success: false,
      error: 'Internal error. Please try again.',
    };
  }
}

/**
 * Obtiene credenciales HKA actuales (sin password)
 */
export async function getHKACredentials(): Promise<{
  success: boolean;
  data?: {
    tokenUser: string;
    environment: 'DEMO' | 'PROD';
    hasPassword: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const credential = await prisma.hKACredential.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: {
        tokenUser: true,
        tokenPassword: true,
        environment: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!credential) {
      return {
        success: false,
        error: 'No HKA credentials configured',
      };
    }

    return {
      success: true,
      data: {
        tokenUser: credential.tokenUser,
        environment: credential.environment as 'DEMO' | 'PROD',
        hasPassword: Boolean(credential.tokenPassword),
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      },
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to get HKA credentials');

    return {
      success: false,
      error: 'Internal error. Please try again.',
    };
  }
}

/**
 * Elimina credenciales HKA
 */
export async function deleteHkaCredentials(): Promise<UpdateHkaCredentialsOutput> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Marcar como inactivo en lugar de eliminar (soft delete)
    await prisma.hKACredential.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    logger.info('HKA credentials deleted');

    revalidatePath('/settings');

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete HKA credentials');

    return {
      success: false,
      error: 'Internal error. Please try again.',
    };
  }
}
