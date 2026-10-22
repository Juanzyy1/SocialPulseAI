# SocialPulse AI — Estado del proyecto

Última actualización: 19/10/2026

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
| 3. Autenticación y usuarios | COMPLETADA | Aislamiento entre usuarios verificado en la 4.3 |
| 4. Integración con YouTube | COMPLETADA con una excepción | Falta levantar la excepción de logs (ver abajo) |
| 5. Estadísticas e historial | PENDIENTE | Empieza con verificación de métricas disponibles |
| 6 a 9 | PENDIENTES | |

## Pruebas actuales
- Unitarias: 35 pruebas en 6 suites (todas pasan). Con el helper de logs: 45 en 7 (pendiente de ver).
- e2e (contra PostgreSQL real): 89 pruebas en 11 suites (todas pasan).
- `tsc --noEmit` y `nest build` sin errores. `npm audit --omit=dev`: 0 vulnerabilidades (sin dependencias nuevas desde entonces).
- Verificado con Google real: login (3.5b), conexión del canal (4.2), revocación (4.3) y acceso a YouTube Analytics (4.4, `analyticsStatusCode: 200` el 19/10/2026).

## Fase 3 — Autenticación y usuarios: COMPLETADA
3.1 Argon2id · 3.2 Sesiones (solo hash en BD) · 3.3 Registro, login, logout, guard global y límite de intentos · 3.4 Perfil `/users/me` · 3.5 Google OAuth con PKCE y reglas de vinculación.

## Fase 4 — Integración con YouTube
| Tarea | Estado | Evidencia |
|---|---|---|
| Verificación de permisos y modo Testing | COMPLETADA | Permisos mínimos; caducidad de 7 días confirmada en fuente oficial |
| Pasos en Google Cloud | COMPLETADA | APIs habilitadas, permisos y URI configurados; usuario de prueba añadido |
| 4.1 Cifrado AES-256-GCM | COMPLETADA | 12 unitarias; credencial real verificada cifrada en la base |
| 4.2 Conexión del canal | COMPLETADA | 14 e2e; conexión real con canal propio el 18/10/2026 |
| 4.3 social-accounts y aislamiento | COMPLETADA | 9 e2e; revocación real en Google (`revokedAtGoogle: true`) |
| 4.4 Renovación, REVOKED y comprobación | COMPLETADA | 7 e2e; acceso real a Analytics verificado; pruebas manuales de renovación y revocación reportadas por el usuario el 19/10/2026 (sin salida adjunta) |
| Helper `redactSecrets` para logs | POR VERIFICAR | Código y 10 pruebas escritos; falta ver build y pruebas en verde |
| 4. Integración con YouTube | COMPLETADA | Cerrada el 19/10/2026 |
| 5. Estadísticas e historial | EN PROGRESO | Verificación documental hecha; 5.1 en curso |
| F. Frontend (nueva) | PROPUESTA APROBADA | Después de la 5; tecnología por decidir |

## Fase 5
| 5.1 Sondeo de YouTube Analytics | COMPLETADA | 97/97 e2e; sondeo real el 21/10/2026: 11 métricas aceptadas, ceros explícitos, últimos días sin fila (retraso observado de ~2 días), coincidencia con Studio |
| 5.2 Modelo de datos del historial | COMPLETADA | Migración aplicada; 70 unitarias y 103 e2e; fechas del Pacífico sin desfase en PostgreSQL real |
| 5.3 Sincronización real | COMPLETADA | 14 unitarias + 12 e2e; sincronización real del 22/10/2026 (699 filas, coincide con Studio); 429, segunda sincronización, sync-status y 404 del sondeo confirmados por el usuario | — |
| 5.4a Estadísticas de una cuenta | COMPLETADA | 17 unitarias + 11 e2e; JSON real verificado el 22/10/2026 | Probar a mano el rango personalizado y los 400 (cubiertos por e2e) |

Excepción abierta: el criterio "ningún token aparece en logs". Se levanta cuando el helper y sus pruebas estén en verde y la búsqueda de `error.message` dé 1.

## Errores, riesgos y bloqueos
- Sin bloqueos.
- **Media:** posible token en logs (sospecha sin confirmar) hasta aplicar el helper.
- **Media:** Google en modo Testing: la conexión de YouTube caduca a los 7 días; se maneja con REVOKED y reconexión.
- **Media:** Jest requiere `--experimental-vm-modules` (`@nestjs/testing` 12 es solo ESM). Plan alternativo: bajar a NestJS 11.
- **Media:** flag `Secure` de cookies solo revisado en el código, no probado con `NODE_ENV=production`.
- **Media:** CSRF se apoya en `SameSite=Lax`; validar `Origin` queda pendiente hasta definir el frontend.
- **Media:** verificación de correo pospuesta; la regla 4 neutraliza la pre-registración.
- **Media:** no desplegar tras un proxy sin configurar `trust proxy`.
- **Media:** el bloqueo por correo permite bloquear a propósito el login de otra persona.
- **Media:** el 409 del registro revela si un correo existe.
- **Baja:** sin límite de solicitudes en `connect`, `callback`, `social-accounts` y `check` (llamadas a Google).
- **Baja:** renovaciones de token en paralelo sin bloqueo; el estado `ERROR` existe pero no se usa.
- **Baja:** si faltan permisos al conectar, la autorización parcial queda en la cuenta de Google.
- **Baja:** rotación de la clave de cifrado sin implementar (solo existe la versión 1).
- **Baja:** contadores de límite en memoria (una sola instancia).
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
- YouTube: permisos `youtube.readonly` y `yt-analytics.readonly`; `reports.query` exige además `youtube.readonly` (documentación oficial). No se pide ingresos ni gestión.
- Tokens de redes cifrados con AES-256-GCM, ligados a su fila con datos asociados; clave obligatoria en variable de entorno.
- Un canal solo puede estar conectado por un usuario (unicidad global).
- El URI de retorno de YouTube se deriva de `GOOGLE_REDIRECT_URI` (mismo servidor).
- La revocación en Google usa `https://oauth2.googleapis.com/revoke` (probada con Google real). Si falla, la cuenta se desconecta igual.
- Si Google responde `invalid_grant` al renovar, la cuenta pasa a `REVOKED` y se borran sus credenciales; un fallo de red no revoca.
- `POST /social-accounts/:id/check` solo informa si las APIs responden; no devuelve métricas.
- PostgreSQL local nativo; Docker diferido a la Fase 9.
- Prisma fijado en la versión mayor 7. Historial de Git reiniciado el 16/10/2026.

## Última tarea realizada
4.4 Renovación de tokens, estado REVOKED y comprobación de acceso a YouTube. COMPLETADA

## Próxima tarea concreta
1. Aplicar el helper de logs y levantar la excepción de la Fase 4.
2. Fase 5, con confirmación del usuario: verificar qué métricas entrega realmente YouTube Analytics con los permisos actuales, antes de diseñar tablas e historial.

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