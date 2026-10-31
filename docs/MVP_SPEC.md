# SocialPulse AI — Especificación del MVP

Estado: APROBADO el 17/10/2026. Alcance: Fases 3 a 5 del plan.
Última revisión: 17/10/2026 (cierre de la Fase 3).

## 1. Convenciones
- Prefijo: `/api/v1`. Formato: JSON. Errores en el formato estándar de NestJS
  (`statusCode`, `message`, `error`).
- Autenticación: sesión en cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción.
  En base de datos solo se guarda el hash del token.
- "Privado" = requiere sesión válida. Cada consulta filtra por el usuario de la sesión;
  un recurso ajeno responde 404 (no 403) para no revelar que existe.
- Las respuestas nunca incluyen `passwordHash`, `tokenHash` ni tokens de redes sociales.
- La API niega por defecto: todo endpoint exige sesión salvo los marcados `@Public()`.

## 2. Endpoints

### Salud (existente, verificado)
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | /health | Público | Estado del servidor |

### Autenticación y usuarios (Fase 3, implementado)
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | /auth/register | Público | Registro con correo y contraseña |
| POST | /auth/login | Público | Inicio de sesión; fija la cookie |
| POST | /auth/logout | Privado | Invalida la sesión actual |
| POST | /auth/logout-all | Privado | Invalida todas las sesiones del usuario |
| GET | /auth/google | Público | Inicia el flujo OAuth con Google (503 si no está configurado) |
| GET | /auth/google/callback | Público | Cierra el flujo y crea la sesión; redirige a `/api/v1/users/me` |
| GET | /users/me | Privado | Perfil del usuario actual |
| PATCH | /users/me | Privado | Actualiza nombre y avatar (solo esos campos) |

### Cuentas sociales (Fase 4, pendiente)
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | /social-accounts | Privado | Lista las cuentas del usuario |
| GET | /social-accounts/:id | Privado | Detalle de una cuenta |
| DELETE | /social-accounts/:id | Privado | Desconecta la cuenta y borra sus credenciales |
| GET | /integrations/youtube/connect | Privado | Inicia la autorización del canal |
| GET | /integrations/youtube/callback | Privado | Cierra la autorización y guarda el canal |

### Estadísticas y sincronización (Fase 5, PROVISIONAL)
Los parámetros y la forma de las respuestas se definen después de comprobar qué
métricas entrega realmente la API de YouTube con los permisos mínimos. No se
promete ninguna métrica antes de esa verificación.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | /social-accounts/:id/sync | Privado | Lanza una sincronización |
| GET | /social-accounts/:id/sync-status | Privado | Estado de la última sincronización |
| GET | /analytics/accounts/:id | Privado | Métricas de una cuenta por periodo |
| GET | /analytics/overview | Privado | Resumen global |
| GET | /analytics/compare | Privado | Comparación entre dos periodos |

Filtros previstos: 7d, 30d, 90d y fechas personalizadas (`from`, `to`).

## 3. Reglas de negocio
1. El correo se guarda en minúsculas y es único.
2. Una cuenta con correo y contraseña no queda verificada hasta confirmar el correo.
   La verificación por correo está pospuesta (fase posterior), así que por ahora las
   cuentas locales quedan sin verificar. Campo: `User.emailVerifiedAt`.
3. Google solo inicia sesión o se vincula si Google reporta el correo como verificado.
4. Si el correo de Google coincide con una cuenta local SIN verificar, el sistema
   elimina la contraseña de esa cuenta, la marca como verificada, **cierra todas sus
   sesiones** y la vincula. Así una cuenta pre-registrada por un atacante no se puede
   aprovechar, ni siquiera con una sesión que ya tuviera abierta.
5. Si coincide con una cuenta local verificada, se vincula a ella sin tocar la contraseña.
   (Entra en vigor cuando exista la verificación por correo; hoy se prueba marcando la
   cuenta como verificada directamente en la base.)
6. Un canal de una plataforma solo puede estar conectado por un usuario (ya aplicado en BD).
7. Al desconectar una cuenta se borran sus credenciales; el historial de métricas
   se conserva o se elimina según la decisión pendiente de la Fase 5.
8. Los tokens de redes se cifran antes de guardarse y jamás salen del backend.


