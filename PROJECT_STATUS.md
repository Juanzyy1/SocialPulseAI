# SocialPulse AI — Estado del proyecto

Última actualización: 22/10/2026

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
| 4. Integración con YouTube | COMPLETADA | Cerrada el 19/10/2026 |
| 5. Estadísticas e historial | COMPLETADA | aprobado el 23/10/2026 |
| F. Frontend (nueva) | EN PROGRESO
| 6 a 9 | PENDIENTES | |

## Pruebas actuales
- Unitarias: 122 en 16 suites (verificadas). Con `fixed-dates.spec.ts`: 143 en 17 (pendiente de ver).
- e2e (contra PostgreSQL real): 137 en 16 suites (verificadas).
- `tsc --noEmit` y `nest build` sin errores.
- Verificado con Google/YouTube reales: login, conexión del canal, revocación, acceso a Analytics,
  sincronización de 90 días (699 filas) y las tres consultas de estadísticas.

## Fase 5 — Estadísticas e historial
| Tarea | Estado | Evidencia |
|---|---|---|
| Verificación documental | COMPLETADA | Métricas y reglas de tiempo; las fuentes de terceros quedaron marcadas como sin confirmar |
| 5.1 Sondeo de YouTube Analytics | COMPLETADA | Sondeo real del 21/10: 11 métricas aceptadas; ceros explícitos; retraso observado de ~2-3 días. Endpoint temporal ya eliminado |
| 5.2 Modelo del historial | COMPLETADA | 3 tablas por migración; fechas del Pacífico sin desfase en PostgreSQL real; catálogo y agregación con pruebas |
| 5.3 Sincronización real | COMPLETADA | 14 unitarias + 12 e2e; 699 filas reales (coinciden con Studio); 429, segunda sincronización y `sync-status` confirmados |
| 5.4a Estadísticas de una cuenta | COMPLETADA | 17 unitarias + 11 e2e; JSON real |
| 5.4b Comparación de periodos | COMPLETADA | 10 unitarias + 9 e2e; JSON real; mensaje global corregido |
| 5.4c Resumen global | COMPLETADA | 11 unitarias + 10 e2e; JSON real |
| Pruebas con fechas fijas | POR VERIFICAR | `fixed-dates.spec.ts`: 21 pruebas con cambios de horario, año bisiesto y cambio de año |

## Fase F — Frontend
| Tarea | Estado |
|---|---|
| F.1a Estructura de `frontend/` y proxy | COMPLETADA | Build, proxy y 401 a través del proxy verificados el 24/10/2026 |
| F.1b Origin, FRONTEND_URL y redirecciones | COMPLETADA | Código y 38 pruebas escritas (28 unitarias y 10 e2e) | Pruebas automáticas y verificación manual |
| F.1c Catálogo de métricas y `termsAcceptedAt` | PENDIENTE | Se hará con el panel (F.4) y el registro (F.3) |
| F.2 Cliente de la API con tipos desde Swagger, rutas y estado de sesión | COMPLETADA |
| F.3 Pantallas de registro y login (Google incluido) | COMPLETADA |
| F.3a Backend: aceptación de términos | COMPLETADA | Verificada por el usuario (migración, pruebas y comprobación manual); salidas no adjuntas |
| F.3b Tailwind y pantallas de registro y login | COMPLETADA | Código y 34 pruebas nuevas escritas (57 en total en el frontend) | Build, lint, pruebas y verificación manual |
| F.3c Términos, privacidad y puerta de aceptación | COMPLETADA | Código y 20 pruebas escritas (18 del frontend y 2 del backend) | Pruebas automáticas y verificación manual |
| F.4 Panel: tarjetas, gráfico de vistas por día y cuentas | COMPLETADA |
| F.4a Backend: catálogo de métricas | COMPLETADA | 181 unitarias en verde; endpoint comprobado a mano; falta ver las 3 e2e y `tsc` |
| F.4b Estructura del panel | COMPLETADA | 87 pruebas del frontend, build y lint limpios; 8 pruebas manuales correctas el 26/10/2026 |
| F.4c Selector de cuenta y tarjetas de métricas | COMPLETADA | 169 pruebas del frontend, build y lint limpios; pruebas manuales correctas el 29/10/2026 |
| F.4d Gráfico de vistas por día y lista de cuentas | COMPLETADA | 221 pruebas del frontend, build y lint limpios; pruebas manuales correctas (reportadas por el usuario, sin capturas) el 29/10/2026 |
| F.5 Cuentas: conectar, sincronizar y desconectar | COMPLETADA | 264 pruebas del frontend, build limpio; pruebas manuales aprobadas por el usuario (sin capturas) el 30/10/2026; lint: 1 aviso corregido |
| F.6 Rango personalizado, resumen global y pulido | COMPLETADA | 303 pruebas del frontend; build (CSS incluido), lint y pruebas manuales correctas el 31/10/2026 |
| F.7 Pruebas de componentes y contrato (versión mínima) | COMPLETADA | Frontend: 337 pruebas; backend: 192 unitarias y 172 e2e; las tres roturas deliberadas del contrato fallaron como debían (confirmado por el usuario) |
| Etapa 7: arquitectura del laboratorio de IA | POR VERIFICAR | Código y unas 85 pruebas escritas | lint, build, pruebas y e2e |

