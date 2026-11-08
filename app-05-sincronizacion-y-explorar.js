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
    localStorage.setItem(syncClave(), JSON.stringify({ marcas: marcas, base: syncBase, pendiente: syncPendiente }));
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
  new Set([...Object.keys(marcas), ...Object.keys(syncBase)]).forEach(k => {
    if (k.startsWith("__") || !marcas[k]) return;
    if (!syncIguales(marcas[k], syncBase[k])) marcas[k].mod = ahora;
  });
}

// Cuenta los cambios de este dispositivo que todavía no están en Drive
function syncContarPendientes() {
  let n = 0;
  new Set([...Object.keys(marcas), ...Object.keys(syncBase)]).forEach(k => {
    if (k.startsWith("__")) return;
    if (!syncIguales(marcas[k], syncBase[k])) n++;
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
    const antes = syncClon(marcas);
    marcas = envolverMarcas(syncMezclar(marcas, combinado, syncBase));
    const cambio = !syncIguales(antes, marcas);
    const enviar = syncClon(marcas);
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
    syncPendiente = !syncIguales(marcas, enviar);
    syncGuardarLocal();
    if (cambio && peliculas.length) refrescarTodo();
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
    syncPendiente = !syncIguales(marcas, syncBase);
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
  if (!peliculas.length) return "";
  const ids = new Set(peliculas.map(idDe));
  const huerfanas = Object.keys(marcas).filter(k => !k.startsWith("__") && marcas[k] && !ids.has(k)).length;
  const sinId = peliculas.filter(p => !/^\d+$/.test(String(p.tmdb_id || "").trim())).length;
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
  peliculas.forEach(p => { if (!tieneProp(mapaTitulos, p.titulo)) mapaTitulos[p.titulo] = claveDe(p); });
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
  if (marcas.__version === 2) return false;
  if (syncUid) { try { localStorage.setItem("respaldo_antes_de_claves_" + syncUid, JSON.stringify(marcas)); } catch (e) {} }
  const antes = JSON.stringify(marcas);
  marcas = envolverMarcas(marcas);
  marcas.__version = 2;
  programarGuardado();
  return JSON.stringify(marcas) !== antes;
}

// Funciones que usa el resto de la página
/* ---------- Ventana sencilla reutilizable ---------- */
function abrirVentanaSimple(id, titulo, cuerpo) {
  const previa = document.getElementById(id);
  if (previa) previa.remove();
  const div = document.createElement("div");
  div.id = id;
  div.className = "ayuda-atajos";
  div.innerHTML = '<div class="ayuda-caja ventana-larga" role="dialog" aria-label="' + esc(titulo) + '">' +
    '<button type="button" class="dlg-x" data-cerrar aria-label="Cerrar">×</button>' +
    '<h3>' + esc(titulo) + '</h3>' + cuerpo + '</div>';
  div.addEventListener("click", e => { if (e.target === div || e.target.hasAttribute("data-cerrar")) div.remove(); });
  document.body.appendChild(div);
}

/* ---------- Cápsula del año ---------- */
function vistasDelAno(ano) {
  return peliculas.filter(p => ((marcas[p.titulo] || {}).historial || [])
    .some(h => h.a === "vista" && String(h.f).startsWith(ano)));
}

function abrirCapsulaAno() {
  const ano = String(new Date().getFullYear());
  const vistas = vistasDelAno(ano);
  if (!vistas.length) {
    abrirVentanaSimple("capsulaAno", "Cápsula " + ano,
      '<p class="meta">Aún no marcas películas como vistas este año. Cuando lo hagas, aquí verás tu resumen.</p>');
    return;
  }
  const est = p => (marcas[p.titulo] || {}).estrellas || 0;
  const top = vistas.slice().sort((a, b) => est(b) - est(a)).slice(0, 5);
  const genero = {};
  vistas.forEach(p => String(p.genero || "").split(/[,\/]/).map(x => x.trim()).filter(Boolean)
    .forEach(g => genero[g] = (genero[g] || 0) + 1));
  const generos = Object.entries(genero).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).join(", ") || "sin datos";
  const calificadas = vistas.filter(p => est(p) > 0);
  const promedio = calificadas.length
    ? (calificadas.reduce((s, p) => s + est(p), 0) / calificadas.length).toFixed(1) : "—";
  const cuerpo =
    '<div class="capsula-stats">' +
    '<div><b>' + vistas.length + '</b><span>vistas</span></div>' +
    '<div><b>' + promedio + '★</b><span>promedio</span></div>' +
    '<div><b>' + esc(generos) + '</b><span>géneros favoritos</span></div></div>' +
    '<h4>Tus favoritas del año</h4><ol>' +
    top.map(p => '<li>' + esc(p.titulo) + (est(p) ? ' · ' + est(p) + '★' : '') + '</li>').join('') + '</ol>';
  abrirVentanaSimple("capsulaAno", "Cápsula " + ano, cuerpo);
}

/* ---------- Modo pareja: elegir de «Para ver con alguien» ---------- */
function modoPareja() {
  try { return localStorage.getItem("modo_pareja") === "1"; } catch (e) { return false; }
}

function alternarModoPareja() {
  const activo = !modoPareja();
  try { localStorage.setItem("modo_pareja", activo ? "1" : "0"); } catch (e) {}
  $("parejaBtn").textContent = activo ? "💑 Modo pareja: activo" : "💑 Modo pareja";
  $("parejaBtn").classList.toggle("destacado", activo);
  setEstado(activo ? "Modo pareja activo: el aleatorio elige entre «Para ver con alguien»." : "Modo pareja desactivado.");
}

function sugerirParaDos() {
  const pool = peliculas.filter(p => (marcas[p.titulo] || {}).conAlguien && !(marcas[p.titulo] || {}).vista);
  if (!pool.length) {
    setEstado("Aún no tienen películas para ver juntos. Marca «Para ver con alguien» en una pendiente.");
    return;
  }
  abrirDetalle(pool[Math.floor(Math.random() * pool.length)]);
}

/* ---------- Reto del mes ---------- */
const RETOS_MES = [
  { texto: "Ve 3 películas este mes", meta: 3, cuenta: vs => vs.length },
  { texto: "Ve una película de un país distinto a Estados Unidos", meta: 1,
    cuenta: vs => vs.filter(p => !/estados unidos|eeuu|ee\. ?uu|usa/i.test(String(p.pais || ""))).length },
  { texto: "Ve una película anterior a 1980", meta: 1,
    cuenta: vs => vs.filter(p => Number(p["año"]) < 1980).length },
  { texto: "Ve 2 películas que califiques con 4 o 5★", meta: 2,
    cuenta: vs => vs.filter(p => ((marcas[p.titulo] || {}).estrellas || 0) >= 4).length }
];

function renderRetoMes() {
  const sec = $("retoMes");
  const hoy = new Date();
  const mes = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0");
  const vistasMes = peliculas.filter(p => ((marcas[p.titulo] || {}).historial || [])
    .some(h => h.a === "vista" && String(h.f).startsWith(mes)));
  const reto = RETOS_MES[hoy.getMonth() % RETOS_MES.length];
  const hecho = Math.min(reto.cuenta(vistasMes), reto.meta);
  const listo = hecho >= reto.meta;
  sec.style.display = "block";
  sec.innerHTML = '<div class="reto-caja' + (listo ? ' listo' : '') + '">' +
    '<div class="reto-titulo">🏆 Reto del mes</div>' +
    '<div class="reto-texto">' + esc(reto.texto) + '</div>' +
    '<div class="reto-barra"><span style="width:' + Math.round(hecho / reto.meta * 100) + '%"></span></div>' +
    '<div class="meta">' + (listo ? '¡Reto cumplido este mes!' : hecho + " de " + reto.meta + " logrado") + '</div></div>';
}

/* ---------- Diario de cine ---------- */
function abrirDiario() {
  const entradas = [];
  peliculas.forEach(p => {
    const o = marcas[p.titulo] || {};
    if (!o.vista) return;
    const v = (o.historial || []).filter(h => h.a === "vista").slice(-1)[0];
    entradas.push({ p, o, f: v ? String(v.f) : "" });
  });
  entradas.sort((a, b) => (b.f || "0").localeCompare(a.f || "0"));
  if (!entradas.length) {
    abrirVentanaSimple("diarioCine", "Diario de cine",
      '<p class="meta">Tu diario se llena solo cuando marcas películas como vistas. Escribe una nota en cada una y aparecerá aquí.</p>');
    return;
  }
  let html = "", mesActual = "";
  entradas.slice(0, 200).forEach(e => {
    const mes = e.f ? e.f.slice(0, 7) : "Sin fecha";
    if (mes !== mesActual) { mesActual = mes; html += '<h4>' + esc(mes) + '</h4>'; }
    html += '<div class="diario-entrada"><b>' + esc(e.p.titulo) + '</b>' +
      (e.o.estrellas ? ' <span class="meta">' + e.o.estrellas + '★</span>' : '') +
      (e.f ? ' <span class="meta">· ' + esc(e.f) + '</span>' : '') +
      (e.o.nota ? '<p>' + esc(e.o.nota) + '</p>' : '') + '</div>';
  });
  abrirVentanaSimple("diarioCine", "Diario de cine", html);
}

/* ---------- Perfil de gustos para Estela (sale de tus marcas) ---------- */
function perfilGustos() {
  const gen = {}, dir = {}, neg = {};
  let pend = 0;
  peliculas.forEach(p => {
    const o = marcas[p.titulo] || {};
    const gs = String(p.genero || "").split(/[,\/]/).map(x => x.trim()).filter(Boolean);
    if (o.pendiente) pend++;
    if (o.vista && (o.estrellas || 0) >= 4) {
      gs.forEach(g => gen[g] = (gen[g] || 0) + 1);
      if (p.director) dir[p.director] = (dir[p.director] || 0) + 1;
    }
    if (o.descartada) gs.forEach(g => neg[g] = (neg[g] || 0) + 1);
  });
  const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).join(", ") || "sin datos";
  return "le gustan los géneros " + top(gen) + "; directores " + top(dir) +
    "; descarta " + top(neg) + "; tiene " + pend + " pendientes";
}

