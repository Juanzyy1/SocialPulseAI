import { Link } from 'react-router';
import type { SocialAccount } from '../api/types';
import { accountLabel, accountStatusNotice, platformLabel } from '../dashboard/account-params';
import { buildMetricCards, buildTotals } from '../dashboard/cards';
import { buildDaySeries } from '../dashboard/chart';
import { formatDateRange } from '../dashboard/format';
import type { PeriodSelection } from '../dashboard/period-selection';
import { useAccountAnalytics, useCatalog, useComparison } from '../dashboard/queries';
import { FreshnessNotice } from './FreshnessNotice';
import { LoadError } from './LoadError';
import { MetricCard } from './MetricCard';
import { ViewsChart } from './ViewsChart';

export function AccountPanel({
  account,
  selection,
}: {
  account: SocialAccount;
  selection: PeriodSelection;
}) {
  const catalog = useCatalog();
  const comparison = useComparison(account.id, selection);
  const analytics = useAccountAnalytics(account.id, selection);

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
  const hasData = data.current !== null && data.current.coverage.daysWithData > 0;

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

      {data.current === null || !hasData ? (
        <div className="rounded-xl border border-panel-line bg-panel-card p-6">
          <p className="text-panel-muted">
            {data.current === null
              ? 'Todavía no hay métricas guardadas para esta cuenta. Se mostrarán aquí después de sincronizarla.'
              : `No hay datos guardados para ${formatDateRange(data.current.period.start, data.current.period.end)}. Prueba con otro periodo o sincroniza la cuenta.`}
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