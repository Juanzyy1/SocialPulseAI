import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { redactSecrets } from '../../common/logging/redact';

export const TIKTOK_SCOPES = ['user.info.basic', 'user.info.stats', 'video.list'] as const;

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  openId: string;
  scopes: string[];
  expiresAt: Date;
  refreshExpiresAt: Date;
}

export interface TikTokProfile {
  openId: string;
  displayName: string;
  avatarUrl: string | null;
  followers: number;
  following: number;
  likes: number;
  videos: number;
}

export interface TikTokVideo {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export class TikTokOAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TikTokOAuthError';
  }
}

export abstract class TikTokOAuthClient {
  abstract readonly enabled: boolean;
  abstract buildAuthUrl(state: string): string;
  abstract exchangeCode(code: string): Promise<TikTokTokens>;
  abstract refreshToken(refreshToken: string): Promise<TikTokTokens>;
  abstract fetchProfile(accessToken: string): Promise<TikTokProfile>;
  abstract fetchRecentVideos(accessToken: string): Promise<TikTokVideo[]>;
  abstract revokeToken(accessToken: string): Promise<void>;
}

const AUTHORIZE_ENDPOINT = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_ENDPOINT = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_INFO_ENDPOINT = 'https://open.tiktokapis.com/v2/user/info/';
const VIDEO_LIST_ENDPOINT = 'https://open.tiktokapis.com/v2/video/list/';
const REVOKE_ENDPOINT = 'https://open.tiktokapis.com/v2/oauth/revoke/';
const REQUEST_TIMEOUT_MS = 10_000;
const VIDEO_FIELDS = 'id,view_count,like_count,comment_count,share_count';
const USER_FIELDS =
  'open_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredCount(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`TikTok devolvió un valor inválido para ${name}`);
  }
  return value;
}

function optionalCount(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredCount(value, name);
}

function checkApiError(value: unknown): void {
  if (!isRecord(value) || !isRecord(value.error)) {
    throw new Error('TikTok devolvió una respuesta inválida');
  }
  const { code, message } = value.error;
  if (code !== 'ok') {
    const detail = typeof message === 'string' ? redactSecrets(message).slice(0, 250) : 'error desconocido';
    throw new Error(`TikTok rechazó la consulta (${String(code)}): ${detail}`);
  }
}

function parseTokenResponse(value: unknown): TikTokTokens {
  if (!isRecord(value)) throw new Error('TikTok devolvió una respuesta de token inválida');
  if (typeof value.error === 'string' && value.error !== '') {
    const detail =
      typeof value.error_description === 'string'
        ? redactSecrets(value.error_description).slice(0, 250)
        : value.error;
    throw new TikTokOAuthError(value.error, `TikTok rechazó el token: ${detail}`);
  }
  if (
    typeof value.access_token !== 'string' ||
    value.access_token.length === 0 ||
    typeof value.refresh_token !== 'string' ||
    value.refresh_token.length === 0 ||
    typeof value.open_id !== 'string' ||
    value.open_id.length === 0 ||
    typeof value.scope !== 'string' ||
    typeof value.expires_in !== 'number' ||
    !Number.isSafeInteger(value.expires_in) ||
    value.expires_in <= 0 ||
    typeof value.refresh_expires_in !== 'number' ||
    !Number.isSafeInteger(value.refresh_expires_in) ||
    value.refresh_expires_in <= 0
  ) {
    throw new Error('TikTok devolvió campos de token incompletos');
  }
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    openId: value.open_id,
    scopes: value.scope.split(',').filter(Boolean),
    expiresAt: new Date(Date.now() + value.expires_in * 1000),
    refreshExpiresAt: new Date(Date.now() + value.refresh_expires_in * 1000),
  };
}

