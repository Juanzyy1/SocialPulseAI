# Fase 8: Instagram y TikTok (viabilidad)

Estado al 03/11/2026. Pedido explícito del usuario. No hay ninguna integración implementada, ni simulada.

## Fuentes consultadas (documentación oficial salvo indicación)
- Meta, Instagram Platform (visión general, acceso estándar y avanzado):
  https://developers.facebook.com/docs/instagram-platform/overview
- Meta, Instagram API con inicio de sesión de Instagram:
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
- Meta, Instagram Account Insights:
  https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
- TikTok, Display API (empezar): https://developers.tiktok.com/doc/display-api-get-started
- TikTok, referencia de permisos: https://developers.tiktok.com/doc/tiktok-api-scopes/
- Terceros (a confirmar): guías de Frontegg, Phyllo y Unified sobre revisión de aplicaciones en TikTok.

## Instagram (API con inicio de sesión de Instagram)
Verificado:
- Solo cuentas profesionales (empresa o creador). Una cuenta personal no sirve.
- No exige página de Facebook vinculada.
- Acceso estándar: basta para la propia cuenta o cuentas que administras. Acceso avanzado (revisión + verificación
  de empresa): para cuentas ajenas.
- Permiso de estadísticas: `instagram_business_manage_insights`.
- `follower_count` y `online_followers` no existen con menos de 100 seguidores. Sin datos, la API devuelve una
  lista vacía (no un 0): encaja con la regla "un día sin dato no es un cero".
Por verificar al empezar: lista de métricas y granularidad diaria; duración y renovación de tokens; límites; flujo
de testers; requisitos en modo en vivo.

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