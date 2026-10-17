# SocialPulse AI — Especificación del MVP

Estado: APROBADO el 17/10/2026. Alcance: Fases 3 a 5 del plan.

## 1. Convenciones
- Prefijo: `/api/v1`. Formato: JSON. Errores en el formato estándar de NestJS
  (`statusCode`, `message`, `error`).
- Autenticación: sesión en cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción.
  En base de datos solo se guarda el hash del token.
- "Privado" = requiere sesión válida. Cada consulta filtra por el usuario de la sesión;
  un recurso ajeno responde 404 (no 403) para no revelar que existe.
- Las respuestas nunca incluyen `passwordHash`, `tokenHash` ni tokens de redes sociales.

## 2. Endpoints
Las cuentas locales quedan sin verificar hasta implementar el envío de correo (fase posterior). Se agrega User.emailVerifiedAt.

### Salud (existente, verificado)
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | /health | Público | Estado del servidor |

### Autenticación y usuarios (Fase 3)
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | /auth/register | Público | Registro con correo y contraseña |
| POST | /auth/login | Público | Inicio de sesión; fija la cookie |
| POST | /auth/logout | Privado | Invalida la sesión actual |
| POST | /auth/logout-all | Privado | Invalida todas las sesiones del usuario |
| GET | /auth/google | Público | Inicia el flujo OAuth con Google |
| GET | /auth/google/callback | Público | Cierra el flujo y crea la sesión |
| GET | /users/me | Privado | Perfil del usuario actual |
| PATCH | /users/me | Privado | Actualiza nombre y avatar |

### Cuentas sociales (Fase 4)
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
   Se agrega `User.emailVerifiedAt` (migración de la Fase 3).
3. Google solo inicia sesión o se vincula si Google reporta el correo como verificado.
4. Si el correo de Google coincide con una cuenta local SIN verificar, el sistema
   elimina la contraseña de esa cuenta, la marca como verificada y la vincula.
   Así una cuenta pre-registrada por un atacante no se puede aprovechar.
5. Si coincide con una cuenta local verificada, se vincula a ella sin tocar la contraseña.
6. Un canal de una plataforma solo puede estar conectado por un usuario (ya aplicado en BD).
7. Al desconectar una cuenta se borran sus credenciales; el historial de métricas
   se conserva o se elimina según la decisión pendiente de la Fase 5.
8. Los tokens de redes se cifran antes de guardarse y jamás salen del backend.

## 4. Criterios de aceptación

### Fase 3 — Autenticación y usuarios
- [ ] Registro válido crea el usuario; la contraseña se guarda con Argon2id, nunca en claro.
- [ ] Registro con correo repetido (en cualquier combinación de mayúsculas) es rechazado.
- [ ] Contraseña menor de 12 caracteres es rechazada con un mensaje claro.
- [ ] Login correcto fija la cookie y `GET /users/me` responde 200.
- [ ] Login incorrecto responde igual para "usuario inexistente" y "clave errónea".
- [ ] Logout invalida la sesión: el mismo token ya responde 401.
- [ ] Tras 5 intentos fallidos en 15 minutos, el login responde 429.
- [ ] Todo endpoint privado sin sesión responde 401.
- [ ] Una sesión caducada responde 401.
- [ ] Aislamiento: el usuario A no puede leer ni modificar recursos del usuario B (prueba e2e).
- [ ] Ninguna respuesta contiene `passwordHash` ni `tokenHash` (prueba e2e).
- [ ] Google: el parámetro `state` se valida y se usa PKCE; un `state` incorrecto se rechaza.
- [ ] Google: se aplican las reglas de negocio 3, 4 y 5, con una prueba por cada una.
- [ ] La BD solo guarda el hash del token de sesión (verificado con una consulta).

### Fase 4 — YouTube
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
- [ ] Cada endpoint documentado en Swagger, con ejemplos y códigos de error.
- [ ] Entradas validadas; datos inválidos responden 400 con un mensaje útil.
- [ ] Límite de solicitudes en autenticación y sincronización.
- [ ] `npm run build`, `npm test` y `npm run test:e2e` pasan antes de cada commit.
- [ ] `PROJECT_STATUS.md` actualizado con la evidencia real.

## 5. Decisiones pendientes (valores propuestos)
| Tema | Propuesta |
|---|---|
| Duración de sesión | 7 días de inactividad, máximo 30 días absolutos |
| Longitud mínima de contraseña | 12 caracteres |
| Límite de login | 5 intentos / 15 min por correo y por IP |
| Verificación de correo | Obligatoria para cuentas locales (necesita envío de correo) |
| Recuperar contraseña | Fuera del MVP |
| Eliminar cuenta de usuario | Fuera del MVP |
| Origen del frontend y CORS | Se decide cuando exista el frontend |
| Historial al desconectar una cuenta | Se decide en la Fase 5 |
Pospuesta (camino B): se aplica la regla 4 desde el principio; la regla 5 entra en vigor cuando exista la verificación