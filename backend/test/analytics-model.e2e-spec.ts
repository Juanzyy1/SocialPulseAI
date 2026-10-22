import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@analytics-model-test.invalid';

/** Fecha pura (AAAA-MM-DD) como la guarda y la lee la columna `date`. */
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('Modelo del historial (integración con PostgreSQL real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  const newUser = () =>
    prisma.user.create({ data: { email: `${randomUUID()}${TEST_DOMAIN}` } });
  const newAccount = (userId: string) =>
    prisma.socialAccount.create({
      data: { userId, platform: 'YOUTUBE', platformAccountId: `canal-${randomUUID()}` },
    });

  /** Una fila de cada tabla del historial para la cuenta indicada. */
  const seedHistory = async (socialAccountId: string) => {
    await prisma.accountDailyMetric.create({
      data: { socialAccountId, metricDate: day('2026-10-18'), metric: 'views', value: 3 },
    });
    await prisma.accountTotalSnapshot.create({
      data: { socialAccountId, snapshotDate: day('2026-10-21'), metric: 'subscriberCount', value: 5 },
    });
    await prisma.syncRun.create({
      data: { socialAccountId, rangeStart: day('2026-07-24'), rangeEnd: day('2026-10-21') },
    });
  };

  const counts = async (socialAccountId: string) => ({
    metrics: await prisma.accountDailyMetric.count({ where: { socialAccountId } }),
    snapshots: await prisma.accountTotalSnapshot.count({ where: { socialAccountId } }),
    runs: await prisma.syncRun.count({ where: { socialAccountId } }),
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    // Borrar usuarios elimina en cascada cuentas, métricas, totales y sincronizaciones.
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    await moduleRef.close();
  });

  it('una fecha del Pacífico se guarda y se lee como fecha pura, sin desfase', async () => {
    const user = await newUser();
    const account = await newAccount(user.id);
    await prisma.accountDailyMetric.create({
      data: { socialAccountId: account.id, metricDate: day('2026-10-18'), metric: 'views', value: 3 },
    });

    const row = await prisma.accountDailyMetric.findFirstOrThrow({
      where: { socialAccountId: account.id },
    });
    expect(row.metricDate.toISOString().slice(0, 10)).toBe('2026-10-18');

    // Lo que hay realmente en PostgreSQL, sin pasar por la conversión de Prisma.
    const raw = await prisma.$queryRaw<{ d: string }[]>`
      SELECT "metricDate"::text AS d FROM account_daily_metrics
      WHERE "socialAccountId" = ${account.id}::uuid`;
    expect(raw[0].d).toBe('2026-10-18');
  });

  it('no admite dos filas para la misma cuenta, fecha y métrica; el upsert actualiza', async () => {
    const user = await newUser();
    const account = await newAccount(user.id);
    const key = { socialAccountId: account.id, metricDate: day('2026-10-18'), metric: 'views' };
    await prisma.accountDailyMetric.create({ data: { ...key, value: 3 } });

    await expect(prisma.accountDailyMetric.create({ data: { ...key, value: 4 } })).rejects.toMatchObject({
      code: 'P2002',
    });

    // Sincronizar de nuevo el mismo día reescribe el valor sin duplicar.
    await prisma.accountDailyMetric.upsert({
      where: { socialAccountId_metricDate_metric: key },
      create: { ...key, value: 9 },
      update: { value: 9 },
    });
    const rows = await prisma.accountDailyMetric.findMany({ where: { socialAccountId: account.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(9);
  });

  it('el total puntual es único por cuenta, día y métrica', async () => {
    const user = await newUser();
    const account = await newAccount(user.id);
    const key = { socialAccountId: account.id, snapshotDate: day('2026-10-21'), metric: 'subscriberCount' };
    await prisma.accountTotalSnapshot.create({ data: { ...key, value: 5 } });

    await expect(prisma.accountTotalSnapshot.create({ data: { ...key, value: 6 } })).rejects.toMatchObject({
      code: 'P2002',
    });
    // El mismo valor en otro día sí es otra fila: así se forma la serie histórica.
    await prisma.accountTotalSnapshot.create({
      data: { ...key, snapshotDate: day('2026-10-22'), value: 6 },
    });
    expect(await prisma.accountTotalSnapshot.count({ where: { socialAccountId: account.id } })).toBe(2);
  });

  it('una sincronización nace en curso, con su rango y sin errores', async () => {
    const user = await newUser();
    const account = await newAccount(user.id);
    const run = await prisma.syncRun.create({
      data: { socialAccountId: account.id, rangeStart: day('2026-07-24'), rangeEnd: day('2026-10-21') },
    });

    expect(run.status).toBe('RUNNING');
    expect(run.finishedAt).toBeNull();
    expect(run.rowsWritten).toBe(0);
    expect(run.errorMessage).toBeNull();
    expect(run.rangeStart.toISOString().slice(0, 10)).toBe('2026-07-24');
    expect(run.rangeEnd.toISOString().slice(0, 10)).toBe('2026-10-21');
  });

  it('borrar una cuenta elimina su historial y no toca el de otra cuenta', async () => {
    const user = await newUser();
    const accountA = await newAccount(user.id);
    const accountB = await newAccount(user.id);
    await seedHistory(accountA.id);
    await seedHistory(accountB.id);

    await prisma.socialAccount.delete({ where: { id: accountA.id } });

    expect(await counts(accountA.id)).toEqual({ metrics: 0, snapshots: 0, runs: 0 });
    expect(await counts(accountB.id)).toEqual({ metrics: 1, snapshots: 1, runs: 1 });
  });

  it('borrar un usuario elimina todo su historial en cascada', async () => {
    const user = await newUser();
    const account = await newAccount(user.id);
    await seedHistory(account.id);

    await prisma.user.delete({ where: { id: user.id } });

    expect(await counts(account.id)).toEqual({ metrics: 0, snapshots: 0, runs: 0 });
    expect(await prisma.socialAccount.count({ where: { id: account.id } })).toBe(0);
  });
});