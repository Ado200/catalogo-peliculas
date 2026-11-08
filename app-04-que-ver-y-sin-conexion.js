/* ---------- Qué ver esta noche: elige según el tiempo disponible ---------- */
let ultimaNoche = null;

const estiloNoche = document.createElement("style");
estiloNoche.textContent = `
.noche-panel{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:min(420px,92vw);background:var(--tarjeta);color:var(--texto);border-radius:var(--radio-grande);box-shadow:var(--sombra);padding:16px;z-index:60}
.noche-cab{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.noche-cab button{background:none;border:0;font-size:22px;color:var(--gris);cursor:pointer}
.noche-panel select{width:100%;padding:10px 12px;border-radius:999px;border:1px solid var(--borde);background:var(--fondo);color:var(--texto);font-size:14px;margin-bottom:10px}
.noche-tarjeta{display:flex;gap:12px;margin-top:12px;align-items:flex-start}
.noche-tarjeta img{width:96px;height:144px;object-fit:cover;border-radius:12px;flex-shrink:0}
.noche-tarjeta .noche-sin{width:96px;height:144px;display:grid;place-items:center;font-size:36px;background:var(--boton-suave);border-radius:12px;flex-shrink:0}
.noche-info{min-width:0}
.noche-info h3{margin:0 0 4px;font-size:17px}
.noche-info p{margin:0 0 10px;font-size:13px;color:var(--gris)}
.noche-acciones{display:flex;flex-wrap:wrap;gap:6px}
.noche-acciones button{border:0;border-radius:999px;padding:7px 12px;font-size:13px;background:var(--boton-suave);color:var(--texto);cursor:pointer}
.noche-acciones button.principal{background:var(--azul);color:#fff}
.noche-vacio{font-size:14px;color:var(--gris);margin:12px 0 0}`;
document.head.appendChild(estiloNoche);

function abrirQueVerEstaNoche() {
  let panel = document.getElementById("nochePanel");
  if (panel) panel.remove();
  panel = document.createElement("div");
  panel.id = "nochePanel";
  panel.className = "noche-panel";

  const cab = document.createElement("div");
  cab.className = "noche-cab";
  const titulo = document.createElement("b");
  titulo.textContent = "🍿 ¿Cuánto tiempo tienes?";
  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.setAttribute("aria-label", "Cerrar");
  cerrar.textContent = "×";
  cerrar.addEventListener("click", () => panel.remove());
  cab.append(titulo, cerrar);

  const sel = document.createElement("select");
  sel.id = "nocheTiempo";
  [["60", "Hasta 1 hora"], ["90", "Hasta 1 h 30 min"], ["120", "Hasta 2 horas"], ["150", "Hasta 2 h 30 min"], ["180", "Hasta 3 horas"], ["0", "Sin límite"]]
    .forEach(([v, t], i) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = t;
      if (v === "120") o.selected = true;
      sel.appendChild(o);
    });

  const elegir = document.createElement("button");
  elegir.type = "button";
  elegir.className = "pildora destacado";
  elegir.textContent = "Elegir película";
  elegir.addEventListener("click", () => elegirNoche(false));

  const resultado = document.createElement("div");
  resultado.id = "nocheResultado";
  panel.append(cab, sel, elegir, resultado);
  document.body.appendChild(panel);
  ultimaNoche = null;
  elegirNoche(false);
}

function elegirNoche(otra) {
  const sel = document.getElementById("nocheTiempo");
  const res = document.getElementById("nocheResultado");
  if (!sel || !res) return;
  const tiempo = Number(sel.value);
  const base = baseElegir({ estado: "no-vistas" });
  let pool = base.filter(p => estadoDe(p).pendiente && cabeEnTiempo(p, tiempo));
  if (!pool.length) pool = base.filter(p => cabeEnTiempo(p, tiempo));
  if (otra && ultimaNoche && pool.length > 1) pool = pool.filter(p => p.titulo !== ultimaNoche.titulo);

  res.textContent = "";
  if (!pool.length) {
    const vacio = document.createElement("p");
    vacio.className = "noche-vacio";
    vacio.textContent = "Ninguna de tus pendientes cabe en ese tiempo. Prueba con más minutos o agrega películas a pendientes.";
    res.appendChild(vacio);
    return;
  }
  const p = pool[Math.floor(Math.random() * pool.length)];
  ultimaNoche = p;

  const tarjeta = document.createElement("div");
  tarjeta.className = "noche-tarjeta";
  if (p.portada) {
    const img = document.createElement("img");
    img.src = p.portada;
    img.alt = "";
    tarjeta.appendChild(img);
  } else {
    const sinPortada = document.createElement("div");
    sinPortada.className = "noche-sin";
    sinPortada.textContent = "🎬";
    tarjeta.appendChild(sinPortada);
  }

  const info = document.createElement("div");
  info.className = "noche-info";
  const h = document.createElement("h3");
  h.textContent = p.titulo;
  const meta = document.createElement("p");
  const partes = [p["año"], p.duracion, p.director].filter(Boolean);
  const durMin = minutos(p);
  const fmtMin = m => (Math.floor(m / 60) ? Math.floor(m / 60) + " h " : "") + (m % 60) + " min";
  meta.textContent = partes.join(" · ");
  if (tiempo && durMin) {
    const sobra = document.createElement("span");
    sobra.className = "noche-sobra";
    sobra.textContent = "Te sobran " + fmtMin(tiempo - durMin);
    meta.appendChild(document.createElement("br"));
    meta.appendChild(sobra);
  }
  const acciones = document.createElement("div");
  acciones.className = "noche-acciones";

  const verFicha = document.createElement("button");
  verFicha.type = "button";
  verFicha.className = "principal";
  verFicha.textContent = "Ver ficha";
  verFicha.addEventListener("click", () => { document.getElementById("nochePanel")?.remove(); abrirDetalle(p); });

  const otraBtn = document.createElement("button");
  otraBtn.type = "button";
  otraBtn.textContent = "Otra";
  otraBtn.addEventListener("click", () => elegirNoche(true));

  const vista = document.createElement("button");
  vista.type = "button";
  vista.textContent = "Ya la vi";
  vista.addEventListener("click", () => {
    cambiarEstado(p.titulo, { vista: true });
    refrescarTodo();
    elegirNoche(true);
  });

  acciones.append(verFicha, otraBtn, vista);
  info.append(h, meta, acciones);
  tarjeta.appendChild(info);
  res.appendChild(tarjeta);
}

function refrescarTodo() {
  pintar();
  if ($("modal").classList.contains("abierto")) {
    const actual = peliculas.find(p => p.titulo === $("detalle").querySelector("h2")?.textContent);
    if (actual) abrirDetalle(actual);
  }
}

const ZONAS_PELICULAS = [["lista","Lista"],["estrenos","Estrenos"],["sagas","Sagas"],["actores","Actores"],["duelo","Duelo"]];
const ZONAS_VISTAS = [["lista","Películas vistas"],["resumen","Resumen"],["actividad","Actividad"],["mapa","Mapa de gustos"],["descartadas","Descartadas"]];

// Qué pestaña de la barra está activa
function tabActiva() {
  if (pestana === "descartadas") return "vistas";
  if (pestana === "catalogo") return zonaPeli === "inicio" ? "inicio" : "catalogo";
  return pestana;
}

// Qué bloque de la página corresponde a la vista actual
function zonaActual() {
  if (pestana === "catalogo") return zonaPeli;
  if (pestana === "vistas") return zonaVistas;
  return "lista";
}

// Cambia el estado según la pestaña de la barra (sin pintar)
function fijarTab(nombre) {
  if (nombre === "inicio") { pestana = "catalogo"; zonaPeli = "inicio"; return; }
  if (nombre === "catalogo") { pestana = "catalogo"; zonaPeli = "lista"; return; }
  if (nombre === "vistas") { pestana = "vistas"; zonaVistas = "lista"; return; }
  pestana = nombre; // notas, pendientes, descartadas
}

function guardarTab() {
  const v = pestana === "catalogo" ? (zonaPeli === "inicio" ? "inicio" : "catalogo") : pestana;
  try { localStorage.setItem("pestana_activa", v); } catch (e) {}
}

