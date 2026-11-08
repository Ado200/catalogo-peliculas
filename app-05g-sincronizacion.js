/* ===== Fase 0 · Módulo «sincronizacion» (lo que quedaba de app-05): motor de sincronización con Drive, claves estables, arranque de marcas y listeners que se activan al cargar. Se carga en la misma posición que app-05 para conservar el orden original y la seguridad de tus datos. Migrado sin cambios de comportamiento. ===== */
/* ===== Sincronización segura de marcas (punto 1) ===== */
let syncUid = null;          // id estable de la cuenta de Google (sub)
let syncBase = {};           // última versión confirmada en Drive
let syncPendiente = false;   // hay cambios de este dispositivo sin subir
let syncEnCurso = false;
let syncOtraVez = false;
let syncReintento = null;
let syncUltimaVuelta = 0;

const syncClave = () => "marcas_v6_" + syncUid;
const syncIguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const syncClon = o => JSON.parse(JSON.stringify(o));

function syncLeerLocal() {
  if (!syncUid) return null;
  try { return JSON.parse(localStorage.getItem(syncClave()) || "null"); } catch (e) { return null; }
}

function syncGuardarLocal() {
  if (!syncUid) return;
  try {
    localStorage.setItem(syncClave(), JSON.stringify({ marcas: Nucleo.datos.marcas(), base: syncBase, pendiente: syncPendiente }));
  } catch (e) {}
}

function syncBorrarLocal() {
  syncBase = {};
  syncPendiente = false;
  if (syncUid) { try { localStorage.removeItem(syncClave()); } catch (e) {} }
}

// Marca la hora solo en las películas que cambiaron desde la última sincronización
function syncMarcarCambios() {
  const ahora = Date.now();
  new Set([...Object.keys(Nucleo.datos.marcas()), ...Object.keys(syncBase)]).forEach(k => {
    if (k.startsWith("__") || !Nucleo.datos.marcas()[k]) return;
    if (!syncIguales(Nucleo.datos.marcas()[k], syncBase[k])) Nucleo.datos.marcas()[k].mod = ahora;
  });
}

// Cuenta los cambios de este dispositivo que todavía no están en Drive
function syncContarPendientes() {
  let n = 0;
  new Set([...Object.keys(Nucleo.datos.marcas()), ...Object.keys(syncBase)]).forEach(k => {
    if (k.startsWith("__")) return;
    if (!syncIguales(Nucleo.datos.marcas()[k], syncBase[k])) n++;
  });
  return n;
}

function mensajeSinConexion() {
  const n = syncContarPendientes();
  return "Sin conexión: " + (n ? n + (n === 1 ? " cambio" : " cambios") + " por subir" : "todo guardado en este dispositivo") + ".";
}

// Mezcla película por película: usa la base común para saber qué cambió de cada lado
function syncMezclar(local, remota, base) {
  const res = {};
  new Set([...Object.keys(local), ...Object.keys(remota), ...Object.keys(base)]).forEach(k => {
    const l = local[k], r = remota[k], b = base[k];
    const cambioLocal = !syncIguales(l, b);
    const cambioRemoto = !syncIguales(r, b);
    let v;
    if (!cambioLocal && !cambioRemoto) v = b;
    else if (cambioLocal && !cambioRemoto) v = l;
    else if (!cambioLocal && cambioRemoto) v = r;
    else if (k.startsWith("__") || !r) v = l;
    else if (!l) v = r;
    else v = ((l.mod || 0) >= (r.mod || 0)) ? l : r;
    if (v !== undefined) res[k] = v;
  });
  return res;
}

// Identidad de la cuenta: permite separar la copia local de cada persona
async function syncCargarUid() {
  try {
    const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!r.ok) throw new Error("userinfo " + r.status);
    const j = await r.json();
    syncUid = j.sub || null;
    if (syncUid) { try { localStorage.setItem("sync_uid_cache", syncUid); } catch (e) {} }
  } catch (e) {
    // Sin señal: usa el id guardado en la última sesión con conexión
    try { syncUid = localStorage.getItem("sync_uid_cache"); } catch (e2) { syncUid = null; }
  }
  if (!syncUid) throw new Error("sin id de cuenta");
}