## Errores, riesgos y bloqueos
- Sin bloqueos.
- **Media:** Google en modo Testing: la conexión de YouTube caduca a los 7 días; se maneja con REVOKED y reconexión.
- **Media:** Jest requiere `--experimental-vm-modules` (`@nestjs/testing` 12 es solo ESM). Plan alternativo: bajar a NestJS 11.
- **Media:** `day` de YouTube Analytics se asume en hora del Pacífico; está documentado para la API de informes masivos y no está probado directamente para Analytics. Los datos observados son coherentes.
- **Media:** flag `Secure` de cookies solo revisado en el código, no probado con `NODE_ENV=production`.
- **Media:** CSRF se apoya en `SameSite=Lax`; validar `Origin` queda pendiente hasta definir el frontend.
- **Media:** verificación de correo pospuesta; la regla 4 neutraliza la pre-registración.
- **Media:** no desplegar tras un proxy sin configurar `trust proxy`.
- **Media:** el bloqueo por correo permite bloquear a propósito el login de otra persona.
- **Media:** el 409 del registro revela si un correo existe.
- **Media:** no hay sincronización automática periódica; la lanza el usuario. Corre dentro de la petición.
- **Baja:** cuota de la API de Analytics desconocida; el sondeo hacía 13 llamadas, la sincronización hace 2.
- **Baja:** solo se releen 7 días: una corrección de YouTube sobre un dato más antiguo no se detecta sin recarga completa.
- **Baja:** redondeo de suscriptores y umbrales de privacidad con poco tráfico: sin verificar (el canal de prueba tiene un video).
- **Baja:** las notas de las métricas se repiten en cada respuesta; conviene un endpoint de catálogo para el frontend.
- **Baja:** sin límite de solicitudes en `connect`, `callback`, `social-accounts`, `check` y consultas de estadísticas.
- **Baja:** contadores de límite y control de sincronizaciones simultáneas en memoria (una sola instancia).
- **Baja:** rotación de la clave de cifrado sin implementar; estado `ERROR` sin usar; renovaciones de token en paralelo sin bloqueo.
- **Baja:** las e2e dependen de PostgreSQL encendido y de un `.env` local (Fase 9).
- **Baja:** avisos `EBADENGINE` y vulnerabilidades solo en dependencias de desarrollo.
- Repositorio **público**: nunca subir `.env`, claves ni secretos, ni el JSON de los sondeos.
- **Media:** textos legales en borrador (unos 16 marcadores `[COMPLETAR]`) sin revisión legal; no publicar la aplicación con ellos. La declaración de uso limitado de Google está sin verificar.
- **Media:** no existe eliminación de cuenta ni limpieza programada de sesiones caducadas; la política de privacidad no puede prometerlas.
- **Baja:** la imagen lateral original pesa 1,99 MB; convertir a WebP antes de subirla. El arte promete funciones futuras (crea, automatiza, TikTok, X); revisar antes de abrirla al público.
- **Baja:** el gráfico es propio (SVG); si hacen falta varias series, zoom o más tipos de gráfico, evaluar una librería con verificación previa de compatibilidad con React 19 y Vite 8.
- **Baja:** los tipos del frontend se escriben a mano, pero están protegidos por un contrato (9 JSON comprobados al compilar y contra el backend en las pruebas e2e); un endpoint nuevo exige un JSON nuevo. Y agrega: Media: los componentes del panel (tarjetas, gráfico, selector, resumen) no tienen pruebas de componentes; solo su lógica.
- **Media:** antes del laboratorio de IA hay que actualizar la política de privacidad (nombrar al proveedor de IA y su tratamiento de los videos), subir la versión de los textos y verificar la retención y el entrenamiento de datos del proveedor.
- **Media:** el filtro de promesas de la IA es por patrones (red de seguridad, no garantía); la subida de videos exigirá decodificación en un proceso aislado.
- **Baja:** el procesamiento multimedia probablemente exija ffmpeg en el servidor (por verificar su disponibilidad y licencia).