// Paneles del encabezado (⚙ filtros y ⋯ menú): se muestran como hoja inferior y solo uno a la vez
function cerrarPaneles() {
  document.getElementById("panelMas").classList.remove("abierto");
  document.getElementById("panelAvanzados").classList.remove("abierto");
  document.body.classList.remove("panel-abierto");
}

function alternarPanel(id) {
  const el = document.getElementById(id);
  const abrir = !el.classList.contains("abierto");
  cerrarPaneles();
  if (abrir) {
    el.classList.add("abierto");
    el.scrollTop = 0;
    document.body.classList.add("panel-abierto");
  }
}

document.getElementById("velo").addEventListener("click", cerrarPaneles);
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarPaneles(); });

function limpiarFiltros() {
  buscar.value = "";
  Object.values(sel).forEach(s => s.value = "");
  cerrarPaneles();
}

// Muestra solo los bloques de la zona actual, marca la pestaña y el selector interno
function aplicarZona() {
  const actual = zonaActual();
  document.querySelectorAll("[data-zona]").forEach(el => {
    el.classList.toggle("fuera-zona", el.dataset.zona !== actual);
  });
  const tab = tabActiva();
  document.querySelectorAll("#tabbar button").forEach(b => b.classList.toggle("activa", b.dataset.tab === tab));

  const cont = $("selectorZona");
  let opciones = null;
  if (pestana === "catalogo" && zonaPeli !== "inicio") opciones = ZONAS_PELICULAS;
  else if (pestana === "vistas" || pestana === "descartadas") opciones = ZONAS_VISTAS;
  if (!opciones) { cont.style.display = "none"; cont.innerHTML = ""; return; }
  const activa = pestana === "descartadas" ? "descartadas" : actual;
  cont.style.display = "";
  cont.innerHTML = opciones.map(([v, t]) =>
    '<button type="button" data-zona-op="' + v + '" class="' + (v === activa ? "activa" : "") + '">' + t + '</button>'
  ).join("");
}

function aplicarEstadoTabs() {
  document.body.classList.toggle("solo-lista", pestana !== "catalogo");
  $("buscar").placeholder = pestana === "notas"
    ? "Busca en tus notas o escribe #etiqueta..."
    : pestana === "descartadas" ? "Buscar en descartadas..." : "Busca por título, director o actor";
  aplicarZona();
}

function cambiarPestana(nombre) {
  fijarTab(nombre);
  if (pestana !== "catalogo" || zonaPeli === "inicio") limpiarFiltros();
  setEstado("");
  guardarTab();
  aplicarEstadoTabs();
  pintar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Selector interno: Películas (lista, estrenos, sagas, actores, duelo) o Vistas (lista, resumen, actividad, mapa, descartadas)
function elegirZona(v) {
  if (pestana === "catalogo") zonaPeli = v;
  else if (v === "descartadas") pestana = "descartadas";
  else { pestana = "vistas"; zonaVistas = v; }
  if (pestana !== "catalogo") limpiarFiltros();
  setEstado("");
  guardarTab();
  aplicarEstadoTabs();
  pintar();
}

let cls = { cola: [], pila: [], x: 0, dx: 0, activo: false };

function candidatasClasificar() {
  return peliculas.filter(p => {
    const o = marcas[p.titulo] || {};
    if (o.vista || o.pendiente || o.descartada) return false;
    if (sel.genero.value && !generosDe(p).includes(sel.genero.value)) return false;
    return true;
  });
}

function clasActual() { return cls.cola[0]; }

function pintarClasificador() {
  const p = clasActual();
  const zona = $("clasZona");
  $("clasContador").textContent = cls.cola.length
    ? cls.cola.length + " por clasificar"
    : "Listo";
  $("clasIzq").disabled = !p;
  $("clasDer").disabled = !p;
  $("clasDeshacer").disabled = !cls.pila.length;

  if (!p) {
    zona.innerHTML = '<p class="vacio">Ya no quedan películas por clasificar. ¡Buen trabajo!</p>';
    return;
  }

  zona.innerHTML =
    '<div class="clas-card" id="clasCard">' +
      '<div class="clas-sello izq">DESCARTAR</div>' +
      '<div class="clas-sello der">PENDIENTE</div>' +
      (p.portada && !datosLimitados() ? '<img src="' + esc(p.portada) + '" alt="">' : '<div class="sinportada">🎬</div>') +
      '<h2>' + esc(p.titulo) + '</h2>' +
      '<div class="meta">' + esc(p.tipo) + ' · ' + esc(p["año"]) + ' · ' + esc(p.duracion) + ' · ' + esc(p.pais) + '</div>' +
      '<div class="meta">' + esc(p.genero) + '</div>' +
      '<p class="sinopsis">' + esc(p.sinopsis) + '</p>' +
    '</div>';
}

function clasAccion(dir) {
  const p = clasActual();
  if (!p) return;
  const prev = marcas[p.titulo] ? Object.assign({}, marcas[p.titulo]) : null;
  cls.pila.push({ p, prev });

  if (dir === "der") cambiarEstado(p.titulo, { pendiente: true, vista: false, descartada: false });
  else cambiarEstado(p.titulo, { descartada: true, pendiente: false, vista: false });

  cls.cola.shift();
  pintarClasificador();
  refrescarTodo();
}

function clasDeshacer() {
  const ult = cls.pila.pop();
  if (!ult) return;
  if (ult.prev) marcas[ult.p.titulo] = ult.prev;
  else delete marcas[ult.p.titulo];
  programarGuardado();
  cls.cola.unshift(ult.p);
  pintarClasificador();
  refrescarTodo();
}

function abrirClasificador() {
  cls.cola = candidatasClasificar();
  cls.pila = [];
  $("clasificador").classList.add("abierto");
  pintarClasificador();
}

function cerrarClasificador() {
  $("clasificador").classList.remove("abierto");
  refrescarTodo();
}

function moverSellos(dx) {
  const card = $("clasCard");
  if (!card) return;
  const fuerza = Math.min(Math.abs(dx) / 110, 1);
  card.querySelector(".clas-sello.der").style.opacity = dx > 0 ? fuerza : 0;
  card.querySelector(".clas-sello.izq").style.opacity = dx < 0 ? fuerza : 0;
}

// Comprueba que la cuenta que inició sesión sea la institucional. Sin dominio configurado, no restringe.
async function cuentaPermitida(token) {
  if (!DOMINIO_INSTITUCIONAL) return true;
  try {
    const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!r.ok) return false;
    const j = await r.json();
    const correo = String(j.email || "").toLowerCase();
    const dominio = DOMINIO_INSTITUCIONAL.toLowerCase();
    // En Google Workspace, "hd" indica la organización de la cuenta; si viene, debe coincidir
    const orgOk = !j.hd || String(j.hd).toLowerCase() === dominio;
    return j.email_verified !== false && correo.endsWith("@" + dominio) && orgOk;
  } catch (e) {
    return false;
  }
}

function mostrarError(msg) {
  $("error").textContent = msg;
  $("btnLogin").disabled = false;
  $("btnLogin").textContent = "Iniciar sesión con Google";
}

