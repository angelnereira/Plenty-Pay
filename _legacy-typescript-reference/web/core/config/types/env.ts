/**
 * Environment Variables Validation
 *
 * Validates all required environment variables at application startup.
 * Fails fast if critical configuration is missing.
 */

import { z } from 'zod';

// Schema de validación para variables de entorno
const envSchema = z.object({
  // ========================================
  // Database (REQUERIDO)
  // ========================================
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL válida'),

  // ========================================
  // NextAuth (REQUERIDO)
  // ========================================
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET debe tener al menos 32 caracteres'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL debe ser una URL válida'),

  // ========================================
  // Encryption Keys (REQUERIDO)
  // ========================================
  // Estas claves son críticas para seguridad
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY debe tener al menos 32 caracteres'),

  // Opcionales pero recomendadas para certificados
  CERTIFICATE_ENCRYPTION_KEY: z.string().min(32).optional(),
  CERTIFICATE_MASTER_KEY: z.string().min(32).optional(),

  // ========================================
  // HKA Service URLs (REQUERIDO para facturación)
  // ========================================
  HKA_DEMO_SOAP_URL: z.string().url().optional(),
  HKA_DEMO_REST_URL: z.string().url().optional(),
  HKA_PROD_SOAP_URL: z.string().url().optional(),
  HKA_PROD_REST_URL: z.string().url().optional(),

  // ========================================
  // HKA Credentials Fallback (OPCIONAL)
  // ========================================
  // Solo para Plan Empresarial - Plan Simple usa credenciales por organización
  HKA_ENV: z.enum(['demo', 'prod']).optional(),
  HKA_DEMO_TOKEN_USER: z.string().optional(),
  HKA_DEMO_TOKEN_PASSWORD: z.string().optional(),
  HKA_PROD_TOKEN_USER: z.string().optional(),
  HKA_PROD_TOKEN_PASSWORD: z.string().optional(),

  // ========================================
  // App Configuration
  // ========================================
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_NAME: z.string().default('PlentyPay'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // ========================================
  // Super Admin (OPCIONAL - solo para setup inicial)
  // ========================================
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().optional(),

  // ========================================
  // Redis (OPCIONAL - para queues y cache)
  // ========================================
  REDIS_URL: z.string().url().optional(),

  // ========================================
  // Logging
  // ========================================
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Valida las variables de entorno al inicio de la aplicación
 * Lanza error si variables críticas faltan
 *
 * @throws {Error} Si la validación falla
 */
export function validateEnv(): Env {
  // Si ya validamos, retornar cache
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    cachedEnv = envSchema.parse(process.env);

    console.log('✅ Environment variables validated successfully');
    console.log('📋 Configuration:', {
      nodeEnv: cachedEnv.NODE_ENV,
      database: !!cachedEnv.DATABASE_URL,
      nextAuth: !!cachedEnv.NEXTAUTH_SECRET,
      encryption: !!cachedEnv.ENCRYPTION_KEY,
      hkaDemo: !!(cachedEnv.HKA_DEMO_SOAP_URL && cachedEnv.HKA_DEMO_REST_URL),
      hkaProd: !!(cachedEnv.HKA_PROD_SOAP_URL && cachedEnv.HKA_PROD_REST_URL),
      redis: !!cachedEnv.REDIS_URL,
    });

    return cachedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      console.error('');

      error.issues.forEach((err) => {
        const path = err.path.join('.');
        console.error(`  🔴 ${path}: ${err.message}`);
      });

      console.error('');
      console.error('💡 How to fix:');
      console.error('  1. Copy .env.example to .env');
      console.error('  2. Fill in all required variables');
      console.error('  3. Generate keys with: openssl rand -hex 32');
      console.error('');

      throw new Error('Environment validation failed. Check logs above.');
    }

    throw error;
  }
}

/**
 * Obtiene las variables de entorno validadas
 * Debe llamarse DESPUÉS de validateEnv()
 *
 * @throws {Error} Si validateEnv() no se ha llamado
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    throw new Error(
      'Environment not validated. Call validateEnv() first at application startup.'
    );
  }
  return cachedEnv;
}

/**
 * Verifica si estamos en producción
 */
export function isProduction(): boolean {
  const env = getEnv();
  return env.NODE_ENV === 'production';
}

/**
 * Verifica si estamos en desarrollo
 */
export function isDevelopment(): boolean {
  const env = getEnv();
  return env.NODE_ENV === 'development';
}

/**
 * Verifica si estamos en testing
 */
export function isTest(): boolean {
  const env = getEnv();
  return env.NODE_ENV === 'test';
}
