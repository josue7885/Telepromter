# LiveVoz V15 — Consola unificada para conciertos

LiveVoz V15 es una plataforma de teleprompter musical y operación de conciertos con biblioteca de canciones, letras y acordes, transposición, setlists, bloques, perfiles de músicos, sincronización de dispositivos, modo ensayo, recuperación de concierto, preflight y operación offline.

## Inicio rápido

```bash
npm install
npm run check
npm start
```

## Funciones principales

- Operador con biblioteca, Control de Escenario y navegación adaptable.
- Teleprompter para cantante, músico y vista híbrida.
- Letras, acordes, BPM, tonalidad y cambio de tono por semitonos.
- Editor profesional con secciones INTRO, VERSO, PRE-CORO, CORO, PUENTE, SOLO y FINAL.
- Búsqueda global de repertorio.
- Conciertos y setlists con orden de ejecución y bloques.
- Arrastrar canciones entre bloques en equipos compatibles.
- Modo concierto con controles rápidos para anterior, siguiente, CORO, FINAL, pausa, emergencia y funciones.
- Bloqueo/desbloqueo opcional del escenario con estado sincronizado.
- Perfiles de músicos, instrumento, rol, transposición, batería, conexión y sincronización.
- Ensayo con estados Lista, Necesita ensayo y Problema, notas y lista automática de canciones a practicar.
- Recuperación local del concierto tras cierre inesperado.
- Preflight antes del show.
- Sincronización local mediante servidor LiveVoz protocolo 15.0.
- QR para conectar teléfonos.
- Respaldo, historial y funciones offline heredadas del flujo V14.

## Atajos de concierto

- Espacio: siguiente línea.
- Flecha derecha: siguiente canción.
- Flecha izquierda: canción anterior.
- C: señal CORO.
- F: señal FINAL.
- Esc: emergencia, según el contexto de operación.

## Preparación recomendada

Antes de un evento:
1. Abre LiveVoz.
2. Selecciona o prepara el concierto/setlist.
3. Inicia la conexión de dispositivos.
4. Conecta los teléfonos mediante QR.
5. Revisa batería y sincronización.
6. Abre la pantalla externa si se utilizará.
7. Ejecuta Preflight.
8. Comprueba tonalidad y transposición.
9. Activa Modo concierto cuando estés listo.

## Seguridad de versión

La versión del paquete es **15.0.0** y el protocolo del servidor local es **15.0**. La rama de desarrollo/finalización es `feature/livevoz-v15-unified-operator`. La rama `feature/livevoz-v14.9.1-operator-scroll` se conserva como punto de regreso.

## Compilación

```bash
npm run check
npm run dist:win
```

Los instaladores/portables generados por electron-builder se guardan en `release/`.

## Autor

LiveVoz Teleprompter — JOSUE ALEXIS CHAVEZ GUEVARA
