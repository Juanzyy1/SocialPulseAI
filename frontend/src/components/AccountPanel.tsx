import { Link } from 'react-router';
import type { SocialAccount } from '../api/types';
import { accountStatusNotice } from '../dashboard/account-params';
import { buildMetricCards, buildTotals } from '../dashboard/cards';
import { buildDaySeries } from '../dashboard/chart';
import { formatDateRange } from '../dashboard/format';
import type { PeriodSelection } from '../dashboard/period-selection';
import { useAccountAnalytics, useCatalog, useComparison } from '../dashboard/queries';
import { FreshnessNotice } from './FreshnessNotice';
import { LoadError } from './LoadError';
import { MetricCard } from './MetricCard';
import { ViewsChart } from './ViewsChart';
import { AnimatedMetricValue } from './AnimatedMetricValue';

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
  const snapshotOnly = definitions.length > 0 && definitions.every((definition) => definition.kind === 'snapshot');

  const chartMetric = definitions.find((definition) => definition.kind !== 'snapshot');
  const series = chartMetric && analytics.data?.period
    ? buildDaySeries(analytics.data.period, analytics.data.daily ?? [], chartMetric.code)
    : [];

  return (
    <div className="space-y-6">
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

      {snapshotOnly ? (
        <section aria-labelledby="perfil-title">
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-chart-1">Métricas acumuladas</p>
            <h2 id="perfil-title" className="mt-1 text-lg font-semibold">Resumen del perfil</h2>
            <p className="mt-1 text-sm text-panel-muted">
              Totales capturados al sincronizar; no representan actividad diaria ni cambian con el periodo seleccionado.
            </p>
          </div>
          {analytics.isPending && (
            <p aria-busy="true" className="text-panel-muted">Cargando totales del perfil…</p>
          )}
          {analytics.isError && (
            <LoadError error={analytics.error} onRetry={() => void analytics.refetch()} />
          )}
          {totals.length > 0 && (
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-panel-line bg-panel-line sm:grid-cols-2 xl:grid-cols-3">
              {totals.map((total, index) => (
                <article key={total.code} className="bg-panel-card px-4 py-5 sm:px-5 sm:py-6">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: [
                          'var(--color-chart-1)',
                          'var(--color-chart-2)',
                          'var(--color-chart-3)',
                          'var(--color-chart-4)',
                          'var(--color-chart-5)',
                        ][index % 5],
                      }}
                    />
                    <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-panel-muted">{total.label}</h3>
                  </div>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">
                    <AnimatedMetricValue
                      value={total.value}
                      unit={definitions.find((definition) => definition.code === total.code)?.unit ?? 'count'}
                      finalText={total.valueText}
                    />
                  </p>
                  <p className="mt-2 text-xs text-panel-muted">Capturado el {total.capturedOn}</p>
                  {total.note && <p className="mt-2 text-xs leading-relaxed text-panel-muted">{total.note}</p>}
                </article>
              ))}
            </div>
          )}
          {!analytics.isPending && !analytics.isError && totals.length === 0 && (
            <div className="rounded-2xl border border-panel-line bg-panel-card p-5 text-sm text-panel-muted">
              Aún no hay totales guardados. Sincroniza la cuenta desde Cuentas para capturar las métricas del perfil.
            </div>
          )}
        </section>
      ) : (
        <>
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
                  ? totals.length > 0
                    ? 'Esta plataforma no ofrece métricas diarias; los totales capturados aparecen abajo.'
                    : 'Todavía no hay métricas guardadas para esta cuenta. Se mostrarán aquí después de sincronizarla.'
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
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-panel-line bg-panel-line sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card, index) => {
                const metric = definitions.find((definition) => definition.code === card.code);
                const sparkline = metric && metric.kind !== 'snapshot' && analytics.data?.period
                  ? buildDaySeries(
                      analytics.data.period,
                      analytics.data.daily ?? [],
                      metric.code,
                    )
                  : [];
                return (
                  <MetricCard
                    key={card.code}
                    card={card}
                    series={sparkline}
                    accentIndex={index}
                  />
                );
              })}
            </div>
          </section>

          {chartMetric && (
            <section
              aria-labelledby="grafico-title"
              className="rounded-2xl border border-panel-line bg-panel-card p-5 sm:p-6"
            >
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-chart-1">Actividad</p>
                  <h2 id="grafico-title" className="mt-1 text-lg font-semibold">
                    {chartMetric.label} por día
                  </h2>
                </div>
                <p className="text-xs text-panel-muted">
                  {formatDateRange(data.current.period.start, data.current.period.end)}
                </p>
              </div>
              {analytics.isPending && (
                <p aria-busy="true" className="text-panel-muted">
                  Cargando gráfico…
                </p>
              )}
              {analytics.isError && (
                <LoadError error={analytics.error} onRetry={() => void analytics.refetch()} />
              )}
              {analytics.data && series.length > 0 && (
                <ViewsChart days={series} label={chartMetric.label} unit={chartMetric.unit} />
              )}
            </section>
          )}
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
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-panel-line bg-panel-line sm:grid-cols-3">
            {totals.map((total) => (
              <article
                key={total.code}
                className="bg-panel-card px-4 py-5 sm:px-5 sm:py-6"
              >
                <h3 className="text-sm text-panel-muted">{total.label}</h3>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  <AnimatedMetricValue
                    value={total.value}
                    unit={definitions.find((definition) => definition.code === total.code)?.unit ?? 'count'}
                    finalText={total.valueText}
                  />
                </p>
                <p className="mt-2 text-xs text-panel-muted">al {total.capturedOn}</p>
                {total.note && <p className="mt-1 text-xs text-panel-muted">{total.note}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
        </>
      )}
    </div>
  );
}