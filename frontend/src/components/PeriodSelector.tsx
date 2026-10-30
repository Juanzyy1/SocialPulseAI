import { useId, useState } from 'react';
import { PERIOD_OPTIONS } from '../dashboard/period-params';
import { presetSelection, selectionKey } from '../dashboard/period-selection';
import type { PeriodSelection } from '../dashboard/period-selection';
import { CustomRangeForm } from './CustomRangeForm';

interface PeriodSelectorProps {
  selection: PeriodSelection;
  /** Fecha actual del Pacífico: límite del rango personalizado. */
  today: string;
  onChange: (selection: PeriodSelection) => void;
}

function Option({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="peer sr-only" />
      <span className="block rounded-md px-3 py-1.5 text-sm text-panel-muted transition-colors hover:text-panel-text peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600">
        {label}
      </span>
    </label>
  );
}

/**
 * Botones de opción nativos: el teclado funciona sin código extra (Tab entra, las flechas cambian).
 * "Personalizado" abre un formulario de fechas; el periodo solo cambia al pulsar "Aplicar".
 */
export function PeriodSelector({ selection, today, onChange }: PeriodSelectorProps) {
  const name = useId();
  const key = selectionKey(selection);
  const [customOpen, setCustomOpen] = useState(selection.kind === 'custom');
  // Si el periodo cambia desde fuera (por ejemplo, con el botón "atrás"), se vuelve a alinear el formulario.
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setCustomOpen(selection.kind === 'custom');
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <fieldset className="flex items-center gap-1 rounded-lg border border-panel-line bg-panel-card p-1">
        <legend className="sr-only">Periodo</legend>
        {PERIOD_OPTIONS.map((option) => (
          <Option
            key={option.value}
            name={name}
            label={option.label}
            checked={!customOpen && selection.kind === 'preset' && selection.period === option.value}
            onSelect={() => {
              setCustomOpen(false);
              onChange(presetSelection(option.value));
            }}
          />
        ))}
        <Option
          name={name}
          label="Personalizado"
          checked={customOpen}
          onSelect={() => setCustomOpen(true)}
        />
      </fieldset>
      {customOpen && (
        <CustomRangeForm
          key={selection.kind === 'custom' ? key : 'nuevo'}
          today={today}
          initialFrom={selection.kind === 'custom' ? selection.from : ''}
          initialTo={selection.kind === 'custom' ? selection.to : ''}
          onApply={(from, to) => onChange({ kind: 'custom', from, to })}
        />
      )}
    </div>
  );
}