/* JavaScript de Mi catálogo de películas. Bloques en el orden original. */

/* --- bloque 1 --- */
const CLIENT_ID = "45846987194-cm8mnhijljms8k8u8j44n8aeq674vuis.apps.googleusercontent.com";
// Dominio de la cuenta institucional (por ejemplo "universidad.edu.mx"). Solo estas cuentas pueden entrar. Déjalo vacío para no restringir.
const DOMINIO_INSTITUCIONAL = "ucaribe.edu.mx";
// Modo prueba: si existe "hoja_id_prueba" en el navegador, la app usa esa hoja en lugar de la real.
const HOJA_ID = localStorage.getItem("hoja_id_prueba") || "1W5oSA5yy4TpbVYxjya6S9T6NkeE6irwSHABXFAijO2k";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.appdata openid email";
const NOMBRE_PALETA = "paleta_poster";

let peliculas = [];
let visibles = [];
let encabezados = [];
let COL_PALETA = -1;
let tokenClient;
let accessToken = null;
let marcas = {};
let idMarcas = null;
let guardadoTimer = null;
let vistaLista = false;
let agrupado = false;
let desdeAleatorio = false;
let cenaElegida = null;
let mesCalendario = null;
let cenaMensaje = "";
let fotosActores = {};
let detalleActual = null;
let sugeridaActual = null;
let textoSugerida = "";
let ahorroActivo = null;
let chartsStats = [];
let pestana = "catalogo";
let zonaPeli = "inicio";     // dentro de Películas: inicio | lista | estrenos | sagas | actores | duelo
let zonaVistas = "lista";    // dentro de Vistas: lista | resumen | actividad | mapa
let decidiendo = null;
let deshacerDescarte = null;
let avisoCerrado = false;
let firmaAvisoCerrado = "";
let seleccionDesc = new Set();
let porQueAbiertos = new Set();
const paletaCache = new Map();

let ubicacion = { lat: 21.16, lon: -86.85 };

const $ = id => document.getElementById(id);
const lista = $("lista"), buscar = $("buscar"), contador = $("contador"), chips = $("chips");
const sel = { tipo:$("tipo"), genero:$("genero"), tema:$("tema"), anio:$("anio"), pais:$("pais"), duracion:$("duracion"), estado:$("estado") };
const etiquetas = { tipo:"Tipo", genero:"Género", tema:"Tema", anio:"Año", pais:"País", duracion:"Duración", estado:"Estado" };
const AVANZADOS = ["genero", "estado", "tipo", "tema", "anio", "pais", "duracion"];

function esc(x) {
  return String(x == null ? "" : x).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function setEstado(msg) { $("estadoGuardado").textContent = msg; }
function generosDe(p) { return String(p.genero || "").split(",").map(s => s.trim()).filter(Boolean); }
function temasDe(p) { return String(p.temas || "").split(";").map(s => s.trim()).filter(Boolean); }
function directoresDe(p) { return String(p.director || "").split(",").map(s => s.trim()).filter(Boolean); }
function personasDe(p) {
  return [...String(p.director || "").split(","), ...String(p.reparto || "").split(",")]
    .map(s => s.trim()).filter(Boolean);
}

function minutos(p) {
  const s = String(p.duracion || "");
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*min/);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

function enRangoDuracion(p, valor) {
  if (!valor) return true;
  const m = minutos(p);
  if (valor === "corta") return m > 0 && m < 90;
  if (valor === "media") return m >= 90 && m <= 120;
  if (valor === "larga") return m > 120;
  return true;
}

const ordenes = {
  titulo: (a, b) => String(a.titulo).localeCompare(String(b.titulo), "es"),
  recientes: (a, b) => (Number(b["año"]) || 0) - (Number(a["año"]) || 0),
  antiguas: (a, b) => (Number(a["año"]) || 0) - (Number(b["año"]) || 0),
  duracion: (a, b) => minutos(b) - minutos(a)
};

/* ---------- Ahorro de datos ---------- */
function datosLimitados() {
  const modo = modoGuardado("ahorro_modo", "auto");
  if (modo === "ahorro") return true;
  if (modo === "normal") return false;
  const c = navigator.connection;
  if (c && (c.saveData || ["slow-2g", "2g", "3g"].includes(c.effectiveType))) return true;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-data: reduce)").matches) return true;
  return false;
}

function actualizarAhorro() {
  const nuevo = datosLimitados();
  if (nuevo === ahorroActivo) return;
  ahorroActivo = nuevo;
  document.body.classList.toggle("ahorro", nuevo);
  if (!peliculas.length) return;
  renderDestacados();
  pintarSugerencia();
  pintar();
  if ($("modal").classList.contains("abierto") && detalleActual) abrirDetalle(detalleActual);
}

function contenidoTrailer(codigo, titulo) {
  if (!datosLimitados()) return iframeTrailer(codigo, titulo);
  return '<div class="trailer-espera"><button class="pildora destacado" data-cargar-trailer="' + esc(codigo) + '">▶ Cargar tráiler</button></div>';
}

