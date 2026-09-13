# LiveVoz V14 — Stage Director

LiveVoz es un teleprompter y sistema de dirección de escenario para conciertos, serenatas, bodas y ensayos. V14 mantiene la sincronización total de V13.2 y agrega herramientas de operación en vivo para cantante, músicos y director del concierto.

## Inicio rápido

```bash
npm install
npm run check
npm start
```

La aplicación de escritorio inicia Stage Network automáticamente. Para diagnóstico también puedes usar:

```bash
npm run stage-server
npm run stage-health
```

## Flujo de conexión

1. El operador inicia LiveVoz en la laptop.
2. Genera un QR desde el panel Stage.
3. El músico escanea el QR, indica nombre e instrumento y entra a **LiveVoz completo**.
4. Todos los dispositivos permanecen en una sala Stage estable aunque el operador cambie de concierto.
5. Concierto, canción, línea, tono, BPM y estado del espectáculo siguen al operador.
6. La transposición, instrumento y preferencias visuales siguen siendo personales por dispositivo.

## Stage Director V14

El operador dispone del botón **🎛 V14 Director** dentro de LiveVoz. Incluye:

- preparación anticipada de la siguiente canción;
- lanzamiento de la siguiente canción;
- cuenta regresiva sincronizada;
- señales INTRO, CORO, SOLO, CORTE, REPITE, ÚLTIMA y FINAL;
- vibración de aviso en dispositivos compatibles;
- bloqueo/desbloqueo del escenario;
- Wake Lock para evitar que la pantalla se duerma cuando el navegador lo permite;
- modos Normal, Serenata, Boda y Ensayo;
- bloques de evento: Entrada, Cena, Románticas, Baile, Serenata, Cumpleaños y Cierre;
- notas/partes privadas por instrumento;
- historial local de operación;
- estimación de duración del set;
- Preflight antes del concierto;
- atajos de teclado y soporte MIDI/Web MIDI cuando el dispositivo/navegador lo permite.

## Músicos e instrumentos

LiveVoz conserva los perfiles de V13.1 para cantante, guitarra, bajo, bajo quinto, teclado, acordeón, trompeta Sib, saxofones Sib/Mib, trombón, batería, percusión y modo híbrido.

Cada dispositivo conserva su transposición personal. Cambiar la transposición de un trompetista no cambia el tono del operador ni de los demás músicos.

Las notas instrumentales permiten guardar instrucciones como:

```text
Guitarra: Capo 2
Trompeta Sib: Entrar después del segundo coro
Batería: Corte seco al final
Bajo: No tocar durante la intro
```

## Telemetría de dispositivos

Cuando el navegador proporciona la información, Stage Network puede mostrar:

- nombre y rol;
- instrumento;
- transposición;
- batería y estado de carga;
- tipo de conexión de red;
- última actividad del dispositivo.

Algunos navegadores no exponen batería o datos detallados de red; LiveVoz funciona aunque esos datos no estén disponibles.

## Recuperación y modo offline

- Stage Network conserva el último estado de la sala.
- Los clientes intentan reconectarse automáticamente después de un corte breve.
- El Service Worker V14 guarda la interfaz principal para recuperación offline cuando el navegador y el contexto de seguridad permiten usar PWA/Service Worker.
- En una red local HTTP algunos navegadores móviles pueden limitar la instalación PWA. El funcionamiento normal por navegador y Stage Network no depende de que la PWA esté instalada.

## Stage Network V14

Puerto predeterminado: `8080`.

```text
http://IP-DE-LA-PC:8080/join
http://IP-DE-LA-PC:8080/app
http://IP-DE-LA-PC:8080/health
http://IP-DE-LA-PC:8080/metrics
```

Protocolo actual: `14.0`.

Además de STATE y COMMAND, V14 soporta mensajes de escenario para precarga, señales, cuenta regresiva, bloqueo, notas privadas, telemetría y modo del evento.

## Atajos V14

En modo operador:

```text
F8   Preparar siguiente canción
F9   Lanzar siguiente canción
F10  Señal CORO
F11  Bloquear/desbloquear escenario
```

Con Web MIDI disponible, LiveVoz también puede mapear notas MIDI para anterior, siguiente, coro y final.

## Preflight recomendado

Antes de un evento:

1. `git pull`
2. `npm install`
3. `npm run check`
4. `npm start`
5. Generar un QR nuevo.
6. Conectar al menos un teléfono.
7. Abrir **V14 Director** y verificar Preflight.
8. Probar cambio de concierto, canción y línea.
9. Probar una señal y la cuenta regresiva.
10. Desconectar/reconectar un teléfono para comprobar recuperación.

## Supabase

El cliente usa solamente la URL pública y una publishable key. Nunca agregues `service_role`, una clave `sb_secret_...` ni la contraseña PostgreSQL al repositorio.

La migración principal está en:

`supabase/migrations/20260912022000_livevoz_v11.sql`

## Variables opcionales

```bash
LIVEVOZ_WS_PORT=8080
LIVEVOZ_WS_HOST=0.0.0.0
LIVEVOZ_MAX_CLIENTS_PER_ROOM=40
LIVEVOZ_MAX_CLIENTS_PER_IP=12
```

## Versiones estables

V13.1 y V13.2 permanecen en sus ramas anteriores. V14 se desarrolla en `feature/livevoz-v14-stage-director` para no modificar las versiones ya aprobadas mientras se prueba en eventos reales.