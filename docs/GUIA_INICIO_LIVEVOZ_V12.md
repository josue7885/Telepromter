# LiveVoz V12 — Guía de instalación e inicio en Windows

Esta guía explica cómo preparar una computadora Windows, descargar LiveVoz desde GitHub, instalar sus dependencias, iniciar la aplicación y utilizar Stage Network con teléfonos, tablets u otras computadoras.

## Repositorio y versión

Repositorio oficial:

`https://github.com/josue7885/Telepromter`

Rama de LiveVoz V12:

`feature/livevoz-v12-production`

LiveVoz utiliza Git para descargar y actualizar el proyecto, Node.js/npm para las dependencias y herramientas, Electron para la aplicación de escritorio, WebSocket para Stage Network y Supabase para las funciones en la nube.

## 1. Instalar Git

Descarga Git para Windows desde `https://git-scm.com/download/win` e instálalo permitiendo su uso desde PowerShell y la línea de comandos.

Después de instalarlo, cierra PowerShell y vuelve a abrirlo. Comprueba la instalación:

```powershell
git --version
```

## 2. Instalar Node.js

Instala Node.js y comprueba que Node y npm funcionan:

```powershell
node --version
npm --version
```

## 3. Configurar PowerShell para npm

Si PowerShell muestra que `npm.ps1` no puede cargarse porque la ejecución de scripts está deshabilitada, ejecuta:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Comprueba el resultado:

```powershell
Get-ExecutionPolicy -Scope CurrentUser
```

Debe mostrar:

```text
RemoteSigned
```

Si el primer comando termina sin solicitar confirmación, no es necesario escribir `S` después.

Como alternativa se pueden utilizar comandos como `npm.cmd install`.

## 4. Descargar LiveVoz desde GitHub

Es recomendable trabajar desde Documentos y no desde `C:\WINDOWS\system32`.

```powershell
cd C:\Users\josue\Documents
git clone https://github.com/josue7885/Telepromter.git
cd Telepromter
```

Comprueba la ubicación con:

```powershell
pwd
```

## 5. Seleccionar LiveVoz V12

```powershell
git fetch origin
git switch feature/livevoz-v12-production
git branch
```

La rama activa debe aparecer como:

```text
* feature/livevoz-v12-production
```

## 6. Instalar dependencias

Dentro de `C:\Users\josue\Documents\Telepromter` ejecuta:

```powershell
npm install
```

La primera instalación puede tardar unos minutos.

## 7. Comprobar el proyecto

LiveVoz V12 incorpora una comprobación previa:

```powershell
npm run check
```

Es recomendable ejecutarla después de una instalación o actualización y antes de una presentación importante.

## 8. Iniciar LiveVoz

Para abrir LiveVoz:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm start
```

Electron debe abrir la aplicación LiveVoz.

Una vez instalado el proyecto, no es necesario repetir `git clone` ni `npm install` cada vez que se abre la aplicación.

## 9. Iniciar Stage Network

Stage Network permite comunicar el operador con teléfonos, tablets y otras computadoras.

Abre una segunda ventana de PowerShell:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm run stage-server
```

Por defecto utiliza el puerto `8080`.

La terminal de Stage Network debe permanecer abierta durante la presentación. Al cerrar esa terminal se detiene el servidor.

## 10. Comprobar Stage Network

Con Stage Network ejecutándose, abre otra terminal:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm run stage-health
```

Esto permite verificar que el servidor está disponible antes del concierto.

## 11. Obtener la IP de la computadora

Ejecuta:

```powershell
ipconfig
```

Busca la `Dirección IPv4`. Por ejemplo:

```text
192.168.1.100
```

En ese ejemplo, la dirección de Stage Network sería:

```text
ws://192.168.1.100:8080
```

No utilices `localhost` ni `127.0.0.1` en un teléfono, porque esas direcciones hacen referencia al propio dispositivo y no a la computadora de LiveVoz.

## 12. Conectar teléfonos y tablets

La computadora y los dispositivos deben estar en la misma red local.

Ejemplo:

```text
COMPUTADORA
Rol: Operador
Stage Network: ws://192.168.1.100:8080
PIN: 2026

TELÉFONO
Rol: Cantante
Stage Network: ws://192.168.1.100:8080
PIN: 2026

TABLET
Rol: Músico
Stage Network: ws://192.168.1.100:8080
PIN: 2026
```

Todos los dispositivos del mismo escenario deben utilizar el mismo concierto/sala y el mismo PIN o token.

## 13. Prueba recomendada antes de un concierto

Primero comprueba el proyecto:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm run check
```

Después inicia Stage Network:

```powershell
npm run stage-server
```

En otra terminal comprueba la red:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm run stage-health
```

En otra terminal inicia LiveVoz:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm start
```

Antes de comenzar la presentación verifica que:

1. El teléfono o tablet aparece conectado.
2. Todos utilizan el mismo PIN/token.
3. Todos utilizan el concierto correcto.
4. El Operador puede cambiar de canción.
5. Los dispositivos reciben los cambios.
6. Las líneas del teleprompter se sincronizan.
7. Una desconexión temporal puede recuperarse.
8. Las canciones necesarias están disponibles.

## 14. Inicio diario

Para utilizar LiveVoz sin Stage Network:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm start
```

Para una presentación con varios dispositivos, utiliza dos terminales.

Terminal 1:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm run stage-server
```

Terminal 2:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm start
```

Mantén ambas abiertas durante la presentación.

## 15. Actualizar LiveVoz

```powershell
cd C:\Users\josue\Documents\Telepromter
git pull
npm install
npm run check
```

Después puedes iniciar normalmente:

```powershell
npm start
```

## 16. Supabase

Para administrar la base de datos mediante Supabase CLI:

```powershell
supabase login
supabase link --project-ref yyjeihyldqbvkkpswxwg
supabase db push
```

Nunca publiques en GitHub la contraseña de PostgreSQL, `service_role`, claves `sb_secret_...`, contraseñas personales ni otras credenciales privadas.

## 17. Errores frecuentes

### `git` no se reconoce

Comprueba:

```powershell
git --version
```

Si no funciona, instala Git para Windows y vuelve a abrir PowerShell.

### `npm.ps1` no puede cargarse

Ejecuta:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Cierra y vuelve a abrir PowerShell. También puedes utilizar `npm.cmd`.

### `npm` no se reconoce

Comprueba:

```powershell
node --version
npm --version
```

Si no funcionan, revisa la instalación de Node.js.

### El teléfono no se conecta

Comprueba que:

- PC y teléfono están en la misma red.
- `npm run stage-server` continúa ejecutándose.
- La IPv4 de la computadora es correcta.
- Se utiliza el puerto `8080`.
- La dirección tiene el formato `ws://IP-DE-LA-PC:8080`.
- El PIN/token coincide.
- El Firewall de Windows no bloquea Node.js.
- La red Wi-Fi permite comunicación entre dispositivos.

## 18. Resumen rápido para un concierto

Terminal 1 — Stage Network:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm run stage-server
```

Terminal 2 — LiveVoz:

```powershell
cd C:\Users\josue\Documents\Telepromter
npm start
```

En los dispositivos utiliza:

```text
ws://IP-DE-LA-PC:8080
```

con el mismo PIN/token y realiza una prueba de cambio de canción desde el Operador antes de comenzar.
