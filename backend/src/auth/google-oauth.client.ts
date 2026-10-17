import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/** Abstracción del cliente de Google: las pruebas la sustituyen por una simulada. */
export abstract class GoogleOAuthClient {
  abstract enabled: boolean;
  abstract buildAuthUrl(params: {
    state: string;
    nonce: string;
    codeChallenge: string;
  }): string;
  /** Intercambia el código y devuelve la identidad ya verificada. Lanza si algo falla. */
  abstract exchangeCode(
    code: string,
    codeVerifier: string,
    expectedNonce: string,
  ): Promise<GoogleIdentity>;
}

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

@Injectable()
export class GoogleOAuthClientImpl extends GoogleOAuthClient {
  readonly enabled: boolean;
  private readonly clientId: string;
  private readonly redirectUri: string;
  private readonly client: OAuth2Client | null;

  constructor(config: ConfigService) {
    super();
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    this.redirectUri = config.get<string>('GOOGLE_REDIRECT_URI') ?? '';
    this.enabled = Boolean(this.clientId && clientSecret && this.redirectUri);
    this.client = this.enabled
      ? new OAuth2Client({
          clientId: this.clientId,
          clientSecret,
          redirectUri: this.redirectUri,
        })
      : null;
  }

  buildAuthUrl(params: { state: string; nonce: string; codeChallenge: string }): string {
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      // Solo lo necesario para identificar al usuario. Nada de YouTube aquí.
      scope: 'openid email profile',
      state: params.state,
      nonce: params.nonce,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `${AUTH_ENDPOINT}?${query.toString()}`;
  }

  async exchangeCode(
    code: string,
    codeVerifier: string,
    expectedNonce: string,
  ): Promise<GoogleIdentity> {
    if (!this.client) throw new Error('Google OAuth no está configurado');

    const { tokens } = await this.client.getToken({ code, codeVerifier });
    if (!tokens.id_token) throw new Error('Google no devolvió id_token');

    // Verifica la firma, la caducidad y que el token fue emitido para NUESTRO cliente.
    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new Error('Token sin sub o email');
    if (payload.nonce !== expectedNonce) throw new Error('El nonce no coincide');

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name,
      picture: payload.picture,
    };
  }
}