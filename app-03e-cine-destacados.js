/* ===== Fase 0 · Módulo «cine-destacados-listeners» (lo que quedaba de app-03): cine, destacados, continuidad de la portada y listeners que se activan al arrancar. Se carga en la misma posición que app-03 para conservar el orden original. Migrado sin cambios de comportamiento. ===== */

function llenarFiltros() {
  const llenar = (el, arr) => [...new Set(arr.filter(x => x))].sort().forEach(x => el.add(new Option(x, x)));
  llenar(sel.tipo, Nucleo.datos.peliculas().map(p => p.tipo));
  llenar(sel.genero, Nucleo.datos.peliculas().flatMap(generosDe));
  llenar(sel.anio, Nucleo.datos.peliculas().map(p => String(p["año"] || "")));
  llenar(sel.pais, Nucleo.datos.peliculas().map(p => p.pais));

  const conteo = {};
  Nucleo.datos.peliculas().flatMap(temasDe).forEach(t => conteo[t] = (conteo[t] || 0) + 1);
  Object.keys(conteo).sort().forEach(t => sel.tema.add(new Option(`${t} (${conteo[t]})`, t)));
}

function pastillasHtml(p) {
  return temasDe(p).map(t => '<span class="pastilla tema">' + esc(t) + '</span>').join("");
}

function retraso(i) { return "--retraso:" + Math.min(i * 40, 400) + "ms"; }

// Tarjeta compacta: portada pequeña, título, año/duración e insignias. Al tocarla se abre la ficha.
// Vista amplia (por defecto): portada grande, sinopsis y acciones al pasar el cursor
function tarjetaAmplia(p, i, extra) {
  const s = estadoDe(p);
  const k = esc(p.titulo);
  const insignias = [];
  if (s.vista) insignias.push("✓ Vista");
  else if (s.pendiente) insignias.push("⏳ Pendiente");
  if (s.estrellas) insignias.push("★ " + s.estrellas);
  if (s.conAlguien) insignias.push("👥");
  const portada = (p.portada && !datosLimitados())
    ? '<img class="portada" loading="lazy" decoding="async" src="' + esc(p.portada) + '" alt="">'
    : '<div class="sinportada">🎬</div>';
  return '<article class="tarjeta amplia animar" style="' + retraso(i) + '" data-i="' + i + '">' + portada +
    '<h2>' + esc(p.titulo) + '</h2>' +
    '<div class="meta">' + esc(p["año"]) + ' · ' + esc(p.duracion) + (p.pais ? ' · ' + esc(p.pais) : '') + '</div>' +
    (insignias.length ? '<div class="mini-insignias">' + insignias.map(t => '<span class="badge">' + esc(t) + '</span>').join("") + '</div>' : '') +
    '<p class="sinopsis clamp-2">' + esc(p.sinopsis) + '</p>' +
    '<div class="acciones-rapidas">' +
      '<button class="chipc' + (s.vista ? ' activo' : '') + '" data-accion="vista" data-clave="' + k + '">' + (s.vista ? '✓ Vista' : 'Vista') + '</button>' +
      '<button class="chipc' + (s.pendiente ? ' activo' : '') + '" data-accion="pendiente" data-clave="' + k + '">' + (s.pendiente ? '⏳' : 'Pendiente') + '</button>' +
      [1, 2, 3, 4, 5].map(n => '<button class="estrella' + (n <= s.estrellas ? ' on' : '') + '" data-accion="estrella" data-clave="' + k + '" data-n="' + n + '" aria-label="Calificar con ' + n + (n === 1 ? ' estrella' : ' estrellas') + '">★</button>').join("") +
    '</div>' +
    (extra || '') +
    '</article>';
}

// Elige la vista: amplia (por defecto) o compacta
function tarjeta(p, i) {
  return vistaLista ? tarjetaCompacta(p, i) : tarjetaAmplia(p, i);
}

