# Beta cerrada

## Quién puede entrar
- **Con Google:** solo las cuentas añadidas como usuarios de prueba en Google Cloud
  (Google Auth platform → Audience → Test users). Máximo 100.
- **Con correo y contraseña:** solo quien tenga el código de invitación (`REGISTRATION_INVITE_CODE` en Render).
  Si la variable no está definida, el registro es abierto.
- Para conectar **YouTube**, además, el correo de Google de esa persona debe estar en la lista de usuarios
  de prueba. Un canal solo puede estar conectado a un usuario.

## Generar el código de invitación
    node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
Pégalo en Render (Environment → `REGISTRATION_INVITE_CODE`). No lo subas a Git ni lo pegues en el chat.
Para rotarlo, cámbialo en Render: las cuentas ya creadas siguen funcionando.

## Qué esperar (y qué decirles)
- Es un **prototipo**; los textos legales están en borrador.
- La conexión de YouTube caduca a los **7 días** (modo de pruebas): hay que pulsar Reconectar.
- Google mostrará "Google no ha verificado esta aplicación": en esa pantalla, **Avanzado → continuar**.
- El servicio gratuito se duerme tras 15 minutos: la primera visita tarda cerca de un minuto.
- La base de datos gratuita **caduca a los 30 días de su creación** (≈ 2 de diciembre de 2026): sus datos se perderán
  si no se pasa a un plan de pago.
- Pueden eliminar su cuenta y todos sus datos desde Ajustes.

## Mensaje para invitar
> Hola. Estoy probando una aplicación para ver las estadísticas de canales de YouTube (SocialPulse AI).
> Es un prototipo. Para entrar: https://socialpulse-ai-xweo.onrender.com
> Si te registras con correo y contraseña, usa este código de invitación: <CÓDIGO>.
> Si quieres conectar tu canal de YouTube, dame tu correo de Google para autorizarte primero.
> Google te avisará de que la app no está verificada; es normal en esta fase. La primera carga puede tardar
> un minuto. Puedes borrar tu cuenta y tus datos cuando quieras desde Ajustes.