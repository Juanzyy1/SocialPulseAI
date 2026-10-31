// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, jsonResponse } from '../test/fake-api';
import { socialAccount } from '../test/fixtures';
import { renderApp } from '../test/render';
import { AccountCard } from './AccountCard';

const run = {
  id: 'ejecucion-1',
  status: 'SUCCEEDED',
  startedAt: '2026-10-29T12:00:00.000Z',
  finishedAt: '2026-10-29T12:00:01.000Z',
  rangeStart: '2026-07-31',
  rangeEnd: '2026-10-29',
  rowsWritten: 699,
  errorMessage: null,
};

function show(onDisconnected = vi.fn(), overrides: Parameters<typeof socialAccount>[0] = {}) {
  renderApp(
    <ul>
      <AccountCard account={socialAccount(overrides)} onDisconnected={onDisconnected} />
    </ul>,
  );
  return onDisconnected;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('tarjeta de cuenta: desconectar', () => {
  it('pide confirmación, explica qué se borra y deja el foco en Cancelar, sin llamar al servidor', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({});
    show();

    await user.click(screen.getByRole('button', { name: 'Desconectar' }));

    const group = screen.getByRole('group', { name: 'Confirmar la desconexión de Canal de prueba' });
    expect(group.textContent).toContain('credenciales');
    expect(group.textContent).toContain('estadísticas');
    expect(group.textContent).toContain('90 días');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBe(document.activeElement);
    expect(api.calls).toHaveLength(0);
  });

  it('cancelar cierra la confirmación sin llamar al servidor', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({});
    show();

    await user.click(screen.getByRole('button', { name: 'Desconectar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('confirmar llama a DELETE y avisa a la página con el resultado de la revocación', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({
      'DELETE /social-accounts/cuenta-1': () => jsonResponse({ revokedAtGoogle: true }),
    });
    const onDisconnected = show();

    await user.click(screen.getByRole('button', { name: 'Desconectar' }));
    await user.click(screen.getByRole('button', { name: 'Sí, desconectar' }));

    await waitFor(() => expect(onDisconnected).toHaveBeenCalledTimes(1));
    expect(onDisconnected).toHaveBeenCalledWith({
      tone: 'success',
      text: expect.stringContaining('revocamos el acceso en Google'),
    });
    expect(api.calls.map((call) => `${call.method} ${call.path}`)).toContain('DELETE /social-accounts/cuenta-1');
  });

  it('si Google no confirmó la revocación, el aviso lo dice y no afirma que se revocó', async () => {
    const user = userEvent.setup();
    installFakeApi({
      'DELETE /social-accounts/cuenta-1': () => jsonResponse({ revokedAtGoogle: false }),
    });
    const onDisconnected = show();

    await user.click(screen.getByRole('button', { name: 'Desconectar' }));
    await user.click(screen.getByRole('button', { name: 'Sí, desconectar' }));

    await waitFor(() => expect(onDisconnected).toHaveBeenCalledTimes(1));
    expect(onDisconnected).toHaveBeenCalledWith({
      tone: 'info',
      text: expect.stringContaining('No pudimos confirmar la revocación'),
    });
  });

  it('un error del servidor se muestra, la confirmación sigue abierta y no se avisa a la página', async () => {
    const user = userEvent.setup();
    installFakeApi({
      'DELETE /social-accounts/cuenta-1': () => jsonResponse({ message: 'Error' }, 500),
    });
    const onDisconnected = show();

    await user.click(screen.getByRole('button', { name: 'Desconectar' }));
    await user.click(screen.getByRole('button', { name: 'Sí, desconectar' }));

    expect(await screen.findByText('No se pudo desconectar la cuenta. Inténtalo de nuevo.')).toBeTruthy();
    expect(screen.getByRole('group')).toBeTruthy();
    expect(onDisconnected).not.toHaveBeenCalled();
  });
});

describe('tarjeta de cuenta: sincronizar y estado', () => {
  it('sincronizar muestra las filas guardadas y el rango', async () => {
    const user = userEvent.setup();
    installFakeApi({ 'POST /social-accounts/cuenta-1/sync': () => jsonResponse(run) });
    show();

    await user.click(screen.getByRole('button', { name: 'Sincronizar' }));

    expect(
      await screen.findByText('Sincronización completada: 699 filas guardadas (31 jul 2026 – 29 oct 2026).'),
    ).toBeTruthy();
  });

  it('una sincronización repetida (429) muestra el mensaje del límite', async () => {
    const user = userEvent.setup();
    installFakeApi({
      'POST /social-accounts/cuenta-1/sync': () => jsonResponse({ message: 'Espera' }, 429),
    });
    show();

    await user.click(screen.getByRole('button', { name: 'Sincronizar' }));

    expect(
      await screen.findByText('Sincronizaste hace menos de un minuto. Espera un momento e inténtalo de nuevo.'),
    ).toBeTruthy();
  });

  it('una sincronización fallida (HTTP 200 con status FAILED) se muestra como error', async () => {
    const user = userEvent.setup();
    installFakeApi({
      'POST /social-accounts/cuenta-1/sync': () =>
        jsonResponse({ ...run, status: 'FAILED', errorMessage: 'YouTube Analytics respondió 403' }),
    });
    show();

    await user.click(screen.getByRole('button', { name: 'Sincronizar' }));

    expect(await screen.findByText('La sincronización falló: YouTube Analytics respondió 403')).toBeTruthy();
  });

  it('una cuenta sin acceso ofrece Reconectar y no Sincronizar', () => {
    installFakeApi({});
    show(vi.fn(), { status: 'REVOKED' });

    const link = screen.getByRole('link', { name: 'Reconectar' });

    expect(link.getAttribute('href')).toBe('/api/v1/integrations/youtube/connect');
    expect(screen.queryByRole('button', { name: 'Sincronizar' })).toBeNull();
    expect(screen.getByText(/no tiene acceso vigente/)).toBeTruthy();
  });
});