// Vista compacta: fila con portada pequeña
function tarjetaCompacta(p, i) {
  const s = estadoDe(p);
  const insignias = [];
  if (s.vista) insignias.push("✓ Vista");
  else if (s.pendiente) insignias.push("⏳ Pendiente");
  if (s.estrellas) insignias.push("★ " + s.estrellas);
  if (s.conAlguien) insignias.push("👥");
  const portada = (p.portada && !datosLimitados())
    ? '<img class="mini-portada" src="' + esc(p.portada) + '" alt="">'
    : '<div class="mini-portada mini-sinportada">🎬</div>';
  return '<article class="tarjeta compacta animar" style="' + retraso(i) + '" data-i="' + i + '">' + portada +
    '<div class="mini-info"><h2>' + esc(p.titulo) + '</h2>' +
    '<div class="meta">' + esc(p["año"]) + ' · ' + esc(p.duracion) + '</div>' +
    (insignias.length ? '<div class="mini-insignias">' + insignias.map(t => '<span class="badge">' + esc(t) + '</span>').join("") + '</div>' : '') +
    '<div class="acciones-rapidas">' +
      '<button class="chipc' + (s.vista ? ' activo' : '') + '" data-accion="vista" data-clave="' + esc(p.titulo) + '">' + (s.vista ? '✓ Vista' : 'Vista') + '</button>' +
      '<button class="chipc' + (s.pendiente ? ' activo' : '') + '" data-accion="pendiente" data-clave="' + esc(p.titulo) + '">' + (s.pendiente ? '⏳' : 'Pendiente') + '</button>' +
      [1, 2, 3, 4, 5].map(n => '<button class="estrella' + (n <= s.estrellas ? ' on' : '') + '" data-accion="estrella" data-clave="' + esc(p.titulo) + '" data-n="' + n + '" aria-label="Calificar con ' + n + (n === 1 ? ' estrella' : ' estrellas') + '">★</button>').join("") +
    '</div>' +
    '</div></article>';
}

function filaHtml(p, i) {
  return tarjetaCompacta(p, i);
}

// Misma tarjeta compacta que Catálogo; "extra" agrega lo propio de cada pestaña (nota, fechas, etc.)
function heroPestana(tipo, items, extras) {
  const tile = (n, t, acento) => '<div class="pest-stat' + (acento ? ' acento' : '') + '"><b>' + n + '</b><span>' + t + '</span></div>';
  if (tipo === "vistas") {
    const mes = hoyLocalISO().slice(0, 7);
    const delMes = items.filter(p => String((Nucleo.datos.marcas()[p.titulo] || {}).vistaDesde || "").slice(0, 7) === mes).length;
    const conNota = items.filter(p => (Nucleo.datos.marcas()[p.titulo] || {}).estrellas || estadoDe(p).estrellas);
    const prom = conNota.length ? (conNota.reduce((a, p) => a + Number(estadoDe(p).estrellas || 0), 0) / conNota.length).toFixed(1) : "–";
    return '<div class="pest-hero">' + tile(items.length, "vistas", false) + tile(delMes, "este mes", true) + tile("★ " + prom, "promedio", false) + '</div>';
  }
  const planeadas = extras.planeadas || 0;
  const antigua = extras.antigua;
  return '<div class="pest-hero">' + tile(items.length, "pendientes", true) + tile(planeadas, "para ver con alguien", false) +
    tile(antigua === null ? "–" : antigua + "d", "la más antigua", false) + '</div>';
}

function filaPestana(p, i, extra) {
  if (!vistaLista) return tarjetaAmplia(p, i, extra);
  const s = estadoDe(p);
  const insignias = [];
  if (s.vista) insignias.push("✓ Vista");
  else if (s.pendiente) insignias.push("⏳ Pendiente");
  if (s.estrellas) insignias.push("★ " + s.estrellas);
  if (s.conAlguien) insignias.push("👥");
  const portada = (p.portada && !datosLimitados())
    ? '<img class="mini-portada" src="' + esc(p.portada) + '" alt="">'
    : '<div class="mini-portada mini-sinportada">🎬</div>';
  return '<article class="tarjeta compacta animar" style="' + retraso(i) + '" data-i="' + i + '">' + portada +
    '<div class="mini-info"><h2>' + esc(p.titulo) + '</h2>' +
    '<div class="meta">' + esc(p["año"]) + ' · ' + esc(p.duracion) + '</div>' +
    (insignias.length ? '<div class="mini-insignias">' + insignias.map(t => '<span class="badge">' + esc(t) + '</span>').join("") + '</div>' : '') +
    (extra || '') +
    '</div></article>';
}

