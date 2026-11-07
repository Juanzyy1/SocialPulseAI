# Fase 8: Instagram y TikTok (viabilidad)

Estado al 07/11/2026. Pedido explícito del usuario.

## Plan de ejecución
| Tarea | Alcance | Estado |
|---|---|---|
| 8.0 | Refactor sin cambiar comportamiento: contrato de adaptador por plataforma, con YouTube como primero | COMPLETADA; 388 unitarias, 182 e2e, build y lint en verde |
| 8.1a | Verificación oficial vigente, configuración de Meta y permisos mínimos | COMPLETADA; conexión y sincronización validadas con la cuenta del usuario |
| 8.1b | Renovación segura, sincronización y catálogo de Instagram | EN PROGRESO; sincronización real confirmada; renovación automática no implementada |
| 8.2a | Verificación oficial, permisos y configuración de la app TikTok | DOCUMENTACIÓN VERIFICADA; falta que el usuario registre/configure la app |
| 8.2b | Conexión de TikTok: autorización, renovación, sincronización, catálogo e interfaz | IMPLEMENTADA; falta probar con la app/cuenta real |
| 8.3 | Textos legales por plataforma, nueva versión, pruebas de navegador y revisión de seguridad | PENDIENTE |

Los adaptadores de sincronización comparten el mismo ciclo de persistencia. YouTube conserva su comportamiento;
Instagram consulta Insights y almacena alcance diario; TikTok almacena capturas de totales del perfil y de videos
públicos recientes. No se simulan respuestas ni se convierten datos ausentes en ceros.

## Fuentes consultadas (documentación oficial salvo indicación; verificar de nuevo antes de implementar cada plataforma)
- Meta, Instagram Platform overview: https://developers.facebook.com/documentation/instagram-platform/overview
- Meta, Instagram API with Instagram Login:
  https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login
- Meta, Instagram API with Unified Login:
  https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login
- Meta, Unified Login get started:
  https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started
- Meta, Unified Login permissions:
  https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions
- Meta, Business Login for Instagram:
  https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
- Meta, Get started:
  https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started
- Meta, Instagram Account Insights:
  https://developers.facebook.com/documentation/instagram-platform/api-reference/instagram-user/insights
- TikTok, Display API (empezar): https://developers.tiktok.com/doc/display-api-get-started
- TikTok, referencia de permisos: https://developers.tiktok.com/doc/tiktok-api-scopes/
- Terceros (a confirmar): guías de Frontegg, Phyllo y Unified sobre revisión de aplicaciones en TikTok.

## Instagram (API con Unified Login)
Verificado en documentación oficial el 07/11/2026:
- Solo cuentas profesionales (empresa o creador). Una cuenta personal no sirve.
- No exige página de Facebook vinculada.
- La app de Meta debe ser de tipo Business. Standard Access sirve para cuentas propias/administradas y personas
  con un rol en la app; cuentas de usuarios externos requieren Advanced Access, App Review y verificación de empresa.
- La referencia de Insights confirma explícitamente compatibilidad con Unified Login, host `graph.facebook.com`,
  token del sistema de usuario del negocio y permisos `instagram_basic` + `instagram_manage_insights`.
- La primera sincronización consulta `reach` con `period=day` y `metric_type=time_series`, única métrica consultada
  que documenta una serie temporal en la referencia actual. Se expone como promedio diario: sumar alcances diarios
  contaría repetidamente a las mismas personas. `views` es `total_value`, no se trata como serie diaria; `impressions`
  está deprecado en v22 y posteriores.
- Meta limita el rango de cada consulta Insights a 30 días; el adaptador divide rangos largos en bloques de 29 días
  para incluir fechas completas, también al cruzar el cambio de horario. Si algún bloque falla, no se persiste ningún
  dato de esa ejecución.
- Si una métrica no está disponible, la API devuelve un conjunto vacío, no cero; algunas métricas requieren 100
  seguidores, `online_followers` solo tiene 30 días y los datos pueden retrasarse hasta 48 horas.
- Meta especifica que `follower_count` y `online_followers` no están disponibles en cuentas con menos de 100
  seguidores. La sincronización implementada consulta únicamente alcance diario; no obtiene likes ni compartidos.
