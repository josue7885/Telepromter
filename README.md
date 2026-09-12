# LiveVoz Teleprompter V12

LiveVoz combina teleprompter para cantante, músico, modo híbrido y operador con Supabase Cloud, Stage Network y soporte offline para conciertos.

## Inicio rápido

```bash
npm install
npm run check
npm run stage-server
npm run stage-health
npm start
```

`npm run check` valida que los archivos críticos existan, que las referencias de arranque estén completas y que no haya secretos de Supabase expuestos en el runtime.

`npm run stage-health` comprueba que Stage Network esté respondiendo antes de un evento.

## Supabase

El cliente usa únicamente la URL pública y la publishable key de Supabase. Nunca agregues `service_role`, una clave `sb_secret_...` ni la contraseña de PostgreSQL al repositorio.

```bash
supabase login
supabase link --project-ref yyjeihyldqbvkkpswxwg
supabase db push
```

La migración principal está en:

`supabase/migrations/20260912022000_livevoz_v11.sql`

## Stage Network V12

```bash
npm run stage-server
```

Por defecto escucha en el puerto `8080`. En teléfonos y tablets usa:

```text
ws://IP-DE-LA-PC:8080
```

Todos los integrantes del mismo concierto deben usar el mismo PIN/token de sala.

Endpoints de diagnóstico:

```text
http://IP-DE-LA-PC:8080/health
http://IP-DE-LA-PC:8080/metrics
```

### Mejoras V12

- límite configurable de clientes por sala e IP;
- token de sala almacenado como hash en el servidor;
- expiración automática de salas vacías;
- endpoint de salud y métricas;
- mensaje de bienvenida con versión de protocolo;
- validación estricta de rol, sala, dispositivo y tamaño de mensajes;
- heartbeat y eliminación de conexiones muertas;
- reconexión automática del cliente con backoff;
- último estado del escenario conservado por sala;
- Electron endurecido contra navegación externa inesperada;
- Service Worker con estrategia offline más segura y control de caché;
- comprobación automática de integridad del proyecto antes del concierto.

## Variables opcionales del servidor

```bash
LIVEVOZ_WS_PORT=8080
LIVEVOZ_WS_HOST=0.0.0.0
LIVEVOZ_MAX_CLIENTS_PER_ROOM=40
LIVEVOZ_MAX_CLIENTS_PER_IP=12
```

## Flujo recomendado antes de un concierto

1. Ejecuta `npm install` después de actualizar el repositorio.
2. Ejecuta `npm run check`.
3. Ejecuta `npm run stage-server`.
4. En otra terminal ejecuta `npm run stage-health`.
5. Conecta operador, músicos y cantante con la misma URL WebSocket y PIN de sala.
6. Prueba cambio de canción, línea, acordes y reconexión de un dispositivo.
7. Mantén Stage Network ejecutándose durante todo el evento.
