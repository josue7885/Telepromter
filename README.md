# LiveVoz V14.1 — Stage Director

LiveVoz es un teleprompter y sistema de dirección de escenario para conciertos, serenatas, bodas y ensayos. V14.1 perfecciona V14 con una capa de confiabilidad enfocada en uso real durante eventos.

## Inicio rápido

```bash
npm install
npm run check
npm start
```

La aplicación de escritorio inicia Stage Network automáticamente. Para diagnóstico:

```bash
npm run stage-server
npm run stage-health
```

## Qué mejora V14.1

V14.1 conserva todas las funciones de V14 y agrega:

- reconexión progresiva con backoff y jitter;
- recuperación local del último estado del escenario;
- petición explícita de resincronización al volver a entrar;
- reemplazo de conexiones antiguas del mismo dispositivo para evitar duplicados;
- botón **↻ Sincronizar** para reenviar inmediatamente el estado actual;
- indicador visible de estado de red en cada dispositivo;
- modo supervivencia cuando el navegador detecta pérdida de conexión;
- protección contra conexiones repetidas durante el arranque;
- deduplicación de mensajes por `messageId`;
- heartbeat de cliente cada 10 segundos;
- alerta visual de dispositivos con retraso;
- alerta de batería ≤20% cuando el navegador entrega ese dato;
- protocolo Stage Network `14.1`;
- validación de sintaxis automática mediante `npm run check`;
- Service Worker/cache separado para V14.1.

## Flujo de conexión

1. El operador inicia LiveVoz en la laptop.
2. Genera un QR desde el panel Stage.
3. El músico escanea el QR, indica nombre e instrumento y entra a **LiveVoz completo**.
4. Todos permanecen dentro de una sala Stage estable aunque el operador cambie de concierto.
5. Concierto, canción, línea, tono, BPM y estado siguen al operador.
6. Instrumento, transposición y preferencias visuales siguen siendo personales.
7. Si un teléfono pierde Wi‑Fi, mantiene el último estado visible e intenta volver automáticamente.
8. Al reconectar solicita el último estado de la sala y continúa sin generar un QR nuevo.

## Stage Director

El operador dispone de **🎛 V14 Director** con:

- preparar y lanzar la siguiente canción;
- cuenta regresiva sincronizada;
- señales INTRO, CORO, SOLO, CORTE, REPITE, ÚLTIMA y FINAL;
- vibración en dispositivos compatibles;
- bloqueo de escenario y Wake Lock;
- modos Normal, Serenata, Boda y Ensayo;
- bloques Entrada, Cena, Románticas, Baile, Serenata, Cumpleaños y Cierre;
- partes/notas privadas por instrumento;
- historial operativo;
- duración estimada del set;
- Preflight;
- atajos de teclado;
- Web MIDI/pedal cuando el navegador/controlador lo permite.

## Panel del operador

El panel externo de V14.1 muestra:

- protocolo Stage activo;
- IP y puerto;
- salas y dispositivos;
- latencia local;
- batería/carga cuando está disponible;
- tipo de red cuando está disponible;
- dispositivo con retraso (`RETRASO`);
- batería crítica (`BATERÍA BAJA`);
- estado general del escenario;
- botón de resincronización;
- segunda pantalla de cantante, músico o híbrido.

## Músicos e instrumentos

Se conservan perfiles para cantante, guitarra, bajo, bajo quinto, teclado, acordeón, trompeta Sib, saxofones Sib/Mib, trombón, batería, percusión y modo híbrido.

Cada dispositivo conserva su transposición personal. Ejemplo:

```text
Operador: C
Guitarra: C
Trompeta Sib: D
Sax alto Mib: A
```

Las notas instrumentales permiten guardar instrucciones privadas como:

```text
Guitarra: Capo 2
Trompeta Sib: Entrar después del segundo coro
Batería: Corte seco al final
Bajo: No tocar durante la intro
```

## Recuperación de red

Stage Network V14.1 conserva el último `STATE` de cada sala. Al reconectar:

1. el servidor reemplaza una conexión antigua del mismo `deviceId`;
2. el dispositivo vuelve a registrarse;
3. un músico envía `RESYNC_REQUEST`;
4. el servidor responde con el último estado conocido;
5. el operador también puede usar **↻ Sincronizar** para forzar una actualización general.

La pantalla muestra:

```text
V14.1 · conectado
V14.1 · conexión lenta
V14.1 · sin conexión · modo supervivencia
V14.1 · red recuperada · reconectando
```

## Stage Network V14.1

Puerto predeterminado: `8080`.

```text
http://IP-DE-LA-PC:8080/join
http://IP-DE-LA-PC:8080/app
http://IP-DE-LA-PC:8080/health
http://IP-DE-LA-PC:8080/metrics
```

Protocolo actual: `14.1`.

Los mensajes incluyen STATE, COMMAND, PRELOAD, SIGNAL, COUNTDOWN, LOCK_STAGE, PRIVATE_NOTE, DEVICE_TELEMETRY, STAGE_MODE y RESYNC_REQUEST.

## Atajos

```text
F8   Preparar siguiente canción
F9   Lanzar siguiente canción
F10  Señal CORO
F11  Bloquear/desbloquear escenario
```

## Preflight recomendado

Antes de un evento:

1. `git pull`
2. `npm install`
3. `npm run check`
4. `npm start`
5. Generar un QR nuevo.
6. Conectar al menos dos teléfonos si es posible.
7. Confirmar que el panel indique protocolo `14.1`.
8. Cambiar concierto, canción y línea.
9. Probar cuenta regresiva y señales.
10. Activar/desactivar Wi‑Fi en un teléfono durante unos segundos y comprobar la recuperación.
11. Pulsar **↻ Sincronizar** y verificar que todos sigan la misma posición.
12. Probar la pantalla externa si se usará durante el evento.

## Validación

`npm run check` ahora comprueba archivos requeridos, referencias de arranque, credenciales peligrosas, versión del paquete y sintaxis JavaScript/CJS con `node --check`.

Debe terminar con:

```text
LiveVoz V14.1 check: OK
```

## Supabase

El cliente usa solamente URL pública y publishable key. Nunca agregues `service_role`, una clave `sb_secret_...` ni la contraseña PostgreSQL al repositorio.

Migraciones:

```text
supabase/migrations/20260912022000_livevoz_v11.sql
supabase/migrations/20260913093000_livevoz_v14_stage_director.sql
```

## Variables opcionales

```bash
LIVEVOZ_WS_PORT=8080
LIVEVOZ_WS_HOST=0.0.0.0
LIVEVOZ_MAX_CLIENTS_PER_ROOM=40
LIVEVOZ_MAX_CLIENTS_PER_IP=12
```

## Ramas de seguridad

Las versiones anteriores permanecen separadas. V14.1 se desarrolla en:

```text
feature/livevoz-v14.1-stage-director-polish
```

Esto permite probar V14.1 sin modificar V14, V13.2 ni V13.1.