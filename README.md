# LiveVoz Teleprompter V11.1

LiveVoz combina teleprompter para cantante, músico, modo híbrido y operador con Supabase Cloud y Stage Network.

## Supabase

El proyecto web usa la URL pública y la publishable key de Supabase. Nunca agregues `service_role`, una clave `sb_secret_...` ni la contraseña de PostgreSQL al repositorio.

```bash
supabase login
supabase link --project-ref yyjeihyldqbvkkpswxwg
supabase db push
```

La migración está en `supabase/migrations/20260912022000_livevoz_v11.sql`.

## Stage Network (WebSocket)

```bash
npm install
npm run stage-server
```

Por defecto escucha en el puerto `8080`. En los teléfonos usa `ws://IP-DE-LA-PC:8080` y el mismo PIN/token de sala.

### Mejoras V11.1

- salas aisladas por concierto + PIN/token;
- solo el rol operador puede enviar comandos remotos;
- heartbeat y eliminación de dispositivos inactivos;
- reconexión exponencial con jitter;
- límite de mensajes de 64 KiB;
- deduplicación y descarte de mensajes obsoletos;
- último estado de escenario conservado por sala para dispositivos recién conectados;
- Supabase Auth, PostgreSQL, Realtime, backups, conciertos compartidos e historial;
- Service Worker evita cachear Supabase y otros servicios externos.