## Decisiones técnicas confirmadas
- Monolito modular NestJS + Prisma 7 + PostgreSQL, REST con prefijo `/api/v1`.
- Sesiones en base de datos con token opaco en cookie; solo se guarda su hash. Argon2id para contraseñas.
- Guard global que niega por defecto; `@Public()` marca lo público.
- Límite de intentos con contador propio en memoria (no `@nestjs/throttler`).
- Google en modo Testing; publicar o verificar la app se aplaza a la Fase 9.
- YouTube: permisos `youtube.readonly` y `yt-analytics.readonly`. Tokens cifrados con AES-256-GCM.
- Un canal solo puede estar conectado por un usuario (unicidad global). Al desconectar se borra su historial.
- Métricas en filas (cuenta, fecha, métrica) con catálogo en código; cada día es una fecha del Pacífico guardada como fecha pura.
- Tipos de métrica: sumables, media ponderada por vistas y totales puntuales (tabla aparte). Sin "personas únicas".
- Sincronización: carga inicial de 90 días y ventana de 7; todo o nada en una transacción; una por minuto y una a la vez por cuenta; un fallo responde 200 con `status: FAILED`.
- Consultas: periodos predefinidos terminan en el último día con dato; cobertura siempre visible; la comparación nunca compara en silencio; el resumen global usa un rango común y no suma totales puntuales ni métricas no compatibles.
- PostgreSQL local nativo; Docker diferido a la Fase 9. Prisma fijado en la versión mayor 7.

## Pendiente de planificación: frontend
No está en las 9 fases originales; fase nueva después de la 5. Decisiones que esperan al frontend: tecnología, CORS y validación de `Origin` (CSRF), destino de las redirecciones tras Google y YouTube, cookies en producción, origen de los avatares y endpoint de catálogo de métricas. Los dos diseños de referencia del PDF llegaron solo como título; subir las imágenes al empezar.

## Última tarea realizada
5.4c Resumen global y cierre del repaso de la Fase 5.

## Próxima tarea concreta
Ver en verde `fixed-dates.spec.ts` y cerrar la Fase 5. Después, con confirmación, empezar la fase de frontend con una tarea de decisiones (tecnología, estructura del repositorio y diseños de referencia).

## Comandos importantes (desde `backend/`)
```powershell
npm run start:dev       # servidor en desarrollo
npm run build           # compilar (única comprobación de tipos de src)
npm test                # pruebas unitarias
npm run test:e2e        # pruebas e2e (requiere PostgreSQL encendido)
npx tsc --noEmit -p tsconfig.json   # tipos de src y de las pruebas
npx prisma migrate dev  # crear y aplicar migraciones
npx prisma generate     # regenerar el cliente (necesario tras cambiar el esquema)
```
URLs locales: `http://localhost:3000/api/v1/health` y `http://localhost:3000/api/docs`