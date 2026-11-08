/* ---------- Clima solar: tema y protección de la vista ---------- */
const RAD = Math.PI / 180;

function datosSolares(fecha) {
  const diaAnio = Math.floor((fecha - new Date(fecha.getFullYear(), 0, 0)) / 86400000);
  const g = 2 * Math.PI / 365 * (diaAnio - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return { eq, dec };
}

function alturaSol(fecha, lat, lon) {
  const { eq, dec } = datosSolares(fecha);
  const minUTC = fecha.getUTCHours() * 60 + fecha.getUTCMinutes() + fecha.getUTCSeconds() / 60;
  const minSolar = minUTC + 4 * lon + eq;
  const H = (minSolar - 720) / 4 * RAD;
  const latR = lat * RAD;
  const seno = Math.sin(latR) * Math.sin(dec) + Math.cos(latR) * Math.cos(dec) * Math.cos(H);
  return Math.asin(Math.max(-1, Math.min(1, seno))) / RAD;
}

function horasSolares(fecha, lat, lon) {
  const { eq, dec } = datosSolares(fecha);
  const latR = lat * RAD;
  const coseno = Math.cos(90.833 * RAD) / (Math.cos(latR) * Math.cos(dec)) - Math.tan(latR) * Math.tan(dec);
  if (coseno < -1 || coseno > 1) return null;
  const mitad = Math.acos(coseno) / RAD;
  const medioDiaUTC = 720 - 4 * lon - eq;
  const base = Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  return {
    amanecer: new Date(base + (medioDiaUTC - 4 * mitad) * 60000),
    atardecer: new Date(base + (medioDiaUTC + 4 * mitad) * 60000)
  };
}

function oscuroDelSistema() {
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function esOscuroPorSol() {
  const ahora = new Date();
  const h = horasSolares(ahora, ubicacion.lat, ubicacion.lon);
  if (!h) return false;
  return ahora < h.amanecer || ahora >= h.atardecer;
}

function esOscuroPorHora() {
  const h = new Date().getHours();
  return h >= 19 || h < 7;
}

function decidirOscuro(modo) {
  if (modo === "premiere") return true;
  if (modo === "claro") return false;
  if (modo === "oscuro") return true;
  if (modo === "hora") return esOscuroPorHora();
  if (modo === "sol") return esOscuroPorSol();
  return oscuroDelSistema();
}

function actualizarTema() {
  document.body.classList.toggle("oscuro", decidirOscuro($("tema-modo").value));
  document.body.classList.toggle("premiere", $("tema-modo").value === "premiere");
}

function modoGuardado(clave, defecto) {
  try { return localStorage.getItem(clave) || defecto; } catch (e) { return defecto; }
}

function intensidadPorSol() {
  const alt = alturaSol(new Date(), ubicacion.lat, ubicacion.lon);
  const t = (4 - alt) / 10;
  return Math.max(0, Math.min(1, t));
}

const INTENSIDAD_MAXIMA = 0.28;

function actualizarCalido() {
  const modo = $("vista-modo").value;
  let opacidad = 0;
  if (modo === "siempre") opacidad = INTENSIDAD_MAXIMA;
  else if (modo === "auto") opacidad = intensidadPorSol() * INTENSIDAD_MAXIMA;
  $("calido").style.opacity = opacidad.toFixed(3);
}

function actualizarTodo() {
  actualizarTema();
  actualizarCalido();
}

function pedirUbicacion() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      ubicacion = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      actualizarTodo();
    },
    () => {},
    { timeout: 8000, maximumAge: 86400000 }
  );
}

// Búsqueda: «género: Terror» o «año: 2026» filtran; cualquier otro texto busca como antes
function coincideBusqueda(p, f) {
  const g = norm(f).trim();
  const gen = g.match(/^genero:\s*(.+)$/);
  if (gen) return generosDe(p).some(x => norm(x) === gen[1].trim());
  const anio = g.match(/^ano:\s*(\d{4})$/);
  if (anio) return String(p["año"]) === anio[1];
  const m = marcas[p.titulo] || {};
  // Sin acentos ni mayúsculas, y cada palabra debe aparecer (con tolerancia a una o dos letras mal escritas)
  const texto = norm([p.titulo, p.director, p.reparto, p.genero, m.nota || "", m.conQuien || ""].join(" "));
  const tokens = texto.split(/[^a-z0-9]+/).filter(Boolean);
  const palabras = g.split(/\s+/).filter(Boolean);
  if (!palabras.length) return true;
  return palabras.every(w => {
    if (texto.includes(w)) return true;
    if (w.length < 4) return false;
    const tolerancia = w.length >= 7 ? 2 : 1;
    return tokens.some(t => Math.abs(t.length - w.length) <= tolerancia && distanciaEdicion(w, t) <= tolerancia);
  });
}