/* ---------- Avisos visibles (aparecen sobre la barra inferior) ---------- */
let toastTimer = null;
function avisar(msg) {
  setEstado(msg);
  let t = document.getElementById("toastApp");
  if (!t) {
    t = document.createElement("div");
    t.id = "toastApp";
    t.className = "toast-app";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("visible"), 4200);
}

/* ---------- Etapa 1: selección inteligente ---------- */
const TEMAS_NOCHE = [
  { dia: "domingo", tema: "Ciencia ficción", genero: "ciencia ficci" },
  { dia: "lunes", tema: "Animación", genero: "animaci" },
  { dia: "martes", tema: "Comedia", genero: "comedia" },
  { dia: "miércoles", tema: "Drama", genero: "drama" },
  { dia: "jueves", tema: "Aventura", genero: "aventura" },
  { dia: "viernes", tema: "Terror o suspenso", genero: "terror|suspenso|thriller" },
  { dia: "sábado", tema: "Romance", genero: "romance" }
];

function pendientesNoVistas() {
  return peliculas.filter(p => (marcas[p.titulo] || {}).pendiente && !(marcas[p.titulo] || {}).vista);
}

function generoCoincide(p, patron) {
  return new RegExp(patron, "i").test(String(p.genero || ""));
}

function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

/* 1) Noche temática según el día */
function nocheTematica() {
  const hoy = TEMAS_NOCHE[new Date().getDay()];
  const pool = pendientesNoVistas();
  if (!pool.length) {
    avisar("No tienes pendientes sin ver. Agrega algunas para elegir.");
    return;
  }
  const del_tema = pool.filter(p => generoCoincide(p, hoy.genero));
  if (!del_tema.length) {
    avisar("Hoy es noche de " + hoy.tema + ", pero no tienes pendientes de ese género. Te muestro otra.");
    abrirDetalle(elegirAlAzar(pool));
    return;
  }
  avisar("Noche de " + hoy.tema + " (" + hoy.dia + ").");
  abrirDetalle(elegirAlAzar(del_tema));
}

