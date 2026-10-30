import { Link } from 'react-router';
import type { SocialAccount } from '../api/types';
import { accountLabel, accountStatusNotice, platformLabel } from '../dashboard/account-params';
import { buildMetricCards, buildTotals } from '../dashboard/cards';
import { buildDaySeries } from '../dashboard/chart';
import { describeLoadError } from '../dashboard/errors';
import { formatDateRange } from '../dashboard/format';
import type { PeriodPreset } from '../dashboard/period-params';
import { useAccountAnalytics, useCatalog, useComparison } from '../dashboard/queries';
import { FreshnessNotice } from './FreshnessNotice';
import { MetricCard } from './MetricCard';
import { ViewsChart } from './ViewsChart';

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-5 text-sm">
      <p className="text-red-200">{describeLoadError(error)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-panel-line px-3 py-1.5 text-panel-text hover:bg-panel-line"
      >
        Reintentar
      </button>
    </div>
  );
}

export function AccountPanel({ account, period }: { account: SocialAccount; period: PeriodPreset }) {
  const catalog = useCatalog();
  const comparison = useComparison(account.id, period);
  const analytics = useAccountAnalytics(account.id, period);

  if (comparison.isPending || catalog.isPending) {
    return (
      <p aria-busy="true" className="text-panel-muted">
        Cargando métricas…
      </p>
    );
  }
  if (comparison.isError || catalog.isError) {
    return (
      <LoadError
        error={comparison.error ?? catalog.error}
        onRetry={() => {
          if (comparison.isError) void comparison.refetch();
          if (catalog.isError) void catalog.refetch();
        }}
      />
    );
  }

  const data = comparison.data;
  const definitions = catalog.data.platforms.find((p) => p.platform === account.platform)?.metrics ?? [];
  const cards = buildMetricCards(definitions, data);
  const totals = analytics.data ? buildTotals(definitions, analytics.data.totals) : [];
  const notice = accountStatusNotice(account.status);

  const views = definitions.find((definition) => definition.code === 'views');
  const viewsLabel = views?.label ?? 'Vistas';
  const series = analytics.data?.period
    ? buildDaySeries(analytics.data.period, analytics.data.daily ?? [], 'views')
    : [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-panel-muted">
        Cuenta: <strong className="text-panel-text">{accountLabel(account)}</strong> ·{' '}
        {platformLabel(account.platform)}
      </p>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
        >
          {notice}{' '}
          <Link to="/cuentas" className="underline">
            Ir a Cuentas
          </Link>
        </div>
      )}

      <FreshnessNotice
        dataThrough={data.dataThrough}
        daysBehind={data.daysBehind}
        coverage={data.current?.coverage ?? null}
        lastSyncedAt={account.lastSyncedAt}
      />

      {data.current === null ? (
        <div className="rounded-xl border border-panel-line bg-panel-card p-6">
          <p className="text-panel-muted">
            Todavía no hay métricas guardadas para esta cuenta. Se mostrarán aquí después de sincronizarla.
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="metricas-title">
            <h2 id="metricas-title" className="mb-1 text-lg font-semibold">
              Métricas del periodo
            </h2>
            <p className="mb-4 text-sm text-panel-muted">
              {formatDateRange(data.current.period.start, data.current.period.end)}
              {data.previous &&
                ` · comparado con ${formatDateRange(data.previous.period.start, data.previous.period.end)}`}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <MetricCard key={card.code} card={card} />
              ))}
            </div>
          </section>

          <section
            aria-labelledby="grafico-title"
            className="rounded-xl border border-panel-line bg-panel-card p-5"
          >
            <h2 id="grafico-title" className="mb-4 text-lg font-semibold">
              {viewsLabel} por día
            </h2>
            {analytics.isPending && (
              <p aria-busy="true" className="text-panel-muted">
                Cargando gráfico…
              </p>
            )}
            {analytics.isError && (
              <LoadError error={analytics.error} onRetry={() => void analytics.refetch()} />
            )}
            {analytics.data && series.length > 0 && (
              <ViewsChart days={series} label={viewsLabel} unit={views?.unit ?? 'count'} />
            )}
          </section>
        </>
      )}

      {totals.length > 0 && (
        <section aria-labelledby="totales-title">
          <h2 id="totales-title" className="mb-1 text-lg font-semibold">
            Totales del canal
          </h2>
          <p className="mb-4 text-sm text-panel-muted">
            Valores más recientes capturados; no dependen del periodo elegido.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {totals.map((total) => (
              <article
                key={total.code}
                className="rounded-xl border border-panel-line bg-panel-card p-5"
              >
                <h3 className="text-sm text-panel-muted">{total.label}</h3>
                <p className="mt-2 text-2xl font-semibold">{total.valueText}</p>
                <p className="mt-2 text-xs text-panel-muted">al {total.capturedOn}</p>
                {total.note && <p className="mt-1 text-xs text-panel-muted">{total.note}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}