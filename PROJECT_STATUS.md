# SocialPulse AI — Estado del proyecto

Última actualización: 17/10/2026

## Descripción
Plataforma para conectar varias cuentas de redes sociales de un usuario, consultar
sus estadísticas individuales y agregadas, y analizar videos con IA antes de
publicarlos. Monolito modular. Primera integración real prevista: YouTube.

## Tecnologías (versiones verificadas en este entorno)
- Node.js 24.14.1, npm 11.11.0
- NestJS 12.1.3, TypeScript 6.0.3
- PostgreSQL 18.2 (instalación local en Windows)
- Prisma 7.10.1 con `@prisma/adapter-pg`
- Jest 30.5.2 + ts-jest 29.4.15 + supertest
- `@nestjs/swagger` 12, `@nestjs/config`

## Fase actual
- Fase 2 (preparación del entorno): **COMPLETADA** (Docker diferido a la Fase 9 por decisión).
- Fase 1 (arquitectura y planificación): **COMPLETADA**. con la evidencia: “docs/MVP_SPEC.md. Hecho: arquitectura, estructura
  del repositorio y modelo inicial de datos. Pendiente: definición formal de endpoints y
  criterios de aceptación del MVP.
- Fase 3 (autenticación): **EN PROGRESO.** (a la espera de confirmación para empezar).

## Tablero de la Fase 2
| Tarea | Estado | Evidencia | Pendiente |
|---|---|---|---|
| Proyecto NestJS y TypeScript | COMPLETADA | `nest build` sin errores | — |
| PostgreSQL local, usuario y base | COMPLETADA | Conexión con `socialpulse` a `socialpulse_dev` | — |
| Prisma 7 y esquema | COMPLETADA | `validate` y `generate` correctos; `moduleFormat = "cjs"` | — |
| Modelo inicial de datos | COMPLETADA | 5 tablas en PostgreSQL: users, oauth_identities, sessions, social_accounts, social_credentials | Tablas de métricas: Fase 5 |
| Migración inicial | COMPLETADA | `20261017145825_init` aplicada; `_prisma_migrations` presente | — |
| `PrismaService` | COMPLETADA | e2e: conexión real a PostgreSQL | — |
| Unicidad global de cuenta social | COMPLETADA | e2e: el segundo usuario recibe `P2002` | Ver índice en `psql` (opcional) |
| Cascada usuario → sesiones | COMPLETADA | e2e pasa | — |
| Validación de variables de entorno | COMPLETADA | Con `DATABASE_URL` inválida la app aborta sin exponer valores | — |
| `GET /api/v1/health` | COMPLETADA | JSON real; 200 con prefijo, 404 sin prefijo | — |
| Swagger en `/api/docs` | COMPLETADA | Página renderizada con endpoint `health` | — |
| Pruebas Jest | COMPLETADA | Unitarias 1/1; e2e 5/5 | Ver riesgos |
| `.env.example` sin secretos | COMPLETADA | Revisado | — |
| Higiene de Git | COMPLETADA | `origin/main` limpio, `.env` nunca en el historial | — |
| Docker | PENDIENTE | — | Diferido a la Fase 9 |

## Fase 3
| 3.1 Hash de contraseñas (Argon2id) | COMPLETADA | 5 pruebas de PasswordService; migración add_email_verified_at; build correcto |— |
| 3.2 Servicio de sesiones | COMPLETADA | 9 pruebas e2e contra PostgreSQL real; solo se guarda el hash del token | Limpieza programada de sesiones caducadas |
| 3.3a Validación global y registro | COMPLETADA | 7 pruebas e2e: hash Argon2id en BD, correo normalizado, 409, 400 | Límite de solicitudes (3.3c) |

## Errores, riesgos y bloqueos
- Sin bloqueos.
- **Media:** Jest requiere `--experimental-vm-modules` (`@nestjs/testing` 12 es solo ESM).
  Plan alternativo: bajar a NestJS 11 (CommonJS).
- **Media:** las pruebas e2e dependen de PostgreSQL encendido y de un `.env` local.
  Pendiente de resolver para integración continua (Fase 9).
- **Baja:** Jest mapea imports `.js` a `.ts` por el cliente generado de Prisma 7.
- **Baja:** avisos `EBADENGINE` (herramientas de la CLI piden Node >= 24.15).
- **Baja:** 25 vulnerabilidades de npm solo en dependencias de desarrollo;
  `npm audit --omit=dev` da 0.
- Repositorio **público**: nunca subir `.env` ni credenciales.
- **Media:** el registro y el login no tienen límite de intentos hasta la 3.3c. No desplegar antes.
- **Media:** el 409 del registro revela si un correo existe (enumeración de usuarios).

## Decisiones técnicas confirmadas
- Monolito modular NestJS + Prisma + PostgreSQL, REST con prefijo `/api/v1`.
- Prisma fijado en la versión mayor 7 (la 8 está en candidata).
- PostgreSQL local nativo en Windows; Docker diferido.
- `tsconfig.json` con `rootDir: "."`; `tsconfig.build.json` con `rootDir: "./src"`.
- Jest con `--experimental-vm-modules` y `moduleNameMapper` para imports `.js`.
- Swagger deshabilitado en producción.
- Autenticación por sesiones en base de datos (token opaco en cookie, solo se guarda su hash).
- Tokens de redes sociales cifrados (AES-256-GCM) en tabla separada `social_credentials`.
- Un mismo canal de una plataforma solo puede estar conectado por un usuario (unicidad global).
- Historial de Git reiniciado el 16/10/2026 para eliminar `node_modules`.
- “Verificación de correo pospuesta; regla 4 activa” y “Argon2id con la librería argon2”.

## Última tarea realizada
Modelo de datos inicial, migración `init`, `PrismaService` y pruebas de integración.

## Próxima tarea concreta
Cerrar la Fase 1 definiendo endpoints y criterios de aceptación de autenticación, y,
con confirmación, comenzar la Fase 3. Verificar antes las librerías de hash de
contraseñas y de OAuth con Node 24 y Nest 12.

## Comandos importantes (desde `backend/`)
```powershell
npm run start:dev          # servidor en desarrollo
npm run build              # compilar
npm test                   # pruebas unitarias
npm run test:e2e           # pruebas e2e (requiere PostgreSQL encendido)
npx prisma validate        # validar el esquema
npx prisma migrate dev     # crear y aplicar migraciones
npx prisma generate        # regenerar el cliente
```
URLs locales: `http://localhost:3000/api/v1/health` y `http://localhost:3000/api/docs`