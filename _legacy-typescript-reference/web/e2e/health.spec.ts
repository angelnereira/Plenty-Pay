import { test, expect } from '@playwright/test';

/**
 * E2E de salud de integraciones: golpea los endpoints reales de health para
 * confirmar, de punta a punta, que el servidor desplegado puede hablar con
 * la base de datos (Neon/Postgres) y que las consultas ACID responden.
 *
 * Estos endpoints usan el MISMO cliente Prisma que la autenticación, así que
 * son el canario de "¿está viva la conexión a la base de datos?".
 */

test.describe('Health checks de integraciones', () => {
  test('GET /api/health/db conecta a la base de datos', async ({ request }) => {
    // En entornos no-producción el endpoint es público; en producción exige
    // el header x-health-secret. Para E2E corremos en modo no-producción.
    const res = await request.get('/api/health/db', {
      headers: process.env.NEXTAUTH_SECRET
        ? { 'x-health-secret': process.env.NEXTAUTH_SECRET }
        : {},
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(String(body.dbConnection)).toContain('OK');
  });

  test('GET /api/health/acid responde métricas de concurrencia', async ({
    request,
  }) => {
    const res = await request.get('/api/health/acid');

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // El endpoint expone conectividad de DB y contadores de reservas.
    expect(body).toBeTruthy();
  });
});
