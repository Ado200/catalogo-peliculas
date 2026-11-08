/* ===== Fase 0 · Módulo «curiosidades»: curiosidades, historias y fuentes verificadas ===== */
/* Migrado de app-04 sin cambiar el comportamiento. Mantiene los mismos nombres globales.
   Se registra en el núcleo (app-00-nucleo.js). Aún sin interruptor: lo usan app-03, app-06, app-09 y app-10. */
/* ---------- Curiosidades ----------
   Fuentes: (1) pestaña «curiosidades» de tu hoja (tmdb_id, titulo, tema, texto, fuente)
            (2) datos de tu propio catálogo (año, país, duración, director, reparto): siempre verificables.
   Sin internet se usa la copia guardada en el dispositivo. */
let curiosidadesTabla = [];
let curioOffset = 0;
const CURIOS_CACHE = "curiosidades_cache";

let indiceDirectoresCache = { ref: null, n: -1, mapa: null };
function indiceDirectores() {
  if (indiceDirectoresCache.ref === peliculas && indiceDirectoresCache.n === peliculas.length) return indiceDirectoresCache.mapa;
  const mapa = new Map();
  peliculas.forEach(x => directoresDe(x).forEach(d => mapa.set(d, (mapa.get(d) || 0) + 1)));
  indiceDirectoresCache = { ref: peliculas, n: peliculas.length, mapa };
  return mapa;
}

// Rankings, sagas, países, actores y calificaciones de TODA la colección; se calculan una sola vez
let indiceDatosCache = { ref: null, n: -1, d: null };
function indiceDatos() {
  if (indiceDatosCache.ref === peliculas && indiceDatosCache.n === peliculas.length) return indiceDatosCache.d;
  const anios = [], mins = [], sagas = new Map(), paises = new Map(), actores = new Map();
  let suma = 0, cuantas = 0;
  peliculas.forEach(x => {
    const serie = /serie/i.test(String(x.tipo || ""));
    const a = Number(x["año"]);
    if (a && !serie) anios.push(a);
    const m = parseInt(String(x.duracion || ""), 10);
    if (m && !serie) mins.push(m);
    const s = String(x.saga || "").trim();
    if (s && s !== "-") sagas.set(s, (sagas.get(s) || 0) + 1);
    String(x.pais || "").split(",").map(t => t.trim()).filter(Boolean).forEach(t => paises.set(t, (paises.get(t) || 0) + 1));
    nombresReparto(x).forEach(n => actores.set(n, (actores.get(n) || 0) + 1));
    const e = Number(estadoDe(x).estrellas);
    if (e) { suma += e; cuantas++; }
  });
  anios.sort((a, b) => a - b);
  mins.sort((a, b) => a - b);
  const d = { anios, mins, sagas, paises, actores, promEst: cuantas ? suma / cuantas : null };
  indiceDatosCache = { ref: peliculas, n: peliculas.length, d };
  return d;
}

// Cuántos valores de una lista ordenada son menores que v (búsqueda binaria)
function menoresQue(arr, v) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < v) lo = mid + 1; else hi = mid; }
  return lo;
}

