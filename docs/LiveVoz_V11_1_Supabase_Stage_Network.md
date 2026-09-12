# LiveVoz V11.1 - Supabase y Stage Network

Esta guia documenta la preparacion de la base de datos de LiveVoz con Supabase/PostgreSQL y la ejecucion de Stage Network mediante WebSocket local.

## 1. Preparar Supabase

Desde la raiz del repositorio:

```bash
supabase login
supabase link --project-ref yyjeihyldqbvkkpswxwg
supabase db push
```

- `supabase login` autentica Supabase CLI.
- `supabase link` vincula el repositorio con el proyecto correcto.
- `supabase db push` aplica las migraciones almacenadas en `supabase/migrations`.

No agregues al repositorio la contrasena de PostgreSQL, claves `service_role` ni claves `sb_secret_...`.

## 2. Preparar Stage Network

Instala dependencias:

```bash
npm install
```

Inicia el servidor WebSocket:

```bash
npm run stage-server
```

El servidor usa por defecto el puerto `8080`.

## 3. Conectar telefonos y tablets

Todos los dispositivos deben poder alcanzar la computadora que ejecuta Stage Network. Usa la IPv4 local de esa computadora, por ejemplo:

```text
ws://192.168.1.100:8080
```

En Windows puedes consultar la IPv4 con:

```bash
ipconfig
```

No uses `localhost` o `127.0.0.1` desde los telefonos, porque esas direcciones apuntan al propio dispositivo.

## 4. PIN/token de sala

Todos los participantes del mismo concierto deben usar el mismo PIN/token de sala. Esto evita que los dispositivos de una sesion reciban mensajes de otra.

Ejemplo:

```text
Servidor: ws://192.168.1.100:8080
PIN/token: SERENATA-2026
```

## 5. Mejoras de WebSocket en V11.1

- salas aisladas por concierto y token;
- comandos remotos restringidos al operador;
- heartbeat para detectar dispositivos inactivos;
- reconexion automatica con backoff y jitter;
- descarte de mensajes duplicados u obsoletos;
- limite de mensajes para evitar trafico excesivo;
- recuperacion del ultimo estado de escenario para dispositivos recien conectados.

## 6. Secuencia recomendada antes del concierto

1. Conecta la computadora y los dispositivos a la red del evento.
2. Ejecuta `npm install` si aun no instalaste dependencias.
3. Ejecuta `npm run stage-server`.
4. Consulta la IPv4 de la computadora.
5. Configura `ws://IP-DE-LA-PC:8080` en LiveVoz.
6. Usa el mismo PIN/token en todos los dispositivos.
7. Comprueba que el operador pueda cambiar de cancion y linea.
8. Prueba toda la configuracion antes del evento.

## 7. Referencia de version

Commit de referencia indicado para `main`:

```text
674300d50e6bddb7d5801e2338981109feb9d18e
```

Para inspeccionarlo:

```bash
git show 674300d50e6bddb7d5801e2338981109feb9d18e
```

El PDF correspondiente se encuentra en:

`docs/Documentacion_LiveVoz_V11_1_Supabase_Stage_Network.pdf`
