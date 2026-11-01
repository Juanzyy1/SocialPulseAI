// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { AccountDeletedPage } from './AccountDeletedPage';

afterEach(cleanup);

const show = (state?: unknown) =>
  renderApp(<AccountDeletedPage />, { route: { pathname: '/cuenta-eliminada', state } });

describe('pantalla de cuenta eliminada', () => {
  it('con el resultado, muestra si se confirmó la revocación en Google', () => {
    show({ result: { accountsDisconnected: 2, revocationsNotConfirmed: 1 } });

    expect(screen.getByRole('status').textContent).toContain('No pudimos confirmar la revocación');
  });

  it('con todo confirmado, lo dice', () => {
    show({ result: { accountsDisconnected: 1, revocationsNotConfirmed: 0 } });

    expect(screen.getByRole('status').textContent).toContain('se revocó el acceso');
  });

  it('sin estado (visita directa) o con un estado inválido, muestra un mensaje simple y no falla', () => {
    show();
    expect(screen.getByRole('status').textContent).toBe('Tu cuenta y todos sus datos se eliminaron.');
    cleanup();

    show({ result: { accountsDisconnected: 'x' } });
    expect(screen.getByRole('status').textContent).toBe('Tu cuenta y todos sus datos se eliminaron.');
  });

  it('ofrece crear una cuenta nueva', () => {
    show();

    expect(screen.getByRole('link', { name: 'crear una cuenta nueva' }).getAttribute('href')).toBe('/registro');
  });
});