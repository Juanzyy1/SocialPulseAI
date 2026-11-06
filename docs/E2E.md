# Pruebas con navegador real (Playwright)

Prueban los flujos críticos en Chromium contra una dirección real. No sustituyen a las pruebas del backend y del
frontend: las completan. El acceso con Google y la conexión de YouTube NO se automatizan (requieren una cuenta
real de Google); se verifican a mano.

## Preparación (una vez)
    cd e2e
    npm install -D @playwright/test
    npx playwright install chromium

## Ejecutar contra la versión desplegada
    $env:E2E_BASE_URL='https://socialpulse-ai-xweo.onrender.com'
    $env:E2E_INVITE_CODE='<el código; escríbelo tú, no lo pegues en ningún chat ni archivo>'
    npx playwright test
    Remove-Item Env:E2E_BASE_URL, Env:E2E_INVITE_CODE

`E2E_INVITE_CODE` solo hace falta si el registro está cerrado. Informe: `npx playwright show-report`.

## Ejecutar contra producción local
Compila el frontend y el backend, arranca con `NODE_ENV=production` y `FRONTEND_DIST_DIR=../frontend/dist`
(ver `docs/DEPLOY_RENDER.md`), y ejecuta sin `E2E_BASE_URL` (usa http://localhost:3000).

## Cuidado
- Cada ejecución crea un usuario `e2e-…@socialpulse-e2e.invalid` y lo elimina al terminar.
- Respeta los límites del servidor (10 registros/hora y 5 contraseñas malas cada 15 minutos por IP).
- La primera ejecución tras 15 minutos de inactividad tarda más: el servicio gratuito de Render se duerme.