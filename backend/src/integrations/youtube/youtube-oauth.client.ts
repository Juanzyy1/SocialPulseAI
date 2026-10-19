import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { API_PREFIX } from '../../app.setup';

/** Permisos mínimos: identificar el canal y leer analítica (sin ingresos ni gestión). */
export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
] as const;

export interface YoutubeTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  /** Permisos que el usuario realmente concedió. */
  scopes: string[];
}

export interface YoutubeChannel {
  channelId: string;
  title: string | null;
  handle: string | null;
  avatarUrl: string | null;
}

export interface RefreshedToken {
  accessToken: string;
  expiresAt?: Date;
}

export interface AnalyticsCheck {
  ok: boolean;
  statusCode: number;
}

/** Google rechazó el refresh token: fue revocado o caducó (en modo Testing, a los 7 días). */
export class RefreshTokenRevokedError extends Error {
  constructor() {
    super('El refresh token fue revocado o caducó');
    this.name = 'RefreshTokenRevokedError';
  }
}

/** Abstracción del cliente de Google/YouTube: las pruebas la sustituyen por una simulada. */
export abstract class YoutubeOAuthClient {
  abstract enabled: boolean;
  abstract buildAuthUrl(params: { state: string; codeChallenge: string }): string;
  abstract exchangeCode(code: string, codeVerifier: string): Promise<YoutubeTokens>;
  /** Devuelve el canal del usuario autenticado, o null si la cuenta no tiene canal. */
  abstract fetchChannel(accessToken: string): Promise<YoutubeChannel | null>;
  /** Revoca el token en Google. Lanza si Google no responde con éxito. */
  abstract revokeToken(token: string): Promise<void>;
  /** Renueva el access token. Lanza RefreshTokenRevokedError si Google rechaza el refresh token. */
  abstract refreshAccessToken(refreshToken: string): Promise<RefreshedToken>;
  /** Hace una consulta mínima a YouTube Analytics para comprobar que el acceso funciona. */
  abstract checkAnalyticsAccess(accessToken: string): Promise<AnalyticsCheck>;
}

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const CHANNELS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/channels';
const ANALYTICS_ENDPOINT = 'https://youtubeanalytics.googleapis.com/v2/reports';
const REQUEST_TIMEOUT_MS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

interface ChannelsResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      customUrl?: string;
      thumbnails?: { default?: { url?: string } };
    };
  }>;
}

@Injectable()
export class YoutubeOAuthClientImpl extends YoutubeOAuthClient {
  readonly enabled: boolean;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly client: OAuth2Client | null;

  constructor(config: ConfigService) {
    super();
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    const googleRedirect = config.get<string>('GOOGLE_REDIRECT_URI') ?? '';
    this.enabled = Boolean(this.clientId && this.clientSecret && googleRedirect);
    // Mismo servidor que el login con Google, distinta ruta. Debe estar registrada en Google.
    this.redirectUri = this.enabled
      ? new URL(`/${API_PREFIX}/integrations/youtube/callback`, googleRedirect).toString()
      : '';
    this.client = this.enabled
      ? new OAuth2Client({
          clientId: this.clientId,
          clientSecret: this.clientSecret,
          redirectUri: this.redirectUri,
        })
      : null;
  }

  buildAuthUrl(params: { state: string; codeChallenge: string }): string {
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: YOUTUBE_SCOPES.join(' '),
      state: params.state,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
      // Necesario para recibir un refresh token y poder sincronizar sin el usuario delante.
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${AUTH_ENDPOINT}?${query.toString()}`;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<YoutubeTokens> {
    if (!this.client) throw new Error('Google OAuth no está configurado');

    const { tokens } = await this.client.getToken({ code, codeVerifier });
    if (!tokens.access_token) throw new Error('Google no devolvió access_token');

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scopes: (tokens.scope ?? '').split(' ').filter(Boolean),
    };
  }

  async fetchChannel(accessToken: string): Promise<YoutubeChannel | null> {
    const res = await fetch(`${CHANNELS_ENDPOINT}?part=snippet&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`YouTube respondió ${res.status}`);

    const item = ((await res.json()) as ChannelsResponse).items?.[0];
    if (!item) return null;
    return {
      channelId: item.id,
      title: item.snippet?.title ?? null,
      handle: item.snippet?.customUrl ?? null,
      avatarUrl: item.snippet?.thumbnails?.default?.url ?? null,
    };
  }

  async revokeToken(token: string): Promise<void> {
    const res = await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Google respondió ${res.status} al revocar`);
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshedToken> {
    if (!this.enabled) throw new Error('Google OAuth no está configurado');

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!res.ok) {
      // Solo se lee el campo `error`: la respuesta completa nunca se registra.
      if (body.error === 'invalid_grant') throw new RefreshTokenRevokedError();
      throw new Error(`Google respondió ${res.status} al renovar el token`);
    }
    if (!body.access_token) throw new Error('Google no devolvió access_token');

    return {
      accessToken: body.access_token,
      expiresAt:
        typeof body.expires_in === 'number'
          ? new Date(Date.now() + body.expires_in * 1000)
          : undefined,
    };
  }

  async checkAnalyticsAccess(accessToken: string): Promise<AnalyticsCheck> {
    // Hasta ayer: evita una fecha "futura" por diferencia de zona horaria.
    const query = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: isoDate(new Date(Date.now() - 8 * DAY_MS)),
      endDate: isoDate(new Date(Date.now() - DAY_MS)),
      metrics: 'views',
    });
    const res = await fetch(`${ANALYTICS_ENDPOINT}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { ok: res.ok, statusCode: res.status };
  }
}