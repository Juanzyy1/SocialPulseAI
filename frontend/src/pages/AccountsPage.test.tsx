// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, jsonResponse } from '../test/fake-api';
import { socialAccount } from '../test/fixtures';
import { LocationProbe } from '../test/LocationProbe';
import { renderApp } from '../test/render';
import { AccountsPage } from './AccountsPage';

function Screen() {
  return (
    <>
      <AccountsPage />
      <LocationProbe />
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('página de cuentas: conectar YouTube', () => {
  it('ofrece conectar con un enlace normal al backend y explica los dos permisos de solo lectura', async () => {
    installFakeApi({ 'GET /social-accounts': () => jsonResponse([]) });
    renderApp(<Screen />, { route: '/cuentas' });

    const link = await screen.findByRole('link', { name: 'Conectar YouTube' });

    expect(link.getAttribute('href')).toBe('/api/v1/integrations/youtube/connect');
    expect(screen.getByText(/Ver tu cuenta de YouTube/)).toBeTruthy();
    expect(screen.getByText(/Ver las estadísticas de tu canal/)).toBeTruthy();
    expect(screen.getByText(/No publicamos ni modificamos nada en tu canal/)).toBeTruthy();
    expect(await screen.findByText(/Todavía no has conectado ninguna cuenta/)).toBeTruthy();
  });

  it('una conexión correcta muestra el aviso una sola vez y deja la dirección limpia', async () => {
    installFakeApi({ 'GET /social-accounts': () => jsonResponse([]) });
    renderApp(<Screen />, { route: '/cuentas?youtube=connected' });

    expect(await screen.findByText(/Canal conectado/)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('ruta').textContent).toBe('/cuentas'));
  });

  it('un error conocido muestra su mensaje en español', async () => {
    installFakeApi({ 'GET /social-accounts': () => jsonResponse([]) });
    renderApp(<Screen />, { route: '/cuentas?youtube=error&reason=already_connected' });

    expect(await screen.findByText(/ya está conectado a otra cuenta/)).toBeTruthy();
  });

  it('un código desconocido o con HTML muestra el mensaje genérico y nunca pinta el texto de la dirección', async () => {
    installFakeApi({ 'GET /social-accounts': () => jsonResponse([]) });
    renderApp(<Screen />, {
      route: `/cuentas?youtube=error&reason=${encodeURIComponent('<b>hola</b>')}`,
    });

    expect(await screen.findByText('No se pudo conectar el canal. Inténtalo de nuevo.')).toBeTruthy();
    expect(screen.queryByText(/hola/)).toBeNull();
    expect(document.body.querySelector('b')).toBeNull();
  });

  it('lista las cuentas conectadas con su estado y las acciones disponibles', async () => {
    installFakeApi({ 'GET /social-accounts': () => jsonResponse([socialAccount()]) });
    renderApp(<Screen />, { route: '/cuentas' });

    expect(await screen.findByRole('heading', { name: 'Canal de prueba' })).toBeTruthy();
    expect(screen.getByText('Activa')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sincronizar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeTruthy();
  });
});