function curiosidadesAuto(p) {
  const out = [];
  const D = indiceDatos();
  const fuente = "Tu catálogo";
  const esSerie = /serie/i.test(String(p.tipo || ""));

  // Récords: solo aparecen cuando la película está entre las extremas de tu colección
  const a = Number(p["año"]);
  if (!esSerie && a && D.anios.length > 10) {
    const masViejas = menoresQue(D.anios, a);
    const masNuevas = D.anios.length - menoresQue(D.anios, a + 1);
    if (masViejas < 10) out.push({ tema: "Récord", texto: "Solo hay " + masViejas + " películas más antiguas que ella en tu colección.", fuente });
    else if (masNuevas < 10) out.push({ tema: "Récord", texto: "Solo hay " + masNuevas + " películas más nuevas que ella en tu colección.", fuente });
  }
  const m = parseInt(String(p.duracion || ""), 10);
  if (!esSerie && m && D.mins.length > 10) {
    const masCortas = menoresQue(D.mins, m);
    const masLargas = D.mins.length - menoresQue(D.mins, m + 1);
    if (masLargas < 10) out.push({ tema: "Récord", texto: "Solo hay " + masLargas + " películas más largas que ella en tu colección.", fuente });
    else if (masCortas < 10) out.push({ tema: "Récord", texto: "Solo hay " + masCortas + " películas más cortas que ella en tu colección.", fuente });
  }

  const s = String(p.saga || "").trim();
  if (s && s !== "-" && (D.sagas.get(s) || 0) > 1) {
    out.push({ tema: "Saga", texto: "Forma parte de la saga «" + s + "»: tienes " + D.sagas.get(s) + " películas de ella en tu colección.", fuente });
  }

  const pais = String(p.pais || "").split(",")[0].trim();
  if (pais && (D.paises.get(pais) || 0) > 1) {
    out.push({ tema: "País", texto: "De " + pais + " tienes " + D.paises.get(pais) + " películas en tu colección, incluida esta.", fuente });
  }

  const dir = directoresDe(p);
  if (dir.length) {
    const total = indiceDirectores().get(dir[0]) || 0;
    if (total > 1) out.push({ tema: "Director", texto: "De " + dir[0] + " tienes " + total + " películas en tu colección, incluida esta.", fuente });
  }

  // El actor de esta película que más se repite en tu colección
  const actor = nombresReparto(p).map(n => [n, D.actores.get(n) || 0]).sort((x, y) => y[1] - x[1])[0];
  if (actor && actor[1] > 1) out.push({ tema: "Reparto", texto: actor[0] + " aparece en " + actor[1] + " películas de tu colección, incluida esta.", fuente });

  // Tu calificación frente a tu promedio
  const e = Number(estadoDe(p).estrellas);
  if (e && D.promEst) out.push({ tema: "Tu calificación", texto: "Le diste " + e + "★. Tu promedio general es " + D.promEst.toFixed(1) + "★.", fuente: "Tus calificaciones" });

  return out;
}

function curiosidadesDe(p) {
  const id = String(p.tmdb_id || "").trim();
  const curadas = curiosidadesTabla.filter(c => (c.tmdb && c.tmdb === id) || (c.titulo && c.titulo.toLowerCase() === String(p.titulo).toLowerCase()));
  return curadas.concat(curiosidadesAuto(p));
}

// Cache: con cientos de películas, recalcular todas las curiosidades en cada pintado sería lento
let todasCache = { peliculas: null, n: -1, tabla: null, lista: null };
function todasLasCuriosidades() {
  if (todasCache.lista && todasCache.peliculas === peliculas && todasCache.n === peliculas.length && todasCache.tabla === curiosidadesTabla) return todasCache.lista;
  const lista = calcularTodasLasCuriosidades();
  todasCache = { peliculas, n: peliculas.length, tabla: curiosidadesTabla, lista };
  return lista;
}

function calcularTodasLasCuriosidades() {
  const curadas = curiosidadesTabla.map(c => {
    const peli = peliculas.find(p => (c.tmdb && String(p.tmdb_id || "").trim() === c.tmdb) || (c.titulo && String(p.titulo).toLowerCase() === c.titulo.toLowerCase()));
    return Object.assign({}, c, { peli: peli || null });
  }).filter(c => c.peli);
  const autos = peliculas.flatMap(p => curiosidadesAuto(p).map(c => Object.assign({}, c, { peli: p })));
  return curadas.concat(autos);
}

function curiosidadDelDia() {
  const lista = todasLasCuriosidades();
  if (!lista.length) return null;
  const dia = Math.floor(Date.parse(hoyLocalISO() + "T00:00") / 86400000);
  return lista[(dia + curioOffset) % lista.length];
}

function curiosidadesFichaHtml(p) {
  const lista = curiosidadesDe(p).slice(0, 3);
  if (!lista.length) return "";
  return '<h4 class="ficha-h">Lo que quizá no sabías</h4><ul class="cur-lista">' +
    lista.map(c => '<li><span class="cur-tema">' + esc(c.tema || "Dato") + '</span> ' + esc(c.texto) +
      (c.fuente ? ' <small>' + esc(c.fuente) + '</small>' : '') + '</li>').join("") + '</ul>';
}