### Fase 3 — Autenticación y usuarios
Estado: COMPLETADA el 17/10/2026, con una excepción documentada (aislamiento, ver abajo).
Evidencia global: 22 pruebas unitarias y 59 e2e en verde; `tsc --noEmit` y build sin errores;
`npm audit --omit=dev` sin vulnerabilidades; flujo de Google probado con una cuenta real.

- [x] Registro válido crea el usuario; la contraseña se guarda con Argon2id, nunca en claro.
- [x] Registro con correo repetido (en cualquier combinación de mayúsculas) es rechazado.
- [x] Contraseña menor de 12 caracteres es rechazada con un mensaje claro.
      (aserción del mensaje añadida; marcar tras `npm run test:e2e` en verde)
- [x] Login correcto fija la cookie y `GET /users/me` responde 200.
- [x] Login incorrecto responde igual para "usuario inexistente" y "clave errónea".
      (mismo mensaje probado; la igualdad de tiempos está implementada pero no medida)
- [x] Logout invalida la sesión: el mismo token ya responde 401.
- [x] Tras 5 intentos fallidos en 15 minutos, el login responde 429.
- [x] Todo endpoint privado sin sesión responde 401.
- [x] Una sesión caducada responde 401.
- [x] Aislamiento: el usuario A no puede leer ni modificar recursos del usuario B (prueba e2e).
      EXCEPCIÓN: todavía no existe ningún recurso con ID. Hoy solo se prueba que cada
      sesión ve y edita únicamente su propio perfil. verificado en la 4.3
- [x] Ninguna respuesta contiene `passwordHash` ni `tokenHash` (prueba e2e).
      (probado en registro, login y GET /users/me; aserción del PATCH añadida;
      marcar tras `npm run test:e2e` en verde)
- [x] Google: el parámetro `state` se valida y se usa PKCE; un `state` incorrecto se rechaza.
- [x] Google: se aplican las reglas de negocio 3, 4 y 5, con una prueba por cada una.
- [x] La BD solo guarda el hash del token de sesión (verificado con una consulta).

### Fase 4 — YouTube
Estado: COMPLETADA el 19/10/2026, con una excepción: el criterio de logs.

- [x] Aislamiento: el usuario A no puede leer, modificar ni desconectar cuentas sociales
      del usuario B; responde 404 (e2e, 9 pruebas en `social-accounts`).
- [x] Solo se piden los permisos mínimos (`youtube.readonly` y `yt-analytics.readonly`);
      documentado en `PROJECT_STATUS.md`.
- [x] Conectar un canal real crea la cuenta social y su credencial cifrada
      (verificado en la base real el 18/10/2026).
- [ ] Ningún token aparece en logs, respuestas ni Swagger.
      Respuestas y Swagger: probado. Logs: helper `redactSecrets` pendiente de ver en verde.
- [x] Un canal ya conectado por otro usuario es rechazado con un error claro (409, e2e).
- [x] Desconectar borra la credencial y revoca el acceso en Google (e2e y prueba real).
- [x] Un permiso revocado en Google marca la cuenta como `REVOKED` sin fallar en silencio
      (e2e; prueba manual reportada por el usuario).
- [x] Probado con un canal real; los errores de la API externa se registran sin secretos
      (conexión, revocación y Analytics reales; el registro sin secretos depende del helper).


### Transversales (todas las fases)
- [x] Cada endpoint documentado en Swagger, con ejemplos y códigos de error.
      (los 9 endpoints de la Fase 3 aparecen en Swagger, verificado el 17/10/2026;
      falta revisar ejemplos y códigos de error uno por uno)
- [x] Entradas validadas; datos inválidos responden 400 con un mensaje útil.
      (validación global con whitelist; cubierto en registro, login y perfil)
- [x] Límite de solicitudes en autenticación y sincronización.
      (autenticación hecha; Estado: COMPLETADA el 19/10/2026)
- [x] `npm run build`, `npm test` y `npm run test:e2e` pasan antes de cada commit.
- [x] `PROJECT_STATUS.md` actualizado con la evidencia real.

### Fase 5 — Estadísticas
Estado: COMPLETADA (pendiente solo de ver en verde las pruebas con fechas fijas).
Evidencia global: sincronización y las tres consultas verificadas con un canal real el 22/10/2026;
las 6 tareas (5.1 a 5.4c) con sus pruebas unitarias y e2e en verde.