/* ---------- Modo sin conexión: copia local del catálogo ---------- */
async function actualizarCopiaEnSegundoPlano() {
  if (!accessToken || !navigator.onLine || !HOJA_ID) return;
  try {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${HOJA_ID}/values/A:Z`, {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!r.ok) return;
    const j = await r.json();
    const nuevas = j.values || [];
    let previas = null;
    try { previas = (JSON.parse(localStorage.getItem("catalogo_hoja_cache") || "null") || {}).filas || null; } catch (e) {}
    if (JSON.stringify(previas) === JSON.stringify(nuevas)) return;
    guardarCopiaHoja(nuevas);
    const b = document.getElementById("bannerSinConexion");
    if (b) {
      b.textContent = "Hay cambios nuevos en el catálogo. Recarga la página para verlos.";
      b.hidden = false;
    }
  } catch (e) { /* sin conexión o error: se intenta en la siguiente vuelta */ }
}
function guardarCopiaHoja(filas) {
  try { localStorage.setItem("catalogo_hoja_cache", JSON.stringify({ fecha: new Date().toISOString(), filas: filas })); }
  catch (e) { /* si la copia no cabe, simplemente no se guarda */ }
}

function mostrarBannerOffline(fechaISO) {
  const b = document.getElementById("bannerSinConexion");
  if (!b) return;
  const fecha = fechaISO ? new Date(fechaISO).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  b.textContent = "Sin conexión: viendo la copia" + (fecha ? " del " + fecha : "") + ". Tus cambios se guardan aquí y se suben al volver la conexión.";
  b.hidden = false;
}

function ocultarBannerOffline() {
  const b = document.getElementById("bannerSinConexion");
  if (b) b.hidden = true;
}

async function cargarDesdeCopia() {
  let copia = null;
  try { copia = JSON.parse(localStorage.getItem("catalogo_hoja_cache") || "null"); } catch (e) { copia = null; }
  if (!copia || !copia.filas || !copia.filas.length) return false;

  const filas = copia.filas;
  encabezados = (filas[0] || []).slice();
  COL_PALETA = encabezados.indexOf(NOMBRE_PALETA);
  peliculas = [];
  filas.slice(1).forEach((f, i) => {
    if (!f[0]) return;
    const o = { _fila: i + 2 };
    encabezados.forEach((n, j) => o[n] = f[j] ?? "");
    peliculas.push(o);
  });
  fotosActores = {};
  peliculas.forEach(p => {
    try {
      const m = JSON.parse(p.fotos_reparto || "{}");
      Object.entries(m).forEach(([n, u]) => { if (!fotosActores[n]) fotosActores[n] = u; });
    } catch (e) {}
  });

  await cargarMarcas();
  $("login").style.display = "none";
  $("app").style.display = "block";
  const botonChat = document.getElementById("chatAbrir");
  if (botonChat) botonChat.style.display = "";
  document.body.classList.add("con-sesion");
  llenarFiltros();
  llenarSugerencias();
  renderDestacados();
  pintar();
  mostrarBannerOffline(copia.fecha);
  return true;
}

async function cargarHoja() {
  try {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${HOJA_ID}/values/A:Z`, {
      headers: { Authorization: "Bearer " + accessToken }
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error?.message || "No se pudo leer la hoja.");

    const filas = json.values || [];
    encabezados = (filas[0] || []).slice();
    COL_PALETA = encabezados.indexOf(NOMBRE_PALETA);

    peliculas = [];
    filas.slice(1).forEach((f, i) => {
      if (!f[0]) return;
      const o = { _fila: i + 2 };
      encabezados.forEach((n, j) => o[n] = f[j] ?? "");
      peliculas.push(o);
    });

    fotosActores = {};
    peliculas.forEach(p => {
      try {
        const m = JSON.parse(p.fotos_reparto || "{}");
        Object.entries(m).forEach(([n, u]) => { if (!fotosActores[n]) fotosActores[n] = u; });
      } catch (e) {}
    });
    guardarCopiaHoja(filas);

    $("login").style.display = "none";
    $("app").style.display = "block";
    const botonChat = document.getElementById("chatAbrir");
    if (botonChat) botonChat.style.display = "";
    document.body.classList.add("con-sesion");
    llenarFiltros();
    llenarSugerencias();
    renderDestacados();
    pintar();
    abrirDesdeUrl();
  } catch (e) {
    mostrarError(e.message);
  }
}

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

async function iniciarApp() {
  await cargarMarcas();
  await cargarHoja();
  cargarProximosCines();
  cargarCuriosidades();
}

