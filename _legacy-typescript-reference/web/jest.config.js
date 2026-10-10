const nextJest = require('next/jest')

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
    setupFiles: ['<rootDir>/jest.polyfills.js'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testEnvironment: 'jest-environment-jsdom',
    testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/.next/',
        '<rootDir>/e2e/',
        // Archivo de utilidades, no contiene tests
        '<rootDir>/__tests__/setup.ts',
        // Requieren servicios reales (Postgres/Redis); corren con jest.integration.config.js
        '<rootDir>/__tests__/db-integration/',
    ],
    moduleNameMapper: {
        // Handle module aliases (this will be automatically configured for you soon)
        '^@/components/(.*)$': '<rootDir>/components/$1',
        '^@/pages/(.*)$': '<rootDir>/pages/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '^@core/(.*)$': '<rootDir>/core/$1',
        '^@/(.*)$': '<rootDir>/$1',
    },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
