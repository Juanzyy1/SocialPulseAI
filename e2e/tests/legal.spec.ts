import { expect, test } from '@playwright/test';

test('publica términos y privacidad de la versión vigente con los datos de las plataformas', async ({
  page,
}) => {
  await page.goto('/privacidad');
  await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
  await expect(page.getByText('Versión 2026-11-07')).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Borrador');

  const privacy = await page.locator('body').innerText();
  expect(privacy).toContain('alcance diario');
  expect(privacy).toContain('No consultamos seguidores, me gusta ni compartidos de Instagram');
  expect(privacy).toContain('hasta los 20 videos públicos más recientes');
  expect(privacy).toContain('sp_ig_oauth y sp_tt_oauth');

  await page.goto('/terminos');
  await expect(page.getByRole('heading', { name: 'Términos de uso' })).toBeVisible();
  await expect(page.getByText('Versión 2026-11-07')).toBeVisible();
  await expect(page.locator('body')).toContainText('YouTube, Instagram y TikTok');
});
