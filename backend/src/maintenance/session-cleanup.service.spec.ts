import type { ConfigService } from '@nestjs/config';
import type { SessionsService } from '../auth/sessions.service';
import { SessionCleanupService } from './session-cleanup.service';

class FakeSessions {
  calls = 0;
  fail = false;
  async deleteExpired(): Promise<number> {
    this.calls += 1;
    if (this.fail) throw new Error('postgresql://usuario:clave-secreta@host/db falló');
    return 3;
  }
}

/** Misma clase con un intervalo de milisegundos, para probar el temporizador sin esperar horas. */
class FastCleanup extends SessionCleanupService {
  protected override readonly intervalMs = 5;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const build = (env: string, fast = false) => {
  const sessions = new FakeSessions();
  const config = { get: () => env } as unknown as ConfigService;
  const Service = fast ? FastCleanup : SessionCleanupService;
  return { sessions, service: new Service(sessions as unknown as SessionsService, config) };
};

describe('SessionCleanupService', () => {
  it('runOnce devuelve cuántas sesiones se eliminaron', async () => {
    const { service, sessions } = build('development');

    await expect(service.runOnce()).resolves.toBe(3);
    expect(sessions.calls).toBe(1);
  });

  it('un fallo se absorbe: devuelve 0 y no lanza ningún error', async () => {
    const { service, sessions } = build('development');
    sessions.fail = true;

    await expect(service.runOnce()).resolves.toBe(0);
  });

  it('en las pruebas (NODE_ENV=test) no limpia ni programa nada', async () => {
    const { service, sessions } = build('test', true);

    service.onApplicationBootstrap();
    await wait(40);
    service.onModuleDestroy();

    expect(sessions.calls).toBe(0);
  });

  it('fuera de las pruebas limpia al arrancar y luego se repite, hasta que se detiene', async () => {
    const { service, sessions } = build('development', true);

    service.onApplicationBootstrap();
    await wait(80);
    service.onModuleDestroy();
    const callsAtStop = sessions.calls;

    expect(callsAtStop).toBeGreaterThanOrEqual(3);
    await wait(40);
    expect(sessions.calls).toBe(callsAtStop);
  });
});