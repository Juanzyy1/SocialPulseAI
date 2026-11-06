import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { BASE_URL, INVITE_CODE, IS_HTTPS, deleteTestUserIfExists, newTestUser, warmUp } from './support';
import type { TestUser } from './support';

async function fillRegisterForm(page: Page, user: TestUser, inviteCode?: string) {
  await page.goto('/registro');
  await page.getByLabel('Nombre', { exact: true }).fill(user.name);
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(user.password);
  if (inviteCode) await page.getByLabel(/Código de invitación/).fill(inviteCode);
  await page.getByRole('checkbox').check();
}

async function logIn(page: Page, user: { email: string; password: string }) {
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('sin sesión', () => {
  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180_000);
    await warmUp();
  });

  test('una ruta protegida lleva al inicio de sesión', async ({ page }) => {
    await page.goto('/cuentas');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
  });

  test('una ruta que no existe muestra la página de no encontrado', async ({ page }) => {
    await page.goto('/ruta-que-no-existe');

    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
  });

  test('los textos legales son públicos y se muestran como borrador', async ({ page }) => {
    await page.goto('/privacidad');
    await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
    await expect(page.getByRole('note')).toContainText('Borrador');

    await page.goto('/terminos');
    await expect(page.getByRole('heading', { name: 'Términos de uso' })).toBeVisible();
  });

  test('un código de invitación incorrecto se rechaza y no crea la cuenta', async ({ page }) => {
    test.skip(!INVITE_CODE, 'El registro está abierto: no hay código de invitación que probar');
    const stranger = newTestUser();

    await fillRegisterForm(page, stranger, 'codigo-incorrecto-123');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByRole('alert')).toContainText('El código de invitación no es correcto');
    await expect(page).toHaveURL(/\/registro$/);
  });
});

test.describe('ciclo de vida de una cuenta', () => {
  test.describe.configure({ mode: 'serial' });

  const user = newTestUser();
  const policyProblems: string[] = [];
  let page: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(180_000);
    await warmUp();
    // Una sola página compartida: la sesión debe sobrevivir de una prueba a la siguiente.
    page = await browser.newPage({ baseURL: BASE_URL, locale: 'es-CO' });
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text())) policyProblems.push(message.text());
    });
    page.on('pageerror', (error) => policyProblems.push(`Error de página: ${error.message}`));
  });

  test.afterAll(async () => {
    await page.close();
    await deleteTestUserIfExists(user);
  });

  test('registrarse con correo y contraseña lleva al panel vacío', async () => {
    const apiLog: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/')) {
        apiLog.push(`${response.request().method()} ${new URL(response.url()).pathname} -> ${response.status()}`);
      }
    });

    await fillRegisterForm(page, user, INVITE_CODE || undefined);
    const startedAt = Date.now();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // Se espera el panel, un aviso o la puerta de términos: lo primero que aparezca explica qué pasó.
    const outcome = page
      .getByRole('heading', { name: 'Panel', exact: true })
      .or(page.getByRole('alert'))
      .or(page.getByRole('heading', { name: 'Antes de continuar' }));
    await expect(outcome.first()).toBeVisible({ timeout: 90_000 });

    const seconds = Math.round((Date.now() - startedAt) / 1000);
    const context = `Tras ${seconds} s. Llamadas a la API: ${apiLog.join(' | ') || '(ninguna)'}`;
    const alerts = await page.getByRole('alert').allTextContents();
    expect(alerts, `Apareció un aviso. ${context}`).toEqual([]);

    await expect(page.getByRole('heading', { name: 'Panel', exact: true }), `No llegó al panel. ${context}`).toBeVisible();
    await expect(page.getByText(`Hola, ${user.name}`)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aún no tienes cuentas conectadas' })).toBeVisible();
    expect(seconds, `El registro tardó demasiado. ${context}`).toBeLessThan(45);
  });

  test('las secciones del menú cargan', async () => {
    await page.getByRole('link', { name: 'Resumen', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aún no tienes cuentas conectadas' })).toBeVisible();

    await page.getByRole('link', { name: 'Cuentas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cuentas', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Conectar YouTube' })).toHaveAttribute(
      'href',
      '/api/v1/integrations/youtube/connect',
    );

    await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Eliminar cuenta' })).toBeVisible();
  });

  test('recargar una ruta del cliente la sigue mostrando, con la sesión intacta', async () => {
    await page.goto('/cuentas');
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Cuentas', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/cuentas$/);
  });

  test('cerrar sesión lleva al inicio de sesión y protege las rutas', async () => {
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/ajustes');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('una contraseña incorrecta se rechaza y la correcta entra', async () => {
    await page.goto('/login');
    await logIn(page, { email: user.email, password: `${user.password}x` });
    await expect(page.getByRole('alert')).toContainText('El correo o la contraseña no son correctos.');

    await logIn(page, user);
    await expect(page.getByRole('heading', { name: 'Panel', exact: true })).toBeVisible();
  });

  test('eliminar la cuenta desde Ajustes la borra y ya no permite entrar', async () => {
    await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
    await page.getByRole('button', { name: 'Eliminar mi cuenta…' }).click();
    await page.getByLabel(/Para confirmar/).fill(user.email);
    await page.getByLabel('Tu contraseña').fill(user.password);
    await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();

    await expect(page).toHaveURL(/\/cuenta-eliminada$/);
    await expect(page.getByRole('heading', { name: 'Cuenta eliminada' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Tu cuenta y todos sus datos se eliminaron.');

    await page.goto('/login');
    await logIn(page, user);
    await expect(page.getByRole('alert')).toContainText('El correo o la contraseña no son correctos.');
  });

  test('la política de contenido no bloqueó nada de la interfaz durante todo el recorrido', () => {
    expect(policyProblems).toEqual([]);
  });
});