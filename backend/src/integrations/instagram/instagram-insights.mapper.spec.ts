import { SyncRange } from '../../sync/sync-range';
import { parseDailyReach } from './instagram-insights.mapper';

const range: SyncRange = {
  start: '2026-03-01',
  end: '2026-03-31',
  kind: 'initial',
};

describe('parseDailyReach', () => {
  it('conserva ceros reales, omite valores ausentes y asigna las fechas al Pacífico', () => {
    const result = parseDailyReach(
      {
        data: [
          {
            name: 'reach',
            period: 'day',
            values: [
              { value: 0, end_time: '2026-03-08T12:00:00+0000' },
              { value: 12, end_time: '2026-03-09T12:00:00+0000' },
              { value: null, end_time: '2026-03-10T12:00:00+0000' },
            ],
          },
        ],
      },
      range,
    );

    expect(result).toEqual([
      { date: '2026-03-08', metric: 'reach', value: 0 },
      { date: '2026-03-09', metric: 'reach', value: 12 },
    ]);
  });

  it('trata una respuesta sin datos como ausencia, no como ceros', () => {
    expect(parseDailyReach({ data: [] }, range)).toEqual([]);
  });

  it('ignora valores fuera del rango solicitado', () => {
    expect(
      parseDailyReach(
        {
          data: [
            {
              name: 'reach',
              period: 'day',
              values: [{ value: 12, end_time: '2026-04-01T12:00:00Z' }],
            },
          ],
        },
        range,
      ),
    ).toEqual([]);
  });

  it.each([
    null,
    {},
    { data: [{ name: 'reach', period: 'day', values: [{ value: -1, end_time: '2026-03-08T12:00:00Z' }] }] },
    { data: [{ name: 'reach', period: 'day', values: [{ value: 1, end_time: 'no-es-fecha' }] }] },
    { data: [{ name: 'reach', period: 'lifetime', values: [] }] },
    { data: [{ name: 'likes', period: 'day', values: [] }] },
  ])('rechaza respuestas inesperadas sin producir métricas', (response) => {
    expect(() => parseDailyReach(response, range)).toThrow();
  });

  it('rechaza fechas duplicadas para no sobrescribir valores silenciosamente', () => {
    expect(() =>
      parseDailyReach(
        {
          data: [
            {
              name: 'reach',
              period: 'day',
              values: [
                { value: 1, end_time: '2026-03-08T12:00:00+0000' },
                { value: 2, end_time: '2026-03-08T13:00:00+0000' },
              ],
            },
          ],
        },
        range,
      ),
    ).toThrow('más de un valor');
  });
});
