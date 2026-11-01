import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionsService } from '../auth/sessions.service';
import { safeErrorMessage } from '../common/logging/redact';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Elimina periódicamente las sesiones caducadas. Corre una vez al arrancar y luego cada 6 horas.
 * Vale para una sola instancia (con varias, cada una limpiaría: es inofensivo). En las pruebas
 * (NODE_ENV=test) no arranca ningún temporizador.
 */
@Injectable()
export class SessionCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SessionCleanupService.name);
  private timer: NodeJS.Timeout | null = null;
  protected readonly intervalMs = SIX_HOURS_MS;

  constructor(
    private readonly sessions: SessionsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref(); // el temporizador no impide que el proceso termine
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Una pasada de limpieza. Un fallo se registra y no se propaga: no debe tumbar la aplicación. */
  async runOnce(): Promise<number> {
    try {
      const removed = await this.sessions.deleteExpired();
      if (removed > 0) this.logger.log(`Sesiones caducadas eliminadas: ${removed}`);
      return removed;
    } catch (error) {
      this.logger.warn(`No se pudieron limpiar las sesiones caducadas: ${safeErrorMessage(error)}`);
      return 0;
    }
  }
}