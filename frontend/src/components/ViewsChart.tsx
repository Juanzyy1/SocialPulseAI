import type { MetricUnit } from '../api/types';
import {
  describeDay,
  describeSeries,
  labelIndexes,
  layoutBars,
  yScale,
} from '../dashboard/chart';
import type { ChartDay } from '../dashboard/chart';
import { formatDate, formatMetricValue } from '../dashboard/format';

const GEOMETRY = { width: 720, height: 240, left: 48, right: 12, top: 12, bottom: 28 } as const;

interface ViewsChartProps {
  days: readonly ChartDay[];
  label: string;
  unit: MetricUnit;
}

/**
 * Barras por día dibujadas en SVG. Tres casos distintos, con leyenda: día con dato (barra), día en
 * cero (línea fina: es un dato real) y día sin dato (contorno punteado: no es lo mismo que cero).
 */
export function ViewsChart({ days, label, unit }: ViewsChartProps) {
  const dataMax = days.reduce((max, day) => Math.max(max, day.value ?? 0), 0);
  const scale = yScale(dataMax);
  const bars = layoutBars(days, GEOMETRY, scale.max);
  const plotBottom = GEOMETRY.height - GEOMETRY.bottom;
  const plotHeight = plotBottom - GEOMETRY.top;
  const summary = describeSeries(days, label, unit);
  const lowerLabel = label.toLowerCase();
  const labelled = labelIndexes(days.length);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${GEOMETRY.width} ${GEOMETRY.height}`}
        role="img"
        aria-label={summary}
        className="w-full"
      >
        {scale.ticks.map((tick) => {
          const y = plotBottom - (tick / scale.max) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={GEOMETRY.left}
                x2={GEOMETRY.width - GEOMETRY.right}
                y1={y}
                y2={y}
                stroke="var(--color-panel-line)"
              />
              <text
                x={GEOMETRY.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill="var(--color-panel-muted)"
              >
                {formatMetricValue(tick, unit)}
              </text>
            </g>
          );
        })}

        {bars.map((bar) => (
          <g key={bar.date}>
            <title>{describeDay(bar, label, unit)}</title>
            {bar.kind === 'gap' ? (
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                fill="none"
                stroke="var(--color-panel-muted)"
                strokeDasharray="2 2"
              />
            ) : (
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                fill={bar.kind === 'zero' ? 'var(--color-panel-muted)' : 'var(--color-chart-1)'}
              />
            )}
          </g>
        ))}

        {labelled.map((index) => {
          const bar = bars[index];
          const day = days[index];
          if (!bar || !day) return null;
          const anchor = index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle';
          const x = anchor === 'start' ? bar.x : anchor === 'end' ? bar.x + bar.width : bar.x + bar.width / 2;
          return (
            <text
              key={day.date}
              x={x}
              y={GEOMETRY.height - 8}
              textAnchor={anchor}
              fontSize="11"
              fill="var(--color-panel-muted)"
            >
              {formatDate(day.date)}
            </text>
          );
        })}
      </svg>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-panel-muted">
        <li>
          <span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-chart-1" />
          Día con {lowerLabel}
        </li>
        <li>
          <span aria-hidden="true" className="mr-1.5 inline-block h-1 w-2.5 bg-panel-muted" />
          Día en cero (dato real)
        </li>
        <li>
          <span
            aria-hidden="true"
            className="mr-1.5 inline-block h-2.5 w-2.5 border border-dashed border-panel-muted"
          />
          Día sin dato
        </li>
      </ul>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-panel-muted hover:text-panel-text">
          Ver los datos en una tabla
        </summary>
        <div
          tabIndex={0}
          aria-label="Tabla de datos por día, con desplazamiento"
          className="mt-2 max-h-64 overflow-auto rounded-lg border border-panel-line"
        >
          <table className="w-full text-left">
            <caption className="sr-only">{summary}</caption>
            <thead className="sticky top-0 bg-panel-card text-panel-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Fecha
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {label}
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date} className="border-t border-panel-line">
                  <td className="px-3 py-1.5">{formatDate(day.date)}</td>
                  <td className="px-3 py-1.5">
                    {day.value === null ? 'Sin dato' : formatMetricValue(day.value, unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}