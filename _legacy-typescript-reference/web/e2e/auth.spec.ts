import { test, expect } from '@playwright/test';

/**
 * E2E de autenticación: ejercita el flujo de login real contra NextAuth y
 * la base de datos. Verifica que credenciales inválidas NO conceden acceso
 * (puerta de seguridad crítica) y que las rutas protegidas redirigen.
 */

test.describe('Autenticación', () => {
  test('credenciales inválidas muestran error y no autentican', async ({ page }) => {
    await page.goto('/auth/signin');

    await page.locator('#email').fill('noexiste@example.com');
    await page.locator('#password').fill('passwordIncorrecta123');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    // El flujo usa signIn(redirect:false) y muestra el error en pantalla.
    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible();
    // Seguimos en la página de login, sin entrar al dashboard.
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('una ruta protegida del dashboard redirige al login si no hay sesión', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    // Sin sesión, el acceso a /dashboard redirige (307) a /auth/signin
    // conservando el callbackUrl para volver tras autenticarse.
    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(page).toHaveURL(/callbackUrl=%2Fdashboard/);
    await expect(page).not.toHaveURL(/\/dashboard(\/|$)/);
    // Y se ve el formulario de login, no el contenido del dashboard.
    await expect(page.locator('#email')).toBeVisible();
  });
});
