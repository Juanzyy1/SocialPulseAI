# Fase 8: Instagram y TikTok (viabilidad)

Estado al 07/11/2026. Pedido explícito del usuario.

## Plan de ejecución
| Tarea | Alcance | Estado |
|---|---|---|
| 8.0 | Refactor sin cambiar comportamiento: contrato de adaptador por plataforma, con YouTube como primero | COMPLETADA; 388 unitarias, 182 e2e, build y lint en verde |
| 8.1a | Verificación oficial vigente, configuración de Meta y permisos mínimos | IMPLEMENTADA; queda confirmar el flujo real de Meta con la cuenta del usuario |
| 8.1b | Renovación segura, sincronización y catálogo de Instagram | EN PROGRESO; alcance diario sincronizable; falta validar en Meta y cerrar renovación segura |
| 8.2a / 8.2b | Verificación y conexión de TikTok: autorización, sincronización, catálogo e interfaz | PENDIENTE |
| 8.3 | Textos legales por plataforma, nueva versión, pruebas de navegador y revisión de seguridad | PENDIENTE |

Los adaptadores de sincronización comparten el mismo ciclo de persistencia. YouTube conserva su comportamiento;
Instagram consulta Insights y almacena alcance diario. TikTok aún no tiene integración. No se simulan respuestas
ni se convierten datos ausentes en ceros.

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
- Si una métrica no está disponible, la API devuelve un conjunto vacío, no cero; algunas métricas requieren 100
  seguidores, `online_followers` solo tiene 30 días y los datos pueden retrasarse hasta 48 horas.
- El ejemplo oficial vigente muestra Graph API v27.0; confirmar la versión activa al crear/configurar la app.

Pendiente: comprobar con la cuenta del usuario qué datos devuelve Meta, límites/cuotas, testers y requisitos de
publicación para esta app. No asumir el comportamiento de renovación de tokens de Instagram Login: Unified Login
entrega un token del sistema de usuario del negocio y todavía no se implementa una renovación automática.

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

## TikTok (Login Kit + Display API)
Verificado:
- Permisos: `user.info.basic` (identidad), `user.info.profile` (biografía, verificación), `user.info.stats`
  (seguidores, seguidos, me gusta, videos) y `video.list` (videos públicos). Se pueden conceder parcialmente.
- Aplicación nueva: borrador con acceso sandbox (solo usuarios objetivo añadidos). Para usuarios ajenos: revisión
  (descripción, video de demostración, direcciones de términos y privacidad). Revisión por permiso (terceros).
- La API de investigación es solo académica.
- NO hay series diarias (vistas, alcance, impresiones): totales de cuenta y lista de videos.
Por verificar: vistas/comentarios/compartidos por video; duración de tokens; direcciones de retorno en desarrollo;
si términos y privacidad exigen dominio propio; límite de uso (cifra truncada en la fuente).

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