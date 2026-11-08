import { useId } from 'react';
import type { DeltaKind, DeltaTone, MetricCardModel } from '../dashboard/cards';
import type { ChartDay } from '../dashboard/chart';
import { AnimatedMetricValue } from './AnimatedMetricValue';

const TONE_CLASS: Record<DeltaTone, string> = {
  good: 'bg-emerald-500/15 text-emerald-300',
  bad: 'bg-red-500/15 text-red-300',
  neutral: 'bg-slate-500/20 text-panel-muted',
};

// La dirección también se comunica con un símbolo y con texto: el color nunca es la única señal.
const ARROW: Record<DeltaKind, string> = { up: '▲', down: '▼', flat: '■', none: '' };
const SPOKEN: Record<DeltaKind, string> = { up: 'Aumentó: ', down: 'Disminuyó: ', flat: '', none: '' };
const ACCENTS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const;

function Sparkline({ days, color }: { days: readonly ChartDay[]; color: string }) {
  const gradientId = `sparkline-${useId().replaceAll(':', '')}`;
  const values = days.flatMap((day, index) =>
    day.value === null ? [] : [{ x: index, value: day.value }],
  );
  if (values.length < 2) return null;

  const min = Math.min(...values.map(({ value }) => value));
  const max = Math.max(...values.map(({ value }) => value));
  const spread = max - min || 1;
  const pointX = (index: number) => 4 + (index / Math.max(1, days.length - 1)) * 112;
  const pointY = (value: number) => 34 - ((value - min) / spread) * 28;
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let segment: Array<{ x: number; y: number }> = [];

  days.forEach((day, index) => {
    if (day.value === null) {
      if (segment.length) segments.push(segment);
      segment = [];
      return;
    }
    segment.push({ x: pointX(index), y: pointY(day.value) });
  });
  if (segment.length) segments.push(segment);
  const last = values[values.length - 1];
  if (!last) return null;

  return (
    <svg
      aria-hidden="true"
      data-testid="metric-sparkline"
      viewBox="0 0 120 40"
      className="h-10 w-24 shrink-0 overflow-visible sm:w-28"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {segments.map((points, index) => {
        if (points.length < 2) return null;
        const first = points[0];
        const end = points[points.length - 1];
        if (!first || !end) return null;
        const line = points.map(({ x, y }) => `${x},${y}`).join(' ');
        return (
          <g key={index}>
            <path
              d={`M ${line.replaceAll(',', ' ')} L ${end.x} 38 L ${first.x} 38 Z`}
              fill={`url(#${gradientId})`}
            />
            <polyline
              points={line}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      <circle
        cx={pointX(last.x)}
        cy={pointY(last.value)}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

export function MetricCard({
  card,
  series = [],
  accentIndex = 0,
}: {
  card: MetricCardModel;
  series?: readonly ChartDay[];
  accentIndex?: number;
}) {
  const { delta } = card;
  const accent = ACCENTS[accentIndex % ACCENTS.length] ?? ACCENTS[0];

  return (
    <article className="relative min-w-0 overflow-hidden bg-panel-card px-4 py-5 sm:px-5 sm:py-6">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: accent, boxShadow: `0 0 12px ${accent}` }} />
        <h3 className="truncate text-xs font-medium uppercase tracking-[0.12em] text-panel-muted">{card.label}</h3>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className={`min-w-0 truncate text-3xl font-semibold tracking-tight sm:text-4xl ${card.hasValue ? '' : 'text-panel-muted'}`}>
          <AnimatedMetricValue value={card.value} unit={card.unit} finalText={card.valueText} />
        </p>
        {card.hasValue && <Sparkline days={series} color={accent} />}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-medium ${TONE_CLASS[delta.tone]}`}>
          <span aria-hidden="true">{ARROW[delta.kind]} </span>
          <span className="sr-only">{SPOKEN[delta.kind]}</span>
          {delta.changeText}
          {delta.percentText && ` (${delta.percentText})`}
        </span>
        {delta.previousText && <span className="text-panel-muted">{delta.previousText}</span>}
      </div>
      {delta.reason && <p className="mt-2 text-xs leading-relaxed text-panel-muted">{delta.reason}</p>}
      {card.note && <p className="mt-2 text-xs leading-relaxed text-panel-muted">{card.note}</p>}
    </article>
  );
}