- [x] Solo se almacenan métricas que la API entrega realmente (sondeo real: 11 métricas
      aceptadas; el conversor solo guarda las del catálogo).
- [x] Sincronizar dos veces el mismo periodo no duplica registros (índice único + ON CONFLICT;
      3 e2e; comprobado con el canal real).
- [x] No se mezclan ni suman métricas incompatibles (catálogo por tipo; 8 pruebas de agregación
      y 11 del resumen global; sin "personas únicas").
- [x] Los filtros 7d, 30d, 90d y personalizado devuelven rangos correctos (pruebas con fechas fijas).
      `src/analytics/fixed-dates.spec.ts` (21 pruebas) pendiente de verse en verde.
- [x] La comparación de periodos indica cuando falta información en alguno de los dos
      (10 unitarias, 4 e2e y JSON real).
- [x] Un usuario solo ve las métricas de sus propias cuentas (e2e de aislamiento en sincronización,
      estadísticas, comparación y resumen).
      
## 6. Reglas de estadísticas (aprobadas el 19/10/2026)
1. Cada día es una fecha del Pacífico, guardada como fecha pura; los filtros 7/30/90/personalizado se interpretan en esas fechas y cada respuesta indica hasta qué fecha hay datos.
2. Sincronizar es repetible: clave única (cuenta, fecha, métrica) con upsert; cada sincronización relee los últimos 7 días y la carga inicial trae 90.
3. Un día ausente significa "todavía no hay dato"; un 0 presente es un cero real que YouTube informa. Solo se guardan las filas que devuelve la API y nunca se rellenan días con ceros.
4. Tipos de métrica. Sumables: views, estimatedMinutesWatched, likes, comments, shares, subscribersGained y subscribersLost. Media ponderada por vistas (no se suma): averageViewDuration. Totales puntuales, en tabla aparte con fecha de captura: subscriberCount, viewCount y videoCount. Fuera del MVP: engagedViews y redViews (definición sin verificar), dislikes y averageViewPercentage (superó el 100 %). estimatedMinutesWatched llega en minutos enteros por día, así que sumar muchos días con valores pequeños subestima el tiempo real.
5. No se suma entre plataformas salvo métricas explícitamente compatibles; el resumen global muestra cada plataforma por separado.
6. Solo nivel canal; los informes por video quedan fuera del MVP.
7. Sin "personas únicas": la API no las entrega según la documentación consultada.
8. Al desconectar una cuenta se borra su historial (cascada). Al reconectar YouTube se recupera con una carga de 90 días. Más adelante se puede ofrecer "conservar mi historial".
9. Los periodos de 7, 30 y 90 días terminan en el último día con dato de la cuenta, no en hoy. Cada respuesta indica el rango, la fecha hasta la que hay datos y cuántos días del rango faltan. Los rangos personalizados se respetan tal cual. El periodo de comparación tiene la misma longitud y es el inmediatamente anterior; si le faltan días, se dice.
10. Consulta de una cuenta: `period` (7d/30d/90d, por defecto 30d) o `from`+`to`, nunca ambos. Un rango personalizado no puede acabar después de hoy (Pacífico) ni superar 366 días. Cada respuesta incluye la cobertura (días con dato, días ausentes y sus tramos) y la advertencia propia de cada métrica. Los totales son los más recientes capturados y no dependen del periodo.
11. Comparación: `GET /analytics/compare?accountId=...` con `period` o `from`+`to`. El periodo anterior es el inmediatamente anterior y de la misma longitud. Nunca se compara en silencio: las métricas sumables solo se comparan si ambos periodos tienen el mismo número de días con dato; la duración media, si ambos tienen valor; si no, `comparable` es false y `reason` explica el motivo. `changePercent` es null cuando el valor anterior es 0. Los totales puntuales no se comparan en esta versión.
12. Resumen global: `GET /analytics/overview` (mismos parámetros de periodo, sin accountId ni daily). Los periodos predefinidos terminan en el último día con dato entre todas las cuentas y todas se evalúan en ese rango; la cobertura de cada cuenta dice qué le falta. Dentro de una plataforma se suman las métricas sumables y la duración media se pondera por las vistas de cada cuenta; si alguna cuenta tiene días ausentes, el total de su plataforma es parcial y se avisa. Los totales puntuales nunca se suman. Entre plataformas solo se suman las métricas marcadas como compatibles en el catálogo y presentes en 2 o más plataformas (hoy ninguna). Las cuentas REVOKED se incluyen con su estado a la vista.
13. Frontend y backend: validación de `Origin` en las peticiones que modifican datos (se acepta el origen del propio servidor y `FRONTEND_URL`; sin encabezado Origin se permite; `Origin: null` se rechaza). Con `FRONTEND_URL` definida, los callbacks de Google y YouTube redirigen al frontend: éxito de Google a `/`, fallo a `/login?error=<código>`, éxito de YouTube a `/cuentas?youtube=connected` y fallo a `/cuentas?youtube=error&reason=<código>`. Los códigos son rejected, unauthorized, already_connected, google_error, unavailable y error. Sin `FRONTEND_URL`, los callbacks responden como API.
14. Términos y privacidad: el usuario guarda `termsAcceptedAt` y `termsVersion`. El registro con correo exige `acceptTerms: true` y la versión vigente (si no coincide, 400). `GET /users/me` informa `termsUpToDate` y `currentTermsVersion`; quien no la haya aceptado (cuentas nuevas de Google o tras un cambio de versión) acepta con `POST /users/me/terms`, idempotente. Al vincular Google a una cuenta local sin verificar (regla 4) se borra también la aceptación. El backend informa pero no bloquea el resto de la API; la puerta está en el frontend.
15. Aceptación de términos en el frontend: quien no haya aceptado la versión vigente (cuentas nuevas de Google o tras un cambio de versión) ve una pantalla previa al panel con enlaces a los textos. Se acepta siempre la versión del texto que la interfaz muestra; si el backend exige otra, la interfaz pide recargar. Los textos están en borrador (`LEGAL_REVIEWED = false`) con marcadores `[COMPLETAR]` hasta su revisión. Una prueba del backend vigila que la versión del frontend y la del backend coincidan.
16. Panel: muestra una cuenta a la vez, con selector, porque la comparación es por cuenta. Los días sin dato nunca se dibujan como ceros. Cada métrica declara su polaridad (mejor si sube, mejor si baja, neutra) en el catálogo, que se entrega en `GET /analytics/metrics` con etiquetas en español. El periodo vive en la URL (`?period=7d|30d|90d`; por defecto 30d). Avatares: solo iniciales. El menú solo lista secciones que existen.
17 (ajuste). El aviso de retraso solo se atribuye a la plataforma si la cuenta se sincronizó hace menos de un día; si no, el aviso dice cuándo fue la última sincronización y que hay que sincronizar.
18. Gráfico de vistas por día: una barra por día del periodo, sin librería. Un día con dato es una barra; un día en cero es una línea fina (dato real); un día sin dato es un contorno punteado, y nunca se dibuja como cero. Incluye leyenda, resumen para lectores de pantalla y tabla desplegable con todos los días. La lista "Tus cuentas" muestra plataforma, estado en palabras y última sincronización.
19. Cuentas en la interfaz: conectar YouTube es una navegación completa a `/api/v1/integrations/youtube/connect` precedida de la explicación de los dos permisos de solo lectura. El resultado llega en `?youtube=connected` o `?youtube=error&reason=<código>`; el código solo se traduce por una lista cerrada y se limpia de la URL. Sincronizar muestra filas y rango, o el motivo del fallo; una sincronización fallida también refresca la lista de cuentas (puede haber quedado sin acceso). Una cuenta sin acceso ofrece Reconectar. Desconectar exige una confirmación que indica qué se borra (credenciales y estadísticas) y que al reconectar solo se recuperan los últimos 90 días; el resultado informa si Google confirmó la revocación.
20. Periodo en la interfaz: uno de los predefinidos (7, 30, 90 días) o un rango personalizado con las reglas del backend (fechas reales, inicio no posterior al fin, fin no posterior a hoy en hora del Pacífico, máximo 366 días), guardado en la URL. Una URL inválida vuelve a 30 días. El resumen global (`/resumen`) muestra cada plataforma por separado, con totales parciales avisados, la cobertura de cada cuenta y los totales del canal sin sumar entre cuentas; nunca muestra los textos técnicos del backend.
21. Contrato entre frontend y backend: el frontend declara en `frontend/src/api/contracts/*.json` la forma de las respuestas que consume. Al compilar, cada JSON debe cumplir su tipo de TypeScript; en las pruebas e2e del backend, cada respuesta real debe tener los campos del JSON con el mismo tipo (se permiten campos extra). Un `null` en el JSON significa campo anulable. Pruebas de componentes (Testing Library + jsdom) cubren login, conexión y desconexión de cuentas, sincronización y las guardas de sesión y términos.
22. Laboratorio de IA (etapa 7, solo arquitectura): puertos `VideoStorage` y `VideoAnalyzer` con implementación "no disponible" (503); reglas de video (MP4, MOV y WebM identificados por sus primeros bytes, 200 MB, 5 minutos, 9:16, 16:9 y 1:1); toda respuesta de un modelo pasa por `finalizeAnalysis` (potencial como nivel con razones, sin cifras de alcance, sin promesas de viralidad; `isEstimate` y el aviso los añade el sistema). Diseño y decisiones abiertas en `docs/AI_LAB_DESIGN.md`.