/* 3) Maratón: arma hasta 3 películas que quepan en el tiempo indicado */
function abrirMaraton() {
  abrirVentanaSimple("maraton", "Maratón",
    '<p class="meta">¿Cuántos minutos tienes para ver películas?</p>' +
    '<div class="fila-form"><input id="maraMin" type="number" min="30" step="15" value="300" inputmode="numeric">' +
    '<button type="button" class="pildora destacado" id="maraGo">Armar</button></div>' +
    '<div id="maraRes"></div>');
  document.getElementById("maraGo").addEventListener("click", () => armarMaraton(Number(document.getElementById("maraMin").value)));
  armarMaraton(300);
}

function armarMaraton(minutosPedidos) {
  const res = document.getElementById("maraRes");
  if (!minutosPedidos || minutosPedidos <= 0) { res.innerHTML = '<p class="meta">Escribe un número de minutos.</p>'; return; }
  const pool = pendientesNoVistas().map(p => ({ p, m: minutos(p) })).filter(x => x.m > 0);
  if (!pool.length) {
    res.innerHTML = '<p class="meta">Ninguna pendiente tiene duración escrita. Revisa la columna «duracion» de la hoja, por ejemplo «1 h 45 min».</p>';
    return;
  }
  const { elegidas, total } = armarLista({ pool, minutosMax: minutosPedidos, maximo: 3, separacion: 0 });
  if (!elegidas.length) {
    res.innerHTML = '<p class="meta">Ninguna pendiente cabe en ' + minutosPedidos + ' minutos. Prueba con más tiempo.</p>';
    return;
  }
  const h = Math.floor(total / 60), mm = total % 60;
  res.innerHTML = '<p class="meta">Total: ' + h + ' h ' + mm + ' min · ' + elegidas.length + ' películas</p><ol>' +
    elegidas.map(x => '<li><b>' + esc(x.p.titulo) + '</b> · ' + x.m + ' min</li>').join("") + '</ol>';
}

/* 8) Modo sorpresa con reglas */
function abrirSorpresa() {
  const generos = [...new Set(peliculas.flatMap(p => String(p.genero || "").split(/[,\/]/).map(x => x.trim()).filter(Boolean)))].sort();
  abrirVentanaSimple("sorpresa", "Sorpresa con reglas",
    '<label class="campo">Duración máxima<select id="sorpDur"><option value="0">Cualquiera</option><option value="90">Hasta 90 min</option><option value="120">Hasta 2 h</option></select></label>' +
    '<label class="campo">Género<select id="sorpGen"><option value="">Cualquiera</option>' +
    generos.map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join("") + '</select></label>' +
    '<label class="campo">Actor (opcional)<input id="sorpAct" type="text" placeholder="Ej. Scarlett Johansson"></label>' +
    '<p id="sorpRes" class="meta"></p>' +
    '<button type="button" class="pildora destacado" id="sorpOtra">🎲 Sorpréndeme</button>');
  const elegir = () => {
    const dur = Number($("sorpDur") ? document.getElementById("sorpDur").value : 0);
    const gen = document.getElementById("sorpGen").value;
    const act = document.getElementById("sorpAct").value.trim().toLowerCase();
    const pool = pendientesNoVistas().filter(p =>
      (!dur || (minutos(p) > 0 && minutos(p) <= dur)) &&
      (!gen || String(p.genero || "").toLowerCase().includes(gen.toLowerCase())) &&
      (!act || String(p.reparto || "").toLowerCase().includes(act)));
    const res = document.getElementById("sorpRes");
    if (!pool.length) {
      const soloGenero = pendientesNoVistas().filter(p => !gen || String(p.genero || "").toLowerCase().includes(gen.toLowerCase())).length;
      res.textContent = soloGenero
        ? "Hay " + soloGenero + " pendiente(s) de ese género, pero ninguna cumple también la duración o el actor. Relaja una regla."
        : "No tienes pendientes de ese género. Elige «Cualquiera» o agrega películas.";
      return;
    }
    const p = elegirAlAzar(pool);
    res.innerHTML = "Te toca: <b>" + esc(p.titulo) + "</b>";
    document.querySelector("#sorpresa [data-cerrar]").click();
    abrirDetalle(p);
  };
  document.getElementById("sorpOtra").addEventListener("click", elegir);
}

/* ---------- Etapa 2a: votación en pareja (en un mismo dispositivo) ---------- */
function leerVotos() {
  try { return JSON.parse(localStorage.getItem("votos_pareja") || "{}"); } catch (e) { return {}; }
}
function guardarVotos(v) {
  try { localStorage.setItem("votos_pareja", JSON.stringify(v)); } catch (e) {}
}

function abrirVotacionPareja() {
  const votos = leerVotos();
  let quien = "1";
  const candidatas = () => pendientesNoVistas().filter(p => !(votos[p.titulo] && votos[p.titulo][quien]));

  function pintarVotacion() {
    const cola = candidatas();
    const caja = document.querySelector("#votacionPareja .ventana-larga");
    const coincidencias = pendientesNoVistas().filter(p => votos[p.titulo] && votos[p.titulo]["1"] === 1 && votos[p.titulo]["2"] === 1);
    let html = '<p class="meta">Votando: <b>Persona ' + quien + '</b> · pendientes por votar: ' + cola.length + '</p>';
    if (cola.length) {
      const p = cola[0];
      html += '<div class="voto-tarjeta"><b>' + esc(p.titulo) + '</b><div class="meta">' +
        esc(p.genero || "") + (p.duracion ? " · " + esc(p.duracion) : "") + '</div>' +
        '<div class="voto-botones"><button type="button" class="pildora" data-voto="-1">👎 No</button>' +
        '<button type="button" class="pildora destacado" data-voto="1">👍 Sí</button></div></div>';
    } else {
      html += '<p class="meta">Ya votó esta persona por todas.</p>';
    }
    html += '<button type="button" class="pildora" id="cambiarPersona">Cambiar a Persona ' + (quien === "1" ? "2" : "1") + '</button>';
    html += '<h4>Coinciden los dos (' + coincidencias.length + ')</h4><ul>' +
      coincidencias.map(p => '<li>' + esc(p.titulo) + '</li>').join("") + '</ul>';
    caja.querySelector(".voto-cuerpo").innerHTML = html;
    caja.querySelectorAll("[data-voto]").forEach(b => b.addEventListener("click", () => {
      const t = cola[0].titulo;
      votos[t] = Object.assign({}, votos[t] || {}, { [quien]: Number(b.dataset.voto) });
      guardarVotos(votos);
      pintarVotacion();
    }));
    document.getElementById("cambiarPersona").addEventListener("click", () => {
      quien = quien === "1" ? "2" : "1";
      pintarVotacion();
    });
  }

  abrirVentanaSimple("votacionPareja", "Votación en pareja",
    '<div class="voto-cuerpo"></div>' +
    '<p class="meta">Se guarda en este navegador. Es para votar en un mismo dispositivo, turnándose.</p>' +
    '<button type="button" class="pildora" id="reiniciarVotos">Empezar de cero</button>');
  document.getElementById("reiniciarVotos").addEventListener("click", () => {
    guardarVotos({});
    Object.keys(votos).forEach(k => delete votos[k]);
    pintarVotacion();
  });
  pintarVotacion();
}

