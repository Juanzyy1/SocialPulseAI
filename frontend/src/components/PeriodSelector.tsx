import { useId } from 'react';
import { PERIOD_OPTIONS } from '../dashboard/period-params';
import type { PeriodPreset } from '../dashboard/period-params';

interface PeriodSelectorProps {
  value: PeriodPreset;
  onChange: (period: PeriodPreset) => void;
}

/** Botones de opción nativos: el teclado funciona sin código extra (Tab entra, las flechas cambian). */
export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const name = useId();

  return (
    <fieldset className="flex items-center gap-1 rounded-lg border border-panel-line bg-panel-card p-1">
      <legend className="sr-only">Periodo</legend>
      {PERIOD_OPTIONS.map((option) => (
        <label key={option.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span className="block rounded-md px-3 py-1.5 text-sm text-panel-muted transition-colors hover:text-panel-text peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600">
            {option.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}