// Lee todos los marcas.json de tu Drive y los combina, para no perder nada si hubo duplicados
// Antes de subir: confirma que los archivos de Drive siguen igual que cuando se leyeron
async function syncArchivosCambiaron(ids, versiones) {
  const q = encodeURIComponent("name='marcas.json'");
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`);
  const j = await r.json();
  const ahora = {};
  (j.files || []).forEach(f => { ahora[f.id] = f.modifiedTime; });
  const a = Object.keys(ahora).sort().join(","), b = Object.keys(versiones).sort().join(",");
  if (a !== b) return true;
  return Object.keys(versiones).some(id => ahora[id] !== versiones[id]);
}

async function syncLeerTodos() {
  const q = encodeURIComponent("name='marcas.json'");
  // Si esto falla, lanza error: no seguimos y no creamos archivos nuevos
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&orderBy=modifiedTime%20desc&fields=files(id,modifiedTime)`);
  const j = await r.json();
  const ids = (j.files || []).map(f => f.id);
  const versiones = {};
  (j.files || []).forEach(f => { versiones[f.id] = f.modifiedTime; });
  let combinado = {};
  for (const id of ids) {
    const c = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    const datos = await c.json();
    combinado = syncMezclar(combinado, datos || {}, {});
  }
  return { ids, combinado, versiones };
}
async function syncSubir(id, datos) {
  const cuerpo = JSON.stringify(datos);
  if (id) {
    await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: cuerpo
    });
    return id;
  }
  const frontera = "marcas_frontera";
  const meta = JSON.stringify({ name: "marcas.json", parents: ["appDataFolder"] });
  const partes = `--${frontera}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${frontera}\r\nContent-Type: application/json\r\n\r\n${cuerpo}\r\n--${frontera}--`;
  const r = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${frontera}` },
    body: partes
  });
  const j = await r.json();
  return j.id;
}

// Función central: lee Drive, combina, sube y solo confirma "guardado" si la subida funcionó
async function syncTodo() {
  if (!accessToken) return;
  if (syncEnCurso) { syncOtraVez = true; return; }
  if (navigator.onLine === false) {
    syncMarcarCambios();
    syncPendiente = syncContarPendientes() > 0;
    syncGuardarLocal();
    setEstado(mensajeSinConexion());
    return;
  }
  syncEnCurso = true;
  clearTimeout(syncReintento);
  if (syncContarPendientes() > 0) setEstado("Guardando…");
  try {
    syncMarcarCambios();
    const { ids, combinado, versiones } = await syncLeerTodos();
    const antes = syncClon(Nucleo.datos.marcas());
    marcas = envolverMarcas(syncMezclar(Nucleo.datos.marcas(), combinado, syncBase));
    const cambio = !syncIguales(antes, Nucleo.datos.marcas());
    const enviar = syncClon(Nucleo.datos.marcas());
    if (!syncIguales(enviar, combinado) || ids.length > 1) {
      if (ids.length || Object.keys(enviar).length) {
        if (await syncArchivosCambiaron(ids, versiones)) throw new Error("CONFLICTO_DRIVE");
        idMarcas = await syncSubir(ids[0] || null, enviar);
        for (const id of ids.slice(1)) {
          await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}`, { method: "DELETE" });
        }
      }
    } else {
      idMarcas = ids[0] || null;
    }
    syncBase = enviar;
    syncReintentos = 0;
    syncPendiente = !syncIguales(Nucleo.datos.marcas(), enviar);
    syncGuardarLocal();
    if (cambio && Nucleo.datos.peliculas().length) refrescarTodo();
    const hora = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    ultimaSyncOk = Date.now();
    setEstado((syncPendiente ? "Hay cambios nuevos por subir…" : "Guardado en tu Drive · " + hora) + avisoIds());
  } catch (e) {
    if (String(e.message) === "CONFLICTO_DRIVE" && syncReintentos < 3) {
      syncReintentos++;
      syncReintento = setTimeout(syncTodo, 250);
      return;
    }
    syncReintentos = 0;
    syncPendiente = !syncIguales(Nucleo.datos.marcas(), syncBase);
    syncGuardarLocal();
    setEstado(navigator.onLine === false
      ? mensajeSinConexion()
      : "No se pudo subir ahora. Reintentaré en 30 segundos.");
    syncReintento = setTimeout(syncTodo, 30000);
  } finally {
    syncEnCurso = false;
    if (syncOtraVez) { syncOtraVez = false; syncTodo(); }
  }
}

// Avisa en la barra de estado si hay marcas que ya no coinciden con ninguna fila de la hoja
function avisoIds() {
  if (!Nucleo.datos.peliculas().length) return "";
  const ids = new Set(Nucleo.datos.peliculas().map(idDe));
  const huerfanas = Object.keys(Nucleo.datos.marcas()).filter(k => !k.startsWith("__") && Nucleo.datos.marcas()[k] && !ids.has(k)).length;
  const sinId = Nucleo.datos.peliculas().filter(p => !/^\d+$/.test(String(p.tmdb_id || "").trim())).length;
  let t = "";
  if (huerfanas) t += " · " + huerfanas + (huerfanas === 1 ? " marca sin película en la hoja" : " marcas sin película en la hoja");
  if (sinId) t += " · " + sinId + (sinId === 1 ? " película sin tmdb_id" : " películas sin tmdb_id");
  return t;
}

// Identidad estable de cada película: su tmdb_id; si no tiene, una versión normalizada del título
function idDe(p) {
  const t = String(p.tmdb_id || "").trim();
  return /^\d+$/.test(t) ? "tmdb:" + t : "slug:" + slugDe(p);
}

/* ---------- Claves estables: las marcas se guardan por id (tmdb:123), no por título ---------- */
function claveDe(p) { return idDe(p); }