/* ---------- Etapa 2b: filtro por ánimo (ordena el catálogo) ---------- */
const ANIMOS = [
  { id: "tranquilo", texto: "😌 Tranquilo", generos: "animaci|documental|romance" },
  { id: "emocionado", texto: "🔥 Emocionado", generos: "acci|aventura|ciencia ficci|thriller" },
  { id: "reir", texto: "😂 Quiero reír", generos: "comedia" },
  { id: "melancolico", texto: "🌧 Melancólico", generos: "drama" },
  { id: "pensar", texto: "🧠 Para pensar", generos: "misterio|documental|historia|ciencia ficci" }
];

function animoActual() {
  try { return localStorage.getItem("animo") || ""; } catch (e) { return ""; }
}

function abrirAnimo() {
  const actual = animoActual();
  abrirVentanaSimple("animoVentana", "¿Cómo te sientes hoy?",
    ANIMOS.map(a => '<button type="button" class="pildora animo-op' + (a.id === actual ? ' destacado' : '') +
      '" data-animo="' + a.id + '">' + esc(a.texto) + '</button>').join(" ") +
    '<p class="meta">El catálogo pondrá primero las películas de ese ánimo.</p>' +
    '<button type="button" class="pildora" data-animo="">Quitar ánimo</button>');
  document.querySelectorAll("#animoVentana [data-animo]").forEach(b => b.addEventListener("click", () => {
    try { localStorage.setItem("animo", b.dataset.animo); } catch (e) {}
    document.querySelector("#animoVentana [data-cerrar]").click();
    pintar();
    const a = ANIMOS.find(x => x.id === b.dataset.animo);
    avisar(a ? "Catálogo en modo " + a.texto + "." : "Ánimo quitado.");
  }));
}

function ordenarPorAnimo(lista) {
  const a = ANIMOS.find(x => x.id === animoActual());
  if (!a) return lista;
  const re = new RegExp(a.generos, "i");
  return lista.slice().sort((x, y) => (re.test(String(y.genero || "")) ? 1 : 0) - (re.test(String(x.genero || "")) ? 1 : 0));
}

/* ---------- Etapa 2c: el ánimo cambia el color de las tarjetas ---------- */
const ANIMO_COLOR = { tranquilo: "#30b0c7", emocionado: "#ff6b35", reir: "#ffcc00", melancolico: "#5e5ce6", pensar: "#34c759" };

function marcarAnimo() {
  const lis = document.getElementById("lista");
  if (!lis) return;
  const a = ANIMOS.find(x => x.id === animoActual());
  lis.classList.toggle("animo-activo", !!a);
  if (!a) return;
  lis.style.setProperty("--animo", ANIMO_COLOR[a.id]);
  const re = new RegExp(a.generos, "i");
  lis.querySelectorAll("[data-i]").forEach(el => {
    const p = visibles[Number(el.dataset.i)];
    el.classList.toggle("animo-match", !!p && re.test(String(p.genero || "")));
  });
}

/* ---------- Etapa 3a: mapa de viaje cinematográfico ---------- */
const PAISES_MAPA = ["Estados Unidos", "México", "Francia", "Italia", "España", "Japón", "Corea del Sur", "India",
  "Brasil", "Reino Unido", "Alemania", "China", "Argentina", "Canadá", "Irán", "Australia", "Rusia", "Suecia"];

const PAIS_ALIAS = {
  "United States of America": "Estados Unidos", "United States": "Estados Unidos", "USA": "Estados Unidos", "EE. UU.": "Estados Unidos",
  "Mexico": "México", "Spain": "España", "France": "Francia", "Italy": "Italia", "Japan": "Japón",
  "South Korea": "Corea del Sur", "Korea": "Corea del Sur", "Germany": "Alemania", "United Kingdom": "Reino Unido",
  "Brazil": "Brasil", "Canada": "Canadá", "Iran": "Irán", "Russia": "Rusia", "Sweden": "Suecia"
};
function normPais(c) {
  const x = String(c || "").trim();
  return PAIS_ALIAS[x] || x;
}
function paisesDe(p) {
  return String(p.pais || "").split(/[,\/]/).map(x => normPais(x)).filter(Boolean);
}

function abrirMapaViaje() {
  const mapa = {};
  peliculas.forEach(p => {
    const o = marcas[p.titulo] || {};
    paisesDe(p).forEach(c => {
      mapa[c] = mapa[c] || { total: 0, vistas: 0, films: [] };
      mapa[c].total++;
      if (o.vista) mapa[c].vistas++;
      mapa[c].films.push(p);
    });
  });
  const paises = Object.keys(mapa).sort((x, y) => x.localeCompare(y, "es"));
  const visitados = paises.filter(c => mapa[c].vistas > 0).length;
  const sugerido = paises.filter(c => mapa[c].vistas === 0).sort((x, y) => mapa[y].total - mapa[x].total)[0];
  abrirVentanaSimple("mapaViaje", "Mapa de viaje",
    '<p class="meta">Has visto películas de ' + visitados + ' de ' + paises.length + ' países de tu catálogo. Toca un país para ver sus películas.</p>' +
    '<div class="paises-grid">' + paises.map(c =>
      '<button type="button" class="pais-chip' + (mapa[c].vistas ? ' visto' : '') + '" data-pais="' + esc(c) + '">' +
      esc(c) + ' · ' + mapa[c].total + '</button>').join("") + '</div>' +
    (sugerido ? '<p class="pais-sugerencia">Te sugiero <b>' + esc(sugerido) + '</b>, donde aún no has visto ninguna.</p>' : '') +
    '<div id="paisDetalle"></div>');
  const ventana = document.getElementById("mapaViaje");
  ventana.addEventListener("click", e => {
    const pais = e.target.closest("[data-pais]");
    const peli = e.target.closest("[data-titulo]");
    if (peli) {
      const p = peliculas.find(x => x.titulo === peli.dataset.titulo);
      ventana.remove();
      if (p) abrirDetalle(p);
      return;
    }
    if (!pais) return;
    const c = pais.dataset.pais;
    const films = mapa[c].films;
    document.getElementById("paisDetalle").innerHTML = '<h4>' + esc(c) + ' (' + films.length + ')</h4>' +
      films.map(p => {
        const o = marcas[p.titulo] || {};
        const estado = o.vista ? "✓ vista" : o.pendiente ? "⏳ pendiente" : "sin ver";
        return '<button type="button" class="explorar-item" data-titulo="' + esc(p.titulo) + '"><b>' + esc(p.titulo) +
          '</b><span class="meta">' + esc(p["año"] || "") + ' · ' + estado + '</span></button>';
      }).join("");
  });
}

