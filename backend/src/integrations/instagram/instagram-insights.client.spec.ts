import { InstagramInsightsClientImpl } from './instagram-insights.client';

describe('InstagramInsightsClientImpl', () => {
  afterEach(() => jest.restoreAllMocks());

  it('solicita solo reach diario como serie temporal y cubre los días del Pacífico', async () => {
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    const client = new InstagramInsightsClientImpl();

    await expect(
      client.fetchDailyReach('business-token', '17841400000000000', {
        start: '2026-01-01',
        end: '2026-01-31',
        kind: 'initial',
      }),
    ).resolves.toEqual({ data: [] });

    const [requestUrl, options] = fetch.mock.calls[0];
    const url = new URL(String(requestUrl));
    expect(url.origin + url.pathname).toBe(
      'https://graph.facebook.com/v27.0/17841400000000000/insights',
    );
    expect(url.searchParams.get('metric')).toBe('reach');
    expect(url.searchParams.get('period')).toBe('day');
    expect(url.searchParams.get('metric_type')).toBe('time_series');
    expect(new Date(Number(url.searchParams.get('since')) * 1000).toISOString()).toBe(
      '2026-01-01T08:00:00.000Z',
    );
    expect(new Date(Number(url.searchParams.get('until')) * 1000).toISOString()).toBe(
      '2026-02-01T08:00:00.000Z',
    );
    expect(url.searchParams.get('access_token')).toBe('business-token');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('rechaza los errores HTTP sin exponer el token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('', { status: 403 }));
    const client = new InstagramInsightsClientImpl();

    await expect(
      client.fetchDailyReach('private-token', 'instagram-id', {
        start: '2026-01-01',
        end: '2026-01-01',
        kind: 'initial',
      }),
    ).rejects.toThrow('403');
  });

  it('ajusta los límites al cambio de horario del Pacífico', async () => {
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    const client = new InstagramInsightsClientImpl();

    await client.fetchDailyReach('business-token', 'instagram-id', {
      start: '2026-03-07',
      end: '2026-03-08',
      kind: 'initial',
    });

    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(new Date(Number(url.searchParams.get('since')) * 1000).toISOString()).toBe(
      '2026-03-07T08:00:00.000Z',
    );
    expect(new Date(Number(url.searchParams.get('until')) * 1000).toISOString()).toBe(
      '2026-03-09T07:00:00.000Z',
    );
  });
});
