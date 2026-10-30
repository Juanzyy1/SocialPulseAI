import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { pacificToday } from './dates';
import { parseSelection, withSelection } from './period-selection';
import type { PeriodSelection } from './period-selection';

/** Periodo elegido, guardado en la URL. `today` es la fecha actual del Pacífico, fijada al montar. */
export function useSelection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [today] = useState(() => pacificToday(new Date()));
  const selection = parseSelection(searchParams, today);

  const setSelection = (next: PeriodSelection) =>
    setSearchParams(withSelection(searchParams, next), { replace: true });

  return { selection, setSelection, today, searchParams, setSearchParams };
}