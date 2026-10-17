import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { SessionsService } from '../src/auth/sessions.service';
import { PrismaService } from '../src/prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
// Dominio .invalid: reservado, nunca es un correo real.
const TEST_DOMAIN = '@sessions-test.invalid';

describe('SessionsService (integración con PostgreSQL real)', () => {
  let moduleRef: TestingModule;
  let sessions: SessionsService;
  let prisma: PrismaService;

  const newUser = () =>
    prisma.user.create({ data: { email: `${randomUUID()}${TEST_DOMAIN}` } });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    sessions = moduleRef.get(SessionsService);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    // Borra los usuarios de prueba; sus sesiones caen en cascada.
    await prisma.user.deleteMany({
      where: { email: { endsWith: TEST_DOMAIN } },
    });
    await moduleRef.close();
  });

  it('guarda solo el hash del token, nunca el token', async () => {
    const user = await newUser();
    const { token } = await sessions.create(user.id);
    const row = await prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(row.tokenHash).toBe(SessionsService.hashToken(token));
    expect(row.tokenHash).not.toBe(token);
    expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it('genera un token distinto en cada sesión', async () => {
    const user = await newUser();
    const a = await sessions.create(user.id);
    const b = await sessions.create(user.id);
    expect(a.token).not.toBe(b.token);
  });

  it('valida un token vigente y devuelve el usuario', async () => {
    const user = await newUser();
    const { token } = await sessions.create(user.id);
    const result = await sessions.validate(token);
    expect(result?.userId).toBe(user.id);
  });

  it('rechaza un token desconocido o vacío', async () => {
    expect(await sessions.validate('no-existe')).toBeNull();
    expect(await sessions.validate('')).toBeNull();
  });

  it('rechaza y borra una sesión caducada', async () => {
    const user = await newUser();
    const { token } = await sessions.create(user.id);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await sessions.validate(token)).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('revoke invalida el token', async () => {
    const user = await newUser();
    const { token } = await sessions.create(user.id);
    await sessions.revoke(token);
    expect(await sessions.validate(token)).toBeNull();
  });

  it('revokeAllForUser cierra las sesiones de ese usuario y no las de otros', async () => {
    const a = await newUser();
    const b = await newUser();
    const a1 = await sessions.create(a.id);
    const a2 = await sessions.create(a.id);
    const b1 = await sessions.create(b.id);

    expect(await sessions.revokeAllForUser(a.id)).toBe(2);
    expect(await sessions.validate(a1.token)).toBeNull();
    expect(await sessions.validate(a2.token)).toBeNull();
    expect(await sessions.validate(b1.token)).not.toBeNull();
  });

  it('extiende la expiración sin superar el límite absoluto de 30 días', async () => {
    const user = await newUser();
    const { token } = await sessions.create(user.id);
    const createdAt = new Date(Date.now() - 29 * DAY_MS);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: {
        createdAt,
        lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });

    expect(await sessions.validate(token)).not.toBeNull();

    const row = await prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(row.expiresAt.getTime()).toBeLessThanOrEqual(
      createdAt.getTime() + 30 * DAY_MS,
    );
    expect(row.lastUsedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('deleteExpired borra solo las caducadas', async () => {
    const user = await newUser();
    const expired = await sessions.create(user.id);
    const valid = await sessions.create(user.id);
    await prisma.session.updateMany({
      where: { tokenHash: SessionsService.hashToken(expired.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await sessions.deleteExpired()).toBeGreaterThanOrEqual(1);
    expect(await sessions.validate(expired.token)).toBeNull();
    expect(await sessions.validate(valid.token)).not.toBeNull();
  });
});