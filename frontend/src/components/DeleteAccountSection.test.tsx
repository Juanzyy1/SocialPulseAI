// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../api/types';
import { SESSION_KEY } from '../session/session-core';
import { installFakeApi, jsonResponse } from '../test/fake-api';
import { profile } from '../test/fixtures';
import { LocationProbe } from '../test/LocationProbe';
import { renderApp } from '../test/render';
import { DeleteAccountSection } from './DeleteAccountSection';

function Screen({ account }: { account: Profile }) {
  return (
    <Routes>
      <Route path="/ajustes" element={<DeleteAccountSection profile={account} />} />
      <Route
        path="/cuenta-eliminada"
        element={
          <>
            <p>pantalla final</p>
            <LocationProbe />
          </>
        }
      />
    </Routes>
  );
}

const show = (account: Profile) => renderApp(<Screen account={account} />, { route: '/ajustes' });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('eliminar cuenta', () => {
  it('al principio solo hay un botón: no se muestra el formulario ni se llama al servidor', () => {
    const api = installFakeApi({});
    show(profile());

    expect(screen.getByRole('button', { name: 'Eliminar mi cuenta…' })).toBeTruthy();
    expect(screen.queryByLabelText('Tu contraseña')).toBeNull();
    expect(api.calls).toHaveLength(0);
  });

  it('al abrirlo, el foco va al correo y se pide la contraseña solo si la cuenta tiene una', async () => {
    const user = userEvent.setup();
    installFakeApi({});
    show(profile({ hasPassword: true }));

    await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta…' }));

    expect(screen.getByLabelText(/Para confirmar, escribe tu correo/)).toBe(document.activeElement);
    expect(screen.getByLabelText('Tu contraseña')).toBeTruthy();
  });

  it('una cuenta sin contraseña (solo Google) no la pide', async () => {
    const user = userEvent.setup();
    installFakeApi({});
    show(profile({ hasPassword: false }));

    await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta…' }));

    expect(screen.queryByLabelText('Tu contraseña')).toBeNull();
  });

  it('con un correo incorrecto o sin contraseña muestra los errores y no llama al servidor', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({});
    show(profile());

    await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta…' }));
    await user.type(screen.getByLabelText(/Para confirmar/), 'otro@example.com');
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    expect(screen.getByText('Escribe tu correo exactamente como aparece arriba')).toBeTruthy();
    expect(screen.getByText('Escribe tu contraseña para confirmar')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('con los datos correctos envía la confirmación, va a la pantalla final y borra la sesión local', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({
      'POST /users/me/delete': () => jsonResponse({ accountsDisconnected: 1, revocationsNotConfirmed: 0 }),
    });
    const { queryClient } = show(profile({ email: 'ana@example.com' }));

    await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta…' }));
    await user.type(screen.getByLabelText(/Para confirmar/), 'ANA@EXAMPLE.COM');
    await user.type(screen.getByLabelText('Tu contraseña'), 'mi-clave-larga-1234');
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    expect(await screen.findByText('pantalla final')).toBeTruthy();
    expect(screen.getByTestId('ruta').textContent).toBe('/cuenta-eliminada');
    expect(api.calls).toEqual([
      {
        method: 'POST',
        path: '/users/me/delete',
        body: { confirmEmail: 'ANA@EXAMPLE.COM', password: 'mi-clave-larga-1234' },
      },
    ]);
    expect(queryClient.getQueryData(SESSION_KEY)).toBeNull();
  });

  it('una cuenta sin contraseña envía solo el correo', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({
      'POST /users/me/delete': () => jsonResponse({ accountsDisconnected: 0, revocationsNotConfirmed: 0 }),
    });
    show(profile({ email: 'ana@example.com', hasPassword: false }));

    await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta…' }));
    await user.type(screen.getByLabelText(/Para confirmar/), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    await screen.findByText('pantalla final');
    expect(api.calls[0]?.body).toEqual({ confirmEmail: 'ana@example.com' });
  });

  it.each([
    [403, 'Los datos de confirmación no son correctos.'],
    [429, 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.'],
  ])('un %i muestra el mensaje, se queda en la pantalla y no toca la sesión', async (status, text) => {
    const user = userEvent.setup();
    installFakeApi({ 'POST /users/me/delete': () => jsonResponse({ message: 'texto interno' }, status) });
    const { queryClient } = show(profile({ email: 'ana@example.com' }));

    await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta…' }));
    await user.type(screen.getByLabelText(/Para confirmar/), 'ana@example.com');
    await user.type(screen.getByLabelText('Tu contraseña'), 'mi-clave-larga-1234');
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    expect((await screen.findByRole('alert')).textContent).toBe(text);
    expect(screen.queryByText('pantalla final')).toBeNull();
    expect(queryClient.getQueryData(SESSION_KEY)).toBeUndefined();
  });

  it('cancelar cierra el formulario, borra lo escrito y no llama al servidor', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({});
    show(profile());

    await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta…' }));
    await user.type(screen.getByLabelText(/Para confirmar/), 'algo');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta…' }));

    expect((screen.getByLabelText(/Para confirmar/) as HTMLInputElement).value).toBe('');
    expect(api.calls).toHaveLength(0);
  });
});