function abrirTodasCuriosidades(temaElegido) {
  const todas = todasLasCuriosidades();
  const temas = [...new Set(todas.map(c => c.tema || "Dato"))];
  const filtradas = temaElegido ? todas.filter(c => (c.tema || "Dato") === temaElegido) : todas;
  let panel = document.getElementById("curiosidadesTodas");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "curiosidadesTodas";
    document.body.appendChild(panel);
  }
  panel.innerHTML =
    '<div class="cur-panel-caja" role="dialog" aria-label="Todas las curiosidades">' +
      '<div class="cur-panel-cab"><strong>Curiosidades</strong><button type="button" data-cur-cerrar aria-label="Cerrar">✕</button></div>' +
      '<div class="cur-temas">' +
        '<button type="button" data-cur-tema="" class="' + (!temaElegido ? 'activo' : '') + '">Todas</button>' +
        temas.map(t => '<button type="button" data-cur-tema="' + esc(t) + '" class="' + (t === temaElegido ? 'activo' : '') + '">' + esc(t) + '</button>').join("") +
      '</div>' +
      '<ul class="cur-lista cur-lista-todas">' +
        (filtradas.length ? filtradas.slice(0, 200).map((c, i) =>
          '<li data-cur-peli="' + i + '"><span class="cur-tema">' + esc(c.tema || "Dato") + '</span> <strong>' + esc(c.peli.titulo) + '</strong><br>' +
          esc(c.texto) + (c.fuente ? ' <small>' + esc(c.fuente) + '</small>' : '') + '</li>').join("")
          : '<li>No hay curiosidades en este tema.</li>') +
      '</ul>' +
    '</div>';
  panel.onclick = e => {
    if (e.target === panel || e.target.closest("[data-cur-cerrar]")) { panel.remove(); return; }
    const t = e.target.closest("[data-cur-tema]");
    if (t) { abrirTodasCuriosidades(t.dataset.curTema || null); return; }
    const li = e.target.closest("[data-cur-peli]");
    if (li) { const c = filtradas[Number(li.dataset.curPeli)]; panel.remove(); if (c && c.peli) abrirDetalle(c.peli); }
  };
}

// La curiosidad ya no es una barra: se abre con el botón ✨ (ver abrirCuriosidad).
function renderCuriosidadDia() {}

// URL del servidor (la misma Aplicación web de Apps Script que usa el asistente)
const CURIO_URL = "PEGA_AQUI_LA_URL_DE_TU_APPS_SCRIPT";
const CURIO_HIST = "curio_historial";

function historialCurio() {
  try { return JSON.parse(localStorage.getItem(CURIO_HIST) || "[]"); } catch (e) { return []; }
}
function guardarHistorialCurio(lista) {
  try { localStorage.setItem(CURIO_HIST, JSON.stringify(lista.slice(-60))); } catch (e) {}
}

function elegirPeliculaCurio() {
  const hist = historialCurio();
  const pool = peliculas.filter(p => p.titulo && !/serie/i.test(String(p.tipo || "")));
  const nuevas = pool.filter(p => !hist.some(h => h.titulo === p.titulo));
  const base = nuevas.length ? nuevas : pool;
  return base[Math.floor(Math.random() * base.length)];
}

function abrirCuriosidadSheet() {
  let hoja = document.getElementById("curioSheet");
  if (!hoja) {
    hoja = document.createElement("div");
    hoja.id = "curioSheet";
    hoja.className = "cur-sheet";
    hoja.innerHTML = '<div class="cur-sheet-caja" role="dialog" aria-label="Curiosidad"><div class="cur-sheet-cuerpo" id="curioSheetCuerpo"></div></div>';
    hoja.addEventListener("click", e => { if (e.target === hoja) hoja.classList.remove("abierta"); });
    document.body.appendChild(hoja);
  }
  hoja.classList.add("abierta");
  generarCuriosidadNueva();
}

async function generarCuriosidadNueva() {
  const cuerpo = document.getElementById("curioSheetCuerpo");
  const peli = elegirPeliculaCurio();
  curioPeliActual = peli || null;
  if (!peli) { cuerpo.innerHTML = '<p class="cur-texto">Agrega películas para ver curiosidades.</p>'; return; }
  cuerpo.innerHTML = '<div class="cur-tema">' + esc(peli.titulo) + '</div><p class="cur-texto cur-cargando">Buscando una curiosidad verificada…</p>';

  const hist = historialCurio();
  try {
    const r = await fetch(CURIO_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        token: accessToken,
        accion: "curiosidad",
        pelicula: { titulo: peli.titulo, año: peli.año, director: peli.director, reparto: peli.reparto, genero: peli.genero, pais: peli.pais },
        evitar: hist.map(h => h.texto)
      })
    });
    const j = await r.json();
    if (j.error) {
      cuerpo.innerHTML = '<div class="cur-tema">' + esc(peli.titulo) + '</div><p class="cur-texto">' + esc(j.error) + '</p>' + pieCurio(peli, null);
      return;
    }
    hist.push({ titulo: peli.titulo, texto: j.texto });
    guardarHistorialCurio(hist);
    cuerpo.innerHTML =
      '<div class="cur-tema">' + esc(j.tema) + ' · ' + esc(peli.titulo) + '</div>' +
      '<p class="cur-texto">' + esc(j.texto) + '</p>' +
      '<small class="cur-fuente">Fuente: <a href="' + esc(j.url) + '" target="_blank" rel="noopener">' + esc(j.fuente || j.url) + '</a></small>' +
      pieCurio(peli, j.texto);
  } catch (e) {
    cuerpo.innerHTML = '<p class="cur-texto">No pude conectar. Revisa tu conexión e inténtalo de nuevo.</p>' + pieCurio(peli, null);
  }
}