let mapaTitulos = {};   // título -> clave estable (se llena al cargar la hoja)
const tieneProp = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function construirMapaTitulos() {
  mapaTitulos = {};
  Nucleo.datos.peliculas().forEach(p => { if (!tieneProp(mapaTitulos, p.titulo)) mapaTitulos[p.titulo] = claveDe(p); });
}

// Pasa las claves de título a su clave estable; si dos registros chocan, combina sus campos (gana el más reciente)
function normalizarClaves(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(k => {
    const destino = (!k.startsWith("__") && tieneProp(mapaTitulos, k)) ? mapaTitulos[k] : k;
    const v = obj[k];
    if (tieneProp(out, destino) && out[destino] && v) {
      const a = out[destino];
      out[destino] = (a.mod || 0) > (v.mod || 0) ? Object.assign({}, v, a) : Object.assign({}, a, v);
      return;
    }
    out[destino] = v;
  });
  return out;
}

// Envuelve las marcas: el resto de la página puede seguir usando marcas[título]; por dentro se guarda por id
function envolverMarcas(obj) {
  const base = normalizarClaves(obj);
  const traducir = k => (typeof k === "string" && !k.startsWith("__") && tieneProp(mapaTitulos, k)) ? mapaTitulos[k] : k;
  return new Proxy(base, {
    get: (t, k) => t[traducir(k)],
    set: (t, k, v) => { t[traducir(k)] = v; return true; },
    deleteProperty: (t, k) => { delete t[traducir(k)]; return true; },
    has: (t, k) => traducir(k) in t
  });
}

// Migración única: respaldo local previo, conversión de claves y marca de versión 2
function migrarClaves() {
  if (Nucleo.datos.marcas().__version === 2) return false;
  if (syncUid) { try { localStorage.setItem("respaldo_antes_de_claves_" + syncUid, JSON.stringify(Nucleo.datos.marcas())); } catch (e) {} }
  const antes = JSON.stringify(Nucleo.datos.marcas());
  marcas = envolverMarcas(Nucleo.datos.marcas());
  Nucleo.datos.marcas().__version = 2;
  programarGuardado();
  return JSON.stringify(Nucleo.datos.marcas()) !== antes;
}

// Funciones que usa el resto de la página





function programarGuardado() {
  if (window.Nucleo) Nucleo.emit("marcas:cambiadas");
  registrarDeshacer();
  syncPendiente = true;
  syncGuardarLocal();
  clearTimeout(guardadoTimer);
  guardadoTimer = setTimeout(syncTodo, 600);
}

function guardarMarcasDrive() { return syncTodo(); }

async function cargarMarcas() {
  try { await syncCargarUid(); } catch (e) { syncUid = null; }
  const local = syncLeerLocal();
  marcas = envolverMarcas(local && local.marcas ? local.marcas : {});
  syncBase = local && local.base ? local.base : {};
  syncPendiente = !!(local && local.pendiente);
  if (!syncUid) setEstado("No pude confirmar tu cuenta; no se guarda copia local en este dispositivo.");
  await syncTodo();
  mostrarGuiaSiEsNueva();
}

// Borra todos los marcas.json y los respaldos semanales de tu Drive
async function syncBorrarTodoDrive() {
  const q = encodeURIComponent("name='marcas.json' or name contains 'respaldo-marcas-'");
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`);
  const j = await r.json();
  for (const f of (j.files || [])) {
    await driveFetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: "DELETE" });
  }
}

// Al volver a la app (con límite de 30 s), al recuperar la conexión y cada 5 minutos
function syncAlVolver() {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - syncUltimaVuelta < 30000) return;
  syncUltimaVuelta = Date.now();
  if (Nucleo.datos.peliculas().length) syncTodo();
}
document.addEventListener("visibilitychange", syncAlVolver);
window.addEventListener("focus", syncAlVolver);
window.addEventListener("online", () => { setEstado("Conexión recuperada. Sincronizando…"); syncTodo(); });
window.addEventListener("offline", () => setEstado(mensajeSinConexion()));
// Sincronización periódica: solo con la app visible y con señal (no gasta datos en segundo plano)
setInterval(() => {
  if (Nucleo.datos.peliculas().length && !document.hidden && navigator.onLine !== false) syncTodo();
}, 300000);

// Cuando la hoja ya cargó: reconcilia las marcas por id y sincroniza una vez
const esperaSync = setInterval(() => {
  if (!Nucleo.datos.peliculas().length || !accessToken) return;
  clearInterval(esperaSync);
  construirMapaTitulos();
  if (migrarClaves()) refrescarTodo();
  syncTodo();
}, 500);

// Sale de la cuenta en este navegador y borra la copia local (no revoca el acceso de Google)
function salirDeEsteDispositivo() {
  if (syncPendiente && !confirm("Tienes cambios que aún no se subieron a tu Drive. Si sales ahora, se perderán en este dispositivo. ¿Continuar?")) return;
  syncBorrarLocal();
  marcas = envolverMarcas({});
  location.reload();
}
document.getElementById("salirDispositivo").addEventListener("click", salirDeEsteDispositivo);


if (window.Nucleo) { Nucleo.registrar("sincronizacion", { version: "1.0", emite: [], escucha: [] }); }