window.addEventListener("load", () => {
  setInterval(actualizarCopiaEnSegundoPlano, 15 * 60 * 1000);
  window.addEventListener("online", () => {
    ocultarBannerOffline();
    setTimeout(actualizarCopiaEnSegundoPlano, 3000);
    // Intenta reconectar en silencio para subir los cambios pendientes
    if (!accessToken && tokenClient) {
      try { tokenClient.requestAccessToken({ prompt: "" }); } catch (e) {}
    }
  });
  window.addEventListener("offline", () => {
    if (accessToken && peliculas.length) mostrarBannerOffline(new Date().toISOString());
  });
  if (!navigator.onLine) {
    cargarDesdeCopia();
  }

  $("tema-modo").value = modoGuardado("tema_modo", "sistema");
  $("vista-modo").value = modoGuardado("vista_modo", "apagada");
  $("ahorro-modo").value = modoGuardado("ahorro_modo", "auto");
  actualizarTodo();
  actualizarAhorro();
  pedirUbicacion();
  setInterval(actualizarTodo, 60000);

  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => actualizarTema();
    if (mq.addEventListener) mq.addEventListener("change", alCambiar);
    else if (mq.addListener) mq.addListener(alCambiar);

    const mqDatos = window.matchMedia("(prefers-reduced-data: reduce)");
    if (mqDatos.addEventListener) mqDatos.addEventListener("change", actualizarAhorro);
  }

  if (navigator.connection && navigator.connection.addEventListener) {
    navigator.connection.addEventListener("change", actualizarAhorro);
  }

  if (DOMINIO_INSTITUCIONAL) {
    $("avisoInstitucional").textContent = "Usa tu correo @" + DOMINIO_INSTITUCIONAL + ". Las cuentas personales no tienen acceso.";
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    hosted_domain: DOMINIO_INSTITUCIONAL || undefined,
    callback: async resp => {
      if (!resp.access_token) { mostrarError("No se pudo iniciar sesión."); return; }
      const token = resp.access_token;
      $("btnLogin").textContent = "Verificando tu cuenta…";
      if (!(await cuentaPermitida(token))) {
        try { google.accounts.oauth2.revoke(token, () => {}); } catch (e) {}
        accessToken = null;
        mostrarError("Esta app es solo para cuentas institucionales" + (DOMINIO_INSTITUCIONAL ? " (@" + DOMINIO_INSTITUCIONAL + ")" : "") + ". Vuelve a intentar con tu correo institucional.");
        return;
      }
      accessToken = token;
      iniciarApp();
    }
  });

  $("btnLogin").addEventListener("click", () => {
    $("btnLogin").disabled = true;
    $("btnLogin").textContent = "Cargando películas...";
    tokenClient.requestAccessToken();
  });

  $("toggleAvanzados").addEventListener("click", () => {
    if (pestana === "catalogo" && zonaPeli === "inicio") { zonaPeli = "lista"; aplicarEstadoTabs(); pintar(); }
    alternarPanel("panelAvanzados");
  });

  $("tema-modo").addEventListener("change", () => {
    try { localStorage.setItem("tema_modo", $("tema-modo").value); } catch (e) {}
    actualizarTema();
  });

  $("vista-modo").addEventListener("change", () => {
    try { localStorage.setItem("vista_modo", $("vista-modo").value); } catch (e) {}
    actualizarCalido();
  });

  $("ahorro-modo").addEventListener("change", () => {
    try { localStorage.setItem("ahorro_modo", $("ahorro-modo").value); } catch (e) {}
    ahorroActivo = null;
    actualizarAhorro();
  });

  // La búsqueda espera 120 ms a que dejes de escribir: un solo render en vez de uno por letra
  let pintarBusquedaTimer = null;
  buscar.addEventListener("input", () => {
    clearTimeout(pintarBusquedaTimer);
    pintarBusquedaTimer = setTimeout(pintar, 120);
  });
  [sel.tipo, sel.genero, sel.tema, sel.anio, sel.pais, sel.duracion, sel.estado, $("orden")]
    .forEach(el => el.addEventListener("input", pintar));
  buscar.addEventListener("input", () => {
    if (pestana === "catalogo" && zonaPeli === "inicio" && buscar.value.trim()) { zonaPeli = "lista"; aplicarEstadoTabs(); }
  });
  $("selectorZona").addEventListener("click", e => {
    const b = e.target.closest("[data-zona-op]");
    if (b) elegirZona(b.dataset.zonaOp);
  });

  document.querySelectorAll("#tabbar button[data-tab]").forEach(b => {
    b.addEventListener("click", () => cambiarPestana(b.dataset.tab));
  });
  const guardada = modoGuardado("pestana_activa", "inicio");
  if (["inicio", "catalogo", "notas", "pendientes", "vistas", "descartadas"].includes(guardada)) fijarTab(guardada);
  aplicarEstadoTabs();

  chips.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const clave = chip.dataset.clave;
    if (clave === "buscar") buscar.value = "";
    else sel[clave].value = "";
    pintar();
  });

  // Un solo listener delegado para toda la lista: Descartadas primero, luego tarjetas
  lista.addEventListener("click", e => {
    if (suprimirClic) { suprimirClic = false; return; }
    if (e.target.id === "selTodasDesc") {
      document.querySelectorAll("[data-fila-desc]").forEach(fila => {
        if (fila.style.display === "none") return;
        const t = fila.dataset.filaDesc;
        seleccionDesc.add(t);
        const cb = fila.querySelector("[data-sel]");
        if (cb) cb.checked = true;
      });
      const btn = $("restaurarSelDesc");
      if (btn) {
        btn.textContent = "Restaurar seleccionadas (" + seleccionDesc.size + ")";
        btn.disabled = seleccionDesc.size === 0;
      }
      return;
    }
    if (e.target.id === "restaurarSelDesc") { restaurarTitulos([...seleccionDesc]); return; }
    if (e.target.id === "descartarBtnDesc") { descartarSeleccionadas(); return; }
    const una = e.target.closest("[data-restaurar-una]");
    if (una) { restaurarTitulos([una.dataset.restaurarUna]); return; }
    const rev = e.target.closest("[data-revision]");
    if (rev) { accionRevision(rev.dataset.revision, rev.dataset.clave); return; }

    // Clic en tarjetas (los controles interactivos no abren la ficha)
    if (e.target.closest("a, [data-accion], [data-tag], [data-sel], button, input")) return;
    const card = e.target.closest("[data-i]");
    if (card) {
      desdeAleatorio = false;
      origenPoster = card.querySelector("img.portada");
      abrirDetalle(visibles[Number(card.dataset.i)]);
    }
  });

  // Buscador de Descartadas: solo filtra las filas, así conserva el foco
  lista.addEventListener("input", e => {
    if (e.target.id === "buscarDesc") {
      buscar.value = e.target.value;
      filtrarFilasDescartadas();
    }
  });

  lista.addEventListener("change", e => {
    if (e.target.dataset && e.target.dataset.sel) {
      const t = e.target.dataset.sel;
      if (e.target.checked) seleccionDesc.add(t); else seleccionDesc.delete(t);
      const btn = $("restaurarSelDesc");
      if (btn) {
        btn.textContent = "Restaurar seleccionadas (" + seleccionDesc.size + ")";
        btn.disabled = seleccionDesc.size === 0;
      }
    }
  });

  $("sagas").addEventListener("click", e => {
    const d = e.target.closest("[data-idx]");
    if (d && peliculas[Number(d.dataset.idx)]) {
      desdeAleatorio = false;
      origenPoster = d.querySelector("img"); abrirDetalle(peliculas[Number(d.dataset.idx)]);
    }
  });

  $("carrusel").addEventListener("click", e => {
    const d = e.target.closest("[data-idx]");
    if (d) {
      desdeAleatorio = false;
      origenPoster = d.querySelector("img"); abrirDetalle(peliculas[Number(d.dataset.idx)]);
    }
  });

  // Carrusel de recomendaciones: el botón ¿Por qué? despliega o oculta el desglose; el resto abre la ficha
  $("recomCarrusel").addEventListener("click", e => {
    const pq = e.target.closest("[data-porque]");
    if (pq) {
      const titulo = peliculas[Number(pq.dataset.porque)].titulo;
      if (porQueAbiertos.has(titulo)) porQueAbiertos.delete(titulo);
      else porQueAbiertos.add(titulo);
      renderRecomendaciones();
      return;
    }
    const d = e.target.closest("[data-idx]");
    if (d) {
      desdeAleatorio = false;
      origenPoster = d.querySelector("img"); abrirDetalle(peliculas[Number(d.dataset.idx)]);
    }
  });

  document.addEventListener("click", e => {
    const etiqueta = e.target.closest("[data-tag]");
    if (etiqueta) {
      const tag = etiqueta.dataset.tag;
      if ($("modal").classList.contains("abierto")) cerrarDetalle();
      if (pestana !== "notas") cambiarPestana("notas");
      buscar.value = "#" + tag;
      pintar();
      return;
    }

    const abrir = e.target.closest("[data-decidir-abrir]");
    if (abrir) { decidiendo = abrir.dataset.decidirAbrir; renderAvisoEstancados(); return; }
    const decision = e.target.closest("[data-decidir]");
    if (decision) { accionDecidir(decision.dataset.decidir, decision.dataset.clave); return; }

    if (e.target.id === "avisoFechaCerrar") { cerrarRecordatorio(); return; }
    const tabVer = e.target.closest("[data-ver]");
    if (tabVer) { verActual = tabVer.dataset.ver; ajustarQueVer(); return; }
    if (e.target.id === "preguntaGuardar") { guardarRespuestaDia(e.target.dataset.titulo); return; }
    if (e.target.id === "preguntaOmitir") { omitirPreguntaHoy(); return; }
    if (e.target.id === "avisoCerrar") {
      avisoCerrado = true;
      firmaAvisoCerrado = listaEstancadas().map(x => x.p.titulo + x.tipo).join("|");
      $("avisoEstancados").style.display = "none";
      return;
    }
    if (e.target.id === "avisoDeshacerBtn") { deshacerUltimoDescarte(); return; }

    if (e.target.id === "cerrarResumen") { cerrarResumenSemana(); return; }
    if (e.target.id === "resumenVer") {
      const p = peliculas.find(x => x.titulo === e.target.dataset.titulo);
      if (p) { desdeAleatorio = false; abrirDetalle(p); }
      return;
    }
    if (e.target.id === "btnBorrarNota") { borrarNota(); return; }
    if (e.target.id === "otraSugerencia") { sugerirAleatoria(); return; }
    if (e.target.id === "btnCompartir") {
      if (detalleActual) compartirPelicula(detalleActual);
      return;
    }
    if (e.target.id === "btnEnlace") { copiarEnlace(); return; }
    if (e.target.id === "btnCompartirRec") { compartirRecomendacion(); return; }
    if (e.target.id === "btnCena" || e.target.id === "cenaOtra") { elegirCena(e.target.id === "cenaOtra"); return; }
    if (e.target.id === "calPrev" || e.target.id === "calNext") {
      mesCalendario = desplazarMes(mesCalendario || hoyLocalISO().slice(0, 7), e.target.id === "calNext" ? 1 : -1);
      pintar();
      return;
    }
    const botonActor = e.target.closest("[data-actor]");
    if (botonActor) { cerrarDetalle(); abrirActor(botonActor.dataset.actor); return; }
    const filaActor = e.target.closest("[data-actor-titulo]");
    if (filaActor) {
      const p = peliculas.find(x => x.titulo === filaActor.dataset.actorTitulo);
      cerrarActor();
      if (p) { desdeAleatorio = false; abrirDetalle(p); }
      return;
    }
    const elegidaDuelo = e.target.closest("[data-duelo-elige]");
    if (elegidaDuelo) { elegirEnDuelo(elegidaDuelo.dataset.dueloElige); return; }
    if (e.target.closest("[data-duelo-otro]")) { parDuelo = null; renderDuelo(); return; }
    const botonSaga = e.target.closest("[data-saga-pend]");
    if (botonSaga) { marcarSagaPendiente(botonSaga.dataset.sagaPend); return; }
    const botonSiguiente = e.target.closest("[data-siguiente]");
    if (botonSiguiente) {
      const p = peliculas.find(x => x.titulo === botonSiguiente.dataset.siguiente);
      if (p) { desdeAleatorio = false; abrirDetalle(p); }
      return;
    }
    if (e.target.id === "cenaVer") {
      const p = peliculas.find(x => x.titulo === e.target.dataset.titulo);
      if (p) { desdeAleatorio = false; abrirDetalle(p); }
      return;
    }

    if (e.target.id === "ahoraVer") {
      if (sugeridaActual) { desdeAleatorio = false; abrirDetalle(sugeridaActual); }
      return;
    }
    if (e.target.id === "ahoraOtra") { nuevaSugerencia(sugeridaActual); return; }

    const cargar = e.target.closest("[data-cargar-trailer]");
    if (cargar) {
      const caja = cargar.closest(".trailer-caja");
      const titulo = $("detalle").querySelector("h2")?.textContent || "";
      if (caja) caja.innerHTML = iframeTrailer(cargar.dataset.cargarTrailer, titulo);
      return;
    }

    const idioma = e.target.closest("[data-trailer]");
    if (idioma) {
      const caja = $("trailerCaja");
      const titulo = $("detalle").querySelector("h2")?.textContent || "";
      caja.innerHTML = contenidoTrailer(idioma.dataset.codigo, titulo);
      document.querySelectorAll("[data-trailer]").forEach(b => b.classList.toggle("activo", b === idioma));
      return;
    }

    const b = e.target.closest("[data-accion]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();

    const titulo = b.dataset.clave;
    const p = peliculas.find(x => x.titulo === titulo);
    if (!p) return;
    const s = estadoDe(p);

    if (b.dataset.accion === "vista") {
      cambiarEstado(titulo, { vista: !s.vista, pendiente: false, vistaDesde: !s.vista ? new Date().toISOString().slice(0, 10) : undefined });
    } else if (b.dataset.accion === "pendiente") {
      cambiarEstado(titulo, { pendiente: !s.pendiente, vista: false });
    } else if (b.dataset.accion === "conAlguien") {
      alternarConAlguien(titulo);
    } else if (b.dataset.accion === "conFecha") {
      cambiarFechaConAlguien(titulo);
    } else if (b.dataset.accion === "restaurar") {
      cambiarEstado(titulo, { descartada: false });
    } else if (b.dataset.accion === "estrella") {
      const n = Number(b.dataset.n);
      cambiarEstado(titulo, { estrellas: s.estrellas === n ? 0 : n });
    }
    refrescarTodo();
  });

  $("aleatorio").addEventListener("click", sugerirAleatoria);
  $("queVerNoche").addEventListener("click", abrirQueVerEstaNoche);
  $("estadisticas").addEventListener("click", abrirEstadisticas);
  $("guardarPaletas").addEventListener("click", guardarPaletasEnHoja);
  $("deshacer").addEventListener("click", deshacerUltimo);
  $("atajos").addEventListener("click", toggleAyudaAtajos);
  $("capsula").addEventListener("click", abrirCapsulaAno);
  $("parejaBtn").addEventListener("click", alternarModoPareja);
  $("diario").addEventListener("click", abrirDiario);
  $("nocheTema").addEventListener("click", nocheTematica);
  $("maraton").addEventListener("click", abrirMaraton);
  $("sorpresa").addEventListener("click", abrirSorpresa);
  $("votarPareja").addEventListener("click", abrirVotacionPareja);
  $("animoBtn").addEventListener("click", abrirAnimo);
  $("mapaViaje").addEventListener("click", abrirMapaViaje);
  $("buzon").addEventListener("click", abrirBuzon);
  $("prepararViaje").addEventListener("click", prepararViaje);
  $("verViaje").addEventListener("click", abrirModoViaje);
  if (modoPareja()) { $("parejaBtn").textContent = "💑 Modo pareja: activo"; $("parejaBtn").classList.add("destacado"); }
  $("cerrarStats").addEventListener("click", cerrarEstadisticas);
  $("statsModal").addEventListener("click", e => { if (e.target.id === "statsModal") cerrarEstadisticas(); });

  $("cerrarModal").addEventListener("click", cerrarDetalle);
  $("modal").addEventListener("click", e => { if (e.target.id === "modal") cerrarDetalle(); });

  $("vista").addEventListener("click", () => {
    vistaLista = !vistaLista;
    document.body.classList.toggle("lista", vistaLista);
    $("vista").textContent = vistaLista ? "Vista amplia" : "Vista compacta";
    try { localStorage.setItem("vista_tarjetas", vistaLista ? "compacta" : "amplia"); } catch (e) {}
    pintar();
  });

  function alternarAgrupado() {
    agrupado = !agrupado;
    const txt = agrupado ? "Quitar agrupación" : "Agrupar por tema";
    $("agrupar").textContent = txt;
    $("agruparNotas").textContent = txt;
    pintar();
  }
  $("agrupar").addEventListener("click", alternarAgrupado);
  $("agruparNotas").addEventListener("click", alternarAgrupado);
  $("ordenNotas").addEventListener("change", () => pintar());
  $("personaVistas").addEventListener("change", () => pintar());
  $("presetGuardar").addEventListener("click", guardarPreset);
  $("presetBorrar").addEventListener("click", borrarPreset);
  $("presetsSel").addEventListener("change", aplicarPreset);
  renderPresets();
  $("cerrarActor").addEventListener("click", cerrarActor);
  $("actorModal").addEventListener("click", e => { if (e.target.id === "actorModal") cerrarActor(); });

  $("limpiar").addEventListener("click", () => {
    buscar.value = "";
    Object.values(sel).forEach(s => s.value = "");
    $("orden").value = "titulo";
    pintar();
  });

  $("clasificar").addEventListener("click", abrirClasificador);
  $("clasCerrar").addEventListener("click", cerrarClasificador);
  $("clasIzq").addEventListener("click", () => clasAccion("izq"));
  $("clasDer").addEventListener("click", () => clasAccion("der"));
  $("clasDeshacer").addEventListener("click", clasDeshacer);

  $("toggleSalud").addEventListener("click", () => {
    const oculta = modoGuardado("salud_oculta", "1") === "1";
    try { localStorage.setItem("salud_oculta", oculta ? "0" : "1"); } catch (e) {}
    actualizarBotonSalud();
  });

  $("respaldarMarcas").addEventListener("click", respaldarMarcas);
  $("restaurarMarcas").addEventListener("click", () => $("archivoRestaurar").click());
  $("archivoRestaurar").addEventListener("change", e => {
    const archivo = e.target.files && e.target.files[0];
    e.target.value = "";
    if (archivo) restaurarMarcasDesdeArchivo(archivo);
  });
});