## DECISIONES
| Frontend: tecnología | React + Vite + TypeScript, aplicación de una sola página en `frontend/` | Confirmada el 22/10/2026 |
| Frontend: origen y CORS | Mismo origen mediante proxy (`/api` hacia el backend); sin CORS en desarrollo. En producción, servidor inverso (Fase 9) | Confirmada |
| Frontend: Apple | Sin "Sign in with Apple" en el MVP (no está en el plan) | Confirmada |
| Frontend: términos y privacidad | Páginas de ambos (texto redactado o revisado por el usuario) y aceptación guardada en el backend (`termsAcceptedAt`) | Confirmada; backend pendiente (F.1b) |
| Frontend: registro | El frontend llama a `register` y luego a `login`; el backend no cambia | Confirmada |
| Frontend: temas e idioma | Login claro y panel oscuro, sin selector; solo español, sin librería de traducción | Confirmada |
| Frontend: primer panel | Tarjetas de métricas, gráfico de vistas por día y lista de cuentas; sin gráfico radial ni ingresos | Confirmada |
| Frontend: estilo | Tailwind CSS (compatibilidad con Vite 8 por verificar al instalar) | Confirmada el 24/10/2026 |
| Términos y privacidad | Páginas con texto borrador versionado (versión `2026-10-24`), a revisar por el usuario o un profesional antes de publicar | Confirmada |
| Aceptación de términos | Se guarda en el backend (`termsAcceptedAt`, `termsVersion`); el registro con correo exige `acceptTerms: true` y la versión vigente | Confirmada |
| Puerta de aceptación | Quien no haya aceptado la versión vigente (p. ej. cuentas nuevas de Google) ve una pantalla de aceptación antes del panel | Confirmada |
| Pantallas de entrada | Login diseñado por nosotros con el mismo estilo que el registro; requisito de contraseña visible, sin medidor; tras registrarse se inicia sesión automáticamente | Confirmada |
| Imagen lateral | La aporta el usuario; pendiente de confirmar derechos, nombre de marca y peso | Pendiente |
| Nombre y patrocinio | App: SocialPulse AI. Patrocinador: wav.soft ("Patrocinado por wav.soft"). Constantes en `frontend/src/config/app.ts` | Confirmada el 24/10/2026 |
| Registro: nombre | Obligatorio en la interfaz (el backend lo admite opcional) | Confirmada |
| Color de marca | Azul, a juego con la imagen lateral; tokens en `index.css` | Propuesta, pendiente de confirmar |
| Imagen lateral | `public/auth-side.webp` (opcional); pendiente de confirmar derechos, logotipos de terceros, retratos y peso | Pendiente |
| Desconectar una cuenta | Borra credenciales y estadísticas; al reconectar solo se recuperan 90 días. El usuario lo decide con una confirmación explícita (decisión del 30/10/2026) | Confirmada |
| Acceso a Google en pruebas | Solo cuentas autorizadas (hasta 100) hasta publicar y verificar la aplicación (Fase 9) | Confirmada |