/* ---------- Etapa 3b: rachas de gustos ---------- */
function detectarRachas() {
  const avisos = [];
  const vistas = peliculas.map(p => ({ p, o: marcas[p.titulo] || {} }))
    .filter(x => x.o.vista && x.o.estrellas)
    .map(x => {
      const ultima = (x.o.historial || []).filter(h => h.a === "vista").slice(-1)[0];
      return { p: x.p, o: x.o, f: ultima ? String(ultima.f) : "" };
    })
    .sort((a, b) => a.f.localeCompare(b.f));

  const dir = {};
  vistas.forEach(v => { if (v.o.estrellas >= 4 && v.p.director) dir[v.p.director] = (dir[v.p.director] || 0) + 1; });
  Object.entries(dir).filter(x => x[1] >= 3).forEach(([d, n]) =>
    avisos.push("Te gusta mucho " + d + ": " + n + " películas suyas con 4 o 5★."));

  if (vistas.length >= 16) {
    const topGenero = arr => {
      const c = {};
      arr.forEach(v => String(v.p.genero || "").split(/[,\/]/).map(x => x.trim()).filter(Boolean)
        .forEach(g => c[g] = (c[g] || 0) + 1));
      const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
      return e ? e[0] : "";
    };
    const antes = topGenero(vistas.slice(-16, -8)), ahora = topGenero(vistas.slice(-8));
    if (antes && ahora && antes !== ahora)
      avisos.push("Últimamente te inclinas por " + ahora + " (antes era " + antes + ").");
  }
  return avisos;
}

/* ---------- Etapa 3c: buzón de cartas a tu yo futuro ---------- */
function fechaMasMeses(iso, meses) {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + meses);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function cartasListas() {
  const hoy = hoyLocalISO();
  return peliculas.filter(p => {
    const c = (marcas[p.titulo] || {}).carta;
    return c && !c.leida && fechaMasMeses(c.fecha, c.meses) <= hoy;
  });
}

function abrirBuzon() {
  const listas = cartasListas();
  const vistas = peliculas.filter(p => (marcas[p.titulo] || {}).vista && !(marcas[p.titulo] || {}).carta);
  const cartaHtml = p => {
    const c = marcas[p.titulo].carta;
    return '<div class="carta-caja"><b>' + esc(p.titulo) + '</b> <span class="meta">escrita el ' + esc(c.fecha) + '</span>' +
      '<p>' + esc(c.texto) + '</p></div>';
  };
  const cuerpo =
    (listas.length
      ? '<h4>Cartas que ya puedes leer (' + listas.length + ')</h4>' + listas.map(cartaHtml).join("") +
        '<button type="button" class="pildora" id="marcarLeidas">Marcar como leídas</button>'
      : '<p class="meta">No hay cartas listas para leer.</p>') +
    '<h4>Escribir una carta</h4>' +
    (vistas.length
      ? '<label class="campo">Película vista<select id="cartaPeli">' +
        vistas.map(p => '<option>' + esc(p.titulo) + '</option>').join("") + '</select></label>' +
        '<label class="campo">Tu mensaje<textarea id="cartaTexto" rows="4" placeholder="¿Qué sentiste hoy? ¿Qué quieres recordar?"></textarea></label>' +
        '<label class="campo">Leer en<select id="cartaMeses"><option value="6">6 meses</option><option value="12">1 año</option></select></label>' +
        '<button type="button" class="pildora destacado" id="guardarCarta">Guardar carta</button>'
      : '<p class="meta">Marca una película como vista para escribirle una carta.</p>');
  abrirVentanaSimple("buzon", "Buzón de cartas", cuerpo);

  const marcarLeidas = document.getElementById("marcarLeidas");
  if (marcarLeidas) marcarLeidas.addEventListener("click", () => {
    listas.forEach(p => { marcas[p.titulo] = Object.assign({}, marcas[p.titulo], { carta: Object.assign({}, marcas[p.titulo].carta, { leida: true }) }); });
    programarGuardado();
    document.querySelector("#buzon [data-cerrar]").click();
    pintar();
    avisar("Cartas marcadas como leídas.");
  });

  const guardar = document.getElementById("guardarCarta");
  if (guardar) guardar.addEventListener("click", () => {
    const titulo = document.getElementById("cartaPeli").value;
    const texto = document.getElementById("cartaTexto").value.trim();
    if (!texto) { avisar("Escribe algo en la carta antes de guardarla."); return; }
    marcas[titulo] = Object.assign({}, marcas[titulo], {
      carta: { texto, fecha: hoyLocalISO(), meses: Number(document.getElementById("cartaMeses").value), leida: false }
    });
    programarGuardado();
    document.querySelector("#buzon [data-cerrar]").click();
    avisar("Carta guardada. Se abrirá dentro de " + document.getElementById("cartaMeses").selectedOptions[0].text + ".");
  });
}