async function borrarMisMarcas() {
  const ok = confirm("¿Borrar todas tus marcas (vistas, pendientes, estrellas, notas, «con alguien» y descartadas)? Esta acción no se puede deshacer.");
  if (!ok) return;
  if (!confirm("Última confirmación: se borrarán todas tus marcas y sus respaldos semanales de Drive, y no se pueden recuperar. ¿Seguro?")) return;
  clearTimeout(guardadoTimer);
  try {
    await syncBorrarTodoDrive();
  } catch (e) {
    setEstado("No pude borrar tus marcas de Drive. Intenta de nuevo.");
    return;
  }
  idMarcas = null;
  marcas = envolverMarcas({});
  seleccionDesc.clear();
  porQueAbiertos.clear();
  syncBorrarLocal();
  refrescarTodo();
  setEstado("Tus marcas se borraron de Drive y de este navegador.");
}

$("borrarMarcas").addEventListener("click", borrarMisMarcas);

function exportarCSV() {
  const columnas = ["titulo", "tipo", "año", "duracion", "pais", "director", "genero", "reparto", "temas", "link", "vista", "pendiente", "estrellas", "nota", "conAlguien", "conQuien", "conFecha"];

  const esc = v => {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const filas = [columnas.join(",")];
  peliculas.forEach(p => {
    const s = estadoDe(p);
    const m = marcas[p.titulo] || {};
    const valores = columnas.map(c => {
      if (c === "vista") return s.vista ? "sí" : "no";
      if (c === "pendiente") return s.pendiente ? "sí" : "no";
      if (c === "estrellas") return s.estrellas || "";
      if (c === "nota") return m.nota || "";
      if (c === "conAlguien") return s.conAlguien ? "sí" : "no";
      if (c === "conQuien") return m.conQuien || "";
      if (c === "conFecha") return m.conFecha || "";
      return p[c] ?? "";
    });
    filas.push(valores.map(esc).join(","));
  });

  const blob = new Blob(["\uFEFF" + filas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mi_catalogo_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setEstado("CSV exportado: " + peliculas.length + " títulos.");
}

$("exportar").addEventListener("click", exportarCSV);

let swipe = null;

// Gesto a la izquierda: marca como vista. Nunca desmarca; se puede deshacer con el aviso.
function marcarVistaGesto(p) {
  if (estadoDe(p).vista) {
    setEstado("Ya está en tus vistas.");
    refrescarTodo();
    return;
  }
  const previo = marcas[p.titulo] ? Object.assign({}, marcas[p.titulo]) : null;
  cambiarEstado(p.titulo, { vista: true, pendiente: false, vistaDesde: hoyLocalISO() });
  mostrarDeshacer("«" + p.titulo + "» marcada como vista.", [{ titulo: p.titulo, previo }]);
  refrescarTodo();
}

function reiniciarTarjeta(el) {
  if (!el) return;
  el.style.transition = "transform .25s var(--ease)";
  el.style.transform = "";
}

lista.addEventListener("touchstart", e => {
  const card = e.target.closest("[data-i]");
  if (!card || e.target.closest("a, button, select, input")) { swipe = null; return; }
  const t = e.touches[0];
  swipe = { el: card, i: Number(card.dataset.i), x: t.clientX, y: t.clientY, dx: 0, activo: false, lp: false, timer: null };
  swipe.timer = setTimeout(() => {
    if (!swipe) return;
    swipe.lp = true;
    abrirRapida(card);
  }, 500);
}, { passive: true });

lista.addEventListener("touchmove", e => {
  if (!swipe) return;
  const t = e.touches[0];
  const dx = t.clientX - swipe.x;
  const dy = t.clientY - swipe.y;
  if (Math.abs(dx) > 12 || Math.abs(dy) > 12) clearTimeout(swipe.timer);
  if (swipe.lp) return;
  if (!swipe.activo) {
    if (Math.abs(dy) > Math.abs(dx)) { reiniciarTarjeta(swipe.el); swipe = null; return; }
    if (Math.abs(dx) < 12) return;
    swipe.activo = true;
  }
  swipe.dx = dx;
  swipe.el.style.transition = "none";
  swipe.el.style.transform = "translateX(" + Math.max(-120, Math.min(120, dx)) + "px)";
  swipe.el.dataset.swipe = dx <= -30 ? "vista" : (dx >= 30 ? "pendiente" : "");
}, { passive: true });

lista.addEventListener("touchend", () => {
  if (!swipe) return;
  const s = swipe;
  swipe = null;
  reiniciarTarjeta(s.el);
  delete s.el.dataset.swipe;
  clearTimeout(s.timer);
  if (s.lp) {
    suprimirClic = true;
    setTimeout(() => { suprimirClic = false; }, 400);
    return;
  }
  if (!s.activo) return;
  const p = visibles[s.i];
  if (!p) return;
  if (s.dx <= -90) { marcarVistaGesto(p); return; }
  if (s.dx >= 90) {
    const pendienteActual = estadoDe(p).pendiente;
    const previo = marcas[p.titulo] ? Object.assign({}, marcas[p.titulo]) : null;
    cambiarEstado(p.titulo, { pendiente: !pendienteActual, vista: false });
    mostrarDeshacer(pendienteActual
      ? "«" + p.titulo + "» quitada de pendientes."
      : "«" + p.titulo + "» puesta en pendientes.", [{ titulo: p.titulo, previo }]);
    refrescarTodo();
  }
});

lista.addEventListener("touchcancel", () => {
  if (swipe) { clearTimeout(swipe.timer); reiniciarTarjeta(swipe.el); delete swipe.el.dataset.swipe; }
  swipe = null;
});

const zonaClas = $("clasZona");

zonaClas.addEventListener("touchstart", e => {
  if (!clasActual()) return;
  cls.x = e.touches[0].clientX;
  cls.dx = 0;
  cls.activo = true;
  const card = $("clasCard");
  if (card) card.style.transition = "none";
}, { passive: true });

zonaClas.addEventListener("touchmove", e => {
  if (!cls.activo) return;
  const card = $("clasCard");
  if (!card) return;
  cls.dx = e.touches[0].clientX - cls.x;
  card.style.transform = "translateX(" + cls.dx + "px) rotate(" + (cls.dx / 25) + "deg)";
  moverSellos(cls.dx);
}, { passive: true });

zonaClas.addEventListener("touchend", () => {
  if (!cls.activo) return;
  cls.activo = false;
  const card = $("clasCard");
  if (!card) return;
  const dx = cls.dx;
  cls.dx = 0;
  if (Math.abs(dx) >= 110) {
    const dir = dx > 0 ? "der" : "izq";
    const salida = dx > 0 ? window.innerWidth : -window.innerWidth;
    card.style.transition = "transform .25s ease";
    card.style.transform = "translateX(" + salida + "px) rotate(" + (dx > 0 ? 20 : -20) + "deg)";
    setTimeout(() => clasAccion(dir), 220);
  } else {
    card.style.transition = "transform .25s var(--ease)";
    card.style.transform = "";
    moverSellos(0);
  }
});

zonaClas.addEventListener("touchcancel", () => {
  cls.activo = false;
  cls.dx = 0;
  const card = $("clasCard");
  if (card) { card.style.transition = "transform .25s var(--ease)"; card.style.transform = ""; }
  moverSellos(0);
});

/* --- bloque 2 --- */
(function () {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById("voz");
  const buscarEl = document.getElementById("buscar");
  if (!Rec || !btn) return;

  btn.hidden = false;
  const rec = new Rec();
  rec.lang = "es-MX";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let escuchando = false;

  function mensaje(texto) {
    const el = document.getElementById("estadoGuardado");
    if (el) el.textContent = texto;
  }
  function parar() {
    escuchando = false;
    btn.classList.remove("escuchando");
  }

  rec.onresult = e => {
    let texto = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      texto += e.results[i][0].transcript;
    }
    buscarEl.value = texto.replace(/[.,;:!?¿¡]+/g, " ").replace(/\s+/g, " ").trim();
    buscarEl.dispatchEvent(new Event("input"));
  };

  rec.onerror = e => {
    parar();
    mensaje(e.error === "not-allowed"
      ? "Permite el uso del micrófono en el navegador para buscar por voz."
      : "No entendí, intenta de nuevo.");
  };

  rec.onend = parar;

  btn.addEventListener("click", () => {
    if (escuchando) {
      rec.stop();
      parar();
      return;
    }
    try {
      rec.start();
      escuchando = true;
      btn.classList.add("escuchando");
      mensaje("Escuchando... di un título, director o actor.");
    } catch (e) {
      mensaje("No pude iniciar el micrófono. Intenta de nuevo.");
    }
  });
})();

/* --- bloque 3 --- */
(function () {
  const header = document.querySelector("#app > header");
  const rango = document.getElementById("vidrioAlfa");
  const valor = document.getElementById("vidrioAlfaValor");
  if (!header || !rango || !valor) return;

  function aplicarVidrio(v) {
    const n = Math.min(95, Math.max(40, Math.round(Number(v)) || 72));
    document.documentElement.style.setProperty("--opacidad", (n / 100).toFixed(2));
    document.documentElement.style.setProperty("--desenfoque", Math.round(n * 0.3) + "px");
    rango.value = n;
    valor.textContent = n;
    return n;
  }
  aplicarVidrio(modoGuardado("vidrio_alfa", "72"));

  rango.addEventListener("input", () => {
    const n = aplicarVidrio(rango.value);
    try { localStorage.setItem("vidrio_alfa", String(n)); } catch (e) {}
  });


  // Reglas:
  // - Se compacta solo al bajar, pasando 180 px (así siempre hay espacio para compensar el salto).
  // - Se expande solo al llegar arriba (y <= 20). Nunca mientras se sube, para no pelear con el scroll.
  // - La compensación del scroll solo se aplica al compactar, que es cuando el contenido sube.
  const UMBRAL_COMPACTA = 180;
  let compacta = false, ultimoY = window.scrollY, ignorarHasta = 0, pendiente = false;

  function cambiarEstado(v, y) {
    if (compacta === v) return;
    compacta = v;
    const antes = header.offsetHeight;
    document.body.classList.toggle("barra-compacta", v);
    const despues = header.offsetHeight;
    if (v && y > 0 && despues !== antes) {
      ignorarHasta = performance.now() + 200;
      window.scrollBy(0, despues - antes);
    }
  }

  function alDesplazar() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      if (performance.now() < ignorarHasta) return;
      const y = window.scrollY;
      if (!compacta) {
        if (y > UMBRAL_COMPACTA && y > ultimoY) cambiarEstado(true, y);
      } else if (y <= 20) {
        cambiarEstado(false, y);
      }
      ultimoY = y;
    });
  }

  window.addEventListener("scroll", alDesplazar, { passive: true });
})();

