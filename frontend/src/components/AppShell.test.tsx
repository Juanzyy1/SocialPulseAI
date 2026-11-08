// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, jsonResponse } from '../test/fake-api';
import { profile } from '../test/fixtures';
import { renderApp } from '../test/render';
import { AppShell } from './AppShell';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('menú lateral', () => {
  it('se puede contraer y expandir, manteniendo accesibles las secciones', async () => {
    installFakeApi({
      'GET /users/me': () => jsonResponse(profile()),
    });
    const user = userEvent.setup();
    renderApp(<AppShell />);

    const collapse = await screen.findByRole('button', { name: 'Contraer menú' });
    expect(screen.getByRole('main').className).toContain('page-enter');
    await user.click(collapse);

    const expand = screen.getByRole('button', { name: 'Expandir menú' });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('link', { name: 'Panel' }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: 'Cuentas' }).some((link) => link.getAttribute('title') === 'Cuentas'),
    ).toBe(true);

    await user.click(expand);
    expect(screen.getByRole('button', { name: 'Contraer menú' }).getAttribute('aria-expanded')).toBe('true');
  });
});