/* ---------- Extras de Actividad: rachas y cartas listas ---------- */
function renderExtrasActividad() {
  const sec = $("retoMes");
  const avisos = detectarRachas();
  let html = avisos.map(a => '<p class="meta racha">· ' + esc(a) + '</p>').join("");
  const listas = cartasListas().length;
  if (listas) html += '<button type="button" class="pildora destacado" id="abrirBuzonBtn">📬 Tienes ' + listas + ' carta(s) lista(s)</button>';
  html += renderAlertasEstreno();
  sec.insertAdjacentHTML("beforeend", html);
  const b = document.getElementById("abrirBuzonBtn");
  if (b) b.addEventListener("click", abrirBuzon);
}

/* ---------- Etapa 4a: modo viaje (lista de pendientes guardada para usar sin internet) ---------- */
function prepararViaje() {
  const lista = pendientesNoVistas().map(p => ({
    titulo: p.titulo, genero: p.genero || "", duracion: p.duracion || "",
    año: p["año"] || "", sinopsis: String(p.sinopsis || "").slice(0, 300)
  }));
  if (!lista.length) {
    avisar("No tienes pendientes para llevar. Marca algunas como «Pendiente» primero.");
    return;
  }
  try {
    localStorage.setItem("paquete_viaje", JSON.stringify({ fecha: hoyLocalISO(), lista: lista }));
  } catch (e) {
    avisar("No pude guardar la lista de viaje en este navegador.");
    return;
  }
  avisar("Lista de viaje guardada: " + lista.length + " películas. Funciona sin internet.");
  abrirModoViaje();
}

function abrirModoViaje() {
  let paq = null;
  try { paq = JSON.parse(localStorage.getItem("paquete_viaje") || "null"); } catch (e) {}
  if (!paq || !paq.lista) {
    abrirVentanaSimple("modoViaje", "Modo viaje",
      '<p class="meta">Aún no tienes una lista de viaje. Usa «Preparar viaje» cuando tengas internet.</p>');
    return;
  }
  const pendientes = paq.lista.filter(x => !((marcas[x.titulo] || {}).vista));
  const cuerpo = '<p class="meta">Preparada el ' + esc(paq.fecha) + ' · ' + pendientes.length + ' por ver</p>' +
    (pendientes.length
      ? pendientes.map(x => '<div class="viaje-fila"><div><b>' + esc(x.titulo) + '</b>' +
          '<div class="meta">' + esc([x.genero, x.duracion, x["año"]].filter(Boolean).join(" · ")) + '</div></div>' +
          '<button type="button" class="pildora" data-vista="' + esc(x.titulo) + '">✓ Vista</button></div>').join("")
      : '<p class="meta">Ya viste todo lo de tu lista. ¡Buen viaje!</p>');
  abrirVentanaSimple("modoViaje", "Modo viaje", cuerpo);
  document.querySelectorAll("#modoViaje [data-vista]").forEach(b => b.addEventListener("click", () => {
    cambiarEstado(b.dataset.vista, { vista: true });
    avisar("Marcada como vista. Se sincronizará cuando vuelva la conexión.");
    document.querySelector("#modoViaje [data-cerrar]").click();
    abrirModoViaje();
  }));
}

/* ---------- Etapa 4b: alertas de estreno (columna «estreno» con fecha AAAA-MM-DD en la hoja) ---------- */
function sumarDiasEt(iso, dias) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function alertasDeEstreno() {
  const hoy = hoyLocalISO();
  const limite = sumarDiasEt(hoy, 30);
  const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ""));
  const todas = pendientesNoVistas().filter(p => fechaOk(p.estreno));
  return {
    hoy: todas.filter(p => p.estreno === hoy || p.estreno < hoy).sort((a, b) => a.estreno.localeCompare(b.estreno)),
    proximas: todas.filter(p => p.estreno > hoy && p.estreno <= limite).sort((a, b) => a.estreno.localeCompare(b.estreno))
  };
}

function renderAlertasEstreno() {
  const { hoy, proximas } = alertasDeEstreno();
  if (!hoy.length && !proximas.length) return "";
  return '<div class="alertas-estreno">' +
    hoy.map(p => '<p>🎬 Ya se estrenó y tienes pendiente: <b>' + esc(p.titulo) + '</b> (' + esc(p.estreno) + ')</p>').join("") +
    proximas.map(p => '<p>📅 Se estrena el ' + esc(p.estreno) + ': <b>' + esc(p.titulo) + '</b></p>').join("") +
    '</div>';
}

/* ---------- Explorar: herramientas visibles desde la pantalla de inicio ---------- */
function gruposHerramientas() {
  return [...document.querySelectorAll("#panelAvanzados .grupo-menu, #panelMas .grupo-menu")]
    .filter(g => !/^(Ver|Ayuda|Datos|Cuenta|Ajustes)$/.test((g.querySelector(".grupo-titulo") || {}).textContent || ""))
    .filter(g => [...g.querySelectorAll("button[id]")].some(b => DESC_HERRAMIENTAS[b.id]));
}

function abrirGrupoHerramientas(indice) {
  const g = gruposHerramientas()[indice];
  if (!g) return;
  const titulo = g.querySelector(".grupo-titulo").textContent;
  const botones = [...g.querySelectorAll("button[id]")];
  abrirVentanaSimple("explorarGrupo", titulo,
    '<div class="explorar-lista">' + botones.map(b =>
      '<button type="button" class="explorar-item" data-id="' + b.id + '">' + b.innerHTML + '</button>').join("") +
    '</div>');
  document.querySelectorAll("#explorarGrupo .explorar-item").forEach(b => b.addEventListener("click", () => {
    document.querySelector("#explorarGrupo [data-cerrar]").click();
    const destino = document.getElementById(b.dataset.id);
    if (destino) destino.click();
  }));
}

function herramientaDelDia() {
  const lista = todasHerramientas();
  if (!lista.length) return "";
  const hoy = new Date();
  const diaDelAno = Math.floor((hoy - new Date(hoy.getFullYear(), 0, 0)) / 86400000);
  const x = lista[diaDelAno % lista.length];
  return '<div class="hoy-dia"><span>✨ Prueba hoy: <b>' + esc(x.texto) + '</b></span>' +
    '<button type="button" class="pildora" data-run="' + x.id + '">Probar</button></div>';
}