/* --- bloque 4 --- */
(function () {
  const modal = document.getElementById("modal");
  const ventana = modal.querySelector(".ventana");

  const tirador = document.createElement("div");
  tirador.className = "hoja-tirador";
  tirador.setAttribute("aria-hidden", "true");
  ventana.insertBefore(tirador, ventana.firstChild);

  // Escape cierra la ficha
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("abierto")) cerrarDetalle();
  });

  // Deslizar hacia abajo cierra la hoja (solo cuando el contenido está arriba del todo)
  let inicio = null, dy = 0, arrastrando = false;

  function reiniciar() {
    inicio = null;
    arrastrando = false;
    dy = 0;
  }

  ventana.addEventListener("touchstart", e => {
    if (ventana.scrollTop > 0 || e.target.closest("textarea, input, select, iframe")) { reiniciar(); return; }
    inicio = e.touches[0].clientY;
    arrastrando = false;
    dy = 0;
  }, { passive: true });

  ventana.addEventListener("touchmove", e => {
    if (inicio === null) return;
    const d = e.touches[0].clientY - inicio;
    if (!arrastrando) {
      if (d < 8) return;
      arrastrando = true;
      ventana.style.transition = "none";
    }
    if (e.cancelable) e.preventDefault();
    dy = Math.max(0, d);
    ventana.style.transform = "translateY(" + (dy * 0.9) + "px)";
  }, { passive: false });

  ventana.addEventListener("touchend", () => {
    if (inicio === null) return;
    const cerrar = arrastrando && dy > 110;
    const estabaArrastrando = arrastrando;
    reiniciar();
    if (!estabaArrastrando) return;
    ventana.style.transition = "transform .3s var(--ease)";
    if (cerrar) {
      ventana.style.transform = "translateY(100%)";
      setTimeout(() => {
        cerrarDetalle();
        ventana.style.transform = "";
        ventana.style.transition = "";
      }, 260);
    } else {
      ventana.style.transform = "";
    }
  });

  ventana.addEventListener("touchcancel", () => {
    reiniciar();
    ventana.style.transition = "transform .3s var(--ease)";
    ventana.style.transform = "";
  });
})();

