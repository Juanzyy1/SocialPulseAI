import { addDays, pacificDate } from './pacific-date';

describe('pacificDate', () => {
  it('en verano (UTC-7) el día cambia a las 07:00 UTC', () => {
    expect(pacificDate(new Date('2026-10-19T06:59:59Z'))).toBe('2026-10-18');
    expect(pacificDate(new Date('2026-10-19T07:00:00Z'))).toBe('2026-10-19');
  });

  it('en invierno (UTC-8) el día cambia a las 08:00 UTC', () => {
    expect(pacificDate(new Date('2026-12-01T07:59:59Z'))).toBe('2026-11-30');
    expect(pacificDate(new Date('2026-12-01T08:00:00Z'))).toBe('2026-12-01');
  });
});

describe('addDays', () => {
  it('suma y resta días', () => {
    expect(addDays('2026-10-19', -29)).toBe('2026-09-20');
    expect(addDays('2026-10-19', 0)).toBe('2026-10-19');
    expect(addDays('2026-10-19', 1)).toBe('2026-10-20');
  });

  it('cruza correctamente fin de mes, fin de año y años bisiestos', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});