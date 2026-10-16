# SocialPulse AI — Estado del proyecto

Última actualización: 16/10/2026

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
- Swagger: `@nestjs/swagger` 12, `@nestjs/config`

## Fase actual
Fase 2 — Preparación del entorno (numeración del prompt maestro). Estado: **EN PROGRESO**.
Fase 1 (arquitectura y planificación): **EN PROGRESO**. Falta formalizar modelo de
datos inicial, definición de endpoints y criterios de aceptación.

## Tablero de la Fase 2
| Tarea | Estado | Evidencia | Pendiente |
|---|---|---|---|
| Proyecto NestJS y TypeScript | COMPLETADA | `nest build` sin errores | — |
| PostgreSQL local, usuario y base | COMPLETADA | Conexión con `socialpulse` a `socialpulse_dev`, PostgreSQL 18.2 | — |
| Prisma instalado y esquema válido | COMPLETADA | `prisma validate` y `prisma generate` correctos | — |
| Conexión Prisma ↔ base | COMPLETADA | `migrate status` llegó a la base | Sin migraciones aún |
| Migraciones | PENDIENTE | — | Requiere modelo de datos inicial |
| `moduleFormat = "cjs"` en el esquema | COMPLETADA | `Select-String` muestra `moduleFormat = "cjs"` en `prisma/schema.prisma` | — |
| Validación de variables de entorno | COMPLETADA | Con `DATABASE_URL` inválida la app aborta con "Configuración de entorno inválida" sin exponer valores | — |
| Ruta `GET /api/v1/health` | COMPLETADA | Respuesta JSON real; e2e: 200 con prefijo, 404 sin prefijo | — |
| Swagger en `/api/docs` | COMPLETADA | Página renderizada con endpoint `health` | — |
| Pruebas Jest (unitaria y e2e) | COMPLETADA | `npm test`: 1/1; `npm run test:e2e`: 2/2 | Ver riesgo de bandera experimental |
| `.env.example` sin secretos | COMPLETADA | Revisado: solo valores de ejemplo | — |
| Higiene de Git | COMPLETADA | `origin/main`: 1 commit, 0 archivos de `node_modules`; `.env` nunca en el historial | — |
| `PrismaService` | PENDIENTE | — | Se hace con el modelo de datos |
| Docker | PENDIENTE | — | Decisión: diferido hasta la Fase 9 |

## Errores, riesgos y bloqueos
- Sin bloqueos.
- **Media:** Jest requiere `--experimental-vm-modules` porque `@nestjs/testing` 12 es solo
  ESM. Plan alternativo: bajar a NestJS 11 (CommonJS) si deja de funcionar.
- **Baja:** avisos `EBADENGINE` (herramientas de la CLI piden Node >= 24.15; hay 24.14.1).
- **Baja:** 25 vulnerabilidades de npm en dependencias de desarrollo; `npm audit --omit=dev` da 0.
- **Baja:** la prueba e2e depende de que exista un `.env` local (pendiente para la Fase 9).
- Repositorio **público**: nunca subir `.env` ni credenciales.

## Decisiones técnicas confirmadas
- Monolito modular NestJS + Prisma + PostgreSQL, REST con prefijo `/api/v1`.
- Prisma fijado en la versión mayor 7 (la 8 está en versión candidata).
- PostgreSQL local nativo en Windows; Docker diferido.
- `tsconfig.json` con `rootDir: "."`; `tsconfig.build.json` con `rootDir: "./src"`.
- Jest con `--experimental-vm-modules` en los scripts de prueba.
- Documentación Swagger deshabilitada en producción.
- Historial de Git reiniciado el 16/10/2026 para eliminar `node_modules`.

## Última tarea realizada
Configuración de entorno validada, prefijo `/api/v1`, Swagger y endpoint de salud, con pruebas (verificado el 16/10/2026).

## Próxima tarea concreta
Diseñar el modelo de datos inicial (usuarios, identidades de acceso, cuentas sociales) y
aplicar la primera migración con `PrismaService`. Pendiente de tu confirmación.

## Comandos importantes (desde `backend/`)
```powershell
npm run start:dev      # servidor en desarrollo
npm run build          # compilar
npm test               # pruebas unitarias
npm run test:e2e       # pruebas e2e
npx prisma validate    # validar el esquema
npx prisma generate    # generar el cliente
npx prisma migrate status
```
URLs locales: `http://localhost:3000/api/v1/health` y `http://localhost:3000/api/docs`