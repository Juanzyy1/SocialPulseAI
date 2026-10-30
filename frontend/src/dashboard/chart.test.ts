import { describe, expect, it } from 'vitest';
import type { DailyPoint } from '../api/types';
import {
  buildDaySeries,
  describeDay,
  describeSeries,
  eachDay,
  labelIndexes,
  layoutBars,
  yScale,
} from './chart';
import type { ChartGeometry } from './chart';

describe('eachDay', () => {
  it('lista los días de un rango, ambos extremos incluidos', () => {
    expect(eachDay('2026-10-17', '2026-10-19')).toEqual(['2026-10-17', '2026-10-18', '2026-10-19']);
    expect(eachDay('2026-10-19', '2026-10-19')).toEqual(['2026-10-19']);
  });

  it('cruza fin de mes y de año, y respeta el 29 de febrero', () => {
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(eachDay('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
    expect(eachDay('2026-12-31', '2027-01-01')).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('un rango invertido, inválido o enorme da una lista vacía', () => {
    expect(eachDay('2026-10-19', '2026-10-17')).toEqual([]);
    expect(eachDay('no-es-fecha', '2026-10-17')).toEqual([]);
    expect(eachDay('2020-01-01', '2026-01-01')).toEqual([]);
  });
});

describe('buildDaySeries', () => {
  const period = { start: '2026-10-17', end: '2026-10-20' };
  const daily: DailyPoint[] = [
    { date: '2026-10-18', values: { views: 3, likes: 1 } },
    { date: '2026-10-19', values: { views: 0 } },
    { date: '2026-10-20', values: { likes: 5 } },
  ];

  it('cubre todos los días del periodo y deja los días sin dato en null', () => {
    expect(buildDaySeries(period, daily, 'views')).toEqual([
      { date: '2026-10-17', value: null },
      { date: '2026-10-18', value: 3 },
      { date: '2026-10-19', value: 0 },
      { date: '2026-10-20', value: null },
    ]);
  });

  it('un cero real se conserva como 0 y no se confunde con la falta de dato', () => {
    const [, , zero, missing] = buildDaySeries(period, daily, 'views');

    expect(zero?.value).toBe(0);
    expect(missing?.value).toBeNull();
  });

  it('un día que existe pero no trae esa métrica queda en null', () => {
    expect(buildDaySeries(period, daily, 'likes').map((day) => day.value)).toEqual([null, 1, null, 5]);
  });

  it('sin serie diaria, todo el periodo queda sin dato', () => {
    expect(buildDaySeries(period, [], 'views').every((day) => day.value === null)).toBe(true);
  });
});

describe('yScale', () => {
  it.each([
    [0, 1, [0, 1]],
    [-5, 1, [0, 1]],
    [Number.NaN, 1, [0, 1]],
    [3, 3, [0, 1, 2, 3]],
    [4, 4, [0, 1, 2, 3, 4]],
    [2.2, 3, [0, 1, 2, 3]],
    [5, 8, [0, 2, 4, 6, 8]],
    [8, 8, [0, 2, 4, 6, 8]],
    [9, 12, [0, 3, 6, 9, 12]],
    [100, 100, [0, 25, 50, 75, 100]],
    [1234, 1600, [0, 400, 800, 1200, 1600]],
  ])('el máximo de datos %d da un eje hasta %d', (dataMax, top, ticks) => {
    expect(yScale(dataMax)).toEqual({ max: top, ticks });
  });

  it('siempre cubre el máximo, con cinco marcas enteras y crecientes', () => {
    for (let dataMax = 5; dataMax <= 5000; dataMax += 7) {
      const { max, ticks } = yScale(dataMax);

      expect(max).toBeGreaterThanOrEqual(dataMax);
      expect(ticks).toHaveLength(5);
      expect(ticks[0]).toBe(0);
      expect(ticks[4]).toBe(max);
      expect(ticks.every((tick, index) => Number.isInteger(tick) && (index === 0 || tick > ticks[index - 1]!))).toBe(
        true,
      );
    }
  });
});

describe('layoutBars', () => {
  // Área de dibujo de 100 x 80, con la base en y = 80.
  const geometry: ChartGeometry = { width: 120, height: 100, left: 20, right: 0, top: 0, bottom: 20 };

  it('una barra con dato mide en proporción al máximo y se apoya en la base', () => {
    const [full, half] = layoutBars(
      [
        { date: 'a', value: 4 },
        { date: 'b', value: 2 },
      ],
      geometry,
      4,
    );

    expect(full).toMatchObject({ kind: 'data', y: 0, height: 80 });
    expect(half).toMatchObject({ kind: 'data', y: 40, height: 40 });
  });

  it('distingue un cero real (línea fina) de un día sin dato (contorno punteado)', () => {
    const [zero, gap] = layoutBars(
      [
        { date: 'a', value: 0 },
        { date: 'b', value: null },
      ],
      geometry,
      4,
    );

    expect(zero).toMatchObject({ kind: 'zero', height: 2, y: 78 });
    expect(gap).toMatchObject({ kind: 'gap', height: 10, y: 70 });
  });

  it('reparte los días a lo ancho, con la barra centrada en su casilla', () => {
    const bars = layoutBars(
      [0, 1, 2, 3].map((index) => ({ date: String(index), value: 1 })),
      geometry,
      4,
    );

    // Casilla de 25, barra de 17,5: 20 + índice × 25 + 3,75.
    expect(bars.map((bar) => bar.x)).toEqual([23.75, 48.75, 73.75, 98.75]);
    expect(bars.every((bar) => bar.width === 17.5)).toBe(true);
  });

  it('una barra diminuta mide al menos 2 y una que excede el eje se recorta', () => {
    const [tiny, huge] = layoutBars(
      [
        { date: 'a', value: 0.01 },
        { date: 'b', value: 999 },
      ],
      geometry,
      1000,
    );

    expect(tiny?.height).toBe(2);
    expect(huge?.height).toBeLessThanOrEqual(80);
    expect(
      layoutBars([{ date: 'a', value: 9 }], geometry, 4)[0]?.height,
    ).toBe(80);
  });

  it('sin días, sin área de dibujo o sin máximo válido no hay barras', () => {
    expect(layoutBars([], geometry, 4)).toEqual([]);
    expect(layoutBars([{ date: 'a', value: 1 }], { ...geometry, width: 10 }, 4)).toEqual([]);
    expect(layoutBars([{ date: 'a', value: 1 }], geometry, 0)).toEqual([]);
  });
});

describe('labelIndexes', () => {
  it('con pocos días etiqueta todos', () => {
    expect(labelIndexes(0)).toEqual([]);
    expect(labelIndexes(1)).toEqual([0]);
    expect(labelIndexes(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('con más días etiqueta el primero, el último y dos intermedios', () => {
    expect(labelIndexes(8)).toEqual([0, 2, 5, 7]);
    expect(labelIndexes(30)).toEqual([0, 10, 19, 29]);
    expect(labelIndexes(90)).toEqual([0, 30, 59, 89]);
  });

  it('siempre devuelve índices distintos, crecientes y dentro del rango', () => {
    for (let count = 8; count <= 400; count++) {
      const indexes = labelIndexes(count);

      expect(new Set(indexes).size).toBe(indexes.length);
      expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
      expect(indexes[0]).toBe(0);
      expect(indexes.at(-1)).toBe(count - 1);
    }
  });
});

describe('describeDay y describeSeries', () => {
  it('describe un día con dato, con cero y sin dato', () => {
    expect(describeDay({ date: '2026-10-18', value: 3 }, 'Vistas', 'count')).toBe('18 oct 2026: 3 vistas');
    expect(describeDay({ date: '2026-10-19', value: 0 }, 'Vistas', 'count')).toBe('19 oct 2026: 0 vistas');
    expect(describeDay({ date: '2026-10-20', value: null }, 'Vistas', 'count')).toBe(
      '20 oct 2026: sin dato',
    );
  });

  it('resume la serie con total, días en cero y días sin dato', () => {
    const days = [
      { date: '2026-10-17', value: 3 },
      { date: '2026-10-18', value: 0 },
      { date: '2026-10-19', value: null },
    ];

    expect(describeSeries(days, 'Vistas', 'count')).toBe(
      'Vistas por día, 17 oct 2026 – 19 oct 2026. Total: 3. 1 día en cero, 1 día sin dato.',
    );
  });

  it('usa el plural cuando corresponde y avisa si no hay días', () => {
    const days = [
      { date: '2026-10-17', value: 0 },
      { date: '2026-10-18', value: 0 },
      { date: '2026-10-19', value: 5 },
    ];

    expect(describeSeries(days, 'Vistas', 'count')).toContain('2 días en cero, 0 días sin dato');
    expect(describeSeries([], 'Vistas', 'count')).toBe('Vistas por día: sin datos.');
  });
});