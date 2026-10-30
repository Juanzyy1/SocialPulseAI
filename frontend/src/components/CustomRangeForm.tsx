import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { customRangeError } from '../dashboard/period-selection';

interface CustomRangeFormProps {
  today: string;
  initialFrom: string;
  initialTo: string;
  onApply: (from: string, to: string) => void;
}

const INPUT =
  'rounded-lg border border-panel-line bg-panel-card px-3 py-2 text-sm text-panel-text [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

export function CustomRangeForm({ today, initialFrom, initialTo, onApply }: CustomRangeFormProps) {
  const fromId = useId();
  const toId = useId();
  const errorId = useId();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = customRangeError(from, to, today);
    setError(problem);
    if (problem === null) onApply(from, to);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={fromId} className="mb-1 block text-xs text-panel-muted">
          Desde
        </label>
        <input
          id={fromId}
          type="date"
          value={from}
          max={today}
          onChange={(event) => setFrom(event.target.value)}
          aria-describedby={error ? errorId : undefined}
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor={toId} className="mb-1 block text-xs text-panel-muted">
          Hasta
        </label>
        <input
          id={toId}
          type="date"
          value={to}
          max={today}
          onChange={(event) => setTo(event.target.value)}
          aria-describedby={error ? errorId : undefined}
          className={INPUT}
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Aplicar
      </button>
      {error && (
        <p id={errorId} role="alert" className="basis-full text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}