export const PACIFIC_TIME_ZONE = 'America/Los_Angeles';

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PACIFIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Fecha (AAAA-MM-DD) que corresponde a un instante en hora del Pacífico, que es como
 * YouTube asigna los datos a cada día. Respeta el cambio de horario (UTC-7 / UTC-8).
 */
export function pacificDate(instant: Date): string {
  const parts = formatter.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Suma (o resta, con negativos) días a una fecha AAAA-MM-DD, sin depender de zonas horarias. */
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}