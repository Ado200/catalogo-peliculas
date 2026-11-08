/* ===== Fase 0 · Módulo «curiosidad-boton»: curiosidad con botón (datos reales de tu colección, distinta cada vez). Migrado sin cambios de comportamiento. ===== */
/* ---------- Curiosidad con botón: datos reales de tu colección, distinta cada vez ---------- */
const CURIO_VISTAS_KEY = "curio_vistas";
let curioActual = null;

function claveCurio(c) {
  return (c.peli ? c.peli.titulo : "") + "|" + (c.tema || "") + "|" + String(c.texto || "").slice(0, 40);
}

function curioVistas() {
  try { return JSON.parse(leerLS(CURIO_VISTAS_KEY) || "[]"); } catch (e) { return []; }
}

function marcarCurioVista(c) {
  const v = curioVistas().filter(x => x !== claveCurio(c));
  v.push(claveCurio(c));
  escribirLS(CURIO_VISTAS_KEY, JSON.stringify(v.slice(-60)));
}

// Prefiere lo que todavía no has visto; cuando ya viste todo, vuelve a empezar
function elegirCuriosidad() {
  const lista = todasLasCuriosidades();
  if (!lista.length) return null;
  const vistas = new Set(curioVistas());
  const nuevas = lista.filter(c => !vistas.has(claveCurio(c)));
  const pool = nuevas.length ? nuevas : lista;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Historia breve armada solo con datos reales de la ficha (año, director, género, duración, sinopsis, reparto)
function historiaDe(p) {
  const partes = [];
  const anio = p["año"] ? String(p["año"]) : "";
  const dir = String(p.director || "").split(",")[0].trim();
  const gen = String(p.genero || "").split(",")[0].trim();
  const dur = String(p.duracion || "").trim();
  const frase = String(p.sinopsis || "").split(/(?<=[.!?])\s+/)[0] || "";
  const rep = String(p.reparto || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 2);
  const variantes = [
    () => [anio && dir ? "En " + anio + ", " + dir + " llevó a la pantalla «" + p.titulo + "»." : null, frase],
    () => ["«" + p.titulo + "»" + (anio ? " (" + anio + ")" : "") + (gen ? " es un " + gen.toLowerCase() : "") + (dur ? " de " + dur : "") + ".", frase, rep.length ? "En el reparto están " + rep.join(" y ") + "." : null],
    () => [dir ? "Detrás de la película está " + dir + "." : null, frase, rep.length ? "Protagonizan " + rep.join(" y ") + "." : null]
  ];
  const elegida = variantes[Math.floor(Math.random() * variantes.length)]();
  return elegida.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

const MESES_CURIO = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// Datos reales de la película: saga, país, estreno, duración, director, género, década
function hechosDePelicula(p) {
  const out = [];
  const saga = String(p.saga || "").trim();
  if (saga && saga !== "-") {
    const n = Nucleo.datos.peliculas().filter(x => String(x.saga || "").trim() === saga).length;
    out.push("Es parte de la saga «" + saga + "». En tu colección hay " + n + " película" + (n === 1 ? "" : "s") + " de ella.");
  }
  const pais = String(p.pais || "").trim();
  if (pais) out.push("Se produjo en " + pais + ".");
  const est = String(p.estreno || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(est)) {
    const [y, m, d] = est.split("-").map(Number);
    out.push("Llegó a los cines el " + d + " de " + MESES_CURIO[m - 1] + " de " + y + ".");
  }
  const min = minutos(p);
  if (min) out.push("Dura " + min + " minutos.");
  const dir = String(p.director || "").split(",")[0].trim();
  if (dir) {
    const n = Nucleo.datos.peliculas().filter(x => String(x.director || "").split(",")[0].trim() === dir).length;
    if (n > 1) out.push(dir + " tiene " + n + " películas en tu colección.");
  }
  const anio = Number(p["año"]);
  if (anio) out.push("Es de los años " + (Math.floor(anio / 10) * 10) + ".");
  return out;
}

// Datos reales de los actores de la película (fuente: TMDB, guardados en tu hoja)
function hechosDeActores(p) {
  const out = [];
  const info = infoActores();
  nombresReparto(p).forEach(nombre => {
    const i = info[nombre] || {};
    if (i.lugar) out.push(nombre + " nació en " + i.lugar + ".");
    else if (/^\d{4}/.test(i.nacimiento || "")) out.push(nombre + " nació en " + String(i.nacimiento).slice(0, 4) + ".");
    const bio = String(i.bio || "").split(/(?<=[.!?])\s+/)[0] || "";
    if (bio.length > 20 && bio.length < 260) out.push(nombre + ": " + bio);
    const n = Nucleo.datos.peliculas().filter(x => nombresReparto(x).indexOf(nombre) !== -1).length;
    if (n > 1) out.push(nombre + " aparece en " + n + " películas de tu colección.");
  });
  return out;
}

// Conexiones: "te suena porque…" (actor en otra película que ya viste) y "puente" (actor en otra pendiente)
function conexionesDe(p) {
  const out = [];
  const m = a => Nucleo.datos.marcas()[a.titulo] || {};
  const reparto = nombresReparto(p);
  reparto.forEach(nombre => {
    const otras = Nucleo.datos.peliculas().filter(x => x.titulo !== p.titulo && nombresReparto(x).indexOf(nombre) !== -1);
    const vistas = otras.filter(x => m(x).vista);
    if (vistas.length) out.push("Te suena porque " + nombre + " también salió en «" + vistas[0].titulo + "», que ya marcaste como vista.");
    const pend = otras.filter(x => !m(x).vista && !m(x).descartada);
    if (pend.length) out.push("Si te gusta " + nombre + ", «" + pend[0].titulo + "» también está en tu lista por ver.");
  });
  const saga = String(p.saga || "").trim();
  if (saga && saga !== "-") {
    const vistasSaga = Nucleo.datos.peliculas().filter(x => x.titulo !== p.titulo && String(x.saga || "").trim() === saga && m(x).vista).length;
    if (vistasSaga) out.push("De la saga «" + saga + "» ya viste " + vistasSaga + " más.");
  }
  return out;
}

// Spoilers: el texto que pueda revelar el final se oculta hasta que la persona lo pide
const PALABRAS_SPOILER = /(final|desenlace|muere|murió|muerte|termina|resulta que|el asesino|revela|traición|se descubre|al terminar)/i;
function esSpoiler(texto) { return PALABRAS_SPOILER.test(String(texto || "")); }
const CURIO_REVELADOS = new Set();

function unDato(lista) {
  return lista.length ? lista[Math.floor(Math.random() * lista.length)] : "";
}

// ---------- Pestaña de Curiosidades (fase 1) ----------
const CURIO_REAC_KEY = "curio_reacciones";
const CURIO_HIST_KEY = "curio_historial";
let curioFiltro = "todas";
let curioIdx = 0;
let curioLista = [];

function curioTipo(c) {
  const t = String(c.tema || "").toLowerCase();
  if (/internet/.test(t)) return "internet";
  if (/actor|reparto/.test(t)) return "actores";
  if (/saga/.test(t)) return "saga";
  return "pelicula";
}

// ---------- Fase 3: orden adaptativo ----------
// Relevancia (tus gustos) · novedad (no vista) · calidad (con fuente) · aprendizaje (tus reacciones)
// Diversidad: no pone dos del mismo tipo seguidas.
function perfilCurio() {
  const m = a => Nucleo.datos.marcas()[a.titulo] || {};
  const favoritas = Nucleo.datos.peliculas().filter(p => m(p).vista && (m(p).estrellas || 0) >= 4);
  const perfil = { genero: {}, director: {}, actor: {} };
  const sumar = (obj, clave) => { if (clave) obj[clave] = (obj[clave] || 0) + 1; };
  favoritas.forEach(p => {
    generosDe(p).forEach(g => sumar(perfil.genero, g.toLowerCase()));
    sumar(perfil.director, String(p.director || "").split(",")[0].trim().toLowerCase());
    nombresReparto(p).slice(0, 4).forEach(a => sumar(perfil.actor, a.toLowerCase()));
  });
  return perfil;
}

function pesosCurio() {
  // Cuánto te gusta cada tipo de curiosidad, según tus reacciones
  const pesos = { pelicula: 0, actores: 0, saga: 0 };
  const reac = curioReacciones();
  Object.keys(reac).forEach(k => {
    const tipo = curioTipo({ tema: String(k.split("|")[1] || "") });
    const v = reac[k];
    if (v === "gusta") pesos[tipo] += 1;
    else if (v === "sabia") pesos[tipo] -= 0.5;
    else if (v === "no") pesos[tipo] -= 1;
  });
  return pesos;
}

function puntuarCurio(c, perfil, pesos, vistas, reac) {
  const p = c.peli || {};
  const genero = generosDe(p).some(g => perfil.genero[g.toLowerCase()]) ? 1 : 0;
  const dir = perfil.director[String(p.director || "").split(",")[0].trim().toLowerCase()] ? 1 : 0;
  const act = nombresReparto(p).some(a => perfil.actor[a.toLowerCase()]) ? 1 : 0;
  const relevancia = Math.min(1, (genero * 0.4) + (dir * 0.3) + (act * 0.3));
  const novedad = vistas.has(claveCurio(c)) ? 0.3 : 1;
  const calidad = c.fuente ? 1 : 0.6;
  const aprendizaje = Math.max(-1, Math.min(1, (pesos[curioTipo(c)] || 0) / 5));
  let score = relevancia * 0.4 + novedad * 0.3 + calidad * 0.2 + aprendizaje * 0.1;
  if (reac[claveCurio(c)] === "no") score -= 1;
  return score;
}

function curioFiltrada() {
  const base = todasLasCuriosidades().concat(curiosidadesInternet);
  const filtrada = (curioFiltro === "todas" ? base : base.filter(c => curioTipo(c) === curioFiltro)).filter(curioEstaSana);
  const perfil = perfilCurio(), pesos = pesosCurio(), vistas = new Set(curioVistas()), reac = curioReacciones();
  const ordenada = filtrada
    .map(c => ({ c: c, s: puntuarCurio(c, perfil, pesos, vistas, reac) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.c);
  // Diversidad: si la siguiente es del mismo tipo que la anterior, busca otra de distinto tipo cerca
  const salida = [];
  const quedan = ordenada.slice();
  while (quedan.length) {
    const ultimo = salida.length ? curioTipo(salida[salida.length - 1]) : null;
    let i = quedan.findIndex((c, k) => k < 4 && curioTipo(c) !== ultimo);
    if (i < 0) i = 0;
    salida.push(quedan.splice(i, 1)[0]);
  }
  return salida;
}

function curioReacciones() {
  try { return JSON.parse(leerLS(CURIO_REAC_KEY) || "{}"); } catch (e) { return {}; }
}

function curioHistorial() {
  try { return JSON.parse(leerLS(CURIO_HIST_KEY) || "[]"); } catch (e) { return []; }
}

function curioRegistrar(c, reaccion) {
  const k = claveCurio(c);
  const r = curioReacciones();
  if (reaccion) r[k] = reaccion;
  escribirLS(CURIO_REAC_KEY, JSON.stringify(r));
  const hist = curioHistorial().filter(x => x.k !== k);
  hist.unshift({ k: k, titulo: c.peli ? c.peli.titulo : "", texto: c.texto, ts: Date.now() });
  escribirLS(CURIO_HIST_KEY, JSON.stringify(hist.slice(0, 100)));
}

function curioProgreso() {
  const vistas = new Set(curioVistas());
  return curioLista.filter(c => vistas.has(claveCurio(c))).length;
}

// ===== Curiosidades e historias con IA (dentro de esta misma ventana) =====
// Mismo servidor que el asistente. Si el Worker no reenvía "accion", cambia esta URL por la de Apps Script.
const CURIO_IA_URL = "https://catalogo-chat.240300696.workers.dev";
const CURIO_IA_HIST_KEY = "curio_ia_historial";
let curioIA = null; // null = se ve el catálogo; si no, {tipo, peli, cargando|error|texto...}

function curioIAHistorial() {
  try { return JSON.parse(leerLS(CURIO_IA_HIST_KEY) || "[]"); } catch (e) { return []; }
}
function curioIAGuardar(texto, titulo) {
  const h = curioIAHistorial();
  h.unshift({ titulo: titulo, texto: texto });
  escribirLS(CURIO_IA_HIST_KEY, JSON.stringify(h.slice(0, 60)));
}
function curioIAContexto(p) {
  const hora = new Date().getHours();
  const momento = hora < 6 ? "madrugada" : hora < 12 ? "mañana" : hora < 19 ? "tarde" : "noche";
  const est = (typeof estadoDe === "function") ? estadoDe(p) : {};
  const formatos = ["una escena breve", "una carta", "una página de diario", "un diálogo", "una noticia de periódico ficticia", "un monólogo"];
  return {
    momento: momento,
    estrellas: est.estrellas || 0,
    conAlguien: !!est.conAlguien,
    vista: !!est.vista,
    formato: formatos[Math.floor(Math.random() * formatos.length)],
    personajes: Math.random() < 0.5 ? "de la película" : "nuevos, inspirados en la trama"
  };
}
async function curioIAPedir(accion, p) {
  curioIA = { tipo: accion === "historia" ? "historia" : "curiosidad", peli: p, cargando: true };
  renderCuriosidadModal();
  const evitar = curioIAHistorial().map(h => h.texto);
  try {
    const r = await fetch(CURIO_IA_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        token: accessToken,
        accion: accion,
        pelicula: { titulo: p.titulo, año: p.año, director: p.director, reparto: p.reparto, genero: p.genero, pais: p.pais },
        evitar: evitar,
        contexto: curioIAContexto(p)
      })
    });
    const j = await r.json();
    if (j.error) {
      curioIA = { tipo: curioIA.tipo, peli: p, error: j.error };
    } else if (accion === "historia") {
      curioIA = { tipo: "historia", peli: p, titulo: j.titulo, texto: j.texto };
      curioIAGuardar(j.texto, p.titulo);
    } else {
      curioIA = { tipo: "curiosidad", peli: p, tema: j.tema, texto: j.texto, fuente: j.fuente, url: j.url };
      curioIAGuardar(j.texto, p.titulo);
    }
  } catch (e) {
    curioIA = { tipo: curioIA.tipo, peli: p, error: "No pude conectar. Revisa tu conexión e inténtalo de nuevo." };
  }
  renderCuriosidadModal();
}
function pieCurioIA() {
  return '<div class="cur-pie">' +
    '<button type="button" class="pildora" data-cur="ia-otra">Otra curiosidad</button>' +
    '<button type="button" class="pildora" data-cur="ia-historia">Historia</button>' +
    '<button type="button" class="pildora" data-cur="ia-cerrar">Volver al catálogo</button>' +
    '</div>';
}
function htmlCurioIA() {
  const x = curioIA;
  const cab = '<div class="cur-cab"><h2 class="series-h2">' + (x.tipo === "historia" ? "Historia" : "Curiosidad con IA") + '</h2></div>';
  if (x.cargando) return cab + '<p class="cur-texto cur-cargando">' + (x.tipo === "historia" ? "Escribiendo una historia…" : "Buscando un dato verificado…") + '</p>';
  if (x.error) return cab + '<p class="cur-texto">' + esc(x.error) + '</p>' + pieCurioIA();
  if (x.tipo === "historia") {
    return cab + '<p class="cur-tema">Ficción inspirada en ' + esc(x.peli.titulo) + '</p>' +
      '<h3 class="cur-h3">' + esc(x.titulo) + '</h3><p class="cur-texto cur-historia">' + esc(x.texto) + '</p>' +
      '<small class="cur-fuente">Historia inventada. No es un hecho real.</small>' + pieCurioIA();
  }
  return cab + '<p class="cur-tema">' + esc(x.tema || "Dato") + ' · ' + esc(x.peli.titulo) + '</p>' +
    '<p class="cur-texto">' + esc(x.texto) + '</p>' +
    '<small class="cur-fuente">Fuente: <a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.fuente || x.url) + '</a></small>' +
    pieCurioIA();
}

function renderCuriosidadModal() {
  const body = $("curioBody");
  if (!body) return;
  if (curioIA) { body.innerHTML = htmlCurioIA(); return; }
  curioLista = curioFiltrada();
  if (curioIdx >= curioLista.length) curioIdx = 0;
  const c = curioLista[curioIdx];
  const filtros = [["todas","Todas"],["pelicula","Película"],["actores","Actores"],["saga","Saga"],["internet","Internet"]];
  const barra = '<div class="cur-filtros" role="tablist">' + filtros.map(f =>
    '<button type="button" role="tab" aria-selected="' + (curioFiltro === f[0]) + '" class="cur-filtro' + (curioFiltro === f[0] ? ' activo' : '') + '" data-cur="filtro" data-valor="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>';
  const diag = curioDiagnostico();
  const cabecera = '<p class="meta cur-diag">' + esc(diag) + '</p>' + '<div class="cur-cab"><h2 class="series-h2">Curiosidades</h2>' +
    '<button type="button" class="cur-icono" data-cur="historial" aria-label="Historial">🕘</button></div>' + barra;

  if (!curioLista.length) {
    body.innerHTML = cabecera + '<div class="cur-vacio"><p>Todavía no hay curiosidades para este filtro.</p><p class="meta">Agrega datos a la pestaña curiosidades o llena más películas, y aparecerán aquí.</p></div>';
    return;
  }

  const reac = curioReacciones()[claveCurio(c)] || "";
  const fondo = c.peli && c.peli.portada ? ' style="background-image:url(\'' + esc(c.peli.portada) + '\')"' : '';
  const deLaPeli = unDato(hechosDePelicula(c.peli));
  const deActores = unDato(hechosDeActores(c.peli));
  const conexion = unDato(conexionesDe(c.peli));
  const clave = claveCurio(c);
  const oculto = esSpoiler(c.texto) && !CURIO_REVELADOS.has(clave);
  const textoHtml = oculto
    ? '<p class="cur-texto cur-oculto" aria-hidden="true">' + esc(c.texto) + '</p><button type="button" class="pildora cur-revelar" data-cur="revelar">Revelar (contiene spoiler)</button>'
    : '<p class="cur-texto">' + esc(c.texto) + '</p>';
  const pos = (curioIdx + 1) + " de " + curioLista.length + " · " + curioProgreso() + " vistas";
  const reacBtn = (v, t) => '<button type="button" class="cur-reac' + (reac === v ? ' activo' : '') + '" data-cur="reac" data-valor="' + v + '" aria-pressed="' + (reac === v) + '">' + t + '</button>';

  body.innerHTML = cabecera +
    '<article class="cur-tarjeta" id="curioTarjeta">' +
      '<div class="cur-fondo"' + fondo + ' aria-hidden="true"></div>' +
      '<div class="cur-cuerpo">' +
        '<p class="cur-tema">' + esc(c.tema || "Dato") + ' · ' + esc(c.peli.titulo) + '</p>' +
        textoHtml +
        (c.fuente ? '<small class="cur-fuente">Fuente: ' + esc(c.fuente) + '</small>' : '') +
        (deLaPeli ? '<h3 class="cur-h3">Sobre la película</h3><p class="cur-historia">' + esc(deLaPeli) + '</p>' : '') +
        (deActores ? '<h3 class="cur-h3">Sobre sus actores</h3><p class="cur-historia">' + esc(deActores) + '</p>' : '') +
        (conexion ? '<h3 class="cur-h3">En tu colección</h3><p class="cur-historia">' + esc(conexion) + '</p>' : '') +
      '</div>' +
    '</article>' +
    '<div class="cur-nav">' +
      '<button type="button" class="cur-flecha" data-cur="ant" aria-label="Anterior">‹</button>' +
      '<span class="cur-pos" aria-live="polite">' + esc(pos) + '</span>' +
      '<button type="button" class="cur-flecha" data-cur="sig" aria-label="Siguiente">›</button>' +
    '</div>' +
    '<div class="cur-reacciones">' + reacBtn("gusta","👍 Me gusta") + reacBtn("sabia","✓ Ya lo sabía") + reacBtn("no","✕ No me interesa") + '</div>' +
    '<div class="cur-pie">' +
      '<button type="button" class="pildora" data-cur="compartir">Compartir</button>' +
      '<button type="button" class="pildora" data-cur="reportar">Reportar</button>' +
      '<button type="button" class="pildora" data-cur="ver">Ver ficha</button>' +
      '<button type="button" class="pildora" data-cur="ia-otra">Curiosidad IA</button>' +
      '<button type="button" class="pildora" data-cur="ia-historia">Historia</button>' +
    '</div>';
  marcarCurioVista(c);
  curioRegistrar(c, null);
}

function renderCurioHistorial() {
  const body = $("curioBody");
  const hist = curioHistorial();
  body.innerHTML = '<div class="cur-cab"><button type="button" class="pildora" data-cur="volver">← Volver</button><h2 class="series-h2">Historial</h2></div>' +
    (hist.length ? '<ul class="cur-hist">' + hist.map(x =>
      '<li><strong>' + esc(x.titulo) + '</strong><span>' + esc(x.texto) + '</span></li>').join('') + '</ul>'
      : '<p class="meta">Aquí aparecen las curiosidades que ya viste.</p>');
}



function abrirCuriosidad() {
  curioActual = elegirCuriosidad();
  if (curioActual) marcarCurioVista(curioActual);
  renderCuriosidadModal(curioActual);
  const v = $("curioModal");
  if (v) v.classList.add("abierto");
}

function cerrarCuriosidad() {
  const v = $("curioModal");
  if (v) v.classList.remove("abierto");
}

(function curiosidadBoton() {
  const boton = $("btnCuriosidad"), ventana = $("curioModal");
  if (!boton || !ventana) return;
  boton.addEventListener("click", abrirCuriosidad);
  $("cerrarCurio").addEventListener("click", cerrarCuriosidad);
  ventana.addEventListener("click", e => { if (e.target === ventana) cerrarCuriosidad(); });
  document.addEventListener("keydown", e => {
    if (!ventana.classList.contains("abierto")) return;
    if (e.key === "Escape") cerrarCuriosidad();
    if (curioIA && (e.key === "ArrowRight" || e.key === "ArrowLeft")) curioIA = null;
    if (e.key === "ArrowRight") { curioIdx = (curioIdx + 1) % Math.max(curioLista.length, 1); renderCuriosidadModal(); }
    if (e.key === "ArrowLeft") { curioIdx = (curioIdx - 1 + Math.max(curioLista.length, 1)) % Math.max(curioLista.length, 1); renderCuriosidadModal(); }
  });
  let x0 = null;
  const body = $("curioBody");
  body.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  body.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 50 || !curioLista.length) return;
    curioIdx = dx < 0 ? (curioIdx + 1) % curioLista.length : (curioIdx - 1 + curioLista.length) % curioLista.length;
    renderCuriosidadModal();
  });
  body.addEventListener("click", async e => {
    const b = e.target.closest("[data-cur]");
    if (!b) return;
    const acc = b.dataset.cur;
    const c = curioLista[curioIdx];
    if (acc === "ia-otra" || acc === "ia-historia") {
      const p = (c && c.peli) || (curioIA && curioIA.peli);
      if (p) curioIAPedir(acc === "ia-otra" ? "curiosidad" : "historia", p);
      return;
    }
    if (acc === "ia-cerrar") { curioIA = null; renderCuriosidadModal(); return; }
    if (acc !== "ia-otra") curioIA = null;
    if (acc === "filtro") { curioFiltro = b.dataset.valor; curioIdx = 0; renderCuriosidadModal(); }
    else if (acc === "ant" && curioLista.length) { curioIdx = (curioIdx - 1 + curioLista.length) % curioLista.length; renderCuriosidadModal(); }
    else if (acc === "sig" && curioLista.length) { curioIdx = (curioIdx + 1) % curioLista.length; renderCuriosidadModal(); }
    else if (acc === "reac" && c) { curioRegistrar(c, b.dataset.valor); if (c) marcarCurioVista(c); renderCuriosidadModal(); }
    else if (acc === "reportar" && c) { curioReportar(c); b.textContent = "Gracias, lo revisamos"; b.disabled = true; }
    else if (acc === "revelar" && c) { CURIO_REVELADOS.add(claveCurio(c)); renderCuriosidadModal(); }
    else if (acc === "historial") renderCurioHistorial();
    else if (acc === "volver") renderCuriosidadModal();
    else if (acc === "ver" && c) { cerrarCuriosidad(); abrirDetalle(c.peli); }
    else if (acc === "compartir" && c) {
      const texto = c.peli.titulo + ": " + c.texto + (c.fuente ? " (Fuente: " + c.fuente + ")" : "");
      if (navigator.share) { try { await navigator.share({ text: texto }); } catch (err) {} }
      else if (navigator.clipboard) { try { await navigator.clipboard.writeText(texto); } catch (err) {} }
    }
  });
})();


if (window.Nucleo) { Nucleo.registrar("curiosidad-boton", { version: "1.0", emite: [], escucha: [] }); }
