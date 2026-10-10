import { test, expect } from '@playwright/test';

/**
 * Smoke E2E: la aplicación arranca, la landing renderiza y la navegación
 * básica hacia el login funciona. Si esto falla, el deploy está roto.
 */

test.describe('Landing y navegación', () => {
  test('la landing carga y muestra la marca PlentyPay', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBeTruthy();

    await expect(page).toHaveTitle(/PlentyPay/i);
    // El navbar siempre ofrece "Iniciar sesión"
    await expect(
      page.getByRole('link', { name: /iniciar sesión/i }).first()
    ).toBeVisible();
  });

  test('navega de la landing al login', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /iniciar sesión/i }).first().click();

    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(
      page.getByRole('heading', { name: /bienvenido/i })
    ).toBeVisible();
  });

  test('la página de login renderiza email y contraseña', async ({ page }) => {
    await page.goto('/auth/signin');

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /iniciar sesión/i })
    ).toBeVisible();
  });
});
