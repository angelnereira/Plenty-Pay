const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/**
 * Configuración de Jest para tests de INTEGRACIÓN con servicios reales:
 *   - PostgreSQL real (service container en CI, o rama Neon local)
 *   - Redis real vía proxy REST compatible con Upstash (SRH) si está configurado
 *
 * Requiere DATABASE_URL apuntando a una base de datos de pruebas con el
 * schema aplicado (npx prisma db push). NUNCA apuntar a producción:
 * scripts/verify-env.js y los helpers de los tests lo verifican.
 *
 * Uso: npm run test:db  (jest -c jest.integration.config.js)
 */
const customJestConfig = {
    setupFiles: ['<rootDir>/jest.polyfills.js'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testEnvironment: 'node',
    testMatch: ['<rootDir>/__tests__/db-integration/**/*.test.ts'],
    testTimeout: 30000,
    // Una sola conexión/worker: los tests comparten la misma base de datos
    maxWorkers: 1,
    moduleNameMapper: {
        '^@/components/(.*)$': '<rootDir>/components/$1',
        '^@/pages/(.*)$': '<rootDir>/pages/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '^@core/(.*)$': '<rootDir>/core/$1',
        '^@/(.*)$': '<rootDir>/$1',
    },
}

module.exports = createJestConfig(customJestConfig)
