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

## 6. Medir los proxies (TRUST_PROXY_HOPS)
Desde PowerShell, con la dirección real:

    $url = 'https://<servicio>.onrender.com'
    Invoke-RestMethod "$url/api/v1/diagnostics/network"
    Invoke-RestMethod "$url/api/v1/diagnostics/network" -Headers @{ 'X-Forwarded-For' = '1.2.3.4' }
    Invoke-RestMethod 'https://api.ipify.org'     # tu IP pública, para comparar

| Resultado | Qué significa |
|---|---|
| 1.ª llamada: `forwardedFor` = tu IP y `ip` = tu IP; 2.ª: `forwardedFor` = `1.2.3.4, tu IP` e `ip` = tu IP | **TRUST_PROXY_HOPS = 1 es correcto** |
| `forwardedFor` trae dos o más direcciones sin falsificar nada e `ip` no es la tuya | Hay más proxies: prueba 2 (y repite) |
| `ip` = `1.2.3.4` en la 2.ª llamada | **Falsificable**: no cambies nada y avísame |
| `forwardedFor` vacío | El proxy no reenvía la IP real: avísame |

Al terminar: pon `EXPOSE_NETWORK_DIAGNOSTICS` en `false` (Environment) y, si hizo falta, corrige
`TRUST_PROXY_HOPS`. Al guardar, Render vuelve a desplegar.

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