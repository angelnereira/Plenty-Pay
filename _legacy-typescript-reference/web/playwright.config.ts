import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para pruebas End-to-End de PlentyPay.
 *
 * Los specs viven en e2e/ y ejercitan la aplicación Next.js REAL
 * (build + start) contra una base de datos de pruebas. El servidor se
 * levanta automáticamente vía `webServer` salvo que ya haya uno corriendo
 * (PLAYWRIGHT_REUSE_SERVER=1 o un server escuchando en el puerto).
 *
 * Variables relevantes:
 *   - E2E_BASE_URL: URL base contra la que correr (default http://localhost:3000)
 *   - DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL: requeridas por el server
 */
const PORT = Number(process.env.PORT || 3000);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

// Si apuntamos a una URL externa ya desplegada, no levantamos server local.
const isExternalTarget = !!process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: isExternalTarget
    ? undefined
    : {
        // build:simple = prisma generate + next build (sin verify-env, que
        // ya validamos en el job de CI con las envs de prueba inyectadas).
        command: 'npm run build:simple && npm run start',
        url: baseURL,
        // El build de Next tarda ~3 min; damos margen para build + arranque.
        timeout: 600_000,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_TELEMETRY_DISABLED: '1',
        },
      },
});
