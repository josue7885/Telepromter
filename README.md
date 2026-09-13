# LiveVoz V14.2 — Core Workflow

LiveVoz V14.2 amplía Stage Director con herramientas para trabajar el repertorio completo del grupo: sincronización confirmada, editor de canciones/acordes, biblioteca y búsqueda, setlists rápidos, perfiles de músicos, notas personales, ensayo, historial, respaldo y operación offline.

## Inicio rápido

```bash
npm install
npm run check
npm start
```

## Novedades principales

### Sincronización V14.2
- protocolo Stage Network `14.2`;
- `stateRevision` en el estado del operador;
- `STATE_ACK` desde los dispositivos;
- panel con confirmación de sincronización por músico;
- `RESYNC_REQUEST` y recuperación de último estado conservados desde V14.1;
- reconexión, deduplicación y modo supervivencia.

### Centro V14.2
El botón **🧰 Centro V14.2** abre una interfaz responsive con:

- **Biblioteca:** buscador por título, categoría y tono.
- **Editor:** título, categoría, tono, BPM, letra, acordes y cues por línea.
- **Setlist:** agregar rápido, quitar y reordenar canciones.
- **Músicos:** perfiles con instrumento, rol y transposición personal.
- **Notas:** anotaciones privadas por canción y dispositivo.
- **Ensayo:** estado Pendiente / Revisar / Lista y temporizador de sesión.
- **Historial:** cambios y acciones locales del concierto.
- **Respaldo:** exportar/importar JSON y crear respaldo en LiveVoz Cloud.

### Nube y permisos
La nueva migración agrega:

```text
musician_profiles
personal_song_notes
rehearsal_sessions
rehearsal_song_status
concert_activity
```

También habilita búsqueda con `pg_trgm` para títulos/categorías y mantiene RLS para que cada usuario solo modifique la información permitida.

Migración V14.2:

```text
supabase/migrations/20260913105500_livevoz_v14_2_core_workflow.sql
```

Para aplicarla:

```bash
supabase db push
```

## Móvil y offline

La página QR se identifica como V14.2, verifica `/health`, conserva nombre/instrumento/transposición y abre `/app`. El Service Worker usa un caché V14.2 e incluye el nuevo workspace para que la interfaz principal pueda recuperarse sin conexión cuando el navegador lo permite.

## Panel del operador

El panel muestra protocolo, dispositivos, baterías, retrasos y ahora también:

- revisión de estado (`lastRevision`);
- confirmación de cada dispositivo (`lastAckRevision`);
- número de dispositivos sincronizados;
- botón `↻ Sincronizar` para reenviar el estado actual.

## Prueba recomendada

```powershell
cd C:\Users\josue\Documents\Telepromter
git fetch origin
git switch feature/livevoz-v14.2-core-workflow
git pull
npm install
npm run check
npm start
```

Después:

1. Genera un QR nuevo.
2. Conecta al menos dos teléfonos.
3. Cambia concierto, canción y línea.
4. Comprueba que el panel indique los dispositivos sincronizados.
5. Abre **Centro V14.2** y prueba biblioteca, editor y setlist.
6. Guarda una nota personal en un teléfono.
7. Inicia un ensayo y marca canciones como Lista/Revisar.
8. Exporta un respaldo JSON.
9. Apaga/enciende Wi‑Fi en un teléfono y verifica la recuperación.

`npm run check` debe terminar con:

```text
LiveVoz V14.2 check: OK
```

## Seguridad de versiones

V14.1 permanece intacta en `feature/livevoz-v14.1-stage-director-polish`. V14.2 se desarrolla en `feature/livevoz-v14.2-core-workflow` para conservar un punto de regreso probado.