// Distancia de Levenshtein: cuántas letras hay que cambiar para pasar de una palabra a otra
// Cuenta también el intercambio de dos letras vecinas como un solo error (amelei -> amelie)
function distanciaEdicion(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 0; j <= b.length; j++) { d[0][j] = j; }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function llenarSugerencias() {
  const nombres = new Set();
  peliculas.forEach(p => {
    nombres.add(p.titulo);
    personasDe(p).forEach(n => nombres.add(n));
  });
  const dl = $("sugerencias");
  const extras = [];
  [...new Set(peliculas.flatMap(generosDe))].sort((a, b) => a.localeCompare(b, "es"))
    .forEach(g => extras.push("género: " + g));
  [...new Set(peliculas.map(p => String(p["año"] || "")).filter(Boolean))].sort((a, b) => b.localeCompare(a))
    .forEach(a => extras.push("año: " + a));
  dl.innerHTML = extras.map(x => '<option value="' + esc(x) + '"></option>').join("") +
    [...nombres].sort((a, b) => a.localeCompare(b, "es"))
    .map(n => '<option value="' + esc(n) + '"></option>').join("");
}

function llenarFiltros() {
  const llenar = (el, arr) => [...new Set(arr.filter(x => x))].sort().forEach(x => el.add(new Option(x, x)));
  llenar(sel.tipo, peliculas.map(p => p.tipo));
  llenar(sel.genero, peliculas.flatMap(generosDe));
  llenar(sel.anio, peliculas.map(p => String(p["año"] || "")));
  llenar(sel.pais, peliculas.map(p => p.pais));

  const conteo = {};
  peliculas.flatMap(temasDe).forEach(t => conteo[t] = (conteo[t] || 0) + 1);
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
    const delMes = items.filter(p => String((marcas[p.titulo] || {}).vistaDesde || "").slice(0, 7) === mes).length;
    const conNota = items.filter(p => (marcas[p.titulo] || {}).estrellas || estadoDe(p).estrellas);
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
  const conFecha = peliculas.filter(p => fechaValida(p.estreno));
  let lista, sub;
  if (conFecha.length) {
    const ya = conFecha.filter(p => p.estreno <= hoy && dias(p.estreno) >= -120).sort((a, b) => b.estreno.localeCompare(a.estreno)).slice(0, 8);
    const pronto = conFecha.filter(p => p.estreno > hoy).sort((a, b) => a.estreno.localeCompare(b.estreno)).slice(0, 4);
    lista = ya.map(p => ({ p, tipo: "ya" })).concat(pronto.map(p => ({ p, tipo: "pronto" })));
    sub = "Según su fecha de estreno real";
  } else {
    lista = [...peliculas].filter(p => Number(p["año"]))
      .sort((a, b) => Number(b["año"]) - Number(a["año"])).slice(0, 8).map(p => ({ p, tipo: "" }));
    sub = "";
  }
  $("destSub").textContent = sub;
  renderProximosCines();
  $("carrusel").innerHTML = lista.map(({ p, tipo }) => {
    const idx = peliculas.indexOf(p);
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
    const idx = peliculas.findIndex(p => normTxt(p.titulo) === normTxt(x.titulo));
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
      if (t.dataset.idx !== undefined) { desdeAleatorio = false; abrirDetalle(peliculas[Number(t.dataset.idx)]); return; }
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
setInterval(() => { if (peliculas.length) renderDestacados(); }, 60 * 60 * 1000);

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
  if (marcas[p.titulo] && marcas[p.titulo].descartada) return false;
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
  if (!peliculas.length) return;

  const sinEs = [], sinPortada = [], sinPaleta = [], sinTrailer = [], linkRevisar = [];
  const titulosVistos = new Map();
  const duplicados = [];

  peliculas.forEach(p => {
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
    '<details open><summary><b>Salud de la hoja</b> · ' + peliculas.length + ' títulos</summary>' +
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

/* ---------- Aviso de estancadas con botón Decidir ---------- */
function listaEstancadas() {
  const pend = peliculas
    .filter(p => {
      const m = marcas[p.titulo] || {};
      if (m.descartada) return false;
      const d = diasPendiente(p);
      return estadoDe(p).pendiente && d !== null && d > 30;
    })
    .map(p => ({ p, tipo: "pendiente", dias: diasPendiente(p) }));
  const planeadas = peliculas
    .filter(p => {
      const d = diasConAlguien(p);
      return estadoDe(p).conAlguien && d !== null && d > 30;
    })
    .map(p => ({ p, tipo: "planeada", dias: diasConAlguien(p) }));
  return [...pend, ...planeadas];
}

function renderAvisoEstancados() {
  const aviso = $("avisoEstancados");
  const items = listaEstancadas();

  const firmaActual = items.map(x => x.p.titulo + x.tipo).join("|");
  if (firmaActual !== firmaAvisoCerrado) avisoCerrado = false;

  if (hayFiltros() || pestana !== "catalogo" || !items.length || avisoCerrado) {
    aviso.style.display = "none";
    return;
  }

  const n = items.filter(x => x.tipo === "pendiente").length;
  const planeadas = items.length - n;
  const partes = [];
  if (n) partes.push(n + (n === 1 ? " pendiente lleva" : " pendientes llevan") + " más de 30 días sin ver");
  if (planeadas) partes.push(planeadas + (planeadas === 1 ? " planeada con alguien lleva" : " planeadas con alguien llevan") + " más de 30 días");
  $("avisoEstancadosTexto").textContent = partes.join(" · ") + ".";

  $("avisoLista").innerHTML = items.map(x => {
    const k = esc(x.p.titulo);
    const detalle = x.tipo === "pendiente"
      ? "Pendiente hace " + x.dias + " días"
      : "Planeada con alguien hace " + x.dias + " días" + ((marcas[x.p.titulo] || {}).conFecha ? " · " + esc(marcas[x.p.titulo].conFecha) : "");
    const abierta = decidiendo === x.p.titulo;
    const opciones = x.tipo === "pendiente"
      ? '<button class="pildora destacado" data-decidir="ver" data-clave="' + k + '">Ver ahora</button>' +
        '<button class="pildora" data-decidir="planear" data-clave="' + k + '">Planear fecha</button>' +
        '<button class="pildora" data-decidir="descartar" data-clave="' + k + '">Descartar</button>'
      : '<button class="pildora destacado" data-decidir="ver" data-clave="' + k + '">Ver ahora</button>' +
        '<button class="pildora" data-decidir="cambiarFecha" data-clave="' + k + '">Cambiar fecha</button>' +
        '<button class="pildora" data-decidir="quitarPlan" data-clave="' + k + '">Quitar de planeadas</button>';
    return '<div class="aviso-item"><div class="info-aviso">' + esc(x.p.titulo) +
      '<small>' + detalle + '</small></div>' +
      (abierta
        ? '<div class="aviso-opciones">' + opciones + '</div>'
        : '<div class="aviso-opciones"><button class="pildora" data-decidir-abrir="' + k + '">Decidir</button></div>') +
      '</div>';
  }).join("");

  aviso.style.display = "block";
}

// Muestra el aviso con Deshacer. items: [{ titulo, previo }], donde previo es el estado anterior (o null)
function mostrarDeshacer(texto, items) {
  if (deshacerDescarte && deshacerDescarte.timer) clearTimeout(deshacerDescarte.timer);
  deshacerDescarte = { items };
  $("avisoDeshacerTexto").textContent = texto;
  $("avisoDeshacer").hidden = false;
  deshacerDescarte.timer = setTimeout(() => {
    $("avisoDeshacer").hidden = true;
    deshacerDescarte = null;
  }, 6000);
}

function deshacerUltimoDescarte() {
  if (!deshacerDescarte) return;
  deshacerDescarte.items.forEach(({ titulo, previo }) => {
    if (previo) marcas[titulo] = previo; else delete marcas[titulo];
  });
  clearTimeout(deshacerDescarte.timer);
  deshacerDescarte = null;
  $("avisoDeshacer").hidden = true;
  programarGuardado();
  refrescarTodo();
  setEstado("Cambio deshecho.");
}

function accionDecidir(accion, titulo) {
  const p = peliculas.find(x => x.titulo === titulo);
  if (!p) return;
  decidiendo = null;

  if (accion === "ver") {
    desdeAleatorio = false;
    abrirDetalle(p);
    return;
  }
  if (accion === "planear") {
    alternarConAlguien(titulo);
    if (!(marcas[titulo] || {}).conAlguien) { decidiendo = titulo; renderAvisoEstancados(); }
    refrescarTodo();
    return;
  }
  if (accion === "cambiarFecha") {
    cambiarFechaConAlguien(titulo);
    refrescarTodo();
    return;
  }
  if (accion === "quitarPlan") {
    alternarConAlguien(titulo);
    refrescarTodo();
    return;
  }
  if (accion === "descartar") {
    const previo = marcas[titulo] ? Object.assign({}, marcas[titulo]) : null;
    cambiarEstado(titulo, { descartada: true, pendiente: false, vista: false });
    mostrarDeshacer("«" + titulo + "» descartada.", [{ titulo, previo }]);
    refrescarTodo();
  }
}

/* ---------- Pestaña Descartadas ---------- */
function listaDescartadas() {
  return peliculas.filter(p => (marcas[p.titulo] || {}).descartada);
}

function revisionesPendientes() {
  return listaDescartadas().filter(p => {
    const m = marcas[p.titulo] || {};
    if (m.revisionHecha) return false;
    const d = diasDescartada(p);
    return d !== null && d >= 90;
  });
}

// Filtra solo las filas (sin repintar la barra) para no perder el foco del buscador
function filtrarFilasDescartadas() {
  const texto = ($("buscarDesc") ? $("buscarDesc").value : "").trim().toLowerCase();
  document.querySelectorAll("[data-fila-desc]").forEach(fila => {
    const titulo = fila.dataset.filaDesc.toLowerCase();
    const nota = (marcas[fila.dataset.filaDesc] || {}).nota || "";
    fila.style.display = (titulo + " " + nota.toLowerCase()).includes(texto) ? "" : "none";
  });
}

function renderPestanaDescartadas() {
  const todas = listaDescartadas();
  const texto = ($("buscarDesc") ? $("buscarDesc").value : buscar.value).trim().toLowerCase();
  const revisiones = revisionesPendientes();

  seleccionDesc = new Set([...seleccionDesc].filter(t => todas.some(p => p.titulo === t)));

  const visiblesDesc = todas
    .filter(p => {
      const m = marcas[p.titulo] || {};
      return [p.titulo, m.nota || ""].join(" ").toLowerCase().includes(texto);
    })
    .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), "es"));

  visibles = visiblesDesc;
  contador.textContent = "Descartadas: " + todas.length + " · mostrando " + visiblesDesc.length;
  chips.innerHTML = "";

  let html = "";

  if (revisiones.length) {
    html += '<div class="desc-bloque"><h3>Lleva más de 90 días descartada: ¿la reconsideras?</h3>' +
      '<p class="meta">Tú decides. Nada cambia hasta que pulses un botón.</p>' +
      revisiones.map(p => {
        const k = esc(p.titulo);
        return '<div class="desc-item"><div class="info-desc">' + esc(p.titulo) +
          '<small>Descartada hace ' + diasDescartada(p) + ' días</small></div>' +
          '<div class="desc-acciones">' +
          '<button class="pildora destacado" data-revision="restaurar" data-clave="' + k + '">Restaurar</button>' +
          '<button class="pildora" data-revision="dejar" data-clave="' + k + '">Dejar así</button>' +
          '</div></div>';
      }).join("") +
      '</div>';
  }

  html += '<div class="desc-barra">' +
    '<input type="search" id="buscarDesc" placeholder="Buscar en descartadas" value="' + esc(buscar.value) + '">' +
    '<button class="pildora" id="selTodasDesc">Seleccionar todas las visibles</button>' +
    '<button class="pildora destacado" id="restaurarSelDesc"' + (seleccionDesc.size ? '' : ' disabled') + '>Restaurar seleccionadas (' + seleccionDesc.size + ')</button>' +
    '<button class="pildora" id="descartarBtnDesc">🗑 Descartar…</button>' +
    '</div>';

  if (!todas.length) {
    html += '<p class="vacio">Aún no descartas películas. Si una no te interesa, ábrela y usa «Descartar»; así no te la vuelvo a sugerir.</p>';
  } else {
    html += todas.map(p => {
      const k = esc(p.titulo);
      const d = diasDescartada(p);
      const cuando = d === null ? "fecha desconocida" : "descartada hace " + d + (d === 1 ? " día" : " días");
      return '<div class="desc-fila" data-fila-desc="' + k + '"' +
        (visiblesDesc.includes(p) ? '' : ' style="display:none"') + '>' +
        '<input type="checkbox" data-sel="' + k + '"' + (seleccionDesc.has(p.titulo) ? ' checked' : '') + '>' +
        ((p.portada && !datosLimitados()) ? '<img class="mini-portada" src="' + esc(p.portada) + '" alt="">' : '<div class="mini-portada mini-sinportada">🎬</div>') +
        '<div class="info-fila"><h2>' + esc(p.titulo) + '</h2>' +
        '<div class="meta">' + esc(p["año"]) + ' · ' + cuando + '</div></div>' +
        '<button class="chipc" data-restaurar-una="' + k + '">↩ Restaurar</button>' +
        '</div>';
    }).join("");
  }

  lista.innerHTML = html;
}

function accionRevision(accion, titulo) {
  if (accion === "restaurar") {
    cambiarEstado(titulo, { descartada: false });
  } else {
    marcas[titulo] = Object.assign({}, marcas[titulo] || {}, { revisionHecha: true });
    programarGuardado();
  }
  refrescarTodo();
}

function restaurarTitulos(titulos) {
  if (!titulos.length) return;
  titulos.forEach(t => cambiarEstado(t, { descartada: false }));
  seleccionDesc.clear();
  setEstado(titulos.length + (titulos.length === 1 ? " película restaurada." : " películas restauradas."));
  refrescarTodo();
}

// Descarta las seleccionadas desde la propia pestaña, con aviso de Deshacer
function descartarSeleccionadas() {
  const titulos = [...seleccionDesc];
  if (!titulos.length) { setEstado("Marca al menos una película para descartarla."); return; }
  const items = titulos.map(t => ({ titulo: t, previo: marcas[t] ? Object.assign({}, marcas[t]) : null }));
  titulos.forEach(t => cambiarEstado(t, { descartada: true, pendiente: false, vista: false }));
  seleccionDesc.clear();
  const texto = titulos.length + (titulos.length === 1 ? " película descartada." : " películas descartadas.");
  mostrarDeshacer(texto, items);
  setEstado(texto);
  refrescarTodo();
}

/* ---------- Pintado principal ---------- */
function pintar() {
  document.body.dataset.pestana = pestana;
  if (pestana !== "catalogo") { pintarPestana(); return; }
  $("tagsNotas").style.display = "none";

  const f = buscar.value.trim().toLowerCase();
  visibles = peliculas.filter(p => {
    const m = marcas[p.titulo] || {};
    const texto = [p.titulo, p.director, p.reparto, m.nota || "", m.conQuien || ""].join(" ").toLowerCase();
    return coincideBusqueda(p, f) &&
      (!sel.tipo.value || p.tipo === sel.tipo.value) &&
      (!sel.genero.value || generosDe(p).includes(sel.genero.value)) &&
      (!sel.tema.value || temasDe(p).includes(sel.tema.value)) &&
      (!sel.anio.value || String(p["año"]) === sel.anio.value) &&
      (!sel.pais.value || p.pais === sel.pais.value) &&
      enRangoDuracion(p, sel.duracion.value) &&
      coincideEstado(p, sel.estado.value);
  });
  visibles.sort(ordenes[$("orden").value]);
  visibles = ordenarPorAnimo(visibles);

  const { vistas, pendientes } = contarEstados();
  $("destacados").style.display = hayFiltros() ? "none" : "block";
  renderRecomendaciones();
  if (typeof renderSaludoPersonal === "function") renderSaludoPersonal();
  if (typeof renderTarjetaAuto === "function") renderTarjetaAuto();
  renderHoy();
  actualizarAhora();
  renderAvisoEstancados();
  actualizarAvisoFecha();
  renderCena();
  renderEstaSemana();
  renderPregunta();
  renderBienvenida();
  renderDuelo();
  renderSagas();
  renderActores();
  revisarSalud();
  actualizarBotonSalud();
  actualizarBotonAvanzados();
  renderChips();
  contador.textContent = visibles.length + " de " + peliculas.length + " títulos · " +
    vistas + " vistas · " + pendientes + " pendientes" + (datosLimitados() ? " · modo ahorro" : "");

  ajustarQueVer();
  if (!visibles.length) {
    lista.innerHTML = '<p class="vacio">No encontré películas con esos criterios. Prueba quitando algún filtro o cambiando la búsqueda.</p>';
    return;
  }
  if (agrupado) {
    lista.innerHTML = renderAgrupado();
    return;
  }
  lista.innerHTML = visibles.map((p, i) => vistaLista ? filaHtml(p, i) : tarjeta(p, i)).join("");
  marcarAnimo();
}

function pintarPestana() {
  $("resumenSemana").style.display = "none";
  $("avisoFecha").style.display = "none";
  $("avisoEstancados").style.display = "none";
  $("tagsNotas").style.display = "none";
  $("toolbarNotas").style.display = "none";
  $("toolbarVistas").style.display = "none";
  $("destacados").style.display = "none";
  $("salud").classList.add("oculto");
  $("ahora").style.display = "none";
  $("queVer").style.display = "none";
  $("estaSemana").style.display = "none";
  $("duelo").style.display = "none";
  $("pregunta").style.display = "none";
  $("bienvenida").style.display = "none";
  $("mapaGustos").style.display = "none";
  destruirMapa();
  $("recomendaciones").style.display = "none";
  chips.innerHTML = "";

  if (pestana === "vistas") {
    actualizarResumenSemana();
    renderActividad();
  renderExtrasActividad();
  }

  if (pestana === "descartadas") {
    renderPestanaDescartadas();
    return;
  }

  let items = [], extra = null, titulo = "";

  if (pestana === "notas") {
    const f = buscar.value.trim().toLowerCase();
    const etiquetaBuscada = f.startsWith("#") ? f.slice(1) : "";
    titulo = "Mis notas";
    items = peliculas.filter(p => (marcas[p.titulo] || {}).nota)
      .filter(p => etiquetaBuscada
        ? coincideEtiqueta(p, etiquetaBuscada)
        : [p.titulo, (marcas[p.titulo] || {}).nota].join(" ").toLowerCase().includes(f))
      .sort(ordenNotasFn());
    extra = p => {
      const m = marcas[p.titulo] || {};
      const txt = String(m.nota || "").slice(0, 160) + (String(m.nota || "").length > 160 ? "…" : "");
      const tags = etiquetasDeNota(m.nota).map(t => '<button class="etiqueta" data-tag="' + esc(t) + '">#' + esc(t) + '</button>').join("");
      return '<p class="nota-corta">' + esc(txt) + '</p>' +
        (tags ? '<div class="etiquetas-fila">' + tags + '</div>' : '') +
        '<div class="meta" style="margin-top:6px">Editada: ' + esc(m.notaFecha || "") + '</div>';
    };
    $("toolbarNotas").style.display = "flex";
    renderBarraEtiquetas();
  } else if (pestana === "pendientes") {
    titulo = "Pendientes";
    const todas = peliculas.filter(p => estadoDe(p).pendiente);
    const planeadas = todas.filter(p => estadoDe(p).conAlguien)
      .sort((a, b) => {
        const fa = (marcas[a.titulo] || {}).conFecha || "9999-12-31";
        const fb = (marcas[b.titulo] || {}).conFecha || "9999-12-31";
        return fa.localeCompare(fb) || String((marcas[a.titulo] || {}).conAlguienDesde || "").localeCompare(String((marcas[b.titulo] || {}).conAlguienDesde || ""));
      });
    const resto = todas.filter(p => !estadoDe(p).conAlguien)
      .sort((a, b) => String((marcas[a.titulo] || {}).pendienteDesde || "9999").localeCompare(String((marcas[b.titulo] || {}).pendienteDesde || "9999")));
    items = [...planeadas, ...resto];
    extra = p => '<div class="meta" style="margin-top:6px">' + esc(diasPendiente(p) === null ? "fecha desconocida" : "hace " + diasPendiente(p) + " días") + '</div>';

    visibles = items;
    contador.textContent = "Pendientes: " + items.length + " · con alguien: " + planeadas.length;

    if (!items.length) {
      lista.innerHTML = '<p class="vacio">Aún no tienes pendientes. Marca una película con «Pendiente» para verla después.</p>';
      return;
    }
    let html = "";
    if (planeadas.length) {
      html += '<div class="bloque-pend"><h3>Para ver con alguien (' + planeadas.length + ')</h3>' +
        '<div class="grupo-items">' +
        planeadas.map((p, i) => filaPestana(p, i,
          extra(p) +
          (marcas[p.titulo] && marcas[p.titulo].conQuien ? '<div class="meta">con ' + esc(marcas[p.titulo].conQuien) + '</div>' : '') +
          lineaFechaConAlguien(p)
        )).join("") +
        '</div></div>';
    }
    if (resto.length) {
      html += '<div class="bloque-pend"><h3>Otras pendientes (' + resto.length + ')</h3>' +
        '<div class="grupo-items">' +
        resto.map((p, i) => filaPestana(p, i, extra(p))).join("") +
        '</div></div>';
    }
    const diasResto = resto.map(p => diasPendiente(p)).filter(d => d !== null);
    const antigua = diasResto.length ? Math.max(...diasResto) : null;
    lista.innerHTML = heroPestana("pendientes", todas, { planeadas: planeadas.length, antigua: antigua }) + htmlCalendario() + html;
    return;
  } else if (pestana === "vistas") {
    titulo = "Vistas";
    items = peliculas.filter(p => estadoDe(p).vista)
      .sort((a, b) => String((marcas[b.titulo] || {}).vistaDesde || "").localeCompare(String((marcas[a.titulo] || {}).vistaDesde || "")));
    $("toolbarVistas").style.display = "flex";
    const personas = [...new Set(peliculas.map(p => (marcas[p.titulo] || {}).vistaCon).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es"));
    const selP = $("personaVistas");
    const previoP = selP.value;
    selP.innerHTML = '<option value="">Todas</option>' + personas.map(x => '<option value="' + esc(x) + '">' + esc(x) + '</option>').join("");
    selP.value = personas.includes(previoP) ? previoP : "";
    if (selP.value) items = items.filter(p => (marcas[p.titulo] || {}).vistaCon === selP.value);
    extra = p => {
      const m = marcas[p.titulo] || {};
      return (m.vistaDesde ? '<div class="meta" style="margin-top:6px">Vista el ' + esc(m.vistaDesde) + (m.vistaCon ? ' con ' + esc(m.vistaCon) : '') + '</div>' : '') +
        (m.nota ? '<details class="nota-recuerdo"><summary>Ver mi nota</summary><p class="nota-corta">' + esc(String(m.nota)) + '</p>' +
          (m.notaFecha ? '<div class="meta">Editada: ' + esc(m.notaFecha) + '</div>' : '') + '</details>' : '');
    };
  }

  visibles = items;
  contador.textContent = titulo + ": " + items.length + (items.length === 1 ? " título" : " títulos");

  if (!items.length) {
    const msg = pestana === "notas"
      ? "Aún no tienes notas. Abre una película y escribe en «Mi nota». Usa #palabras para etiquetarlas."
      : "Aún no marcas películas como vistas. Abre una película y pulsa «Vista» para empezar tu historial.";
    lista.innerHTML = '<p class="vacio">' + msg + '</p>';
    return;
  }
  const heroHtml = pestana === "vistas" ? heroPestana("vistas", items, {}) : "";
  lista.innerHTML = heroHtml + items.map((p, i) => filaPestana(p, i, extra ? extra(p) : "")).join("");
}

function iframeTrailer(codigo, titulo, auto = false) {
  const parametros = "?cc_load_policy=1&cc_lang_pref=es&hl=es&rel=0" + (auto ? "&autoplay=1" : "");
  return '<iframe src="https://www.youtube.com/embed/' + esc(codigo) + parametros + '" title="Tráiler de ' + esc(titulo) + '" ' +
    'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
    'allowfullscreen loading="lazy"></iframe>';
}

function bloqueTrailer(p) {
  const es = String(p.trailer_es || "").trim();
  const en = String(p.trailer_en || "").trim();
  const hayEs = es && es !== "sin tráiler";
  const hayEn = en && en !== "sin tráiler";

  if (!hayEs && !hayEn) {
    return '<div class="trailer"><div class="trailer-vacio">Esta película no tiene tráiler disponible.</div></div>';
  }

  if (hayEs && hayEn) {
    return '<div class="trailer"><div class="trailer-titulo">Tráiler</div>' +
      '<div class="trailer-opciones">' +
        '<button class="chipc activo" data-trailer="es" data-codigo="' + esc(es) + '">Español</button>' +
        '<button class="chipc" data-trailer="en" data-codigo="' + esc(en) + '">Inglés</button>' +
      '</div>' +
      '<div class="trailer-caja" id="trailerCaja">' + contenidoTrailer(es, p.titulo) + '</div></div>';
  }

  if (hayEs) {
    return '<div class="trailer"><div class="trailer-titulo">Tráiler en español</div>' +
      '<div class="trailer-caja">' + contenidoTrailer(es, p.titulo) + '</div></div>';
  }

  return '<div class="trailer"><div class="trailer-titulo">Tráiler en su idioma original (inglés)</div>' +
    '<div class="trailer-caja">' + contenidoTrailer(en, p.titulo) + '</div>' +
    '<div class="trailer-nota">Activa los subtítulos en el reproductor (CC) para verlos en español.</div></div>';
}

function urlReproducible(link) {
  const t = String(link || "").trim();
  if (!t) return "";
  const yt = t.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return "https://www.youtube.com/embed/" + yt[1] + "?rel=0&hl=es";
  return /^https:\/\//.test(t) ? t : "";
}
function abrirVerPelicula(titulo, es, en, link, auto = false) {
  const codigo = (es && es !== "sin tráiler") ? es : ((en && en !== "sin tráiler") ? en : "");
  const peli = urlReproducible(link);
  const peliSrc = auto && /youtube\.com\/embed/.test(peli) ? peli + (peli.includes("?") ? "&" : "?") + "autoplay=1" : peli;
  const previo = document.getElementById("miniReproductor");
  if (previo) previo.remove();
  const div = document.createElement("div");
  div.id = "miniReproductor";
  div.setAttribute("role", "region");
  div.setAttribute("aria-label", "Reproductor de " + titulo);
  div.dataset.titulo = titulo;
  div.dataset.codigo = codigo;
  div.dataset.peli = peli;
  div.innerHTML =
    '<div class="mr-barra"><span class="mr-titulo">▶ ' + esc(titulo) + '</span>' +
      '<span class="mr-pestanas">' +
        (peli ? '<button type="button" class="mr-chip activo" data-mr="peli">Película</button>' : '') +
        (codigo ? '<button type="button" class="mr-chip' + (peli ? '' : ' activo') + '" data-mr="trailer">Tráiler</button>' : '') +
      '</span>' +
      '<span class="mr-botones"><button type="button" data-mr="tamano" aria-label="Cambiar tamaño">⤢</button>' +
      (peli && !/youtube\.com\/embed/.test(peli) ? '<button type="button" data-mr="recorte" aria-label="Recortar barra lateral" title="Recortar barra lateral">✂</button>' : '') +
      '<button type="button" data-mr="min" aria-label="Minimizar">▁</button>' +
      '<button type="button" data-mr="cerrar" aria-label="Cerrar">✕</button></span></div>' +
    '<div class="mr-caja" id="mrCaja"></div>' +
    '<p class="mr-nota" id="mrNota"></p>';
  const caja = div.querySelector("#mrCaja");
  const nota = div.querySelector("#mrNota");
  const mostrar = (modo) => {
    div.querySelectorAll("[data-mr=peli],[data-mr=trailer]").forEach(b => b.classList.toggle("activo", b.dataset.mr === modo));
    if (modo === "peli" && peli) {
      caja.innerHTML = '<div class="mr-recorte" data-ancho="0"><iframe src="' + esc(peliSrc) + '" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="' + esc(titulo) + '"></iframe></div>';
      const bRec = div.querySelector("[data-mr=recorte]");
      if (bRec) bRec.hidden = false;
      nota.innerHTML = 'Si la pantalla sale en blanco, esa página no permite verla dentro de la app. <a href="' + esc(link) + '" target="_blank" rel="noopener">Abrir en otra pestaña</a>';
    } else {
      caja.innerHTML = codigo ? iframeTrailer(codigo, titulo, auto) : '<div class="mr-vacio">Esta película no tiene tráiler disponible.</div>';
      const bRec2 = div.querySelector("[data-mr=recorte]");
      if (bRec2) bRec2.hidden = true;
      nota.textContent = "Tráiler en la app.";
    }
  };
  div.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-mr]");
    if (!b) return;
    if (b.dataset.mr === "cerrar") { div.remove(); document.body.classList.remove("con-reproductor"); }
    else if (b.dataset.mr === "min") div.classList.toggle("mr-min");
    else if (b.dataset.mr === "recorte") {
      const rec = div.querySelector(".mr-recorte");
      if (rec) {
        const pasos = [0, 150, 260];
        const i = (pasos.indexOf(Number(rec.dataset.ancho)) + 1) % pasos.length;
        rec.dataset.ancho = String(pasos[i]);
        rec.style.setProperty("--recorte", pasos[i] + "px");
      }
    }
    else if (b.dataset.mr === "tamano") {
      const pantallaCompleta = div.classList.contains("mr-completa");
      div.classList.toggle("mr-completa", !pantallaCompleta);
      div.classList.remove("mr-grande");
    }
    else mostrar(b.dataset.mr);
  });
  document.body.appendChild(div);
  document.body.classList.add("con-reproductor");
  mostrar(peli ? "peli" : "trailer");
}
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
  const notaActual = (marcas[p.titulo] || {}).nota || "";
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
    const m = marcas[p.titulo] || {};
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

