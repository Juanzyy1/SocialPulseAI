// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, jsonResponse } from '../test/fake-api';
import { profile } from '../test/fixtures';
import { LocationProbe } from '../test/LocationProbe';
import { renderApp } from '../test/render';
import { LoginPage } from './LoginPage';

function Screen() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <>
            <LoginPage />
            <LocationProbe />
          </>
        }
      />
      <Route
        path="*"
        element={
          <>
            <p>pantalla protegida</p>
            <LocationProbe />
          </>
        }
      />
    </Routes>
  );
}

const authUser = { id: 'u1', email: 'ana@example.com', displayName: 'Ana', createdAt: '2026-10-24T00:00:00.000Z' };
const PASSWORD = 'una-clave-larga-1234';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function submitCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Correo electrónico'), '  ana@example.com ');
  await user.type(screen.getByLabelText('Contraseña'), PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('pantalla de login', () => {
  it('sin datos muestra el error de cada campo y no llama al servidor', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({});
    renderApp(<Screen />, { route: '/login' });

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getByText('Escribe tu correo')).toBeTruthy();
    expect(screen.getByText('Escribe tu contraseña')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('un login correcto llama a login con los datos recortados, consulta la sesión y navega al panel', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({
      'POST /auth/login': () => jsonResponse(authUser),
      'GET /users/me': () => jsonResponse(profile()),
    });
    renderApp(<Screen />, { route: '/login' });

    await submitCredentials(user);

    await screen.findByText('pantalla protegida');
    expect(screen.getByTestId('ruta').textContent).toBe('/');
    expect(api.calls).toEqual([
      { method: 'POST', path: '/auth/login', body: { email: 'ana@example.com', password: PASSWORD } },
      { method: 'GET', path: '/users/me', body: undefined },
    ]);
  });

  it('unas credenciales incorrectas (401) muestran el mensaje, no navegan y no consultan la sesión', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({
      'POST /auth/login': () => jsonResponse({ statusCode: 401, message: 'Credenciales inválidas' }, 401),
    });
    renderApp(<Screen />, { route: '/login' });

    await submitCredentials(user);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('El correo o la contraseña no son correctos.');
    expect(screen.getByTestId('ruta').textContent).toBe('/login');
    expect(api.calls.map((call) => call.path)).toEqual(['/auth/login']);
  });

  it('demasiados intentos (429) muestra el aviso del límite', async () => {
    const user = userEvent.setup();
    installFakeApi({
      'POST /auth/login': () => jsonResponse({ message: 'Demasiados intentos.' }, 429),
    });
    renderApp(<Screen />, { route: '/login' });

    await submitCredentials(user);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
    );
  });

  it('con el servidor caído muestra el aviso de conexión', async () => {
    const user = userEvent.setup();
    installFakeApi({
      'POST /auth/login': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderApp(<Screen />, { route: '/login' });

    await submitCredentials(user);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    );
  });

  it.each([
    ['/cuentas?x=1', '/cuentas?x=1'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
  ])('tras entrar, la ruta de origen %s lleva a %s (solo se vuelve a rutas internas)', async (from, expected) => {
    const user = userEvent.setup();
    installFakeApi({
      'POST /auth/login': () => jsonResponse(authUser),
      'GET /users/me': () => jsonResponse(profile()),
    });
    renderApp(<Screen />, { route: { pathname: '/login', state: { from } } });

    await submitCredentials(user);

    await screen.findByText('pantalla protegida');
    expect(screen.getByTestId('ruta').textContent).toBe(expected);
  });

  it.each([
    ['unauthorized', 'No se pudo verificar tu identidad con Google. Inténtalo de nuevo.'],
    ['<script>alert(1)</script>', 'No se pudo completar el acceso con Google.'],
  ])('el código ?error=%s que deja el backend tras un fallo con Google muestra un aviso seguro', async (code, text) => {
    installFakeApi({});
    renderApp(<Screen />, { route: `/login?error=${encodeURIComponent(code)}` });

    expect((await screen.findByRole('alert')).textContent).toBe(text);
    expect(document.querySelector('script')).toBeNull();
  });
});