/* ---------- Enlaces directos ---------- */
function slugDe(p) {
  return String(p.titulo || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function urlDePelicula(p) {
  const u = new URL(location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set("id", slugDe(p));
  return u.toString();
}

function ponerIdEnUrl(valor) {
  try {
    const u = new URL(location.href);
    if (valor) u.searchParams.set("id", valor); else u.searchParams.delete("id");
    history.replaceState(null, "", u.toString());
  } catch (e) {}
}

function abrirDesdeUrl() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;
  const p = peliculas.find(x => slugDe(x) === id);
  if (p) {
    desdeAleatorio = false;
    abrirDetalle(p);
  } else {
    setEstado("No encontré la película del enlace.");
  }
}

function copiarEnlace() {
  if (!detalleActual) return;
  navigator.clipboard.writeText(urlDePelicula(detalleActual))
    .then(() => setEstado("Enlace copiado."))
    .catch(() => setEstado("Este navegador no permite copiar el enlace."));
}

/* ---------- Sugerencias por hora y día ---------- */
function norm(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function tieneGenero(p, terminos) {
  return generosDe(p).map(norm).some(g => terminos.some(t => g.includes(t)));
}

const REGLAS = [
  {
    texto: "Domingo por la mañana: una comedia o un clásico.",
    aplica: (dia, hora) => dia === 0 && hora >= 7 && hora < 13,
    filtro: p => tieneGenero(p, ["comedia"]) || (Number(p["año"]) > 0 && Number(p["año"]) < 2000)
  },
  {
    texto: "De noche: thriller, misterio o suspenso.",
    aplica: (dia, hora) => hora >= 22 || hora < 5,
    filtro: p => tieneGenero(p, ["thriller", "suspenso", "misterio", "crimen", "terror"])
  },
  {
    texto: "Por la mañana: documental, biografía o historia.",
    aplica: (dia, hora) => hora >= 5 && hora < 12,
    filtro: p => tieneGenero(p, ["documental", "biograf", "historia"])
  },
  {
    texto: "Por la tarde: comedia o aventura.",
    aplica: () => true,
    filtro: p => tieneGenero(p, ["comedia", "aventura"])
  }
];

function esFinDeSemanaTarde() {
  const ahora = new Date();
  const dia = ahora.getDay();
  const hora = ahora.getHours();
  return (dia === 0 || dia === 6) && hora >= 12 && hora < 22;
}

/* ===== Selector único de películas: reglas comunes para «Para esta hora», «Cena» y «Noche» ===== */
// Grupo base: «pendientes» (lo que quieres ver) o «no-vistas» (si no hay pendientes que cumplan)
function baseElegir({ estado = "pendientes", excluir = null } = {}) {
  let base = estado === "pendientes"
    ? peliculas.filter(p => estadoDe(p).pendiente)
    : peliculas.filter(p => !estadoDe(p).vista && !(marcas[p.titulo] || {}).descartada);
  if (excluir && base.length > 1) base = base.filter(p => p.titulo !== excluir.titulo);
  return base;
}
// ¿Cabe en el tiempo disponible? Sin tiempo indicado, cualquiera cabe
function cabeEnTiempo(p, minutosMax) {
  return !minutosMax || (minutos(p) > 0 && minutos(p) <= minutosMax);
}
// Si hay películas para ver acompañado, se prefieren
function prioridadAcompanado(pool) {
  const c = pool.filter(p => estadoDe(p).conAlguien);
  return c.length ? c : pool;
}
// Elige una al azar, sin repetir la anterior si hay otras opciones
function elegirUnaDe(pool, anterior = null) {
  let lista = pool;
  if (anterior && lista.length > 1) lista = lista.filter(p => p !== anterior && p.titulo !== anterior.titulo);
  return lista.length ? lista[Math.floor(Math.random() * lista.length)] : null;
}

// Armador de listas (Maratón y Planear noche): mezcla, suma lo que cabe y se detiene al llegar al máximo.
// «separacion» son los minutos de pausa entre películas (0 en el Maratón).
function armarLista({ pool, minutosMax, maximo, separacion = 0 }) {
  const orden = pool.slice().sort(() => Math.random() - 0.5);
  const elegidas = [];
  let total = 0;
  for (const x of orden) {
    if (elegidas.length >= maximo) break;
    const extra = elegidas.length ? separacion : 0;
    if (total + extra + x.m <= minutosMax) { elegidas.push(x); total += extra + x.m; }
  }
  return { elegidas, total };
}

function elegirParaAhora(excluir) {
  let pend = baseElegir({ excluir });
  if (!pend.length) return null;

  const ahora = new Date();
  const regla = REGLAS.find(r => r.aplica(ahora.getDay(), ahora.getHours()));
  let candidatas = pend.filter(regla.filtro);
  let texto = regla.texto;

  if (esFinDeSemanaTarde()) {
    const conAlguien = pend.filter(p => estadoDe(p).conAlguien);
    if (conAlguien.length) {
      candidatas = conAlguien;
      texto = "Fin de semana: una que puedes ver acompañado.";
    }
  }

  if (!candidatas.length) {
    candidatas = pend;
    texto = "No tienes pendientes de este tipo; te sugiero uno de tus pendientes.";
  }
  return { texto, p: candidatas[Math.floor(Math.random() * candidatas.length)] };
}

function pintarSugerencia() {
  if (!sugeridaActual) return;
  const p = sugeridaActual;
  $("ahoraTexto").textContent = textoSugerida;
  $("ahoraCaja").innerHTML =
    '<div class="ahora-card">' +
      (p.portada && !datosLimitados() ? '<img src="' + esc(p.portada) + '" alt="">' : '<div class="sinportada">🎬</div>') +
      '<div>' +
        '<h4>' + esc(p.titulo) + '</h4>' +
        '<div class="meta">' + esc(p["año"]) + ' · ' + esc(p.duracion) + '</div>' +
        '<div class="acciones">' +
          '<button class="pildora destacado" id="ahoraVer">Ver ficha</button>' +
          '<button class="pildora" id="ahoraOtra">Otra</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function nuevaSugerencia(excluir) {
  const s = elegirParaAhora(excluir);
  if (!s) {
    $("ahora").style.display = "none";
    sugeridaActual = null;
    return;
  }
  sugeridaActual = s.p;
  textoSugerida = s.texto;
  pintarSugerencia();
}

function actualizarAhora() {
  const sec = $("ahora");
  const hayPendientes = peliculas.some(p => estadoDe(p).pendiente);
  if (hayFiltros() || !hayPendientes || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  sec.style.display = "block";
  if (!sugeridaActual || !estadoDe(sugeridaActual).pendiente) nuevaSugerencia(null);
}

/* ---------- Resumen semanal (lunes; prueba con ?resumen=1) ---------- */
function hoyLocalISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function diaISODesde(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function leerJSON(clave, defecto) {
  try {
    const v = localStorage.getItem(clave);
    return v ? JSON.parse(v) : defecto;
  } catch (e) { return defecto; }
}

function guardarJSON(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {}
}

function resumenDePrueba() {
  return new URLSearchParams(location.search).get("resumen") === "1";
}

function sugerenciaSemanal() {
  const pend = peliculas.filter(p => estadoDe(p).pendiente);
  if (!pend.length) return null;

  const hoy = hoyLocalISO();
  const guardada = leerJSON("resumen_sugerida", null);
  if (guardada && guardada.fecha === hoy) {
    const previa = pend.find(x => x.titulo === guardada.titulo);
    if (previa) return previa;
  }

  const historial = leerJSON("resumen_historial", []);
  let candidatas = pend.filter(p => !historial.includes(p.titulo));
  if (!candidatas.length) candidatas = pend;
  const elegida = candidatas[Math.floor(Math.random() * candidatas.length)];

  guardarJSON("resumen_sugerida", { fecha: hoy, titulo: elegida.titulo });
  guardarJSON("resumen_historial", [elegida.titulo, ...historial].slice(0, 8));
  return elegida;
}

function cerrarResumenSemana() {
  try { localStorage.setItem("resumen_cerrado", hoyLocalISO()); } catch (e) {}
  actualizarResumenSemana();
}

function actualizarResumenSemana() {
  const sec = $("resumenSemana");
  const hoy = hoyLocalISO();
  const esLunes = new Date().getDay() === 1;
  const mostrarHoy = esLunes || resumenDePrueba();

  if (!peliculas.length || !mostrarHoy || modoGuardado("resumen_cerrado", "") === hoy || pestana !== "vistas") {
    sec.style.display = "none";
    return;
  }

  const desde = diaISODesde(6);
  const vistasSemana = peliculas.filter(p => {
    const m = marcas[p.titulo] || {};
    return m.vista && m.vistaDesde && m.vistaDesde >= desde && m.vistaDesde <= hoy;
  });
  const pendLargas = peliculas.filter(p => {
    const d = diasPendiente(p);
    return estadoDe(p).pendiente && d !== null && d > 30;
  }).length;
  const sug = sugerenciaSemanal();
  const rec0 = calcularRecomendaciones()[0];

  sec.innerHTML =
    '<div class="resumen-card">' +
      '<div class="resumen-top"><h3>Resumen semanal</h3>' +
        '<button id="cerrarResumen" title="Cerrar" aria-label="Cerrar resumen">×</button></div>' +
      '<div class="resumen-stats">' +
        '<div class="stat"><b>' + vistasSemana.length + '</b><span>vistas esta semana</span></div>' +
        '<div class="stat"><b>' + pendLargas + '</b><span>pendientes con más de 30 días</span></div>' +
      '</div>' +
      (vistasSemana.length === 0 ? '<p class="meta">Esta semana no marcaste películas como vistas.</p>' : '') +
      (rec0 ? '<button class="pildora" id="btnCompartirRec">Compartir recomendación</button>' : '') +
      (sug
        ? '<div class="resumen-sug">' +
            '<span class="meta">Hoy te sugiero</span>' +
            '<div class="resumen-titulo">' + esc(sug.titulo) + '</div>' +
            '<div class="meta">' + esc(sug["año"]) + ' · ' + esc(sug.duracion) + '</div>' +
            '<button class="pildora destacado" id="resumenVer" data-titulo="' + esc(sug.titulo) + '">Ver ficha</button>' +
          '</div>'
        : '<p class="meta">No tienes pendientes para sugerir hoy.</p>') +
    '</div>';
  sec.style.display = "block";
}

/* ---------- Modo cena: pendiente de menos de 2 h, con alguien si aplica ---------- */
function candidatasCena() {
  return peliculas.filter(p => {
    const s = estadoDe(p);
    const m = minutos(p);
    return s.pendiente && m > 0 && m < 120;
  });
}

function elegirCena(otra) {
  const c = candidatasCena();
  if (!c.length) {
    cenaElegida = null;
    cenaMensaje = "No tienes pendientes de menos de 2 horas. Revisa que la duración de tus pendientes esté escrita, por ejemplo 1 h 45 min.";
    renderCena();
    return;
  }
  cenaMensaje = "";
  cenaElegida = elegirUnaDe(prioridadAcompanado(c), otra ? cenaElegida : null);
  renderCena();
}

function renderCena() {
  const sec = $("cena");
  if (!peliculas.length || hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  let cuerpo;
  if (!cenaElegida || !candidatasCena().includes(cenaElegida)) {
    cuerpo = '<p class="meta">' + esc(cenaMensaje || "Pulsa el botón y te doy una película pendiente de menos de 2 horas.") + '</p>' +
      '<button class="pildora destacado" id="btnCena">Elegir para esta noche</button>';
  } else {
    const m = (marcas[cenaElegida.titulo] || {});
    const conAlguien = estadoDe(cenaElegida).conAlguien;
    cuerpo = (cenaElegida.portada && !datosLimitados()
        ? '<img class="cena-portada" src="' + esc(cenaElegida.portada) + '" alt="">'
        : '<div class="cena-sinportada">🎬</div>') +
      '<div class="resumen-titulo">' + esc(cenaElegida.titulo) + '</div>' +
      '<div class="meta">' + esc(cenaElegida["año"]) + ' · ' + esc(cenaElegida.duracion) +
      (conAlguien ? ' · para ver con ' + esc(m.conQuien || "alguien") : '') + '</div>' +
      '<div class="insignias" style="margin-top:8px">' +
        '<button class="pildora destacado" id="cenaVer" data-titulo="' + esc(cenaElegida.titulo) + '">Ver ficha</button>' +
        '<button class="pildora" id="cenaOtra">Otra</button>' +
      '</div>';
  }
  sec.innerHTML = '<div class="actividad-card"><h3>Para esta noche</h3>' + cuerpo + '</div>';
  sec.style.display = "block";
}

/* ---------- Calendario de planeación (pestaña Pendientes) ---------- */
const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function desplazarMes(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

/* ---------- Modo esta semana: planes con alguien en los próximos 7 días ---------- */
function planesProximos7Dias() {
  const hoy = hoyLocalISO();
  const limite = sumarDiasISO(hoy, 7);
  return peliculas
    .map(p => ({ p, m: marcas[p.titulo] || {} }))
    .filter(({ m }) => m.conAlguien && m.conFecha && m.conFecha >= hoy && m.conFecha <= limite)
    .sort((a, b) => a.m.conFecha.localeCompare(b.m.conFecha));
}

function etiquetaDia(iso) {
  const d = diasHasta(iso);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const [y, m, dd] = iso.split("-").map(Number);
  return dias[new Date(y, m - 1, dd).getDay()];
}

function renderEstaSemana() {
  const sec = $("estaSemana");
  if (!peliculas.length || hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  const planes = planesProximos7Dias();
  const cuerpo = planes.length
    ? planes.map(({ p, m }) =>
        '<div class="dest-fila">' +
          '<div><b>' + esc(p.titulo) + '</b>' +
          '<div class="meta">' + esc(etiquetaDia(m.conFecha)) + ' · ' + esc(m.conFecha) +
          (m.conQuien ? ' · con ' + esc(m.conQuien) : '') + '</div></div>' +
        '</div>'
      ).join("")
    : '<p class="meta">No hay planes con alguien para los próximos 7 días.</p>';
  sec.innerHTML = '<div class="actividad-card"><h3>Planes de la semana</h3>' + cuerpo + '</div>';
  sec.style.display = "block";
}

/* ---------- Duelo de películas: elige una de dos pendientes ---------- */
let parDuelo = null;

function elegirPar() {
  const pend = peliculas.filter(p => {
    const s = estadoDe(p);
    return s.pendiente && !s.conAlguien;
  });
  if (pend.length < 2) return null;
  const a = pend[Math.floor(Math.random() * pend.length)];
  let b = a;
  while (b === a) b = pend[Math.floor(Math.random() * pend.length)];
  return [a, b];
}

function renderDuelo() {
  const sec = $("duelo");
  if (!peliculas.length || hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  if (!parDuelo || !parDuelo.every(p => estadoDe(p).pendiente && !estadoDe(p).conAlguien)) {
    parDuelo = elegirPar();
  }
  if (!parDuelo) {
    sec.style.display = "none";
    return;
  }
  const [a, b] = parDuelo;
  const tarjeta = p =>
    '<button class="pildora destacado" data-duelo-elige="' + esc(p.titulo) + '" style="flex:1;padding:14px;">' +
      esc(p.titulo) + '<br><span style="font-size:12px;opacity:.8">' + esc(p["año"]) + ' · ' + esc(p.duracion) + '</span>' +
    '</button>';
  sec.innerHTML =
    '<div class="actividad-card"><h3>Duelo</h3>' +
      '<p class="meta">Elige cuál ver primero. La otra se queda en pendientes.</p>' +
      '<div style="display:flex;gap:10px;align-items:stretch;flex-wrap:wrap">' +
        tarjeta(a) + '<span style="align-self:center;color:var(--gris)">vs</span>' + tarjeta(b) +
      '</div>' +
      '<button class="pildora" data-duelo-otro="1" style="margin-top:10px">Otro duelo</button>' +
    '</div>';
  sec.style.display = "block";
}

function elegirEnDuelo(titulo) {
  const previo = marcas[titulo] || {};
  const nuevo = Object.assign({}, previo, { pendienteElegidaDesde: hoyLocalISO() });
  marcas[titulo] = nuevo;
  programarGuardado();
  parDuelo = null;
  setEstado("Elegida en el duelo: «" + titulo + "».");
  refrescarTodo();
}

/* ---------- Mapa de gustos: géneros y directores de tus favoritas (4 o 5★) ---------- */
let chartsMapa = [];

function destruirMapa() {
  chartsMapa.forEach(c => c.destroy());
  chartsMapa = [];
}

function topConteo(items, n) {
  const conteo = {};
  items.forEach(x => { conteo[x] = (conteo[x] || 0) + 1; });
  return Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function renderMapaGustos() {
  const sec = $("mapaGustos");
  destruirMapa();
  if (!peliculas.length || pestana !== "vistas") {
    sec.style.display = "none";
    return;
  }
  const favoritas = peliculas.filter(p => estadoDe(p).estrellas >= 4);
  if (favoritas.length < 2 || typeof Chart === "undefined") {
    sec.style.display = "none";
    return;
  }
  const generos = topConteo(favoritas.flatMap(generosDe), 6);
  const directores = topConteo(favoritas.flatMap(directoresDe), 5);
  const c = coloresGrafica();

  sec.innerHTML =
    '<div class="actividad-card"><h3>Mapa de gustos</h3>' +
      '<p class="meta">Según tus ' + favoritas.length + ' películas con 4 o 5★.</p>' +
      '<div class="graficas-dos">' +
        '<div class="grafica-caja"><h3>Géneros</h3><canvas id="gMapaGen"></canvas></div>' +
        '<div class="grafica-caja"><h3>Directores</h3><canvas id="gMapaDir"></canvas></div>' +
      '</div>' +
    '</div>';
  sec.style.display = "block";

  chartsMapa.push(new Chart($("gMapaGen"), {
    type: "bar",
    data: { labels: generos.map(x => x[0]), datasets: [{ label: "Películas", data: generos.map(x => x[1]), backgroundColor: c.paleta[0], borderRadius: 6 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
  }));
  chartsMapa.push(new Chart($("gMapaDir"), {
    type: "bar",
    data: { labels: directores.map(x => x[0]), datasets: [{ label: "Películas", data: directores.map(x => x[1]), backgroundColor: c.paleta[1], borderRadius: 6 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
  }));
}

/* ---------- Pregunta del día: una pregunta sobre una vista; la respuesta va en marcas[titulo].preguntas ---------- */
const PREGUNTAS = [
  "¿Qué escena de «{título}» recuerdas mejor?",
  "¿Qué personaje te quedó más en la cabeza de «{título}»?",
  "¿Te gustaría volver a ver «{título}» en otro momento?",
  "¿Qué habrías cambiado de «{título}»?",
  "¿Con qué frase o diálogo te quedaste de «{título}»?"
];

function preguntaDelDia() {
  const hoy = hoyLocalISO();
  const pd = marcas.__preguntaDia || null;
  if (pd && pd.fecha === hoy) {
    const m = marcas[pd.titulo] || {};
    if (m.vista && !m.descartada) return pd;
  }
  const recientes = ((pd && pd.recientes) || []).filter(r => r.f >= diaISODesde(6));
  const vistas = peliculas.filter(p => estadoDe(p).vista && !(marcas[p.titulo] || {}).descartada);
  if (!vistas.length) return null;
  let cand = vistas.filter(p => !recientes.some(r => r.t === p.titulo));
  if (!cand.length) cand = vistas;
  const elegida = cand[Math.floor(Math.random() * cand.length)];
  const nuevo = {
    fecha: hoy,
    titulo: elegida.titulo,
    idx: Math.floor(Math.random() * PREGUNTAS.length),
    recientes: recientes.concat([{ t: elegida.titulo, f: hoy }]).slice(-10),
    omitida: pd && pd.fecha === hoy ? pd.omitida : undefined
  };
  marcas.__preguntaDia = nuevo;
  programarGuardado();
  return nuevo;
}

function textoPregunta(pd) {
  return PREGUNTAS[pd.idx].replace("{título}", pd.titulo);
}

function renderPregunta() {
  const sec = $("pregunta");
  if (!peliculas.length || hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  const hoy = hoyLocalISO();
  const pd = preguntaDelDia();
  if (!pd || pd.omitida === hoy) {
    sec.style.display = "none";
    return;
  }
  const p = peliculas.find(x => x.titulo === pd.titulo);
  if (!p) {
    sec.style.display = "none";
    return;
  }
  const entrada = ((marcas[p.titulo] || {}).preguntas || []).find(e => e.f === hoy);
  const pregunta = textoPregunta(pd);
  const cuerpo = entrada
    ? '<p class="resumen-titulo">' + esc(pregunta) + '</p>' +
      '<p class="meta">Respondida hoy</p>' +
      '<p class="nota-corta">' + esc(entrada.r) + '</p>'
    : '<p class="resumen-titulo">' + esc(pregunta) + '</p>' +
      '<textarea id="preguntaTexto" maxlength="500" placeholder="Escribe tu respuesta" style="width:100%;min-height:70px;padding:10px;font:inherit;border:1px solid var(--borde);border-radius:12px;background:var(--tarjeta);color:var(--texto);margin-top:8px"></textarea>' +
      '<div class="meta" id="preguntaContador">0/500</div>' +
      '<div class="insignias" style="margin-top:8px">' +
        '<button class="pildora destacado" id="preguntaGuardar" data-titulo="' + esc(p.titulo) + '">Guardar</button>' +
        '<button class="pildora" id="preguntaOmitir">Hoy no</button>' +
      '</div>';
  sec.innerHTML = '<div class="actividad-card"><h3>Pregunta del día</h3>' + cuerpo + '</div>';
  sec.style.display = "block";
}

function guardarRespuestaDia(titulo) {
  const texto = ($("preguntaTexto") ? $("preguntaTexto").value : "").trim().slice(0, 500);
  if (!texto) { setEstado("Escribe una respuesta antes de guardar."); return; }
  const pd = preguntaDelDia();
  if (!pd) return;
  const hoy = hoyLocalISO();
  const m = marcas[titulo] || {};
  const lista = (m.preguntas || []).filter(e => e.f !== hoy)
    .concat([{ f: hoy, p: textoPregunta(pd), r: texto }]);
  marcas[titulo] = Object.assign({}, m, { preguntas: lista });
  programarGuardado();
  setEstado("Respuesta guardada.");
  refrescarTodo();
}

function omitirPreguntaHoy() {
  const pd = preguntaDelDia();
  if (!pd) return;
  marcas.__preguntaDia = Object.assign({}, pd, { omitida: hoyLocalISO() });
  programarGuardado();
  refrescarTodo();
}

function preguntasFichaHtml(p) {
  const lista = (marcas[p.titulo] || {}).preguntas || [];
  if (!lista.length) return "";
  return '<details class="historial"><summary>Mis respuestas (' + lista.length + ')</summary><ul>' +
    lista.slice().sort((a, b) => b.f.localeCompare(a.f)).map(e =>
      '<li>' + esc(e.f.split("-").reverse().join("/")) + ' · ' + esc(e.p) + '<br>' + esc(e.r) + '</li>'
    ).join("") +
    '</ul></details>';
}

// Guía para cuando todavía no hay marcas: explica lo básico y se oculta solo.
function renderBienvenida() {
  const sec = $("bienvenida");
  const hayMarcas = Object.keys(marcas).some(k => !k.startsWith("__") && marcas[k] && Object.keys(marcas[k]).length);
  if (!peliculas.length || hayMarcas || hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  sec.innerHTML = '<div class="actividad-card"><h3>Empieza aquí</h3>' +
    '<p class="meta">Toca una película para abrir su ficha y marcarla como vista, pendiente o calificarla.</p>' +
    '<p class="meta">En el celular, desliza una tarjeta a la izquierda para marcarla como vista, o a la derecha para ponerla en pendientes. Puedes deshacerlo en seis segundos.</p>' +
    '<p class="meta">En computadora, pasa el cursor sobre una tarjeta para ver los botones rápidos.</p>' +
    '</div>';
  sec.style.display = "block";
}

// «Qué ver ahora»: una pestaña a la vez (hora o noche); si una no tiene contenido, se usa la otra
let verActual = "ahora";

function ajustarQueVer() {
  const w = $("queVer");
  const vAh = $("ahora").style.display !== "none";
  const vCe = $("cena").style.display !== "none";
  if (!vAh && !vCe) { w.style.display = "none"; return; }
  if (verActual === "ahora" && !vAh) verActual = "noche";
  if (verActual === "noche" && !vCe) verActual = "ahora";
  w.style.display = "block";
  w.classList.toggle("solo-ahora", verActual === "ahora");
  w.classList.toggle("solo-noche", verActual === "noche");
  w.querySelectorAll("[data-ver]").forEach(b => {
    const visible = b.dataset.ver === "ahora" ? vAh : vCe;
    b.style.display = visible ? "" : "none";
    b.classList.toggle("activa-ver", b.dataset.ver === verActual);
  });
}

function htmlCalendario() {
  const hoyISO = hoyLocalISO();
  if (!mesCalendario) mesCalendario = hoyISO.slice(0, 7);
  const [y, m] = mesCalendario.split("-").map(Number);

  const eventos = {};
  const agregar = (f, tipo, titulo) => {
    if (typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
      (eventos[f] = eventos[f] || []).push({ tipo, titulo });
    }
  };
  peliculas.forEach(p => {
    const o = marcas[p.titulo] || {};
    const s = estadoDe(p);
    if (s.pendiente) agregar(o.pendienteDesde, "📌", p.titulo);
    if (s.conAlguien) {
      agregar(o.conAlguienDesde, "👥", p.titulo);
      agregar(o.conFecha, "📅", p.titulo);
    }
  });

  const diasMes = new Date(y, m, 0).getDate();
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  let celdas = "";
  for (let i = 0; i < offset; i++) celdas += '<div class="cal-vacio"></div>';
  for (let d = 1; d <= diasMes; d++) {
    const key = y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const ev = eventos[key] || [];
    const chips = ev.slice(0, 2).map(e => '<div class="cal-chip">' + e.tipo + ' ' + esc(e.titulo) + '</div>').join("") +
      (ev.length > 2 ? '<div class="cal-chip">+' + (ev.length - 2) + '</div>' : "");
    celdas += '<div class="cal-dia' + (key === hoyISO ? ' hoy' : '') + '"><span class="cal-num">' + d + '</span>' + chips + '</div>';
  }

  return '<section class="cal-card">' +
    '<div class="cal-head"><button class="pildora" id="calPrev">‹</button><b>' + MESES_ES[m - 1] + ' ' + y + '</b><button class="pildora" id="calNext">›</button></div>' +
    '<div class="cal-semana"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>' +
    '<div class="cal-grid">' + celdas + '</div>' +
    '<p class="meta">📌 pendiente desde · 👥 con alguien desde · 📅 fecha planeada</p>' +
  '</section>';
}

/* ---------- Sagas (requiere columna "saga" en la hoja) ---------- */
function sagasAgrupadas() {
  const mapa = {};
  peliculas.forEach(p => {
    const nombre = String(p.saga || "").trim();
    if (!nombre || nombre === "-") return; // "-" = sin saga o serie
    (mapa[nombre] = mapa[nombre] || []).push(p);
  });
  return Object.entries(mapa)
    .filter(([, lista]) => lista.length >= 2)
    .map(([nombre, lista]) => {
      const vistas = lista.filter(p => estadoDe(p).vista).length;
      const pendientesPosibles = lista.filter(p => {
        const s = estadoDe(p);
        return !s.vista && !s.pendiente && !(marcas[p.titulo] || {}).descartada;
      }).length;
      return { nombre, total: lista.length, vistas, pendientesPosibles, lista };
    })
    .sort((a, b) => (b.vistas / b.total) - (a.vistas / a.total) || a.nombre.localeCompare(b.nombre, "es"));
}

// Número de orden dentro de la saga (columna opcional "saga_orden"); null si no está escrito
function numeroOrdenSaga(p) {
  const t = String(p.saga_orden ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return isFinite(n) ? n : null;
}

// Orden de visualización: saga_orden si existe; si no, año de estreno; luego título
function ordenEnSaga(a, b) {
  const oa = numeroOrdenSaga(a), ob = numeroOrdenSaga(b);
  if (oa !== null && ob !== null && oa !== ob) return oa - ob;
  if (oa !== null && ob === null) return -1;
  if (oa === null && ob !== null) return 1;
  const ya = Number(a["año"]) || 9999, yb = Number(b["año"]) || 9999;
  if (ya !== yb) return ya - yb;
  return String(a.titulo).localeCompare(String(b.titulo), "es");
}

function etiquetaEstadoSaga(p) {
  const s = estadoDe(p);
  if (s.vista) return "✓ Vista";
  if (s.pendiente) return "⏳ Pendiente";
  if ((marcas[p.titulo] || {}).descartada) return "Descartada";
  return "Sin ver";
}

function marcarSagaPendiente(nombre) {
  const grupo = sagasAgrupadas().find(g => g.nombre === nombre);
  if (!grupo) return;
  let n = 0;
  grupo.lista.forEach(p => {
    const s = estadoDe(p);
    if (!s.vista && !s.pendiente && !(marcas[p.titulo] || {}).descartada) {
      cambiarEstado(p.titulo, { pendiente: true, vista: false });
      n++;
    }
  });
  setEstado(n ? n + " de «" + nombre + "» marcadas como pendientes." : "No había películas de esa saga para marcar.");
  pintar();
}

function renderSagas() {
  const sec = $("sagas");
  if (!peliculas.length || hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  const grupos = sagasAgrupadas();
  if (!grupos.length) {
    sec.style.display = "none";
    return;
  }
  sec.innerHTML = '<div class="actividad-card sagas-wrap"><h3>Sagas</h3>' +
    grupos.map(g => {
      const pct = Math.round(g.vistas / g.total * 100);
      const peliculasEnOrden = [...g.lista].sort(ordenEnSaga);
      const siguiente = peliculasEnOrden.find(p => { const e = estadoDe(p); return !e.vista && !(marcas[p.titulo] || {}).descartada; });
      const tarjetas = peliculasEnOrden.map((p, i) => {
        const n = numeroOrdenSaga(p);
        const e = estadoDe(p);
        const visto = !!e.vista;
        const esSiguiente = siguiente === p;
        const portada = (p.portada && !datosLimitados())
          ? '<img src="' + esc(p.portada) + '" alt="" loading="lazy">'
          : '<div class="sg-sinportada">🎬</div>';
        const insignia = visto ? '<span class="sg-ins ok">✓</span>' : (e.pendiente ? '<span class="sg-ins pend">⏳</span>' : '');
        return '<div class="sg-card' + (visto ? ' visto' : '') + (esSiguiente ? ' siguiente' : '') + '" data-idx="' + peliculas.indexOf(p) + '">' +
          '<div class="sg-poster">' + portada +
            '<span class="sg-num">' + esc(n !== null ? n : i + 1) + '</span>' + insignia +
            (esSiguiente ? '<span class="sg-tag">Sigue aquí</span>' : '') +
          '</div>' +
          '<div class="sg-titulo">' + esc(p.titulo) + '</div>' +
          '<div class="sg-anio">' + esc(p["año"] || "") + '</div>' +
        '</div>';
      }).join("");
      return '<div class="saga-fila sg-bloque">' +
        '<div class="sg-cabecera"><div><b class="sg-nombre">' + esc(g.nombre) + '</b>' +
          '<div class="sg-sub">' + (siguiente ? 'Siguiente: ' + esc(siguiente.titulo) : '¡Saga completa!') + '</div></div>' +
          '<div class="sg-pct">' + pct + '%</div></div>' +
        '<div class="saga-barra sg-barra"><div style="width:' + pct + '%"></div></div>' +
        '<div class="sg-tira">' + tarjetas + '</div>' +
        '<div class="sg-pie"><span class="meta">' + g.vistas + ' de ' + g.total + ' vistas</span>' +
        (g.pendientesPosibles ? '<button class="pildora" data-saga-pend="' + esc(g.nombre) + '">Marcar las que faltan como pendientes</button>' : '') +
        '</div></div>';
    }).join("") +
    '</div>';
  sec.style.display = "block";
}

/* ---------- Actores (desde la columna reparto; sin llamadas nuevas) ---------- */
function nombresReparto(p) {
  const de_reparto = String(p.reparto || "").split(",").map(x => x.trim()).filter(Boolean);
  let de_info = [];
  try { de_info = Object.keys(JSON.parse(p.actores_info || "{}") || {}); } catch (e) { de_info = []; }
  return [...new Set([...de_reparto, ...de_info])];
}

// Caché: el agrupado depende solo del catálogo; se recalcula cuando cambia la lista de películas
let actoresCache = { ref: null, n: -1, datos: null };
function actoresAgrupados() {
  if (actoresCache.ref === peliculas && actoresCache.n === peliculas.length) return actoresCache.datos;
  const mapa = {};
  peliculas.forEach(p => {
    nombresReparto(p).forEach(n => { (mapa[n] = mapa[n] || []).push(p); });
  });
  const datos = Object.entries(mapa)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "es"));
  actoresCache = { ref: peliculas, n: peliculas.length, datos };
  return datos;
}

function infoActores() {
  const mapa = {};
  peliculas.forEach(p => {
    let m = {};
    try { m = JSON.parse(p.actores_info || "{}") || {}; } catch (e) { m = {}; }
    Object.keys(m).forEach(n => {
      if (!mapa[n] || (!mapa[n].bio && m[n].bio)) mapa[n] = m[n];
    });
  });
  return mapa;
}

function fotoDeActor(nombre, info) {
  if (datosLimitados()) return "";
  return (info && info.foto) || fotosActores[nombre] || "";
}

function inicialesDe(nombre) {
  return nombre.split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase();
}

function bioHtml(info) {
  const es = info.bio || "";
  const en = info.bio_original || "";
  if (!es && !en) return '<p class="meta">Todavía no tenemos la biografía de esta persona.</p>';
  const texto = es || en;
  const aviso = (!info.bio && en) ? ' <span class="meta">(traducción automática)</span>' : '';
  return '<p class="actor-bio" id="actorBio" data-es="' + esc(es || en) + '" data-en="' + esc(en) + '" data-vista="es">' +
    esc(texto.slice(0, 280)) + (texto.length > 280 ? '…' : '') + aviso + '</p>' +
    (texto.length > 280 ? '<button type="button" class="pildora" id="actorBioMas">Leer más</button> ' : '') +
    (en && es ? '<button type="button" class="pildora" id="actorBioIdioma">🌐 Ver original en inglés</button>' : '');
}

function fechaLarga(iso) {
  const d = new Date(String(iso) + "T12:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function renderActores() {
  const sec = $("actores");
  if (!peliculas.length || hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  const lista = actoresAgrupados();
  if (!lista.length) { sec.style.display = "none"; return; }
  const info = infoActores();
  sec.innerHTML = '<div class="actividad-card"><h3>Actores</h3><div class="actores-grid">' +
    lista.map(([n, films]) => {
      const foto = fotoDeActor(n, info[n]);
      return '<button class="actor-card" data-actor="' + esc(n) + '">' +
        (foto ? '<img class="actor-avatar" src="' + esc(foto) + '" alt="" loading="lazy">'
              : '<span class="actor-avatar sin-foto">' + esc(inicialesDe(n)) + '</span>') +
        '<b>' + esc(n) + '</b><span class="meta">' + films.length + (films.length === 1 ? ' título' : ' títulos') + '</span>' +
        '</button>';
    }).join("") + '</div></div>';
  sec.style.display = "block";
}

function abrirActor(nombre) {
  const films = peliculas.filter(p => nombresReparto(p).includes(nombre));
  const info = infoActores()[nombre] || {};
  const foto = fotoDeActor(nombre, info);
  const vistas = films.filter(p => estadoDe(p).vista).length;
  const pendientes = films.filter(p => estadoDe(p).pendiente).length;
  const calificadas = films.filter(p => estadoDe(p).estrellas);
  const promedio = calificadas.length
    ? (calificadas.reduce((a, p) => a + estadoDe(p).estrellas, 0) / calificadas.length).toFixed(1)
    : "—";
  const nacio = info.nacimiento ? "Nació el " + fechaLarga(info.nacimiento) + (info.lugar ? " en " + info.lugar : "") : (info.lugar ? "Nació en " + info.lugar : "");
  const bio = bioHtml(info);
  $("actorTitulo").textContent = nombre;
  $("actorBody").innerHTML =
    '<div class="actor-cabecera">' +
      (foto ? '<img class="actor-foto-grande" src="' + esc(foto) + '" alt="">'
            : '<span class="actor-foto-grande sin-foto">' + esc(inicialesDe(nombre)) + '</span>') +
      '<div><p class="meta">' + esc(nacio) + '</p>' + bio + '</div>' +
    '</div>' +
    '<div class="stats-resumen">' +
      '<div class="stat"><b>' + films.length + '</b><span>títulos</span></div>' +
      '<div class="stat"><b>' + vistas + '</b><span>vistas</span></div>' +
      '<div class="stat"><b>' + pendientes + '</b><span>pendientes</span></div>' +
      '<div class="stat"><b>' + promedio + '</b><span>promedio ★</span></div>' +
    '</div>' +
    '<h4 class="actor-films-titulo">Películas en tu catálogo</h4>' +
    '<div class="actor-films">' + films.map(p => {
      const s2 = estadoDe(p);
      const estado = (marcas[p.titulo] || {}).descartada ? "descartada" : s2.vista ? "vista" : s2.pendiente ? "pendiente" : "sin ver";
      const portada = p.portada && !datosLimitados()
        ? '<img class="actor-film-poster" src="' + esc(p.portada) + '" alt="" loading="lazy">'
        : '<span class="actor-film-poster sinportada-mini">🎬</span>';
      return '<button type="button" class="actor-film" data-actor-titulo="' + esc(p.titulo) + '">' + portada +
        '<b>' + esc(p.titulo) + '</b><span class="meta">' + esc(p["año"] || "") + ' · ' + estado +
        (s2.estrellas ? ' · ' + s2.estrellas + '★' : '') + '</span></button>';
    }).join("") + '</div>';
  $("actorBody").onclick = e => {
    const bioEl = $("actorBio");
    if (!bioEl) return;
    const mas = e.target.closest("#actorBioMas");
    if (mas) {
      bioEl.textContent = bioEl.dataset.vista === "en" ? bioEl.dataset.en : bioEl.dataset.es;
      mas.remove();
      return;
    }
    const idioma = e.target.closest("#actorBioIdioma");
    if (idioma) {
      const verEn = bioEl.dataset.vista !== "en";
      bioEl.dataset.vista = verEn ? "en" : "es";
      bioEl.textContent = verEn ? bioEl.dataset.en : bioEl.dataset.es;
      idioma.textContent = verEn ? "🌐 Ver en español" : "🌐 Ver original en inglés";
      const mas2 = document.getElementById("actorBioMas");
      if (mas2) mas2.remove();
    }
  };
  $("actorModal").classList.add("abierto");
}

function cerrarActor() {
  $("actorModal").classList.remove("abierto");
}