function renderDestacados() {
  const fechaValida = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ""));
  const hoy = hoyLocalISO();
  const dias = f => Math.round((new Date(f + "T00:00") - new Date(hoy + "T00:00")) / 86400000);
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const etiquetaFecha = f => { const [a, m, d] = f.split("-"); return Number(d) + " " + MESES[Number(m) - 1] + " " + a; };
  const etiquetaDia = f => DIAS[new Date(f + "T00:00").getDay()] + " " + etiquetaFecha(f);
  const conFecha = Nucleo.datos.peliculas().filter(p => fechaValida(p.estreno));
  let lista, sub;
  if (conFecha.length) {
    const ya = conFecha.filter(p => p.estreno <= hoy && dias(p.estreno) >= -120).sort((a, b) => b.estreno.localeCompare(a.estreno)).slice(0, 8);
    const pronto = conFecha.filter(p => p.estreno > hoy).sort((a, b) => a.estreno.localeCompare(b.estreno)).slice(0, 4);
    lista = ya.map(p => ({ p, tipo: "ya" })).concat(pronto.map(p => ({ p, tipo: "pronto" })));
    sub = "Según su fecha de estreno real";
  } else {
    lista = [...Nucleo.datos.peliculas()].filter(p => Number(p["año"]))
      .sort((a, b) => Number(b["año"]) - Number(a["año"])).slice(0, 8).map(p => ({ p, tipo: "" }));
    sub = "";
  }
  $("destSub").textContent = sub;
  renderProximosCines();
  $("carrusel").innerHTML = lista.map(({ p, tipo }) => {
    const idx = Nucleo.datos.peliculas().indexOf(p);
    const s = estadoDe(p);
    const img = (p.portada && !datosLimitados())
      ? '<img src="' + esc(p.portada) + '" alt="" loading="lazy">'
      : '<div class="dest2-sinportada">🎬</div>';
    let etiqueta = "";
    let fecha = p["año"] ? String(p["año"]) : "";
    if (tipo === "ya") {
      const d = dias(p.estreno);
      if (d >= -30) etiqueta = '<span class="dest2-tag nuevo">Nuevo</span>';
      fecha = "Estrenó el " + etiquetaDia(p.estreno);
    } else if (tipo === "pronto") {
      const d = dias(p.estreno);
      etiqueta = '<span class="dest2-tag prox">' + (d === 1 ? "Mañana" : "En " + d + " días") + '</span>';
      fecha = "Se estrena el " + etiquetaDia(p.estreno);
    }
    const estado = s.vista ? '<span class="dest2-estado">✓</span>' : (s.pendiente ? '<span class="dest2-estado">⏳</span>' : "");
    return '<div class="dest2" data-idx="' + idx + '">' +
      '<div class="dest2-poster">' + img + etiqueta + estado + '</div>' +
      '<div class="dest2-info"><div class="dest2-titulo">' + esc(p.titulo) + '</div>' +
      '<div class="dest2-fecha">' + esc(fecha) + '</div></div></div>';
  }).join("");
}

let proximosCines = [];
const normTxt = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

