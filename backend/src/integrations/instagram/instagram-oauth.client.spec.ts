import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { InstagramOAuthClientImpl } from './instagram-oauth.client';

const configValues: Record<string, string> = {
  INSTAGRAM_CLIENT_ID: 'instagram-app-id',
  INSTAGRAM_CLIENT_SECRET: 'instagram-app-secret',
  INSTAGRAM_CONFIG_ID: 'instagram-config-id',
  INSTAGRAM_REDIRECT_URI: 'https://socialpulse.example/api/v1/integrations/instagram/callback',
};

describe('InstagramOAuthClientImpl', () => {
  let client: InstagramOAuthClientImpl;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        InstagramOAuthClientImpl,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
      ],
    }).compile();
    client = moduleRef.get(InstagramOAuthClientImpl);
  });

  afterEach(() => jest.restoreAllMocks());

  it('genera la URL de inicio unificado con configuración y callback registrados', () => {
    const url = new URL(client.buildAuthUrl('estado-seguro'));
    expect(url.origin + url.pathname).toBe('https://www.facebook.com/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe(configValues.INSTAGRAM_CLIENT_ID);
    expect(url.searchParams.get('config_id')).toBe(configValues.INSTAGRAM_CONFIG_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(configValues.INSTAGRAM_REDIRECT_URI);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('estado-seguro');
    expect(url.searchParams.get('prompt')).toBe('login');
  });

  it('intercambia el código por un token del sistema de negocio de Meta', async () => {
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'business-token', token_type: 'bearer' })),
      );

    const result = await client.exchangeCode('authorization-code');

    expect(result).toEqual({ accessToken: 'business-token', expiresAt: null });
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(
      'https://graph.facebook.com/v27.0/oauth/access_token',
    );
    expect(url.searchParams.get('client_id')).toBe(configValues.INSTAGRAM_CLIENT_ID);
    expect(url.searchParams.get('client_secret')).toBe(configValues.INSTAGRAM_CLIENT_SECRET);
    expect(url.searchParams.get('code')).toBe('authorization-code');
  });

  it('rechaza respuestas de token sin caducidad válida', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'token', expires_in: -1 }), { status: 200 }),
    );
    await expect(client.exchangeCode('authorization-code')).rejects.toThrow('caducidad de token');
  });

  it('consulta y valida las cuentas profesionales compartidas', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: 'instagram-user-id', username: 'mi_marca' },
            { id: 'instagram-second-id', username: 'otra_marca' },
          ],
        }),
      ),
    );

    await expect(client.fetchProfiles('business-token')).resolves.toEqual([
      { accountId: 'instagram-user-id', username: 'mi_marca' },
      { accountId: 'instagram-second-id', username: 'otra_marca' },
    ]);
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toContain('fields=id%2Cusername');
    expect(String(url)).toContain('access_token=business-token');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
});
