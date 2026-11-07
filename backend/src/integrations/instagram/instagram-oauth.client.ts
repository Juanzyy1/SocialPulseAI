import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const INSTAGRAM_SCOPES = ['instagram_basic', 'instagram_manage_insights'] as const;
export const INSTAGRAM_GRAPH_API_VERSION = 'v27.0';

export interface InstagramTokens {
  accessToken: string;
  expiresAt: Date | null;
}

export interface InstagramProfile {
  accountId: string;
  username: string;
}

export abstract class InstagramOAuthClient {
  abstract readonly enabled: boolean;
  abstract buildAuthUrl(state: string): string;
  abstract exchangeCode(code: string): Promise<InstagramTokens>;
  abstract fetchProfiles(accessToken: string): Promise<InstagramProfile[]>;
}

const AUTH_ENDPOINT = 'https://www.facebook.com/dialog/oauth';
const TOKEN_ENDPOINT = `https://graph.facebook.com/${INSTAGRAM_GRAPH_API_VERSION}/oauth/access_token`;
const ACCOUNTS_ENDPOINT = `https://graph.facebook.com/${INSTAGRAM_GRAPH_API_VERSION}/me/assigned_instagram_accounts`;
const REQUEST_TIMEOUT_MS = 10_000;

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireTokenResponse(value: unknown): TokenResponse {
  if (!isRecord(value) || typeof value.access_token !== 'string' || value.access_token.length === 0) {
    throw new Error('Meta devolvió una respuesta de token inválida');
  }
  if (
    value.expires_in !== undefined &&
    (typeof value.expires_in !== 'number' ||
      !Number.isFinite(value.expires_in) ||
      value.expires_in <= 0)
  ) {
    throw new Error('Meta devolvió una caducidad de token inválida');
  }
  return {
    access_token: value.access_token,
    ...(typeof value.expires_in === 'number' ? { expires_in: value.expires_in } : {}),
  };
}

function describeMetaError(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  const { message, code, error_subcode: subcode } = value.error;
  const parts: string[] = [];
  if (typeof message === 'string' && message.length > 0) parts.push(message.slice(0, 250));
  if (typeof code === 'number' || typeof code === 'string') parts.push(`código ${code}`);
  if (typeof subcode === 'number' || typeof subcode === 'string') {
    parts.push(`subcódigo ${subcode}`);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

@Injectable()
export class InstagramOAuthClientImpl extends InstagramOAuthClient {
  readonly enabled: boolean;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly configId: string;
  private readonly redirectUri: string;

  constructor(config: ConfigService) {
    super();
    this.clientId = config.get<string>('INSTAGRAM_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('INSTAGRAM_CLIENT_SECRET') ?? '';
    this.configId = config.get<string>('INSTAGRAM_CONFIG_ID') ?? '';
    this.redirectUri = config.get<string>('INSTAGRAM_REDIRECT_URI') ?? '';
    this.enabled = Boolean(this.clientId && this.clientSecret && this.configId && this.redirectUri);
  }

  buildAuthUrl(state: string): string {
    const query = new URLSearchParams({
      client_id: this.clientId,
      config_id: this.configId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
      display: 'popup',
      prompt: 'login',
    });
    return `${AUTH_ENDPOINT}?${query.toString()}`;
  }

  async exchangeCode(code: string): Promise<InstagramTokens> {
    const query = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code,
    });
    const response = await fetch(`${TOKEN_ENDPOINT}?${query.toString()}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const detail = describeMetaError(body);
      throw new Error(
        `Meta rechazó el código (${response.status})${detail ? `: ${detail}` : ''}`,
      );
    }

    const token = requireTokenResponse(await response.json());
    return {
      accessToken: token.access_token,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    };
  }

  async fetchProfiles(accessToken: string): Promise<InstagramProfile[]> {
    const query = new URLSearchParams({
      fields: 'id,username',
      access_token: accessToken,
    });
    const response = await fetch(`${ACCOUNTS_ENDPOINT}?${query.toString()}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Meta rechazó la consulta de cuentas de Instagram (${response.status})`);
    }

    const raw: unknown = await response.json();
    if (!isRecord(raw) || !Array.isArray(raw.data)) {
      throw new Error('Meta devolvió una lista de cuentas inválida');
    }
    const profiles: InstagramProfile[] = [];
    for (const entry of raw.data) {
      if (
        !isRecord(entry) ||
        (typeof entry.id !== 'string' && typeof entry.id !== 'number') ||
        typeof entry.username !== 'string' ||
        entry.username.length === 0
      ) {
        throw new Error('Meta devolvió una identidad de Instagram inválida');
      }
      profiles.push({ accountId: String(entry.id), username: entry.username });
    }
    return profiles;
  }
}