function pieCurio(peli, texto) {
  return '<div class="cur-pie">' +
    '<button type="button" class="pildora" data-cur="historia">Historia</button>' +
    '<button type="button" class="pildora" data-cur="otra">Otra</button>' +
    '<button type="button" class="pildora" data-cur="ver">Ver ficha</button>' +
    (texto ? '<button type="button" class="pildora" data-cur="copiar">Copiar</button>' : '') +
    '<button type="button" class="pildora" data-cur="cerrar">Cerrar</button>' +
    '</div>';
}

let curioPeliActual = null;

const FORMATOS_HISTORIA = ["una escena breve", "una carta", "una página de diario", "un diálogo", "una noticia de periódico ficticia", "un monólogo"];

function contextoHistoria(peli) {
  const h = new Date().getHours();
  const momento = h < 6 ? "madrugada" : h < 12 ? "mañana" : h < 19 ? "tarde" : "noche";
  const estado = (typeof estadoDe === "function") ? estadoDe(peli) : {};
  return { momento, estrellas: estado.estrellas || 0, conAlguien: !!estado.conAlguien, vista: !!estado.vista };
}

async function generarHistoria(peli) {
  const cuerpo = document.getElementById("curioSheetCuerpo");
  const formato = FORMATOS_HISTORIA[Math.floor(Math.random() * FORMATOS_HISTORIA.length)];
  const usarPersonajesOriginales = Math.random() < 0.5;
  cuerpo.innerHTML = '<div class="cur-tema">' + esc(peli.titulo) + '</div><p class="cur-texto cur-cargando">Escribiendo una historia…</p>';
  try {
    const r = await fetch(CURIO_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        token: accessToken,
        accion: "historia",
        pelicula: { titulo: peli.titulo, año: peli.año, director: peli.director, reparto: peli.reparto, genero: peli.genero, tema: peli.temas },
        contexto: Object.assign(contextoHistoria(peli), { formato: formato, personajes: usarPersonajesOriginales ? "de la película" : "nuevos, inspirados en la trama" })
      })
    });
    const j = await r.json();
    if (j.error) {
      cuerpo.innerHTML = '<p class="cur-texto">' + esc(j.error) + '</p>' + pieCurio(peli, null);
      return;
    }
    cuerpo.innerHTML =
      '<div class="cur-tema">Ficción inspirada en ' + esc(peli.titulo) + '</div>' +
      '<h4 class="cur-historia-titulo">' + esc(j.titulo) + '</h4>' +
      '<p class="cur-texto cur-historia">' + esc(j.texto) + '</p>' +
      '<small class="cur-fuente">Historia inventada. No es un hecho real.</small>' +
      '<div class="cur-pie">' +
        '<button type="button" class="pildora" data-cur="historia-otra">Otra historia</button>' +
        '<button type="button" class="pildora" data-cur="ver">Ver ficha</button>' +
        '<button type="button" class="pildora" data-cur="cerrar">Cerrar</button>' +
      '</div>';
  } catch (e) {
    cuerpo.innerHTML = '<p class="cur-texto">No pude conectar. Revisa tu conexión e inténtalo de nuevo.</p>' + pieCurio(peli, null);
  }
}

