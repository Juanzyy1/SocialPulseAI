# Laboratorio de videos con IA: diseño (etapa 7)

Estado: **arquitectura preparada. El laboratorio NO existe todavía.** Ninguna función de este documento
está implementada salvo lo indicado en la sección 10.

## 1. Qué está verificado y qué no

Verificado (documentación oficial de visión de Claude, consultada el 31/10/2026): imágenes JPEG, PNG, GIF
y WebP; hasta 600 imágenes por petición (100 en modelos con ventana de 200k tokens); 128 MB por petición
en la API directa.

NO verificado:
- Que los modelos actuales de Claude (serie 5.x) acepten archivos de video. La documentación consultada
  solo describe imágenes y PDF; fuentes de terceros recomiendan enviar fotogramas clave como imágenes.
- Que Claude procese audio (una fuente de terceros dice que no). Si el audio importa, haría falta transcribir.
- Que Gemini acepte video nativo, su duración máxima y su costo (solo páginas de terceros).
- Costos actuales de cualquier proveedor y sus condiciones de retención y de uso de datos para entrenar.
- La disponibilidad y licencia de ffmpeg/ffprobe para el procesamiento multimedia.

## 2. Arquitectura: puertos y adaptadores

El sistema solo conoce dos interfaces. Cada proveedor o tecnología es un adaptador intercambiable.
- `VideoStorage`: guardar, abrir y borrar videos. La clave es opaca y la genera el servidor, nunca el nombre
  del archivo subido.
- `VideoAnalyzer`: recibe el video y devuelve la respuesta CRUDA del modelo (`unknown`).

Toda respuesta pasa por `finalizeAnalysis` antes de guardarse o mostrarse (sección 5). Hoy los dos puertos
tienen una implementación "no disponible" que responde 503.

Dos caminos posibles para el analizador (no hace falta decidir hoy):
- A. Fotogramas: el servidor extrae fotogramas (y, si hace falta, una transcripción) y los envía como
  imágenes y texto a un modelo con visión. Funciona con Claude; exige procesamiento multimedia propio.
- B. Video nativo: se envía el video a un proveedor que lo acepte. Más simple; ata a ese proveedor.

## 3. Flujo previsto (Fase 6)

1. Subida en flujo (stream), cortando si supera el tamaño máximo mientras se recibe.
2. Identificar el formato por los primeros bytes (`sniffVideoContainer`); ignorar el nombre y el Content-Type.
3. Leer los metadatos (duración, dimensiones con rotación aplicada) con una herramienta externa, en un proceso
   aislado y con tiempo límite: un archivo con cabecera válida puede estar corrupto o ser malicioso.
4. Validar con `validateVideoMeta`; guardar con una clave aleatoria.
5. Crear el análisis (QUEUED) y procesarlo en segundo plano (el frontend consulta su estado). Primera versión
   sin cola externa: al arrancar, los análisis que quedaron en RUNNING se marcan como fallidos.
6. El adaptador devuelve la respuesta cruda → `finalizeAnalysis` → guardar el resultado.
7. Borrar el video original según la política de retención (sección 7).

## 4. Reglas de los videos (propuestas, en `video-rules.ts`)

MP4, MOV y WebM; máximo 200 MB y 5 minutos; lado menor de al menos 360 px y lado mayor de hasta 4096 px;
proporciones 9:16, 16:9 y 1:1 con tolerancia del 2 %.

## 5. Garantías sobre lo que dice la IA

Requisito: la IA no promete viralidad ni presenta estimaciones como resultados garantizados.
- El potencial es un nivel (bajo, medio o alto) con razones obligatorias; nunca una cifra de vistas.
- Los campos que el modelo añada por su cuenta se descartan.
- `isEstimate: true` y el aviso orientativo los añade el sistema, no el modelo.
- Se rechazan textos con promesas de viralidad, garantías, certezas o cifras de resultados previstas. Los
  hashtags prohibidos (#viral) se eliminan sin invalidar el análisis.
- Limitación: el filtro es por patrones (español y algunas palabras en inglés). Es una red de seguridad, no
  una garantía; se complementa con las instrucciones al modelo y revisión periódica de resultados reales.

## 6. Modelo de datos propuesto (SIN migrar)

- `video_uploads`: id, userId, storageKey, sizeBytes, durationSeconds, width, height, aspect, sha256,
  status, createdAt, deleteAt.
- `video_analyses`: id, userId, uploadId, targetPlatform, objective, status (QUEUED, RUNNING, SUCCEEDED,
  FAILED), result (JSON ya validado), failureCode, provider, model, promptVersion, tokens o costo estimado,
  createdAt, finishedAt.
Se migrará cuando se elija el proveedor.

## 7. Privacidad y textos legales

- Un video puede contener caras y voces de terceros. Enviarlo a un proveedor de IA lo comparte con él.
- Antes del laboratorio hay que nombrar al proveedor en la política de privacidad (hoy solo menciona a Google,
  YouTube y los proveedores de alojamiento), subir la versión de los textos (todos deberán aceptar de nuevo) y
  verificar las condiciones de retención y entrenamiento del proveedor.
- Mostrar un aviso claro al subir ("este video se enviará a ... para analizarlo").
- Minimizar: propuesta de borrar el video original al terminar el análisis (como máximo a las 24 horas) y
  conservar solo el resultado.

## 8. Costos y límites de uso (propuestas)

Cuota por usuario (por ejemplo, 5 análisis al día), un análisis a la vez por usuario, tope mensual global con
un interruptor de apagado. Los costos reales dependen del proveedor y no están verificados.

## 9. Decisiones abiertas

Proveedor y camino (A o B); retención del video; cuotas; cifras de la sección 4; qué plataformas de destino
soportar al inicio (YouTube primero).

## 10. Construido en la etapa 7

`src/ai-lab/`: reglas de video, filtro de resultados, los dos puertos con implementación "no disponible" y
pruebas. No hay endpoints, tablas ni integración con ningún proveedor.