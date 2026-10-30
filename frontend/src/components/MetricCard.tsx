import type { DeltaKind, DeltaTone, MetricCardModel } from '../dashboard/cards';

const TONE_CLASS: Record<DeltaTone, string> = {
  good: 'bg-emerald-500/15 text-emerald-300',
  bad: 'bg-red-500/15 text-red-300',
  neutral: 'bg-slate-500/20 text-panel-muted',
};

// La dirección también se comunica con un símbolo y con texto: el color nunca es la única señal.
const ARROW: Record<DeltaKind, string> = { up: '▲', down: '▼', flat: '■', none: '' };
const SPOKEN: Record<DeltaKind, string> = { up: 'Aumentó: ', down: 'Disminuyó: ', flat: '', none: '' };

export function MetricCard({ card }: { card: MetricCardModel }) {
  const { delta } = card;

  return (
    <article className="rounded-xl border border-panel-line bg-panel-card p-5">
      <h3 className="text-sm text-panel-muted">{card.label}</h3>
      <p className={`mt-2 text-3xl font-semibold ${card.hasValue ? '' : 'text-panel-muted'}`}>
        {card.valueText}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-md px-2 py-0.5 ${TONE_CLASS[delta.tone]}`}>
          <span aria-hidden="true">{ARROW[delta.kind]} </span>
          <span className="sr-only">{SPOKEN[delta.kind]}</span>
          {delta.changeText}
          {delta.percentText && ` (${delta.percentText})`}
        </span>
        {delta.previousText && <span className="text-panel-muted">{delta.previousText}</span>}
      </div>
      {delta.reason && <p className="mt-2 text-xs text-panel-muted">{delta.reason}</p>}
      {card.note && <p className="mt-2 text-xs text-panel-muted">{card.note}</p>}
    </article>
  );
}