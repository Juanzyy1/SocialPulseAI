import { vi } from 'vitest';

export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
}

export type Handler = (call: RecordedCall) => Response | Promise<Response>;

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Sustituye fetch por una API falsa que registra cada llamada. Las rutas se indican como
 * "MÉTODO /ruta" (sin el prefijo /api/v1) y pueden cambiarse durante la prueba. Una ruta sin
 * manejador responde 404; un manejador que lanza un error simula una red caída.
 */
export function installFakeApi(routes: Record<string, Handler>) {
  const calls: RecordedCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = input.replace(/^\/api\/v1/, '');
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      const call = { method, path, body };
      calls.push(call);
      const handler = routes[`${method} ${path}`];
      return handler
        ? handler(call)
        : jsonResponse({ message: `Sin ruta de prueba: ${method} ${path}` }, 404);
    }),
  );
  return { calls, routes };
}