@Injectable()
export class TikTokOAuthClientImpl extends TikTokOAuthClient {
  readonly enabled: boolean;
  private readonly clientKey: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(config: ConfigService) {
    super();
    this.clientKey = config.get<string>('TIKTOK_CLIENT_KEY') ?? '';
    this.clientSecret = config.get<string>('TIKTOK_CLIENT_SECRET') ?? '';
    this.redirectUri = config.get<string>('TIKTOK_REDIRECT_URI') ?? '';
    this.enabled = Boolean(this.clientKey && this.clientSecret && this.redirectUri);
  }

  buildAuthUrl(state: string): string {
    const query = new URLSearchParams({
      client_key: this.clientKey,
      response_type: 'code',
      scope: TIKTOK_SCOPES.join(','),
      redirect_uri: this.redirectUri,
      state,
    });
    return `${AUTHORIZE_ENDPOINT}?${query.toString()}`;
  }

  async exchangeCode(code: string): Promise<TikTokTokens> {
    return parseTokenResponse(
      await this.tokenRequest({
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    );
  }

  async refreshToken(refreshToken: string): Promise<TikTokTokens> {
    return parseTokenResponse(await this.tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' }));
  }

  async fetchProfile(accessToken: string): Promise<TikTokProfile> {
    const query = new URLSearchParams({ fields: USER_FIELDS });
    const response = await fetch(`${USER_INFO_ENDPOINT}?${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`TikTok respondió ${response.status} al consultar el perfil`);
    checkApiError(payload);
    if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.user)) {
      throw new Error('TikTok devolvió un perfil inválido');
    }
    const user = payload.data.user;
    if (
      typeof user.open_id !== 'string' ||
      typeof user.display_name !== 'string' ||
      user.display_name.length === 0
    ) {
      throw new Error('TikTok devolvió una identidad incompleta');
    }
    return {
      openId: user.open_id,
      displayName: user.display_name,
      avatarUrl: typeof user.avatar_url === 'string' ? user.avatar_url : null,
      followers: requiredCount(user.follower_count, 'follower_count'),
      following: requiredCount(user.following_count, 'following_count'),
      likes: requiredCount(user.likes_count, 'likes_count'),
      videos: requiredCount(user.video_count, 'video_count'),
    };
  }

  async fetchRecentVideos(accessToken: string): Promise<TikTokVideo[]> {
    const query = new URLSearchParams({ fields: VIDEO_FIELDS });
    const response = await fetch(`${VIDEO_LIST_ENDPOINT}?${query}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: 20 }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`TikTok respondió ${response.status} al consultar los videos`);
    checkApiError(payload);
    if (!isRecord(payload) || !isRecord(payload.data) || !Array.isArray(payload.data.videos)) {
      throw new Error('TikTok devolvió una lista de videos inválida');
    }
    return payload.data.videos.map((video: unknown) => {
      if (!isRecord(video) || typeof video.id !== 'string') {
        throw new Error('TikTok devolvió un video inválido');
      }
      return {
        views: optionalCount(video.view_count, 'view_count'),
        likes: optionalCount(video.like_count, 'like_count'),
        comments: optionalCount(video.comment_count, 'comment_count'),
        shares: optionalCount(video.share_count, 'share_count'),
      };
    });
  }

  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        token: accessToken,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`TikTok respondió ${response.status} al revocar el acceso`);
    const payload: unknown = await response.json().catch(() => ({}));
    if (isRecord(payload) && typeof payload.error === 'string' && payload.error !== '') {
      throw new Error(`TikTok rechazó la revocación (${payload.error})`);
    }
  }

  private async tokenRequest(fields: Record<string, string>): Promise<unknown> {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        ...fields,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : '';
      const description =
        isRecord(payload) && typeof payload.error_description === 'string'
          ? redactSecrets(payload.error_description).slice(0, 250)
          : `HTTP ${response.status}`;
      if (code) throw new TikTokOAuthError(code, `TikTok rechazó la solicitud de token: ${description}`);
      throw new Error(`TikTok rechazó la solicitud de token: ${description}`);
    }
    return payload;
  }
}
