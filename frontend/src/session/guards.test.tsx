// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TERMS_VERSION } from '../legal/terms';
import { installFakeApi, jsonResponse } from '../test/fake-api';
import { profile } from '../test/fixtures';
import { LocationProbe } from '../test/LocationProbe';
import { renderApp } from '../test/render';
import { GuestOnly } from './GuestOnly';
import { RequireAuth } from './RequireAuth';
import { RequireTerms } from './RequireTerms';

function Screen() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route
          path="/login"
          element={
            <>
              <p>pantalla de login</p>
              <LocationProbe />
            </>
          }
        />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<RequireTerms />}>
          <Route
            path="/"
            element={
              <>
                <p>contenido protegido</p>
                <LocationProbe />
              </>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('guardas de sesión', () => {
  it('sin sesión (401) lleva al login', async () => {
    installFakeApi({
      'GET /users/me': () => jsonResponse({ statusCode: 401, message: 'Unauthorized' }, 401),
    });
    renderApp(<Screen />, { route: '/' });

    expect(await screen.findByText('pantalla de login')).toBeTruthy();
    expect(screen.getByTestId('ruta').textContent).toBe('/login');
  });

  it('con sesión y los términos al día muestra el contenido protegido', async () => {
    installFakeApi({ 'GET /users/me': () => jsonResponse(profile()) });
    renderApp(<Screen />, { route: '/' });

    expect(await screen.findByText('contenido protegido')).toBeTruthy();
  });

  it('un error del servidor NO se trata como "sin sesión": avisa, no redirige y permite reintentar', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({
      'GET /users/me': () => jsonResponse({ message: 'Error' }, 500),
    });
    renderApp(<Screen />, { route: '/' });

    expect(await screen.findByText(/No se pudo comprobar la sesión/)).toBeTruthy();
    expect(screen.queryByText('pantalla de login')).toBeNull();

    api.routes['GET /users/me'] = () => jsonResponse(profile());
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('contenido protegido')).toBeTruthy();
  });

  it('con sesión, el login redirige al panel', async () => {
    installFakeApi({ 'GET /users/me': () => jsonResponse(profile()) });
    renderApp(<Screen />, { route: '/login' });

    expect(await screen.findByText('contenido protegido')).toBeTruthy();
    expect(screen.getByTestId('ruta').textContent).toBe('/');
  });
});

describe('puerta de aceptación de términos', () => {
  it('sin aceptar la versión vigente muestra la puerta y no el contenido', async () => {
    installFakeApi({
      'GET /users/me': () => jsonResponse(profile({ termsUpToDate: false, termsVersion: null, termsAcceptedAt: null })),
    });
    renderApp(<Screen />, { route: '/' });

    expect(await screen.findByText('Antes de continuar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aceptar y continuar' })).toBeTruthy();
    expect(screen.queryByText('contenido protegido')).toBeNull();
  });

  it('si el backend exige otra versión que la que muestra la página, pide recargar en lugar de aceptar', async () => {
    installFakeApi({
      'GET /users/me': () => jsonResponse(profile({ termsUpToDate: false, currentTermsVersion: '2099-01-01' })),
    });
    renderApp(<Screen />, { route: '/' });

    expect(await screen.findByRole('button', { name: 'Recargar la página' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aceptar y continuar' })).toBeNull();
  });

  it('sin marcar la casilla no llama al servidor y avisa', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({
      'GET /users/me': () => jsonResponse(profile({ termsUpToDate: false })),
    });
    renderApp(<Screen />, { route: '/' });

    await user.click(await screen.findByRole('button', { name: 'Aceptar y continuar' }));

    expect(screen.getByText('Debes aceptar los términos y la política de privacidad para continuar.')).toBeTruthy();
    expect(api.calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('aceptar envía la versión que muestra la página y da paso al contenido', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({
      'GET /users/me': () => jsonResponse(profile({ termsUpToDate: false })),
      'POST /users/me/terms': () => jsonResponse(profile({ termsUpToDate: true })),
    });
    renderApp(<Screen />, { route: '/' });

    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));

    expect(await screen.findByText('contenido protegido')).toBeTruthy();
    const post = api.calls.find((call) => call.method === 'POST');
    expect(post).toEqual({
      method: 'POST',
      path: '/users/me/terms',
      body: { acceptTerms: true, termsVersion: TERMS_VERSION },
    });
  });
});