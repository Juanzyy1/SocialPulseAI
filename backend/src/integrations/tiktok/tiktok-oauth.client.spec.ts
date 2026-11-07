import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TikTokOAuthClientImpl } from './tiktok-oauth.client';

const configValues: Record<string, string> = {
  TIKTOK_CLIENT_KEY: 'client-key',
  TIKTOK_CLIENT_SECRET: 'client-secret',
  TIKTOK_REDIRECT_URI: 'https://socialpulse.example/api/v1/integrations/tiktok/callback',
};

describe('TikTokOAuthClientImpl', () => {
  let client: TikTokOAuthClientImpl;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TikTokOAuthClientImpl,
        { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
      ],
    }).compile();
    client = moduleRef.get(TikTokOAuthClientImpl);
  });

  afterEach(() => jest.restoreAllMocks());

  it('genera Login Kit URL con los permisos mínimos y state anti-CSRF', () => {
    const url = new URL(client.buildAuthUrl('state-seguro'));
    expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(url.searchParams.get('client_key')).toBe(configValues.TIKTOK_CLIENT_KEY);
    expect(url.searchParams.get('scope')).toBe('user.info.basic,user.info.stats,video.list');
    expect(url.searchParams.get('redirect_uri')).toBe(configValues.TIKTOK_REDIRECT_URI);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-seguro');
  });

  it('canjea el código en servidor y conserva los dos vencimientos', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'access',
          refresh_token: 'refresh',
          open_id: 'open-id',
          scope: 'user.info.basic,user.info.stats,video.list',
          expires_in: 7200,
          refresh_expires_in: 15_552_000,
        }),
      ),
    );

    const result = await client.exchangeCode('authorization-code');
    const body = String(fetch.mock.calls[0][1]?.body);
    expect(result).toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
      openId: 'open-id',
      scopes: ['user.info.basic', 'user.info.stats', 'video.list'],
    });
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(result.refreshExpiresAt.getTime()).toBeGreaterThan(result.expiresAt.getTime());
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('redirect_uri=https%3A%2F%2Fsocialpulse.example%2Fapi%2Fv1%2Fintegrations%2Ftiktok%2Fcallback');
  });

  it('rota el refresh token y conserva los datos de usuario de la respuesta', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          open_id: 'open-id',
          scope: 'user.info.basic,user.info.stats,video.list',
          expires_in: 7200,
          refresh_expires_in: 15_552_000,
        }),
      ),
    );

    const result = await client.refreshToken('old-refresh');
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(String(fetch.mock.calls[0][1]?.body)).toContain('grant_type=refresh_token');
    expect(String(fetch.mock.calls[0][1]?.body)).toContain('refresh_token=old-refresh');
  });

  it('consulta las estadísticas del perfil y usa Bearer', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            user: {
              open_id: 'open-id',
              display_name: 'Creator',
              avatar_url: 'https://example.test/avatar.jpg',
              follower_count: 2,
              following_count: 4,
              likes_count: 8,
              video_count: 3,
            },
          },
          error: { code: 'ok', message: '' },
        }),
      ),
    );

    await expect(client.fetchProfile('access')).resolves.toEqual({
      openId: 'open-id',
      displayName: 'Creator',
      avatarUrl: 'https://example.test/avatar.jpg',
      followers: 2,
      following: 4,
      likes: 8,
      videos: 3,
    });
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toContain('fields=open_id%2Cavatar_url%2Cdisplay_name');
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer access' });
  });

  it('valida los contadores de hasta 20 videos públicos', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            videos: [
              { id: 'video-1', view_count: 10, like_count: 2, comment_count: 1, share_count: 3 },
              { id: 'video-2', view_count: 20, like_count: 4, comment_count: 2, share_count: 5 },
            ],
          },
          error: { code: 'ok', message: '' },
        }),
      ),
    );

    await expect(client.fetchRecentVideos('access')).resolves.toEqual([
      { views: 10, likes: 2, comments: 1, shares: 3 },
      { views: 20, likes: 4, comments: 2, shares: 5 },
    ]);
    expect(String(fetch.mock.calls[0][0])).toContain('fields=id%2Cview_count%2Clike_count');
    expect(fetch.mock.calls[0][1]?.body).toBe(JSON.stringify({ max_count: 20 }));
  });

  it('rechaza respuestas sin campos de token obligatorios', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'access', error: 'invalid_grant' })),
    );
    await expect(client.refreshToken('old-refresh')).rejects.toThrow('invalid_grant');
  });
});