/* --- bloque 5 --- */
(function () {
  const estado = document.getElementById("estado");
  const botones = document.querySelectorAll(".segmentado button");
  if (!estado || !botones.length) return;

  function sincronizar() {
    botones.forEach(b => {
      const activa = b.dataset.seg === estado.value;
      b.classList.toggle("activa", activa);
      b.setAttribute("aria-pressed", activa ? "true" : "false");
    });
  }

  botones.forEach(b => {
    b.addEventListener("click", () => {
      estado.value = b.dataset.seg;
      estado.dispatchEvent(new Event("input"));
      sincronizar();
    });
  });

  // Mantiene el selector sincronizado con los demás controles (panel, chips, Limpiar)
  estado.addEventListener("input", sincronizar);
  document.addEventListener("click", () => setTimeout(sincronizar, 0));
  sincronizar();

  // Aviso «Deshacer» para Vista y Pendiente desde los botones de la tarjeta o la ficha
  let snap = null;
  document.addEventListener("click", e => {
    const b = e.target.closest('[data-accion="pendiente"], [data-accion="vista"]');
    if (!b) { snap = null; return; }
    const t = b.dataset.clave;
    snap = {
      titulo: t,
      tipo: b.dataset.accion,
      previo: marcas[t] ? Object.assign({}, marcas[t]) : null
    };
  }, true);

  document.addEventListener("click", () => {
    if (!snap) return;
    const s = snap;
    snap = null;
    const antes = JSON.stringify(s.previo);
    const despues = JSON.stringify(marcas[s.titulo] || null);
    if (antes === despues) return;
    const etiqueta = s.tipo === "vista" ? "marcada como vista" : "puesta en pendientes";
    mostrarDeshacer("«" + s.titulo + "» " + etiqueta + ".", [{ titulo: s.titulo, previo: s.previo }]);
  });
})();

/* --- bloque 6 --- */
(function () {
  const LOTE = 24;
  const lista = document.getElementById("lista");

  let cola = [];          // HTML de las tarjetas aún no cargadas, en orden
  let mostradas = LOTE;   // cuántas tarjetas reales hay en pantalla
  let firmaAnterior = "";

  const observerMut = new MutationObserver(() => preparar());
  const observerLote = new IntersectionObserver(entradas => {
    if (entradas.some(e => e.isIntersecting)) cargarSiguiente(false);
  }, { rootMargin: "400px 0px" });

  function pausar() { observerMut.disconnect(); }
  function reanudar() { observerMut.observe(lista, { childList: true }); }

  function quitarSentinela() {
    observerLote.disconnect();
    const s = document.getElementById("sentinelaLote");
    if (s) s.remove();
  }

  function terminar() {
    quitarSentinela();
    cola = [];
  }

  // Cambia la firma cuando cambia la búsqueda, los filtros, el orden o la pestaña.
  // Si solo cambia una marca, se conserva cuántas tarjetas ya estaban cargadas.
  function firma() {
    return [buscar.value, ...Object.values(sel).map(s => s.value), $("orden").value, pestana, agrupado].join("|");
  }

  function actualizarBoton() {
    const b = document.getElementById("cargarTodas");
    const quedan = lista.querySelectorAll(".esqueleto").length;
    if (b) b.textContent = "Cargar las " + quedan + " restantes";
  }

  function preparar() {
    pausar();
    if (pestana !== "catalogo" || agrupado) { terminar(); reanudar(); return; }

    const hijos = [...lista.children].filter(el => el.hasAttribute("data-i"));
    const f = firma();
    if (f !== firmaAnterior) { mostradas = LOTE; firmaAnterior = f; }

    if (hijos.length <= mostradas) { terminar(); reanudar(); return; }

    const resto = hijos.slice(mostradas);
    cola = resto.map(el => el.outerHTML);
    resto.forEach((el, k) => {
      const s = document.createElement("div");
      s.className = "esqueleto";
      s.dataset.n = String(k);
      s.setAttribute("aria-hidden", "true");
      el.replaceWith(s);
    });

    quitarSentinela();
    const sent = document.createElement("div");
    sent.id = "sentinelaLote";
    sent.className = "lote-sentinela";
    sent.innerHTML = '<button type="button" class="pildora" id="cargarTodas"></button>';
    lista.appendChild(sent);
    actualizarBoton();
    reanudar();
    observerLote.observe(sent);
  }

  function cargarSiguiente(todas) {
    const sk = [...lista.querySelectorAll(".esqueleto")];
    if (!sk.length) { terminar(); return; }

    pausar();
    const grupo = todas ? sk : sk.slice(0, LOTE);
    grupo.forEach(s => {
      const k = Number(s.dataset.n);
      const plantilla = document.createElement("template");
      plantilla.innerHTML = cola[k];
      const tarjeta = plantilla.content.firstElementChild;
      if (tarjeta) s.replaceWith(tarjeta); else s.remove();
    });
    mostradas += grupo.length;

    if (!lista.querySelector(".esqueleto")) { terminar(); reanudar(); return; }

    actualizarBoton();
    reanudar();
    const sent = document.getElementById("sentinelaLote");
    if (sent) { observerLote.unobserve(sent); observerLote.observe(sent); }
  }

  // Botón de respaldo: carga todas las restantes de una vez
  document.addEventListener("click", e => {
    if (e.target.closest && e.target.closest("#cargarTodas")) cargarSiguiente(true);
  });

  reanudar();
})();

