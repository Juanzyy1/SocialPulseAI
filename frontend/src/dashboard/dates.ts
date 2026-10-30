const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const pacific = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha (AAAA-MM-DD) de un instante en hora del Pacífico, que es como YouTube asigna los días. */
export function pacificToday(now: Date): string {
  const parts = pacific.formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Una fecha AAAA-MM-DD que existe en el calendario (rechaza 2026-02-30). */
export function isRealIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** Días entre dos fechas AAAA-MM-DD, ambos extremos incluidos. */
export function countDays(start: string, end: string): number {
  const diff = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(diff / DAY_MS) + 1;
}