import { Link } from 'react-router';
import type { CatalogResponse, OverviewResponse } from '../api/types';
import { LoadError } from '../components/LoadError';
import { PeriodSelector } from '../components/PeriodSelector';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatDateRange } from '../dashboard/format';
import {
  accountDashboardLink,
  buildAccountRows,
  buildPlatformSections,
} from '../dashboard/overview';
import type { PeriodSelection } from '../dashboard/period-selection';
import { useCatalog, useOverview } from '../dashboard/queries';
import { useSelection } from '../dashboard/use-selection';

function OverviewContent({
  response,
  catalog,
  selection,
}: {
  response: OverviewResponse;
  catalog: CatalogResponse;
  selection: PeriodSelection;
}) {
  if (response.accounts.length === 0) {
    return (
      <div className="rounded-xl border border-panel-line bg-panel-card p-6">
        <h2 className="mb-2 text-lg font-semibold">Aún no tienes cuentas conectadas</h2>
        <p className="mb-4 text-panel-muted">Conecta una cuenta para ver aquí el resumen de todas.</p>
        <Link to="/cuentas" className="font-medium text-brand-600 underline hover:text-brand-700">
          Ir a Cuentas
        </Link>
      </div>
    );
  }

  const sections = buildPlatformSections(response, catalog);
  const rows = buildAccountRows(response, catalog);

  return (
    <div className="space-y-8">
      <div className="space-y-1 text-sm">
        {response.period === null ? (
          <p className="text-panel-muted">
            Todavía no hay datos de tus cuentas.{' '}
            <Link to="/cuentas" className="underline">
              Sincroniza una desde Cuentas
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="font-medium">{formatDateRange(response.period.start, response.period.end)}</p>
            {response.dataThrough && (
              <p className="text-panel-muted">
                Último dato entre todas las cuentas: {formatDate(response.dataThrough)}
              </p>
            )}
          </>
        )}
      </div>

      {sections.map((section) => (
        <section key={section.platform} aria-labelledby={`plataforma-${section.platform}`}>
          <h2 id={`plataforma-${section.platform}`} className="mb-1 text-lg font-semibold">
            {section.title}
          </h2>
          <p className="mb-3 text-sm text-panel-muted">{section.accountsText}</p>
          {section.notice && (
            <p
              role="status"
              className="mb-4 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
            >
              {section.notice}
            </p>
          )}
          {section.cards.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {section.cards.map((card) => (
                <article
                  key={card.code}
                  className="rounded-xl border border-panel-line bg-panel-card p-5"
                >
                  <h3 className="text-sm text-panel-muted">{card.label}</h3>
                  <p
                    className={`mt-2 text-3xl font-semibold ${card.hasValue ? '' : 'text-panel-muted'}`}
                  >
                    {card.valueText}
                  </p>
                  <p className="mt-3 text-xs text-panel-muted">{card.accountsText}</p>
                  {card.note && <p className="mt-2 text-xs text-panel-muted">{card.note}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      ))}

      <section aria-labelledby="por-cuenta-title">
        <h2 id="por-cuenta-title" className="mb-3 text-lg font-semibold">
          Cada cuenta
        </h2>
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-panel-line bg-panel-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{row.name}</h3>
                  <p className="mt-1 text-xs text-panel-muted">
                    {row.platformText} · {row.lastSyncText}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-panel-muted">Datos</dt>
                  <dd>{row.dataThroughText}</dd>
                </div>
                <div>
                  <dt className="text-xs text-panel-muted">Cobertura del periodo</dt>
                  <dd className={row.coverageWarning ? 'text-amber-300' : ''}>{row.coverageText}</dd>
                </div>
                <div>
                  <dt className="text-xs text-panel-muted">{row.viewsLabel}</dt>
                  <dd>{row.viewsText}</dd>
                </div>
              </dl>
              {row.totals.length > 0 && (
                <p className="mt-3 text-xs text-panel-muted">
                  {row.totals.map((total) => `${total.label}: ${total.valueText}`).join(' · ')}
                </p>
              )}
              <Link
                to={accountDashboardLink(row.id, selection)}
                className="mt-4 inline-block text-sm font-medium text-brand-600 underline hover:text-brand-700"
              >
                Ver en el panel
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-1 text-xs text-panel-muted">
        <p>
          Los totales del canal (suscriptores, vistas totales y videos) no se suman entre cuentas: cada cuenta
          muestra los suyos.
        </p>
        {response.crossPlatform.groups.length === 0 && (
          <p>
            Cada plataforma se muestra por separado: por ahora ninguna métrica se suma entre plataformas
            distintas.
          </p>
        )}
      </div>
    </div>
  );
}

export function OverviewPage() {
  const { selection, setSelection, today } = useSelection();
  const overview = useOverview(selection);
  const catalog = useCatalog();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Resumen</h1>
          <p className="text-sm text-panel-muted">Todas tus cuentas en un mismo periodo</p>
        </div>
        <PeriodSelector selection={selection} today={today} onChange={setSelection} />
      </div>

      {(overview.isPending || catalog.isPending) && (
        <p aria-busy="true" className="text-panel-muted">
          Cargando resumen…
        </p>
      )}
      {(overview.isError || catalog.isError) && (
        <LoadError
          error={overview.error ?? catalog.error}
          onRetry={() => {
            if (overview.isError) void overview.refetch();
            if (catalog.isError) void catalog.refetch();
          }}
        />
      )}
      {overview.data && catalog.data && (
        <OverviewContent response={overview.data} catalog={catalog.data} selection={selection} />
      )}
    </div>
  );
}