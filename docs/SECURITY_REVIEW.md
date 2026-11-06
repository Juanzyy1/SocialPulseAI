# Revisión de seguridad (versión mínima de la Fase 9)

Estado al 03/11/2026. Alcance: backend, frontend y despliegue en Render. NO es una auditoría externa ni un test de
penetración. Evidencia: P = pruebas automáticas, R = verificado a mano en la instancia real, N = navegador real
(Playwright, pendiente de ejecutar), L = revisión del código.

## Controles verificados
| Área | Control | Evidencia |
|---|---|---|
| Contraseñas | Argon2id; nunca se guardan ni se registran en claro | P, L |
| Sesiones | Token opaco; en la base solo su hash; 7 días de inactividad y 30 absolutos; limpieza periódica | P, R |
| Cookies | HttpOnly, SameSite=Lax y Secure en producción | P, R (instancia real), N |
| Acceso | Guarda global que niega por defecto (`@Public()` marca lo público) | P |
| Aislamiento | Un usuario solo ve y modifica lo suyo (sincronización, estadísticas, cuentas, eliminación) | P |
| Fuerza bruta | Límite por correo e IP al iniciar sesión; 10 registros/hora; 10 códigos de invitación fallidos/15 min; 5 confirmaciones fallidas de eliminación/15 min | P, R (caja negra en Render) |
| IP real | `TRUST_PROXY_HOPS=2`: no se puede falsificar `X-Forwarded-For` y las IP distintas no se mezclan | R |
| OAuth | `state` + PKCE + `nonce`; permisos mínimos de solo lectura; se revoca al desconectar | P, R (Google real, desarrollo y producción) |
| Credenciales de canales | AES-256-GCM con datos asociados por fila y campo; la clave de producción debe ser distinta de la de desarrollo | P, L |
| Registros | El redactor oculta tokens y contraseñas, también dentro de URLs | P |
| Navegador | CSP estricta para la API y de solo-origen para las páginas; HSTS sin subdominios; `nosniff`; sin `X-Powered-By`; `noindex` | P, R, N |
| CSRF | SameSite=Lax y validación de `Origin` (probada detrás del proxy real) | P, R |
| Arranque | En producción falla si faltan `FRONTEND_URL` o `TRUST_PROXY_HOPS`; exige https | P |
| Datos | Eliminación de cuenta en cascada; el acceso a Google se revoca | P, R |
| Dependencias | `npm audit --omit=dev` del backend: 0 | R |
| Documentación | Swagger y diagnósticos de red apagados en producción | R, N |

## Riesgos abiertos
| Prioridad | Riesgo | Mitigación actual / siguiente paso |
|---|---|---|
| Alta | **La base de datos gratuita de Render caduca ≈ 02/12/2026** (30 días desde su creación, 14 de gracia) | Pasar a un plan de pago antes, o aceptar perder los datos |
| Alta | **Textos legales en borrador** y una beta con datos reales de otras personas | Revisión legal antes de invitar; el código de invitación limita el acceso |
| Media | Una cuenta solo de Google se elimina escribiendo el correo, sin reautenticar | Pedir una nueva autenticación con Google |
| Media | Correo no verificado al registrarse (la regla 4 de Google neutraliza el pre-registro) | Verificación por correo |
| Media | El bloqueo por correo permite bloquear a propósito el acceso de otra persona; el 409 del registro revela si un correo existe | Aceptado en la beta; revisar al abrir al público |
| Media | Sin dominio propio: Google queda en modo de pruebas (100 usuarios, conexión de YouTube caduca a los 7 días) y no hay verificación posible | Dominio propio y 9.6 |
| Media | El correo de contacto legal se publica en el repositorio y el sitio | Buzón dedicado al tener dominio |
| Media | Contadores de intentos en memoria: se reinician al reiniciar o al dormirse el servicio gratuito | Almacenarlos en la base si se escala |
| Media | Sin límite de solicitudes global en los endpoints autenticados | Limitador por usuario |
| Media | Sincronización dentro de la petición; sin sincronización periódica automática | Tarea en segundo plano |
| Media | Edad mínima (18) y textos legales sin validación legal | Revisión legal |
| Baja | Cuotas de las API de YouTube del proyecto sin verificar | Mirar la pantalla de cuotas con varios usuarios |
| Baja | Sin rotación de la clave de cifrado (solo la versión 1); renovaciones de token en paralelo sin bloqueo | Implementar si se escala |
| Baja | Jest con bandera experimental (`--experimental-vm-modules`); avisos EBADENGINE en dependencias de desarrollo | Plan B: NestJS 11 |
| Baja | Sin cierre ordenado del servidor; sin copias de seguridad propias | Con plan de pago de la base |

## Antes de abrir al público (no solo a invitados)
1. Dominio propio y verificación de Google (9.6).
2. Revisión legal de los textos y de la edad mínima.
3. Base de datos de pago con copias de seguridad.
4. Correo dedicado y verificación de correo.
5. Limitador global, y una prueba de carga mínima.
6. Instagram y TikTok, solo si se decide (Fase 8).