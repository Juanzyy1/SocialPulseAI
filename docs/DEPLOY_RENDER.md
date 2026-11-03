# Despliegue en Render (un solo servicio)

Una sola dirección `https://<servicio>.onrender.com` sirve la API y el frontend (mismo origen).
La base de datos se crea aparte, en la **misma región** (Oregón).

## Antes de empezar
- El código con `render.yaml` está en GitHub (`git push`).
- Nada de esto lleva secretos en el repositorio. Los dos secretos se pegan **solo en el panel de Render**.
- Los textos legales siguen en borrador: **no invites a nadie** a registrarse todavía; solo pruebas tuyas.

## 1. La clave de cifrado de producción
Debe ser **distinta de la de desarrollo**. Genérala y guárdala en un gestor de contraseñas:

    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

Si la pierdes, las credenciales de YouTube guardadas dejan de poder descifrarse (habría que reconectar).

## 2. La base de datos
En el panel de Render: **New + → Postgres**.
- Región: **Oregon**. Nombre: `socialpulse-db`.
- Plan: el gratuito sirve para probar, pero **caduca a los 30 días** (14 más de gracia, y después se borra).
  Para conservar datos hay que usar un plan de pago.
- Al terminar, abre su página (**Info** o **Connect**) y copia la **Internal Database URL**
  (no la externa). Contiene la contraseña: no la pegues en el chat ni en ningún archivo.

## 3. El servicio
**New + → Blueprint** → conecta tu cuenta de GitHub y elige el repositorio → ruta `render.yaml` →
**Deploy Blueprint**. Render te pedirá los dos valores secretos:
- `DATABASE_URL`: la Internal Database URL del paso 2.
- `TOKEN_ENCRYPTION_KEY`: la clave del paso 1.

Si Render te asigna una dirección distinta de `https://socialpulse-ai.onrender.com`, corrige
`FRONTEND_URL` en **Environment** con la dirección real.

## 4. Primer arranque
Sigue los **Logs**. Debe verse: la instalación, `prisma generate`, la compilación del frontend y del
backend, `prisma migrate deploy` (aplica las migraciones) y `Nest application successfully started`.
El primer arranque en el plan gratuito puede tardar varios minutos.

## 5. Comprobaciones
1. `https://<servicio>.onrender.com/api/v1/health` responde `status: ok`.
2. La página de inicio de sesión carga con estilos.
3. Crea una cuenta de prueba con correo y contraseña y entra. En las herramientas de desarrollo
   (F12 → Application → Cookies), `sp_session` debe ser **HttpOnly, Secure y SameSite=Lax**.
4. `/api/docs` da 404 (Swagger apagado en producción).

## 6. Comprobar el límite de intentos por IP (TRUST_PROXY_HOPS)
No se lee la cadena de proxies: se comprueba la propiedad de seguridad con una prueba de caja negra.

**Parte A (tu PC): ¿se puede esquivar el límite falsificando la cabecera?** Cada intento usa un correo y
una IP falsificada distintos:

    $url = 'https://<servicio>.onrender.com'
    1..7 | ForEach-Object {
      $headers = @{ 'X-Forwarded-For' = "203.0.113.$_" }
      $body = @{ email = "prueba$_@no-existe.invalid"; password = 'incorrecta-123456' } | ConvertTo-Json
      try {
        Invoke-WebRequest "$url/api/v1/auth/login" -Method Post -ContentType 'application/json' -Headers $headers -Body $body -UseBasicParsing | Out-Null
        "$_ -> 200"
      } catch { "$_ -> $($_.Exception.Response.StatusCode.value__)" }
    }

Esperado: `401` los cinco primeros y `429` el sexto y el séptimo. Si nunca sale 429, el valor es
**demasiado alto** (el cliente puede falsificar su IP).

**Parte B (otra red, por ejemplo el teléfono con datos móviles):** mientras dura el bloqueo, entra con una
cuenta de prueba. Esperado: entras. Si también te bloquea, el valor es **demasiado bajo** (todos
comparten la IP de un proxy).

La parte A te bloquea a ti 15 minutos; para desbloquearte antes, **Manual Deploy → Restart** en Render
(los contadores viven en memoria).  

## 7. Qué esperar del plan gratuito
- Tras 15 minutos sin tráfico el servicio se duerme; la primera petición tarda cerca de un minuto.
- Los contadores de intentos de acceso (en memoria) se reinician al dormirse.
- La base de datos caduca a los 30 días de su creación: apunta la fecha.

## Problemas frecuentes
- **La compilación falla por la versión de Node:** mira en el registro qué versión usa Render y dime cuál.
- **`prisma generate` o `migrate deploy` fallan por DATABASE_URL:** debe estar puesta antes del primer despliegue.
- **El servicio no pasa la comprobación de salud:** `/api/v1/health` debe responder; revisa el registro de arranque.
- **Error 403 "Origen no permitido" al iniciar sesión:** el proxy no reenvía el `Host` o el protocolo originales:
  abre `/api/v1/diagnostics/network` y avísame.

## 8. Google en producción
Se usa el mismo proyecto de Google Cloud, con un **segundo cliente** (no reutilices el de desarrollo).

1. **Google Auth platform → Clients → Create client**, tipo **Web application**,
   nombre `SocialPulse AI (producción)`.
2. **Authorized redirect URIs**: exactamente estas dos (con tu dirección real):
   - `https://<servicio>.onrender.com/api/v1/auth/google/callback`
   - `https://<servicio>.onrender.com/api/v1/integrations/youtube/callback`
   No hace falta ningún "JavaScript origin": el flujo es de servidor.
3. Copia el **ID de cliente** y el **secreto**. El secreto no va en el chat, ni en un archivo, ni en Git.
4. En Render, **Environment**, pon las **tres variables en un solo guardado** (si solo hay una o dos, la
   aplicación no arranca):
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `https://<servicio>.onrender.com/api/v1/auth/google/callback`
5. La aplicación de Google sigue en **modo de pruebas**: solo entran las cuentas de la lista de usuarios de
   prueba (el dueño del proyecto siempre puede). Verás el aviso "Google no ha verificado esta aplicación":
   es lo esperado.
6. Comprueba en la instancia real: **Continuar con Google** → llegas al panel; **Cuentas → Conectar
   YouTube** → vuelves a `/cuentas` con el aviso verde; **Sincronizar**.
7. La base de datos de producción es **nueva**: hay que reconectar el canal y sincronizar de nuevo
   (se recuperan los últimos 90 días). En modo de pruebas, la conexión de YouTube caduca a los 7 días.