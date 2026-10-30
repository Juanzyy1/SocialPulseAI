import { useState } from 'react';
import { Link } from 'react-router';
import type { Coverage } from '../api/types';
import { describeFreshness } from '../dashboard/freshness';

interface FreshnessNoticeProps {
  dataThrough: string | null;
  daysBehind: number | null;
  coverage: Coverage | null;
  lastSyncedAt: string | null;
}

export function FreshnessNotice(props: FreshnessNoticeProps) {
  // La hora se fija al montar el componente: "hace N días" no necesita cambiar en cada dibujo.
  const [now] = useState(() => new Date());
  const { headline, lag, sync, gaps } = describeFreshness({ ...props, now });

  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">{headline}</p>
      {lag && <p className="text-panel-muted">{lag}</p>}
      {sync && (
        <p role="status" className="text-amber-300">
          {sync}{' '}
          <Link to="/cuentas" className="underline">
            Ir a Cuentas
          </Link>
        </p>
      )}
      {gaps && (
        <p role="status" className="text-amber-300">
          {gaps}
        </p>
      )}
    </div>
  );
}