import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/** Se lanza al final de cada transacción de prueba para deshacerla (rollback). */
class Rollback extends Error {}

async function inRolledBackTransaction(
  prisma: PrismaService,
  fn: (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

describe('Base de datos (integración con PostgreSQL real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('se conecta a PostgreSQL', async () => {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    expect(rows[0].ok).toBe(1);
  });

  it('impide que dos usuarios conecten el mismo canal', async () => {
    await expect(
      inRolledBackTransaction(prisma, async (tx) => {
        const a = await tx.user.create({ data: { email: 'a@example.invalid' } });
        const b = await tx.user.create({ data: { email: 'b@example.invalid' } });
        const channel = { platform: 'YOUTUBE', platformAccountId: 'canal-de-prueba' } as const;
        await tx.socialAccount.create({ data: { userId: a.id, ...channel } });
        await tx.socialAccount.create({ data: { userId: b.id, ...channel } });
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('al borrar un usuario se borran sus sesiones (cascada)', async () => {
    await inRolledBackTransaction(prisma, async (tx) => {
      const user = await tx.user.create({ data: { email: 'cascada@example.invalid' } });
      await tx.session.create({
        data: {
          userId: user.id,
          tokenHash: 'hash-de-prueba',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await tx.user.delete({ where: { id: user.id } });
      expect(await tx.session.count({ where: { userId: user.id } })).toBe(0);
    });
  });
});