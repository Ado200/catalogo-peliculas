# Catálogo de películas

Catálogo personal de películas y series. La página es estática y está alojada en GitHub Pages. Los datos del catálogo viven en una hoja de Google Sheets, y Apps Script completa la información desde TMDB y YouTube.

Página: https://ado200.github.io/catalogo-peliculas/

## Arquitectura

| Componente | Función |
|---|---|
| GitHub Pages | Aloja `index.html` y `manifest.json`. No hay servidor propio. |
| Google Sheets | Base de datos del catálogo (títulos, datos, temas, tráilers). |
| Apps Script (`Código.gs`) | Completa datos desde TMDB y YouTube. Tiene un activador que corre `completarTodo` cada 10 minutos. |
| Google Drive (`appDataFolder`) | Guarda las marcas personales de cada usuario en un archivo `marcas.json` privado de la app. |
| Google Identity Services | Inicio de sesión con cuenta de Google. |

## Flujo de datos

1. El usuario inicia sesión con Google. La página recibe un token de acceso temporal en el navegador.
2. La página lee la hoja de Sheets con ese token para mostrar el catálogo.
3. Las marcas personales (vista, pendiente, estrellas) se leen y escriben en `marcas.json`, dentro de la carpeta privada de la app en el Drive del propio usuario.
4. Una copia de las marcas se guarda en `localStorage` del navegador para uso sin conexión.
5. Las imágenes se cargan desde `image.tmdb.org` y los tráilers desde YouTube.

## Permisos (scopes) solicitados

- `https://www.googleapis.com/auth/spreadsheets`: leer y escribir en las hojas de la cuenta. Es más amplio de lo necesario. La página solo usa la hoja con el ID definido en el código.
- `https://www.googleapis.com/auth/drive.appdata`: acceso solo a la carpeta privada de la app. No da acceso al resto del Drive.

## Datos que maneja el sistema

| Dato | Dónde se guarda | Quién puede leerlo |
|---|---|---|
| Catálogo (títulos, sinopsis, tráilers, temas) | Hoja de Google Sheets | Cuentas con acceso a la hoja |
| Marcas personales | `marcas.json` en el Drive del usuario | Solo el usuario que inicia sesión |
| Copia local de marcas | `localStorage` del navegador | Solo ese navegador |
| Claves de TMDB y YouTube | Propiedades del script en Apps Script | Solo quien tenga acceso al proyecto de Apps Script |

## Secretos (nunca en el repositorio)

- `TMDB_TOKEN` y `YOUTUBE_KEY` se guardan en Apps Script, en Configuración del proyecto → Propiedades del script.
- El ID de cliente OAuth y el ID de la hoja sí están en `index.html`. No son secretos, pero si cambian hay que actualizarlos en ambos lugares.

## Dependencias externas

- TMDB: datos de títulos, pósters y reparto. Se requiere atribución y no se debe sugerir que TMDB respalda el proyecto.
- YouTube Data API v3: búsqueda y validación de tráilers.
- Google Identity Services y las APIs de Sheets y Drive.

## Cómo desplegar

1. Copia la hoja de cálculo y anota su ID.
2. Crea un proyecto de Apps Script, pega `Código.gs`, agrega `TMDB_TOKEN` y `YOUTUBE_KEY`, y activa el activador de `completarTodo` cada 10 minutos.
3. En Google Cloud, activa Google Sheets API, Google Drive API y YouTube Data API v3. Crea un ID de cliente OAuth tipo aplicación web y agrega el origen de la página en "Orígenes de JavaScript autorizados".
4. Cambia `HOJA_ID` y `CLIENT_ID` en `index.html`.
5. Sube `index.html`, `manifest.json` e `icon.svg` a un repositorio público y activa GitHub Pages (rama `main`, carpeta raíz).

## Funciones principales de `Código.gs`

- `completarTodo`: completa datos de filas nuevas desde TMDB.
- `completarPortadas`: trae portadas faltantes.
- `comprobarLinks`: revisa que los enlaces respondan y escribe el estado en `estado_link`.
- `completarTrailersYouTube` y `corregirTrailers`: buscan tráilers en español e inglés y validan que puedan incrustarse.
- `doGet`: versión antigua servida por Apps Script. Ya no se usa, porque la página está en GitHub Pages.

## Limitaciones conocidas

- Google Sheets y Apps Script no están pensados para miles de registros ni muchos usuarios simultáneos.
- El permiso de Sheets es más amplio de lo necesario.
- Las cuotas de la API de YouTube y de Apps Script pueden agotarse con uso intensivo.

## Aviso de privacidad

Ver [PRIVACIDAD.md](PRIVACIDAD.md).

## Créditos

Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB.
