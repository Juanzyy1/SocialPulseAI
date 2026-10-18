# SocialPulse AI — Estado del proyecto

Última actualización: 17/10/2026

## Descripción
Plataforma para conectar varias cuentas de redes sociales de un usuario, consultar
sus estadísticas individuales y agregadas, y analizar videos con IA antes de
publicarlos. Monolito modular. Primera integración real: YouTube.

## Tecnologías (versiones verificadas en este entorno)
- Node.js 24.14.1, npm 11.11.0
- NestJS 12.1.3, TypeScript 6.0.3
- PostgreSQL 18.2 (instalación local en Windows)
- Prisma 7.10.1 con `@prisma/adapter-pg`
- Jest 30.5.2 + ts-jest + supertest
- `@nestjs/swagger` 12, `@nestjs/config`, `class-validator`, `class-transformer`
- `argon2`, `cookie-parser`, `google-auth-library`

## Fases
| Fase | Estado | Nota |
|---|---|---|
| 1. Arquitectura y planificación | COMPLETADA | `docs/MVP_SPEC.md` aprobado el 17/10/2026 |
| 2. Preparación del entorno | COMPLETADA | Docker diferido a la Fase 9 por decisión |
| 3. Autenticación y usuarios | COMPLETADA con excepciones | Aislamiento con IDs pasa a la Fase 4; dos verificaciones menores abiertas (ver abajo) |
| 4. Integración con YouTube | EN PROGRESO | 4.1 completada |
| 5 a 9 | PENDIENTES | |

## Pruebas actuales
- Unitarias: 35 pruebas en 6 suites (todas pasan).
- e2e (contra PostgreSQL real): 59 pruebas en 8 suites (todas pasan).
- `tsc --noEmit` y `nest build` sin errores. `npm audit --omit=dev`: 0 vulnerabilidades.
- Probado manualmente con una cuenta real de Google (login y vinculación).

## Fase 3 — Autenticación y usuarios
| Tarea | Estado | Evidencia |
|---|---|---|
| 3.1 Hash Argon2id | COMPLETADA | 5 unitarias; migración `emailVerifiedAt` |
| 3.2 Sesiones (solo hash en BD) | COMPLETADA | 9 e2e contra PostgreSQL real |
| 3.3a Validación y registro | COMPLETADA | 7 e2e |
| 3.3b Login, logout, cookie, guard global | COMPLETADA | 10 e2e |
| 3.3c Límite de intentos | COMPLETADA | 4 unitarias + 4 e2e |
| 3.4 Perfil `/users/me` | COMPLETADA | 12 e2e |
| 3.5a Configuración de Google | COMPLETADA | `validateEnv` con pruebas unitarias |
| 3.5b Flujo OAuth y vinculación | COMPLETADA | 12 e2e (cliente simulado) + 5 unitarias + prueba manual real |

Abierto de la Fase 3:
- Aislamiento entre usuarios con recursos con ID: se verifica en la Fase 4 (decisión del 17/10/2026).
- Aserción del mensaje de la contraseña corta en `auth-register.e2e-spec.ts`: pendiente de ver en verde.
- Respuesta 503 en el `callback` de Google dentro de Swagger: pendiente de confirmar.

## Fase 4 — Integración con YouTube
| Tarea | Estado | Evidencia / pendiente |
|---|---|---|
| Verificación de permisos y modo Testing | COMPLETADA | Permisos mínimos documentados; caducidad de 7 días confirmada en fuente oficial |
| 4.1 Cifrado de tokens (AES-256-GCM) | COMPLETADA | 12 unitarias; clave obligatoria validada al arrancar; e2e construye el servicio con la clave real |
| Pasos en Google Cloud (APIs, permisos, URI de retorno) | PENDIENTE | A cargo del usuario antes de la 4.2 |
| 4.2 Flujo de conexión del canal | COMPLETADA | 13 e2e; conexión real el 18/10/2026; credencial verificada cifrada en la base real | 
| 4.3 social-accounts y aislamiento | COMPLETADA | 9 e2e; revocación real en Google (`revokedAtGoogle: true`); listado `[]` tras desconectar | Sin límite de solicitudes en estos endpoints (riesgo bajo) |
| 4.4 Refresco de tokens y permisos revocados | PENDIENTE | |

## Errores, riesgos y bloqueos
- Sin bloqueos.
- **Media:** Jest requiere `--experimental-vm-modules` (`@nestjs/testing` 12 es solo ESM). Plan alternativo: bajar a NestJS 11.
- **Media:** flag `Secure` de cookies solo revisado en el código, no probado con `NODE_ENV=production`.
- **Media:** CSRF se apoya en `SameSite=Lax`; validar `Origin` queda pendiente hasta definir el frontend.
- **Media:** verificación de correo pospuesta; la regla 4 neutraliza la pre-registración.
- **Media:** no desplegar tras un proxy sin configurar `trust proxy` (el límite por IP afectaría a todos).
- **Media:** el bloqueo por correo permite bloquear a propósito el login de otra persona.
- **Media:** el 409 del registro revela si un correo existe.
- **Media:** en modo Testing de Google, la conexión de YouTube caduca a los 7 días y hay que reconectar.
- **Baja:** contadores de límite en memoria (una sola instancia).
- **Baja:** rotación de la clave de cifrado sin implementar (solo existe la versión 1).
- **Baja:** el callback de Google no tiene límite de solicitudes.
- **Baja:** las e2e dependen de PostgreSQL encendido y de un `.env` local (Fase 9).
- **Baja:** avisos `EBADENGINE` y vulnerabilidades solo en dependencias de desarrollo.
- Repositorio **público**: nunca subir `.env`, claves ni secretos.

## Decisiones técnicas confirmadas
- Monolito modular NestJS + Prisma 7 + PostgreSQL, REST con prefijo `/api/v1`.
- Sesiones en base de datos con token opaco en cookie; solo se guarda su hash. Argon2id para contraseñas.
- Guard global que niega por defecto; `@Public()` marca lo público.
- Límite de intentos con contador propio en memoria (no `@nestjs/throttler`).
- Verificación de correo pospuesta; regla 4 aplicada (borra contraseña y cierra sesiones al vincular Google).
- Google en modo Testing; publicar o verificar la app se aplaza a la Fase 9.
- YouTube: permisos `youtube.readonly` y `yt-analytics.readonly`; no se pide ingresos ni gestión.
- Tokens de redes cifrados con AES-256-GCM, ligados a su fila con datos asociados; clave en variable de entorno.
- Un canal solo puede estar conectado por un usuario (unicidad global).
- PostgreSQL local nativo; Docker diferido a la Fase 9.
- Prisma fijado en la versión mayor 7. Historial de Git reiniciado el 16/10/2026.

## Última tarea realizada
4.1 Cifrado de tokens con AES-256-GCM y clave obligatoria validada al arrancar.

## Próxima tarea concreta
4.2 Flujo de conexión de YouTube. Requiere antes los pasos de Google Cloud.

## Comandos importantes (desde `backend/`)
```powershell
npm run start:dev       # servidor en desarrollo
npm run build           # compilar (única comprobación de tipos de src)
npm test                # pruebas unitarias
npm run test:e2e        # pruebas e2e (requiere PostgreSQL encendido)
npx tsc --noEmit -p tsconfig.json   # tipos de src y de las pruebas
npx prisma migrate dev  # crear y aplicar migraciones
npx prisma generate     # regenerar el cliente
```
URLs locales: `http://localhost:3000/api/v1/health` y `http://localhost:3000/api/docs`