document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#curioSheet [data-cur]");
  if (!b) return;
  const hoja = document.getElementById("curioSheet");
  const accion = b.dataset.cur;
  if (accion === "otra") generarCuriosidadNueva();
  else if (accion === "historia") { if (curioPeliActual) generarHistoria(curioPeliActual); }
  else if (accion === "historia-otra") { if (curioPeliActual) generarHistoria(curioPeliActual); }
  else if (accion === "cerrar") hoja.classList.remove("abierta");
  else if (accion === "ver") {
    hoja.classList.remove("abierta");
    const h = historialCurio();
    const ult = h[h.length - 1];
    const p = peliculas.find(x => x.titulo === (ult && ult.titulo));
    if (p) abrirDetalle(p);
  }
  else if (accion === "copiar") {
    const h = historialCurio();
    const ult = h[h.length - 1];
    if (ult) navigator.clipboard.writeText(ult.titulo + ": " + ult.texto)
      .then(() => { b.textContent = "¡Copiado!"; setTimeout(() => { b.textContent = "Copiar"; }, 1500); })
      .catch(() => {});
  }
});

async function cargarCuriosidades() {
  try {
    if (!accessToken || !HOJA_ID) throw new Error("sin sesión");
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${HOJA_ID}/values/curiosidades!A:E`, {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!r.ok) throw new Error("sin pestaña");
    const j = await r.json();
    curiosidadesTabla = (j.values || []).slice(1)
      .map(f => ({ tmdb: String(f[0] || "").trim(), titulo: String(f[1] || "").trim(), tema: String(f[2] || "").trim() || "Dato", texto: String(f[3] || "").trim(), fuente: String(f[4] || "").trim() }))
      .filter(c => c.texto && (c.tmdb || c.titulo));
    escribirLS(CURIOS_CACHE, JSON.stringify(curiosidadesTabla));
  } catch (e) {
    // Sin internet o sin la pestaña: usa la copia guardada (o solo los datos del catálogo)
    try { curiosidadesTabla = JSON.parse(leerLS(CURIOS_CACHE) || "[]") || []; } catch (x) { curiosidadesTabla = []; }
  }
  renderCuriosidadDia();
}

if (!document.getElementById("estiloCuriosidades")) {
  const st = document.createElement("style");
  st.id = "estiloCuriosidades";
  st.textContent = `
#curiosidades .curiosidad-dia{background:var(--tarjeta,rgba(255,255,255,.7));border-radius:18px;padding:18px 20px;box-shadow:0 6px 24px rgba(0,0,0,.08)}
#curiosidades .cur-tema{font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;opacity:.7;margin-bottom:6px}
#curiosidades .cur-texto{font-size:1.08rem;line-height:1.5;margin:0 0 8px}
#curiosidades .cur-fuente{opacity:.6}
#curiosidades .cur-pie{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.cur-lista{list-style:none;padding:0;margin:8px 0}
.cur-lista li{padding:8px 0;border-bottom:1px solid rgba(127,127,127,.2);line-height:1.45}
.cur-lista small{opacity:.6}
.cur-tema{font-weight:600;color:var(--azul,#0a84ff);margin-right:4px}
#curiosidadesTodas{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px}
.cur-panel-caja{background:var(--fondo,#fff);color:inherit;max-width:560px;width:100%;max-height:86vh;overflow:auto;border-radius:18px;padding:18px}
.cur-panel-cab{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.cur-panel-cab button{border:0;background:none;font-size:1.2rem;cursor:pointer;color:inherit}
.cur-temas{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.cur-temas button{border:1px solid rgba(127,127,127,.4);background:none;border-radius:999px;padding:4px 12px;cursor:pointer;color:inherit}
.cur-temas button.activo{background:var(--azul,#0a84ff);color:#fff;border-color:transparent}
.cur-lista-todas li{cursor:pointer}
`;
  document.head.appendChild(st);
}

if (window.Nucleo) {
  Nucleo.registrar("curiosidades", { version: "1.0", emite: [], escucha: [] });
}

/* Interruptor de Ajustes (modulo_curiosidades). Al apagarlo se ocultan la tarjeta de Inicio y los botones
   «Ver curiosidades»; las funciones siguen disponibles y el resto de la app no cambia. */
if (window.Nucleo) {
  const aplicarCuriosidades = () => document.body.classList.toggle("sin-curiosidades", !Nucleo.activo("curiosidades"));
  const interruptorCurio = document.getElementById("moduloCuriosidadesOn");
  if (interruptorCurio) {
    interruptorCurio.checked = Nucleo.activo("curiosidades");
    interruptorCurio.addEventListener("change", () => {
      Nucleo.activar("curiosidades", interruptorCurio.checked);
      aplicarCuriosidades();
    });
  }
  aplicarCuriosidades();
}
