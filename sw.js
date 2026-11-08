// Versión de la caché: súbela (catalogo-v3, v4…) cuando cambies index.html, iconos o estilos.
// app.js y estilos.css ya se piden primero a la red, así que sus cambios llegan sin subir la versión.
const VERSION = "catalogo-20261108013454";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./estilos.css",
  "./app-01-inicio-y-sugerencias.js",
  "./app-02-filtros-notas-recomendaciones.js",
  "./app-03-pintado-y-avisos.js",
  "./app-04-que-ver-y-sin-conexion.js",
  "./app-05-sincronizacion-y-explorar.js",
  "./app-06-modulos-varios.js",
  "./app-07-saludo-y-bloques.js",
  "./app-08-automatico-y-pwa.js",
  "./app-09-automatizacion-y-curiosidad.js",
  "./app-10-fases-y-diagnostico.js",
  "./app-11-hoy.js",
  "./app-12-ajustes.js",
  "./app-13-resumen.js",
  "./app-14-calendario.js",
  "./app-15-accesibilidad.js"
];

// Estas direcciones SIEMPRE van a la red y nunca se guardan: datos, APIs, IA e imágenes externas.
const SOLO_RED = /googleapis\.com|gstatic\.com|themoviedb\.org|youtube\.com|ytimg\.com|generativelanguage|script\.google|accounts\.google|esm\.sh|cdnjs\.cloudflare\.com|google\.com/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
  // No se activa sola: la persona decide cuándo actualizar desde el aviso de la app
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k !== VERSION && k !== IMAGENES).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Portadas y fotos de TMDB: se guardan para verse sin conexión, con un máximo de entradas
const IMAGENES = "imagenes-v1";
const MAX_IMAGENES = 300;

async function recortarImagenes(cache) {
  const llaves = await cache.keys();
  if (llaves.length > MAX_IMAGENES) {
    await Promise.all(llaves.slice(0, llaves.length - MAX_IMAGENES).map(k => cache.delete(k)));
  }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "image.tmdb.org") {
    // Lo primero que se muestra es la copia guardada; la red la actualiza en segundo plano
    e.respondWith((async () => {
      const cache = await caches.open(IMAGENES);
      const hit = await cache.match(req);
      const red = fetch(req).then(r => {
        if (r.ok) { cache.put(req, r.clone()); recortarImagenes(cache); }
        return r;
      }).catch(() => null);
      if (hit) { e.waitUntil(red); return hit; }
      return (await red) || Response.error();
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;        // otros sitios: red normal
  if (SOLO_RED.test(req.url)) return;                      // datos y APIs: siempre red

  // Páginas: primero la red (para recibir cambios); sin conexión, la copia guardada
  if (req.mode === "navigate") {
    // Responde de inmediato con la copia guardada y actualiza en segundo plano.
    // Así recargar (por ejemplo, al tocar Actualizar) no espera a la red.
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match("./index.html");
      const red = fetch(req).then(r => {
        if (r.ok) cache.put("./index.html", r.clone());
        return r;
      }).catch(() => null);
      if (cached) { e.waitUntil(red); return cached; }
      return (await red) || caches.match("./index.html");
    })());
    return;
  }

  // Código y estilos: primero la red (para no ejecutar una versión vieja); sin conexión, la copia guardada
  if (/\.(js|css)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(r => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Archivos del propio sitio (iconos, manifest): copia primero, red si no está
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) {
        const copia = r.clone();
        caches.open(VERSION).then(c => c.put(req, copia));
      }
      return r;
    }))
  );
});