function bloqueExplorar() {
  const grupos = gruposHerramientas();
  if (!grupos.length) return "";
  return '<div class="explorar-titulo">Explorar</div><div class="explorar-grid">' +
    grupos.map((g, i) => {
      const n = g.querySelectorAll("button[id]").length;
      return '<button type="button" class="explorar-tile" data-grupo="' + i + '">' +
        '<b>' + esc(g.querySelector(".grupo-titulo").textContent) + '</b>' +
        '<span class="meta">' + n + ' herramientas</span></button>';
    }).join("") + '</div>';
}

/* ---------- Explorar: buscador de herramientas (pestaña, Ctrl+K) ---------- */
function todasHerramientas() {
  const out = [];
  gruposHerramientas().forEach(g => {
    const grupo = g.querySelector(".grupo-titulo").textContent;
    g.querySelectorAll("button[id]").forEach(b => out.push({ id: b.id, html: b.innerHTML, texto: b.textContent.trim(), grupo: grupo }));
  });
  return out;
}

function ejecutarHerramienta(id) {
  const destino = document.getElementById(id);
  if (destino) destino.click();
}

const DESC_HERRAMIENTAS = {
  nocheTema: "Elige una pendiente del género que toca hoy.",
  maraton: "Arma hasta 3 pendientes que quepan en el tiempo que tienes.",
  sorpresa: "Una película según duración, género o actor.",
  animoBtn: "Ordena el catálogo según cómo te sientes hoy.",
  mapaViaje: "Qué países has visitado con tus películas.",
  parejaBtn: "Activa elegir solo entre las películas para ver con alguien.",
  votarPareja: "Cada quien vota sí o no, y ves en qué coinciden.",
  capsula: "Tu resumen del año: vistas, favoritas y géneros.",
  clasificar: "Clasifica rápido las películas que aún no tienes marcadas.",
  estadisticas: "Gráficas de tus calificaciones y tus hábitos.",
  diario: "Tus películas vistas con fecha y notas.",
  buzon: "Escribe cartas a tu yo futuro sobre una película.",
  prepararViaje: "Guarda tus pendientes para verlas sin internet.",
  verViaje: "Abre la lista guardada para llevarla.",
  guardarPaletas: "Calcula y guarda los colores de los pósters.",
  deshacer: "Regresa el último cambio en tus marcas.",
  atajos: "Muestra los atajos de teclado.",
  vista: "Cambia entre vista normal y compacta de la lista.",
  agrupar: "Agrupa las películas por tema.",
  limpiar: "Quita todos los filtros.",
  presetGuardar: "Guarda los filtros actuales para reusarlos.",
  presetBorrar: "Borra el filtro guardado seleccionado.",
  exportar: "Descarga tu catálogo en un archivo CSV.",
  respaldarMarcas: "Descarga una copia de tus marcas.",
  restaurarMarcas: "Carga una copia de tus marcas.",
  borrarMarcas: "Borra todas tus marcas (no se puede deshacer).",
  salirDispositivo: "Cierra tu sesión en este dispositivo.",
  toggleSalud: "Muestra el estado de los datos de la hoja.",
  aleatorio: "Sugiere una película al azar.",
  queVerNoche: "Te dice qué ver esta noche según el tiempo que tengas.",
  verGuia: "Abre esta guía."
};

function abrirExplorar() {
  const grupos = gruposHerramientas().map(g => ({
    titulo: g.querySelector(".grupo-titulo").textContent,
    items: [...g.querySelectorAll("button[id]")].map(b => ({
      id: b.id, html: b.innerHTML, texto: b.textContent.trim(), desc: DESC_HERRAMIENTAS[b.id] || ""
    }))
  }));
  const filtrar = q => {
    const t = q.trim().toLowerCase();
    return grupos.map(g => ({
      titulo: g.titulo,
      items: g.items.filter(x => !t || (x.texto + " " + x.desc + " " + g.titulo).toLowerCase().includes(t))
    })).filter(g => g.items.length);
  };
  const pintar = q => {
    const gs = filtrar(q);
    const plano = gs.flatMap(g => g.items);
    caja.innerHTML = gs.map(g =>
      '<h4 class="explorar-grupo">' + esc(g.titulo) + '</h4>' +
      g.items.map(x => '<button type="button" class="explorar-item" data-id="' + x.id + '">' +
        '<b>' + x.html + '</b><span class="meta">' + esc(x.desc) + '</span></button>').join("")
    ).join("") || '<p class="meta">Ninguna herramienta coincide. Prueba con otra palabra.</p>';
    return plano;
  };
  abrirVentanaSimple("explorarTodo", "Herramientas",
    '<input id="explorarBusca" class="campo-busca" type="search" placeholder="Busca por nombre o para qué sirve…" autocomplete="off">' +
    '<div id="explorarResultados" class="explorar-lista"></div>');
  const caja = document.getElementById("explorarResultados");
  const busca = document.getElementById("explorarBusca");
  pintar("");
  busca.addEventListener("input", () => pintar(busca.value));
  busca.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const primera = pintar(busca.value)[0];
    if (primera) { document.querySelector("#explorarTodo [data-cerrar]").click(); ejecutarHerramienta(primera.id); }
  });
  caja.addEventListener("click", e => {
    const b = e.target.closest(".explorar-item");
    if (!b) return;
    document.querySelector("#explorarTodo [data-cerrar]").click();
    ejecutarHerramienta(b.dataset.id);
  });
  busca.focus();
}

/* ---------- Pantalla de inicio: «Hoy» ---------- */
function saludoHoy() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function retoActual() {
  const hoy = new Date();
  const mes = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0");
  const vistasMes = peliculas.filter(p => ((marcas[p.titulo] || {}).historial || [])
    .some(h => h.a === "vista" && String(h.f).startsWith(mes)));
  const reto = RETOS_MES[hoy.getMonth() % RETOS_MES.length];
  return { texto: reto.texto, hecho: Math.min(reto.cuenta(vistasMes), reto.meta), meta: reto.meta };
}

