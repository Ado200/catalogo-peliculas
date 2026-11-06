// Versión de la caché: súbela (catalogo-v2, v3…) cada vez que cambies index.html o los iconos.
const VERSION = "catalogo-20261106011845";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

// Estas direcciones SIEMPRE van a la red y nunca se guardan: datos, APIs, IA e imágenes externas.
const SOLO_RED = /googleapis\.com|gstatic\.com|themoviedb\.org|image\.tmdb\.org|youtube\.com|ytimg\.com|generativelanguage|script\.google|accounts\.google|esm\.sh|cdnjs\.cloudflare\.com|google\.com/;

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
    await Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // otros sitios: red normal
  if (SOLO_RED.test(req.url)) return;                      // datos y APIs: siempre red

  // Páginas: primero la red (para recibir cambios); sin conexión, la copia guardada
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(r => {
        const copia = r.clone();
        caches.open(VERSION).then(c => c.put("./index.html", copia));
        return r;
      }).catch(() => caches.match("./index.html"))
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
