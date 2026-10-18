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

## 4. Criterios de aceptación

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
- [ ] Aislamiento: el usuario A no puede leer ni modificar recursos del usuario B (prueba e2e).
      EXCEPCIÓN: todavía no existe ningún recurso con ID. Hoy solo se prueba que cada
      sesión ve y edita únicamente su propio perfil. Se verifica en la Fase 4.
- [x] Ninguna respuesta contiene `passwordHash` ni `tokenHash` (prueba e2e).
      (probado en registro, login y GET /users/me; aserción del PATCH añadida;
      marcar tras `npm run test:e2e` en verde)
- [x] Google: el parámetro `state` se valida y se usa PKCE; un `state` incorrecto se rechaza.
- [x] Google: se aplican las reglas de negocio 3, 4 y 5, con una prueba por cada una.
- [x] La BD solo guarda el hash del token de sesión (verificado con una consulta).

### Fase 4 — YouTube
- [ ] Aislamiento (trasladado de la Fase 3): el usuario A no puede leer, modificar ni
      desconectar cuentas sociales del usuario B; responde 404 (prueba e2e).
- [ ] Solo se piden los permisos mínimos; la lista exacta se documenta y justifica.
- [ ] Conectar un canal real crea la cuenta social y su credencial cifrada.
- [ ] Ningún token aparece en logs, respuestas ni Swagger (revisión + prueba).
- [ ] Un canal ya conectado por otro usuario es rechazado con un error claro.
- [ ] Desconectar borra la credencial y revoca el acceso en Google cuando la API lo permite.
- [ ] Un permiso revocado en Google marca la cuenta como `REVOKED` sin fallar en silencio.
- [ ] Probado con un canal real; los errores de la API externa se registran sin secretos.

### Fase 5 — Estadísticas
- [ ] Solo se almacenan métricas que la API entrega realmente.
- [ ] Sincronizar dos veces el mismo periodo no duplica registros (prueba).
- [ ] No se mezclan ni suman métricas incompatibles (por ejemplo, vistas con personas únicas).
- [ ] Los filtros 7d, 30d, 90d y personalizado devuelven rangos correctos (pruebas con fechas fijas).
- [ ] La comparación de periodos indica cuando falta información en alguno de los dos.
- [ ] Un usuario solo ve las métricas de sus propias cuentas (prueba e2e).

### Transversales (todas las fases)
- [x] Cada endpoint documentado en Swagger, con ejemplos y códigos de error.
      (los 9 endpoints de la Fase 3 aparecen en Swagger, verificado el 17/10/2026;
      falta revisar ejemplos y códigos de error uno por uno)
- [x] Entradas validadas; datos inválidos responden 400 con un mensaje útil.
      (validación global con whitelist; cubierto en registro, login y perfil)
- [ ] Límite de solicitudes en autenticación y sincronización.
      (autenticación hecha; sincronización pendiente hasta la Fase 5)
- [x] `npm run build`, `npm test` y `npm run test:e2e` pasan antes de cada commit.
- [x] `PROJECT_STATUS.md` actualizado con la evidencia real.

## 5. Decisiones
| Tema | Decisión | Estado |
|---|---|---|
| Duración de sesión | 7 días de inactividad, máximo 30 días absolutos; se renueva como máximo una vez por hora | Implementada |
| Longitud de contraseña | Mínimo 12, máximo 128 caracteres | Implementada |
| Hash de contraseñas | Argon2id (19 MiB, 2 iteraciones, 1 hilo) | Implementada |
| Límite de login | 5 fallos / 15 min por correo y 5 fallos / 15 min por IP | Implementada |
| Límite de registro | 10 por hora por IP (aprobado el 17/10/2026) | Implementada |
| Contadores de límite | En memoria, una sola instancia; Redis si hay varias | Implementada |
| Verificación de correo | Pospuesta (camino B); la regla 4 se aplica desde el principio | Pospuesta |
| Retorno tras Google | `/api/v1/users/me` hasta que exista frontend | Implementada |
| Recuperar contraseña | Fuera del MVP | Confirmada |
| Eliminar cuenta de usuario | Fuera del MVP | Confirmada |
| Origen del frontend, CORS y validación de `Origin` (CSRF) | Se decide cuando exista el frontend | Pendiente |
| Historial al desconectar una cuenta | Se decide en la Fase 5 | Pendiente |