/* --- bloque 7 --- */
(function () {
  // 1. Tarjetas y carrusel accesibles con teclado
  function hacerEnfocables(raiz) {
    raiz.querySelectorAll("[data-i]:not([tabindex]), [data-idx]:not([tabindex])").forEach(el => {
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      if (!el.getAttribute("aria-label")) {
        const t = el.querySelector("h2, .dest-titulo");
        if (t) el.setAttribute("aria-label", t.textContent.trim());
      }
    });
  }
  hacerEnfocables(document);
  const obsEnfocables = new MutationObserver(() => hacerEnfocables(document));
  obsEnfocables.observe(document.getElementById("app"), { childList: true, subtree: true });

  // Enter o Espacio abren la ficha cuando la tarjeta misma tiene el foco
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (!t.matches || !t.matches("[data-i][tabindex], [data-idx][tabindex]")) return;
    e.preventDefault();
    t.click();
  });

  // 2. Foco al abrir la ficha y regreso al elemento anterior al cerrar
  const modal = document.getElementById("modal");
  let elementoPrevio = null;
  new MutationObserver(() => {
    if (modal.classList.contains("abierto")) {
      if (!elementoPrevio) {
        elementoPrevio = document.activeElement;
        const cerrar = document.getElementById("cerrarModal");
        if (cerrar) cerrar.focus({ preventScroll: true });
      }
    } else if (elementoPrevio) {
      const previo = elementoPrevio;
      elementoPrevio = null;
      if (previo && previo.isConnected && previo.focus) previo.focus({ preventScroll: true });
    }
  }).observe(modal, { attributes: true, attributeFilter: ["class"] });

  // 3. Foco visible en controles del encabezado y barra inferior (ya cubierto por CSS global; aquí se asegura el aria-pressed del segmentado)
  document.querySelectorAll("#tabbar button").forEach(b => {
    b.setAttribute("aria-label", b.textContent.trim());
    b.setAttribute("aria-current", b.classList.contains("activa") ? "page" : "false");
  });
  new MutationObserver(() => {
    document.querySelectorAll("#tabbar button").forEach(b => {
      b.setAttribute("aria-current", b.classList.contains("activa") ? "page" : "false");
    });
  }).observe(document.getElementById("tabbar"), { attributes: true, subtree: true, attributeFilter: ["class"] });
})();

/* --- bloque 8 --- */
(function () {
  // Tarjeta de sugerencia: tocarla abre la ficha
  document.addEventListener("click", e => {
    const card = e.target.closest("#ahoraCaja .ahora-card");
    if (!card || e.target.closest("button")) return;
    const b = document.getElementById("ahoraVer");
    if (b) b.click();
  });

  // Descartadas ahora está en el menú ⋯
  document.addEventListener("click", e => {
    if (!e.target.closest || !e.target.closest("#verDescartadas")) return;
    cerrarPaneles();
    cambiarPestana("descartadas");
  });

  // Si la última pestaña guardada era Descartadas, vuelve al catálogo
  window.addEventListener("load", () => {
    if (pestana === "descartadas") cambiarPestana("catalogo");
  });
})();

/* --- bloque 9 --- */
(function () {
  // El título de la sugerencia cambia según la hora del día
  function tituloSegunHora() {
    const h = new Date().getHours();
    const t = h >= 19 || h < 5 ? "Para esta noche" : h < 12 ? "Para esta mañana" : "Para esta tarde";
    const el = document.getElementById("tituloAhora");
    if (el && el.textContent !== t) el.textContent = t;
  }
  tituloSegunHora();
  setInterval(tituloSegunHora, 60000);
})();

/* --- bloque 10 --- */
(function () {
  // ---------- Estado visible de la copia en Drive ----------
  function textoEstadoRespaldo() {
    let fecha = null, lunes = null;
    try { fecha = localStorage.getItem("respaldo_drive_fecha"); lunes = localStorage.getItem("respaldo_semana"); } catch (e) {}
    if (!fecha && !lunes) return { texto: "Aún no hay copia en tu Drive. Se crea sola cuando tengas marcas.", alerta: true };
    if (!fecha) return { texto: "Copia semanal activa (semana del " + lunes + "). Se conservan las últimas 4.", alerta: false };
    const d = new Date(fecha);
    const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
    const cuando = dias <= 0 ? "hoy" : dias === 1 ? "ayer" : "hace " + dias + " días";
    const dia = d.toLocaleDateString("es-MX", { day: "numeric", month: "long" });
    return {
      texto: "Última copia en tu Drive: " + cuando + " (" + dia + "). Se conservan las últimas 4." + (dias > 8 ? " Hace más de una semana; revisa tu conexión." : ""),
      alerta: dias > 8
    };
  }

  function mostrarEstadoRespaldo() {
    const el = document.getElementById("estadoRespaldo");
    if (!el) return;
    const r = textoEstadoRespaldo();
    el.textContent = r.texto;
    el.classList.toggle("alerta-respaldo", r.alerta);
  }

  // ---------- 2. Respaldo semanal de marcas en tu Drive (se conservan 4) ----------
  async function respaldoSemanal() {
    if (!accessToken || !idMarcas || !Object.keys(marcas).length) return;
    const lunes = inicioSemanaISO(hoyLocalISO());
    if (modoGuardado("respaldo_semana", "") === lunes) return;
    try {
      const nombre = "respaldo-marcas-" + lunes + ".json";
      const frontera = "respaldo_frontera";
      const meta = JSON.stringify({ name: nombre, parents: ["appDataFolder"] });
      const cuerpo = JSON.stringify(marcas);
      const partes = "--" + frontera + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta +
        "\r\n--" + frontera + "\r\nContent-Type: application/json\r\n\r\n" + cuerpo + "\r\n--" + frontera + "--";
      await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + frontera },
        body: partes
      });
      const q = encodeURIComponent("name contains 'respaldo-marcas-'");
      const orden = encodeURIComponent("name desc");
      const r = await driveFetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=" + q + "&orderBy=" + orden + "&fields=files(id,name)");
      const j = await r.json();
      for (const f of (j.files || []).slice(4)) {
        await driveFetch("https://www.googleapis.com/drive/v3/files/" + f.id, { method: "DELETE" });
      }
      try { localStorage.setItem("respaldo_semana", lunes); localStorage.setItem("respaldo_drive_fecha", new Date().toISOString()); } catch (e) {}
      mostrarEstadoRespaldo();
    } catch (e) {}
  }

  // ---------- 3. Limpieza de avisos y datos viejos (cada minuto) ----------
  function mantener() {
    const hoy = hoyLocalISO();
    guardarJSON("recordatorio_cerrados", leerJSON("recordatorio_cerrados", []).filter(k => k.endsWith("|" + hoy)));
    if (!peliculas.length || pestana !== "catalogo") return;
    renderAvisoEstancados();
    actualizarAvisoFecha();
  }

  // ---------- 4. Recordar dónde te quedaste ----------
  const CLAVE_SESION = "ultima_sesion";
  const CAMPOS = ["estado", "tipo", "genero", "tema", "anio", "pais", "duracion"];

  function guardarSesion() {
    if (!peliculas.length) return;
    const datos = { y: window.scrollY, buscar: buscar.value, orden: $("orden").value };
    CAMPOS.forEach(k => { datos[k] = sel[k].value; });
    guardarJSON(CLAVE_SESION, datos);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") guardarSesion(); });
  window.addEventListener("pagehide", guardarSesion);

  function restaurarSesion() {
    if (new URLSearchParams(location.search).get("id")) return;
    const s = leerJSON(CLAVE_SESION, null);
    if (!s) return;
    buscar.value = s.buscar || "";
    $("orden").value = s.orden || "titulo";
    CAMPOS.forEach(k => { sel[k].value = s[k] || ""; });
    // Con filtros activos, la portada se oculta: muestra la lista para que se vean los resultados
    if (hayFiltros()) { zonaPeli = "lista"; aplicarEstadoTabs(); }
    sel.estado.dispatchEvent(new Event("input"));
    // Siempre se empieza arriba, en el menú principal
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  // Cuando la hoja ya cargó: restaura la sesión y revisa el respaldo una vez
  const espera = setInterval(() => {
    if (!peliculas.length || $("app").style.display !== "block") return;
    clearInterval(espera);
    restaurarSesion();
    respaldoSemanal();
    mostrarEstadoRespaldo();
  }, 300);

  setInterval(mantener, 60000);
  setInterval(respaldoSemanal, 600000);
})();

/* --- bloque 11 --- */
