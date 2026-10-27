import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleIdentity, GoogleOAuthClient } from './google-oauth.client';
import {
  createOAuthTransaction,
  packOAuthCookie,
  safeEqual,
  unpackOAuthCookie,
} from './oauth-flow';
import { SessionMeta, SessionsService } from './sessions.service';
import { safeErrorMessage } from '../common/logging/redact';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly google: GoogleOAuthClient,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {}

  private ensureEnabled(): void {
    if (!this.google.enabled) {
      throw new ServiceUnavailableException(
        'El inicio de sesión con Google no está configurado',
      );
    }
  }

  /** Paso 1: genera state, nonce y PKCE, y la URL a la que se redirige al usuario. */
  start(): { url: string; cookieValue: string } {
    this.ensureEnabled();
    const transaction = createOAuthTransaction();
    return {
      url: this.google.buildAuthUrl(transaction),
      cookieValue: packOAuthCookie(transaction),
    };
  }

  /** Paso 2: valida la respuesta de Google y devuelve el token de una sesión nueva. */
  async finish(
    input: { code: unknown; state: unknown; error: unknown; cookie: unknown },
    meta: SessionMeta,
  ): Promise<{ token: string }> {
    this.ensureEnabled();

    if (typeof input.error === 'string') {
      throw new UnauthorizedException('Google no autorizó el inicio de sesión');
    }

    const saved =
      typeof input.cookie === 'string' ? unpackOAuthCookie(input.cookie) : null;
    if (
      !saved ||
      typeof input.state !== 'string' ||
      typeof input.code !== 'string' ||
      input.code.length === 0 ||
      input.code.length > 2048 ||
      !safeEqual(input.state, saved.state)
    ) {
      throw new BadRequestException('Solicitud de inicio de sesión inválida');
    }

    let identity: GoogleIdentity;
    try {
      identity = await this.google.exchangeCode(
        input.code,
        saved.codeVerifier,
        saved.nonce,
      );
    } catch (error) {
      // Se registra solo el mensaje: nunca códigos ni tokens.
      this.logger.warn(
        `Falló la verificación con Google: ${safeErrorMessage(error)}`
      );
      throw new UnauthorizedException('No se pudo verificar la identidad con Google');
    }

    const userId = await this.resolveUser(identity);
    const { token } = await this.sessions.create(userId, meta);
    return { token };
  }

  /**
   * Reglas de negocio 3, 4 y 5 de MVP_SPEC.md.
   * Se reintenta una vez si dos callbacks simultáneos chocan con una restricción única.
   */
  private async resolveUser(identity: GoogleIdentity): Promise<string> {
    // Regla 3: solo se confía en correos que Google marca como verificados.
    if (!identity.emailVerified) {
      throw new UnauthorizedException('Google no ha verificado este correo');
    }
    try {
      return await this.linkOrCreate(identity);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.linkOrCreate(identity);
    }
  }

  private linkOrCreate(identity: GoogleIdentity): Promise<string> {
    const email = identity.email.trim().toLowerCase();
    const avatarUrl = identity.picture?.startsWith('https://')
      ? identity.picture.slice(0, 2048)
      : null;

    return this.prisma.$transaction(async (tx) => {
      // 1. Ya existe esta identidad de Google: entra a su usuario.
      const known = await tx.oAuthIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: 'GOOGLE',
            providerUserId: identity.sub,
          },
        },
        select: { userId: true },
      });
      if (known) return known.userId;

      // 2. El correo ya pertenece a una cuenta local: se vincula.
      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true, emailVerifiedAt: true },
      });
      if (existing) {
        await tx.oAuthIdentity.create({
          data: {
            userId: existing.id,
            provider: 'GOOGLE',
            providerUserId: identity.sub,
          },
        });
        // Regla 4: cuenta local sin verificar. Pudo registrarla otra persona con la
        // contraseña que conoce. Se borra esa contraseña, se marca verificada y se
        // cierran todas sus sesiones. Regla 5: si ya estaba verificada, no se toca.
        if (existing.emailVerifiedAt === null) {
          await tx.user.update({
            where: { id: existing.id },
            // La aceptación de términos también se borra: pudo registrarla quien creó la cuenta,
            // y el dueño real del correo no ha aceptado nada.
            data: {
              passwordHash: null,
              emailVerifiedAt: new Date(),
              termsAcceptedAt: null,
              termsVersion: null,
            },
          });
          await tx.session.deleteMany({ where: { userId: existing.id } });
        }
        return existing.id;
      }

      // 3. Usuario nuevo, ya verificado y sin contraseña.
      const created = await tx.user.create({
        data: {
          email,
          displayName: identity.name?.trim().slice(0, 80) || null,
          avatarUrl,
          emailVerifiedAt: new Date(),
          oauthIdentities: {
            create: { provider: 'GOOGLE', providerUserId: identity.sub },
          },
        },
        select: { id: true },
      });
      return created.id;
    });
  }
}