function renderHoy() {
  const sec = $("hoy");
  if (!sec) return;
  if (hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  const pend = pendientesNoVistas().length;
  const conAlguien = peliculas.filter(p => (marcas[p.titulo] || {}).conAlguien && !(marcas[p.titulo] || {}).vista).length;
  const r = retoActual();
  const sAhora = (typeof elegirParaAhora === "function") ? elegirParaAhora(null) : null;
  const resumenPend = pend ? pend + " pendiente" + (pend === 1 ? "" : "s") : "Aún no tienes pendientes";
  const extra = conAlguien ? " · " + conAlguien + " para ver con alguien" : "";
  sec.style.display = "block";
  sec.innerHTML =
    '<p class="hoy-saludo">' + saludoHoy() + '</p>' +
    '<h2 class="hoy-titulo">¿Qué vemos hoy?</h2>' +
    '<p class="hoy-sub">' + esc(resumenPend + extra) + '</p>' +
    (sAhora && sAhora.texto ? '<p class="hoy-ahora">Para esta hora: ' + esc(sAhora.texto) + '</p>' : '') +
    '<div class="hoy-acciones">' +
      '<button type="button" class="pildora destacado" id="hoyNoche">🎡 Noche temática</button>' +
      '<button type="button" class="pildora" id="hoyAzar">🎲 Al azar</button>' +
      '<button type="button" class="pildora" id="hoyAnimo">🎭 ¿Cómo te sientes?</button>' +
    '</div>' +
    '<div class="hoy-reto"><span>🏆 ' + esc(r.texto) + '</span>' +
      '<div class="reto-barra"><span style="width:' + Math.round(r.hecho / r.meta * 100) + '%"></span></div></div>' +
    herramientaDelDia() + bloqueExplorar() + renderAlertasEstreno();
  $("hoyNoche").addEventListener("click", nocheTematica);
  $("hoyAzar").addEventListener("click", sugerirAleatoria);
  $("hoyAnimo").addEventListener("click", abrirAnimo);
  sec.querySelectorAll("[data-run]").forEach(b => b.addEventListener("click", () => ejecutarHerramienta(b.dataset.run)));
  sec.querySelectorAll("[data-grupo]").forEach(b => b.addEventListener("click", () => abrirGrupoHerramientas(Number(b.dataset.grupo))));
}

/* ---------- Deshacer general (Ctrl/Cmd+Z o botón) ---------- */
let pilaDeshacer = [];
let ultimaCopiaMarcas = null;
let deshaciendo = false;

function registrarDeshacer() {
  if (deshaciendo) return;
  const actual = JSON.stringify(marcas);
  if (ultimaCopiaMarcas !== null && ultimaCopiaMarcas !== actual && ultimaCopiaMarcas !== "{}") {
    pilaDeshacer.push(ultimaCopiaMarcas);
    if (pilaDeshacer.length > 30) pilaDeshacer.shift();
  }
  ultimaCopiaMarcas = actual;
}

function deshacerUltimo() {
  if (!pilaDeshacer.length) {
    avisar("No hay cambios recientes que deshacer.");
    return;
  }
  const previa = pilaDeshacer.pop();
  deshaciendo = true;
  try {
    marcas = JSON.parse(previa);
    programarGuardado();
  } finally {
    deshaciendo = false;
  }
  ultimaCopiaMarcas = previa;
  pintar();
  avisar("Cambio deshecho. Puedes deshacer " + pilaDeshacer.length + " más.");
}

/* ---------- Atajos de teclado (computadora) ---------- */
function enCampoDeTexto(t) {
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

function ventanaAbierta() {
  const m = document.getElementById("modal");
  const c = document.getElementById("chatPanel");
  const a = document.getElementById("ayudaAtajos");
  return (m && m.classList.contains("abierto")) || (c && c.classList.contains("abierto")) || !!a;
}

function toggleAyudaAtajos() {
  const previa = document.getElementById("ayudaAtajos");
  if (previa) { previa.remove(); return; }
  const div = document.createElement("div");
  div.id = "ayudaAtajos";
  div.className = "ayuda-atajos";
  div.innerHTML = '<div class="ayuda-caja" role="dialog" aria-label="Atajos de teclado">' +
    '<h3>Atajos de teclado</h3>' +
    '<dl><dt>/</dt><dd>Ir a la búsqueda</dd>' +
    '<dt>A</dt><dd>Sugerir una película al azar</dd>' +
    '<dt>N</dt><dd>Qué ver esta noche</dd>' +
    '<dt>Ctrl/Cmd + Z</dt><dd>Deshacer el último cambio</dd>' +
    '<dt>Esc</dt><dd>Cerrar la ventana abierta</dd>' +
    '<dt>?</dt><dd>Mostrar u ocultar esta ayuda</dd></dl>' +
    '<button type="button" class="pildora" id="cerrarAyudaAtajos">Entendido</button></div>';
  div.addEventListener("click", e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  document.getElementById("cerrarAyudaAtajos").addEventListener("click", () => div.remove());
}

document.addEventListener("keydown", e => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
    e.preventDefault();
    abrirExplorar();
    return;
  }
  if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z" && !enCampoDeTexto(e.target)) {
    e.preventDefault();
    deshacerUltimo();
    return;
  }
  if (e.key === "Escape" && document.getElementById("ayudaAtajos")) {
    document.getElementById("ayudaAtajos").remove();
    return;
  }
  if (ctrl || e.altKey || enCampoDeTexto(e.target) || ventanaAbierta()) return;
  if (e.key === "/") {
    e.preventDefault();
    const b = document.getElementById("buscar");
    if (b) b.focus();
  } else if (e.key === "a" || e.key === "A") {
    document.getElementById("aleatorio").click();
  } else if (e.key === "n" || e.key === "N") {
    document.getElementById("queVerNoche").click();
  } else if (e.key === "?") {
    toggleAyudaAtajos();
  }
});

function programarGuardado() {
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
  if (peliculas.length) syncTodo();
}
document.addEventListener("visibilitychange", syncAlVolver);
window.addEventListener("focus", syncAlVolver);
window.addEventListener("online", () => { setEstado("Conexión recuperada. Sincronizando…"); syncTodo(); });
window.addEventListener("offline", () => setEstado(mensajeSinConexion()));
// Sincronización periódica: solo con la app visible y con señal (no gasta datos en segundo plano)
setInterval(() => {
  if (peliculas.length && !document.hidden && navigator.onLine !== false) syncTodo();
}, 300000);

// Cuando la hoja ya cargó: reconcilia las marcas por id y sincroniza una vez
const esperaSync = setInterval(() => {
  if (!peliculas.length || !accessToken) return;
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

