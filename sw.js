// Service worker: deja abrir el catálogo sin conexión con la última versión que se cargó.
// Solo guarda archivos de este mismo sitio (página, manifest, íconos). Nunca guarda datos de Google ni del chat.
const VERSION = "catalogo-v1";
const BASE = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION).then(c => c.addAll(BASE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Google, chat y CDNs pasan sin tocarse

  // Primero la red (para tener lo último); si no hay conexión, la copia guardada
  event.respondWith(
    fetch(req)
      .then(resp => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(VERSION).then(c => c.put(req, copia));
        }
        return resp;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});