- El ejemplo oficial vigente muestra Graph API v27.0; confirmar la versión activa al crear/configurar la app.

Verificado en la cuenta del usuario: conexión y sincronización de alcance completadas correctamente. Pendiente:
decidir/documentar el tratamiento de caducidad de tokens Unified Login; el backend guarda la fecha que Meta entrega
y pide volver a conectar una cuenta caducada, no implementa renovación automática. No asumir las reglas de
renovación de Instagram Login, ya que el flujo utilizado es Unified Login.

### Configuración inicial acordada
- Cuenta: Instagram Business.
- Alcance inicial: solo la cuenta propia o administrada (Standard Access); no se solicitará Advanced Access por ahora.
- El usuario ya creó la app y seleccionó **Instagram API (Unified Login)**; el `config_id` de la captura es
  `1248684200916395` (no es un secreto).
- Unified Login es el flujo recomendado por Meta para nuevas integraciones. Inicia en Facebook Login for Business,
  recibe un token del sistema de negocio y obtiene las cuentas con `/{app-scoped-user-id}/assigned_instagram_accounts`;
  no se debe usar el OAuth ni los scopes de Instagram Login (`instagram_business_*`).
- Para conectar la cuenta propia basta Standard Access y rol/tester en la app; cuentas de clientes externos requieren
  Advanced Access, App Review y modo Live.
- En Development, agregar la cuenta de prueba como Instagram Tester y aceptar la invitación desde Instagram
  (**Settings → Website permissions → Apps and websites → Tester Invites**) antes de probar el acceso.
- La configuración debe pedir solo los activos/permisos necesarios: cuenta de Instagram, `instagram_basic` y
  `instagram_manage_insights`. No solicitar cuenta publicitaria, mensajes, comentarios, publicación ni anuncios para
  el alcance actual.
- No pegar secretos de la app en el chat ni subirlos al repositorio. El `INSTAGRAM_CLIENT_SECRET` se configura solo
  en el entorno local y Render.

### OAuth implementado (8.1 inicial)
- Callback registrado en el backend: `/api/v1/integrations/instagram/callback`.
- Inicio autenticado: `/api/v1/integrations/instagram/connect`; genera la URL del diálogo unificado con `client_id`,
  `config_id`, `redirect_uri`, `state` y la configuración seleccionada.
- El callback valida la sesión y `state`, intercambia el código servidor-a-servidor, obtiene las cuentas compartidas,
  y guarda los tokens cifrados. No persiste el token en claro.
- Configuración necesaria: `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_CONFIG_ID` y
  `INSTAGRAM_REDIRECT_URI`. Como Instagram es opcional, variables ausentes o incompletas no impiden el arranque;
  el endpoint de conexión queda deshabilitado hasta que se configuren las cuatro.
- El `INSTAGRAM_CONFIG_ID` de la configuración mostrada por el usuario se fija en `render.yaml`; el ID de app y
  el secreto se agregan en Render (el secreto nunca va a Git). Para pruebas locales, definir las cuatro variables
  en `backend/.env`.
- Para `socialpulse-ai-xweo.onrender.com`, el URI exacto de retorno es
  `https://socialpulse-ai-xweo.onrender.com/api/v1/integrations/instagram/callback`.
- El token Unified Login puede ser de duración variable según la configuración de Meta. El backend guarda `expires_in`
  cuando Meta lo entrega y rechaza el uso de tokens vencidos; la renovación silenciosa no está implementada.
- La pantalla **Cuentas** ya ofrece **Conectar Instagram**, lista las cuentas conectadas y redirige cuentas revocadas
  al flujo de reconexión; cuentas activas también pueden volver a autorizarse. El botón **Sincronizar** ejecuta
  Insights. La serie se valida y persiste dentro de la transacción común del adaptador, con ceros explícitos
  conservados y datos ausentes omitidos.
- No solicitar ni configurar webhooks todavía; el flujo de métricas inicial no depende de notificaciones push y no
  existe un endpoint de webhook implementado.

