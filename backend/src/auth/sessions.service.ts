import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_IDLE_TTL_MS = 7 * DAY_MS;
export const SESSION_ABSOLUTE_TTL_MS = 30 * DAY_MS;
// Solo se renueva la sesión si pasó más de esto desde el último uso.
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface ValidSession {
  sessionId: string;
  userId: string;
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** SHA-256 en hexadecimal. Es lo único del token que se guarda en la base. */
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Crea una sesión. El token solo se devuelve aquí; después no se puede recuperar. */
  async create(
    userId: string,
    meta: SessionMeta = {},
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_IDLE_TTL_MS);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: SessionsService.hashToken(token),
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 255),
        ipAddress: meta.ipAddress?.slice(0, 64),
      },
    });
    return { token, expiresAt };
  }

  /** Devuelve la sesión si el token es válido y vigente; si no, null. */
  async validate(token: string): Promise<ValidSession | null> {
    // Un token real mide 43 caracteres: descartamos lo absurdo sin consultar la base.
    if (!token || token.length > 200) return null;

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: SessionsService.hashToken(token) },
    });
    if (!session) return null;

    const now = Date.now();
    if (session.expiresAt.getTime() <= now) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      return null;
    }

    if (now - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      // expiresAt nunca supera createdAt + 30 días (límite absoluto).
      const absoluteLimit = session.createdAt.getTime() + SESSION_ABSOLUTE_TTL_MS;
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          lastUsedAt: new Date(now),
          expiresAt: new Date(Math.min(now + SESSION_IDLE_TTL_MS, absoluteLimit)),
        },
      });
    }

    return { sessionId: session.id, userId: session.userId };
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { tokenHash: SessionsService.hashToken(token) },
    });
  }

  /** Cierra todas las sesiones de un usuario. Devuelve cuántas cerró. */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.session.deleteMany({ where: { userId } });
    return result.count;
  }

  /** Limpieza de sesiones caducadas (se programará más adelante). */
  async deleteExpired(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}