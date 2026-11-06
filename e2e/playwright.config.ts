import { defineConfig } from '@playwright/test';

// Dirección a probar. Por defecto, una instancia de producción local; para probar Render:
//   $env:E2E_BASE_URL='https://socialpulse-ai-xweo.onrender.com'
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1, // los flujos comparten límites del servidor y un usuario de prueba
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'es-CO',
    actionTimeout: 20_000,
    navigationTimeout: 90_000, // el plan gratuito de Render tarda cerca de un minuto en despertar
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});