async function cargarProximosCines() {
  if (!accessToken || !HOJA_ID) return;
  try {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${HOJA_ID}/values/proximos!A:E`, {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!r.ok) return;
    const j = await r.json();
    proximosCines = (j.values || []).slice(1)
      .filter(f => f[0] && /^\d{4}-\d{2}-\d{2}$/.test(f[1] || ""))
      .map(f => ({ titulo: f[0], fecha: f[1], portada: f[2] || "", tmdb: f[3] || "", sinopsis: f[4] || "" }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    renderProximosCines();
  } catch (e) {}
}

function renderProximosCines() {
  const cont = document.getElementById("proximosCines");
  if (!cont) return;
  const DIAS_C = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const hoy = hoyLocalISO();
  const lista = proximosCines.filter(x => x.fecha >= hoy).slice(0, 12);
  document.getElementById("proxSub").textContent = lista.length ? "Cartelera de cines en México. Toca una para ver de qué trata." : "";
  cont.innerHTML = lista.map((x, i) => {
    const idx = Nucleo.datos.peliculas().findIndex(p => normTxt(p.titulo) === normTxt(x.titulo));
    const [a, m, d] = x.fecha.split("-");
    const dif = Math.round((new Date(x.fecha + "T00:00") - new Date(hoy + "T00:00")) / 86400000);
    const etiqueta = dif === 0 ? "Hoy" : (dif === 1 ? "Mañana" : "En " + dif + " días");
    const img = (x.portada && !datosLimitados())
      ? '<img src="' + esc(x.portada) + '" alt="" loading="lazy">'
      : '<div class="dest2-sinportada">🎬</div>';
    return '<div class="dest2" data-prox="' + i + '"' + (idx !== -1 ? ' data-idx="' + idx + '"' : '') + '>' +
      '<div class="dest2-poster">' + img +
      '<span class="dest2-tag prox">' + etiqueta + '</span>' +
      (idx !== -1 ? '<span class="dest2-estado" title="Ya está en tu catálogo">★</span>' : '') + '</div>' +
      '<div class="dest2-info"><div class="dest2-titulo">' + esc(x.titulo) + '</div>' +
      '<div class="dest2-fecha">' + esc(DIAS_C[new Date(x.fecha + "T00:00").getDay()] + " " + Number(d) + " " + MESES_C[Number(m) - 1]) + '</div></div></div>';
  }).join("") || '';
  if (!cont.dataset.listo) {
    cont.dataset.listo = "1";
    cont.addEventListener("click", e => {
      const t = e.target.closest("[data-prox]");
      if (!t) return;
      if (t.dataset.idx !== undefined) { desdeAleatorio = false; abrirDetalle(Nucleo.datos.peliculas()[Number(t.dataset.idx)]); return; }
      const x = proximosCines[Number(t.dataset.prox)];
      const hoyTxt = hoyLocalISO();
      if (x) abrirVentanaSimple("ventanaProximo", x.titulo,
        '<p class="meta">Se estrena el ' + esc(x.fecha) + '</p>' +
        '<p>' + esc(x.sinopsis || "Sin sinopsis por ahora.") + '</p>' +
        '<p class="meta">No está en tu catálogo todavía.</p>');
    });
  }
}

// Estrenos se reacomoda solo: se vuelve a pintar cada hora (cambia de «próximo» a «estrenó» al pasar la fecha)
setInterval(() => { if (Nucleo.datos.peliculas().length) renderDestacados(); }, 60 * 60 * 1000);

function hayFiltros() {
  return buscar.value.trim() !== "" || Object.values(sel).some(s => s.value !== "");
}

function actualizarBotonAvanzados() {
  const n = AVANZADOS.filter(k => sel[k].value).length;
  const boton = $("toggleAvanzados");
  boton.textContent = "⚙" + (n ? " " + n : "");
  boton.setAttribute("aria-label", "Filtros avanzados" + (n ? ", " + n + " activos" : ""));
  boton.classList.toggle("destacado", n > 0);
}

function textoOpcion(select) {
  const opt = select.options[select.selectedIndex];
  return opt ? opt.text.replace(/\s*\(\d+\)$/, "") : select.value;
}

function renderChips() {
  const activos = [];
  if (buscar.value.trim()) activos.push({ clave:"buscar", texto:'Búsqueda: "' + buscar.value.trim() + '"' });
  Object.keys(sel).forEach(k => {
    if (sel[k].value) activos.push({ clave:k, texto:etiquetas[k] + ": " + textoOpcion(sel[k]) });
  });
  chips.innerHTML = activos.map(a =>
    '<span class="chip" data-clave="' + a.clave + '">' + esc(a.texto) + '<span>×</span></span>'
  ).join("");
}

function coincideEstado(p, valor) {
  if (Nucleo.datos.marcas()[p.titulo] && Nucleo.datos.marcas()[p.titulo].descartada) return false;
  if (!valor) return true;
  const s = estadoDe(p);
  if (valor === "vista") return s.vista;
  if (valor === "sin_ver") return !s.vista;
  if (valor === "pendiente") return s.pendiente;
  if (valor === "conAlguien") return s.conAlguien;
  if (valor === "estancados") {
    const d = diasPendiente(p);
    return s.pendiente && d !== null && d > 30;
  }
  if (valor === "favoritas") return s.estrellas >= 4;
  return true;
}

function renderAgrupado() {
  const temas = [...new Set(visibles.flatMap(temasDe))].sort((a, b) => a.localeCompare(b, "es"));
  const bloques = temas.map(t => {
    const grupo = visibles.filter(p => temasDe(p).includes(t));
    return { nombre: t, items: grupo };
  });
  const sinTema = visibles.filter(p => temasDe(p).length === 0);
  if (sinTema.length) bloques.push({ nombre: "Sin tema", items: sinTema });

  return bloques.map(b => {
    const cuerpo = b.items.map(p => {
      const i = visibles.indexOf(p);
      return vistaLista ? filaHtml(p, i) : tarjeta(p, i);
    }).join("");
    return '<section class="grupo"><h3>' + esc(b.nombre) + ' (' + b.items.length + ')</h3>' +
      '<div class="grupo-items">' + cuerpo + '</div></section>';
  }).join("");
}

function actualizarBotonSalud() {
  const oculto = modoGuardado("salud_oculta", "1") === "1";
  $("salud").classList.toggle("oculto", oculto);
  $("toggleSalud").textContent = oculto ? "🩺 Mostrar salud de la hoja" : "🩺 Ocultar salud de la hoja";
}

function revisarSalud() {
  const sec = $("salud");
  if (!Nucleo.datos.peliculas().length) return;

  const sinEs = [], sinPortada = [], sinPaleta = [], sinTrailer = [], linkRevisar = [];
  const titulosVistos = new Map();
  const duplicados = [];

  Nucleo.datos.peliculas().forEach(p => {
    const t = String(p.titulo || "").trim();
    const clave = slugDe(p);
    if (titulosVistos.has(clave)) duplicados.push(t);
    else titulosVistos.set(clave, t);

    const es = String(p.trailer_es || "").trim();
    const en = String(p.trailer_en || "").trim();
    if (!es || es === "sin tráiler") sinEs.push(t);
    if ((!es && !en) || (es === "sin tráiler" && en === "sin tráiler")) sinTrailer.push(t);
    if (!String(p.portada || "").trim()) sinPortada.push(t);
    if (!paletaDeTexto(p[NOMBRE_PALETA]).length) sinPaleta.push(t);
    const estadoLink = String(p.estado_link || "").trim();
    if (estadoLink && estadoLink.indexOf("activo") === -1) linkRevisar.push(t);
  });

  const bloque = (titulo, lista, mensajeOk) => {
    if (!lista.length) return '<li class="ok">✓ ' + mensajeOk + '</li>';
    return '<li class="alerta">' + titulo + ': ' + lista.length +
      (lista.length <= 8 ? ' (' + lista.map(esc).join(', ') + ')' : '') + '</li>';
  };

  sec.innerHTML =
    '<details open><summary><b>Salud de la hoja</b> · ' + Nucleo.datos.peliculas().length + ' títulos</summary>' +
    '<ul>' +
      bloque("Sin tráiler en español", sinEs, "Todas tienen tráiler en español") +
      bloque("Sin ningún tráiler", sinTrailer, "Todas tienen algún tráiler") +
      bloque("Sin portada", sinPortada, "Todas tienen portada") +
      bloque("Sin paleta de color", sinPaleta, "Todas tienen paleta guardada") +
      bloque("Link que no responde", linkRevisar, "Todos los links responden") +
      (duplicados.length
        ? '<li class="alerta">Posibles duplicados: ' + duplicados.map(esc).join(', ') + '</li>'
        : '<li class="ok">✓ No hay títulos duplicados</li>') +
    '</ul></details>';
}

/* ---------- Aviso de estancadas y pestaña Descartadas: se movieron a app-03c-avisos-descartadas.js ---------- */

/* ---------- Pintado principal: las funciones se movieron a app-03d-pintado-principal.js; el listener queda aquí ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#btnVerPelicula");
  if (!b) return;
  abrirVerPelicula(b.dataset.titulo, b.dataset.es, b.dataset.en, b.dataset.link);
});

function datosCompartir(p) {
  const es = String(p.trailer_es || "").trim();
  const en = String(p.trailer_en || "").trim();
  const codigo = (es && es !== "sin tráiler") ? es : ((en && en !== "sin tráiler") ? en : "");
  const url = codigo ? "https://www.youtube.com/watch?v=" + codigo : "";
  const anio = p["año"] ? " (" + p["año"] + ")" : "";
  return {
    title: p.titulo,
    text: 'Te recomiendo "' + p.titulo + '"' + anio,
    url: url
  };
}

async function compartirPelicula(p) {
  const datos = datosCompartir(p);
  if (navigator.share) {
    try {
      await navigator.share(datos);
    } catch (e) {}
    return;
  }
  const texto = datos.text + (datos.url ? "\n" + datos.url : "");
  try {
    await navigator.clipboard.writeText(texto);
    setEstado("Texto copiado. Pégalo donde quieras compartirlo.");
  } catch (e) {
    setEstado("Este navegador no permite compartir directamente.");
  }
}


/* ---------- Continuidad: la portada viaja desde la lista hasta la ficha ---------- */
let origenPoster = null;   // portada que se tocó para abrir la ficha
function abrirDetalle(p) {
  abrirDetalleBase(p);
}

function abrirDetalleBase(p) {
  detalleActual = p;
  ponerIdEnUrl(slugDe(p));
  const notaActual = (Nucleo.datos.marcas()[p.titulo] || {}).nota || "";
  $("detalle").innerHTML =
    (p.portada && !datosLimitados() ? '<img class="portada" loading="lazy" decoding="async" src="' + esc(p.portada) + '" alt="">' : '') +
    '<h2>' + esc(p.titulo) + '</h2>' +
    '<div class="meta">' + esc(p.tipo) + ' · ' + esc(p["año"]) + ' · ' + esc(p.duracion) + ' · ' + esc(p.pais) + '</div>' +
    '<div class="meta">Género: ' + esc(p.genero) + '</div>' +
    '<div class="meta">Dirección: ' + esc(p.director) + '</div>' +
    '<div class="meta">Reparto: ' + nombresReparto(p).map(n => '<button class="etiqueta" data-actor="' + esc(n) + '">' + ((fotosActores[n] && !datosLimitados()) ? '<img class="actor-chip-foto" loading="lazy" decoding="async" src="' + esc(fotosActores[n]) + '" alt="">' : '') + esc(n) + '</button>').join(" ") + '</div>' +
    '<div class="pastillas">' + pastillasHtml(p) + '</div>' +
    '<h4 class="ficha-h">Mi estado</h4>' + controlesHtml(p) +
    siguienteHtml(p) +
    historialHtml(p) +
    preguntasFichaHtml(p) +
    '<p class="sinopsis">' + esc(p.sinopsis) + '</p>' +
    curiosidadesFichaHtml(p) +
    '<div class="nota-bloque"><label for="notaTexto">Mi nota</label>' +
      '<textarea id="notaTexto" placeholder="Escribe lo que te pareció. Usa #etiquetas para encontrarla después.">' + esc(notaActual) + '</textarea>' +
      '<div id="etiquetasFicha" class="etiquetas-fila">' + etiquetasFichaHtml(notaActual) + '</div>' +
      (notaActual ? '<div class="nota-acciones"><button id="btnBorrarNota">Borrar nota</button></div>' : '') +
    '</div>' +
    bloqueTrailer(p) +
    '<div class="acciones">' +
      '<button type="button" class="boton" id="btnVerPelicula" data-es="' + esc(String(p.trailer_es || "")) + '" data-en="' + esc(String(p.trailer_en || "")) + '" data-titulo="' + esc(p.titulo) + '" data-link="' + esc(p.link || "") + '">Ver película</button>' +
      '<button class="pildora" id="btnCompartir">Compartir</button>' +
      '<button class="pildora" id="btnEnlace">🔗 Copiar enlace</button>' +
    '</div>';

  $("detalle").insertAdjacentHTML("beforeend",
    '<div class="acciones-ficha"><button type="button" class="pildora" id="fichaCarta">📬 Escribir carta</button>' +
    '<button type="button" class="pildora" id="fichaVotar">🗳 Votar en pareja</button></div>');
  document.getElementById("fichaCarta").addEventListener("click", () => { cerrarDetalle(); abrirBuzon(); });
  document.getElementById("fichaVotar").addEventListener("click", () => { cerrarDetalle(); abrirVotacionPareja(); });
  try { montarNotasFicha(p); } catch (e) { console.error("Notas de la ficha:", e); }
  $("otra").innerHTML = desdeAleatorio
    ? '<button class="pildora destacado" id="otraSugerencia">🎲 Otra sugerencia</button>'
    : '';
  $("modal").classList.add("abierto");
  aplicarPaleta(p);
}

// Nota de la ficha: un botón que muestra u oculta la nota completa (sin pestañas)
function montarNotasFicha(p) {
  const det = $("detalle");
  const panel = document.createElement("div");
  panel.className = "fp-notas";
  panel.hidden = true;
  function pintarPanel() {
    const m = Nucleo.datos.marcas()[p.titulo] || {};
    const nota = m.nota || "";
    panel.innerHTML = nota
      ? '<p class="nota-leer">' + esc(nota) + '</p>' +
        (m.notaFecha ? '<div class="meta">Última edición: ' + esc(m.notaFecha) + '</div>' : '') +
        '<div class="etiquetas-fila">' + etiquetasFichaHtml(nota) + '</div>' +
        '<button type="button" class="pildora" data-ir-editar>✎ Editar nota</button>'
      : '<p class="meta">Aún no tienes nota para esta película.</p>' +
        '<button type="button" class="pildora destacado" data-ir-editar>✎ Escribir una nota</button>';
  }
  pintarPanel();
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pildora btn-ver-notas";
  btn.setAttribute("aria-expanded", "false");
  btn.textContent = "📝 Ver nota completa";
  btn.addEventListener("click", () => {
    const abrir = panel.hidden;
    if (abrir) pintarPanel();
    panel.hidden = !abrir;
    btn.setAttribute("aria-expanded", String(abrir));
    btn.textContent = abrir ? "▴ Ocultar nota" : "📝 Ver nota completa";
  });
  panel.addEventListener("click", e => {
    if (!e.target.closest("[data-ir-editar]")) return;
    const t = document.getElementById("notaTexto");
    if (t) { t.scrollIntoView({ behavior: "smooth", block: "center" }); t.focus(); }
  });
  det.append(btn, panel);
}

function cerrarDetalle() {
  $("modal").classList.remove("abierto");
  $("detalle").innerHTML = "";
  desdeAleatorio = false;
  detalleActual = null;
  $("otra").innerHTML = "";
  ponerIdEnUrl(null);
}

function sugerirAleatoria() {
  if (modoPareja()) { sugerirParaDos(); return; }
  if (!visibles.length) {
    contador.textContent = "No hay películas con esos criterios para sugerir.";
    return;
  }
  let p = visibles[Math.floor(Math.random() * visibles.length)];
  const actual = $("detalle").querySelector("h2")?.textContent;
  if (visibles.length > 1 && p.titulo === actual) {
    p = visibles[(visibles.indexOf(p) + 1) % visibles.length];
  }
  desdeAleatorio = true;
  abrirDetalle(p);
}


if (window.Nucleo) { Nucleo.registrar("cine-destacados", { version: "1.0", emite: [], escucha: [] }); }
