// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, jsonResponse } from '../test/fake-api';
import { profile } from '../test/fixtures';
import { LocationProbe } from '../test/LocationProbe';
import { renderApp } from '../test/render';
import { RegisterPage } from './RegisterPage';

function Screen() {
  return (
    <Routes>
      <Route
        path="/registro"
        element={
          <>
            <RegisterPage />
            <LocationProbe />
          </>
        }
      />
      <Route path="*" element={<p>pantalla protegida</p>} />
    </Routes>
  );
}

const authUser = { id: 'u1', email: 'ana@example.com', displayName: 'Ana', createdAt: '2026-10-24T00:00:00.000Z' };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, invite?: string) {
  await user.type(screen.getByLabelText('Nombre'), 'Ana');
  await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com');
  await user.type(screen.getByLabelText('Contraseña'), 'una-clave-larga-1234');
  if (invite) await user.type(screen.getByLabelText(/Código de invitación/), invite);
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}

const okRoutes = {
  'POST /auth/register': () => jsonResponse(authUser, 201),
  'POST /auth/login': () => jsonResponse(authUser),
  'GET /users/me': () => jsonResponse(profile()),
};

describe('registro con código de invitación', () => {
  it('muestra el campo del código como opcional', () => {
    installFakeApi({});
    renderApp(<Screen />, { route: '/registro' });

    expect(screen.getByLabelText('Código de invitación (si tienes uno)')).toBeTruthy();
  });

  it('envía el código recortado junto con el registro y entra', async () => {
    const user = userEvent.setup();
    const api = installFakeApi(okRoutes);
    renderApp(<Screen />, { route: '/registro' });

    await fillAndSubmit(user, '  codigo-123456789  ');

    await screen.findByText('pantalla protegida');
    const register = api.calls.find((call) => call.path === '/auth/register');
    expect(register?.body).toMatchObject({ email: 'ana@example.com', inviteCode: 'codigo-123456789' });
  });

  it('sin código, no envía el campo', async () => {
    const user = userEvent.setup();
    const api = installFakeApi(okRoutes);
    renderApp(<Screen />, { route: '/registro' });

    await fillAndSubmit(user);

    await screen.findByText('pantalla protegida');
    expect(api.calls.find((call) => call.path === '/auth/register')?.body).not.toHaveProperty('inviteCode');
  });

  it('un código incorrecto (403) muestra el aviso de invitación, no inicia sesión y no navega', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({
      'POST /auth/register': () => jsonResponse({ message: 'Se necesita un código de invitación válido' }, 403),
    });
    renderApp(<Screen />, { route: '/registro' });

    await fillAndSubmit(user, 'codigo-equivocado-1');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'El código de invitación no es correcto o falta. Pídeselo a quien te invitó.',
    );
    expect(api.calls.map((call) => call.path)).toEqual(['/auth/register']);
    expect(screen.getByTestId('ruta').textContent).toBe('/registro');
  });
});