## TikTok (Display API y Login Kit Web)
Verificado en documentación oficial de TikTok el 07/11/2026:
- Login Kit Web entrega access token y refresh token; el token de acceso dura 2 horas y el de renovación 180 días.
  Los refresh tokens rotan: hay que reemplazar el token guardado después de cada renovación. La renovación debe
  ocurrir en backend cuando una sincronización detecta que el access token está por vencer o ya venció.
- `user.info.stats` da acceso a `follower_count`, `following_count`, `likes_count` y `video_count`. Por tanto,
  TikTok expone el total actual de seguidores y likes sin el umbral de 100 seguidores documentado por Meta.
- `video.list` solo devuelve videos públicos, paginados hasta 20 por página. La sincronización consulta una página
  (los 20 más recientes) para mantener acotadas las solicitudes. Por video se pueden pedir
  `view_count`, `like_count`, `comment_count` y `share_count`; son contadores acumulados del video, no métricas
  diarias de cuenta. No se deben sumar como si fueran actividad diaria.
- Permisos mínimos previstos: `user.info.basic`, `user.info.stats` y `video.list`; no se solicitarán permisos para
  publicar ni administrar contenido.
- Para comenzar, el usuario debe crear una app en TikTok for Developers, añadir los productos Login Kit (Web) y
  Display API y habilitar esos permisos. Login Kit requiere una URI de retorno HTTPS exacta, estática y sin query
  string ni fragmento, incluso al probar en Sandbox. Para desarrollo local hace falta un túnel HTTPS. La app puede
  probarse en Sandbox; la disponibilidad en Production requiere enviar la configuración a revisión. Las apps nuevas
  deben verificar también sus URLs de términos, privacidad y sitio web
  antes de enviar a revisión.
- URI de retorno configurada en Render: `https://socialpulse-ai-xweo.onrender.com/api/v1/integrations/tiktok/callback`.
- No se ha conectado una cuenta TikTok todavía; el estado de permisos y acceso deberá verificarse con la app real.
- La integración de TikTok ya está cableada en el proyecto: variables `TIKTOK_CLIENT_KEY`,
  `TIKTOK_CLIENT_SECRET` y `TIKTOK_REDIRECT_URI`; la URI de Render está definida en `render.yaml`.
  Configura client key y secret como secretos en Render después de crear la app. La migración de base de datos
  agrega la expiración del refresh token rotatorio.
- El panel captura totales de perfil y sumas de contadores de hasta los 20 videos públicos más recientes.
  TikTok Display API no ofrece series diarias en este flujo, así que las métricas se muestran como capturas puntuales.

Fuentes oficiales:
- TikTok, [Display API - Get Started](https://developers.tiktok.com/docs/en/display-api-get-started)
- TikTok, [Login Kit for Web](https://developers.tiktok.com/docs/en/login-kit-web)
- TikTok, [scopes](https://developers.tiktok.com/docs/en/tiktok-api-scopes)
- TikTok, [User Info v2](https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info)
- TikTok, [Video Object](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-object)
- TikTok, [Video List v2](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list)
- TikTok, [Manage OAuth Access Tokens](https://developers.tiktok.com/docs/en/oauth-user-access-token-management)
- TikTok, [Create an App](https://developers.tiktok.com/docs/en/getting-started-create-an-app)
- TikTok, [Revoke a User Access Token](https://developers.tiktok.com/docs/en/oauth-revoke-a-user-access-token)

## Encaje en el modelo actual
- Instagram: métricas diarias (`account_daily_metrics`) y totales puntuales (`account_total_snapshots`).
- TikTok: solo totales puntuales; la historia se construye guardando una captura por sincronización.
- Nunca se suman métricas entre plataformas (todas con `compatibleGroup = null`).
- Interfaz: no mostrar el gráfico de vistas donde no existe la métrica.

## Orden propuesto
1. Instagram (tu propia cuenta no necesita revisión).
2. TikTok (sandbox para tu cuenta; la revisión, solo si se abre a otras personas).

## Implicaciones
- Cada plataforma exige sus propios términos y política de privacidad: nueva versión de los textos legales.
- Para abrir a terceros hará falta, casi seguro, dominio propio (revisión de Meta y de TikTok).
- Cuentas necesarias para probar: Instagram profesional (empresa o creador) y una cuenta de TikTok.