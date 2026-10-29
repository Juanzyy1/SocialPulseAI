import { useSearchParams } from 'react-router';
import { PeriodSelector } from '../components/PeriodSelector';
import { PERIOD_OPTIONS, parsePeriod, withPeriod } from '../dashboard/period-params';
import { useSession } from '../session/use-session';

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useSession();
  const period = parsePeriod(searchParams.get('period'));
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? '';
  const name = session.data?.displayName ?? session.data?.email;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Panel</h1>
          <p className="text-sm text-panel-muted">Hola, {name}</p>
        </div>
        <PeriodSelector
          value={period}
          onChange={(next) => setSearchParams(withPeriod(searchParams, next), { replace: true })}
        />
      </div>

      <section
        aria-labelledby="resumen-title"
        className="rounded-xl border border-panel-line bg-panel-card p-6"
      >
        <h2 id="resumen-title" className="mb-2 text-lg font-semibold">
          Resumen
        </h2>
        <p className="text-panel-muted">
          Aquí aparecerán las métricas de los últimos {periodLabel} de tu cuenta (próxima tarea: F.4c).
        </p>
      </section>
    </div>
  );
}