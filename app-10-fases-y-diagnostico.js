/* ===== Fase 4: práctica ===== */

// 1) Dato para decidir: se muestra dentro de la ficha, con datos reales de la película
function datoParaDecidir(p) {
  const out = [];
  const min = minutos(p);
  if (min) {
    if (min >= 150) out.push("Dura " + min + " minutos: buena para una noche larga.");
    else if (min <= 100) out.push("Dura " + min + " minutos: cabe en una noche entre semana.");
    else out.push("Dura " + min + " minutos: cabe en una noche normal.");
  }
  const tono = intensidadDe_(p);
  if (tono === 1) out.push("Tono ligero, para relajarte.");
  if (tono === 3) out.push("Tono intenso: mejor con tiempo para asimilarla.");
  const m = marcas[p.titulo] || {};
  if (m.vista && m.estrellas) out.push("Ya la calificaste con " + m.estrellas + " estrella" + (m.estrellas === 1 ? "" : "s") + ".");
  return out;
}

(function datoEnFicha() {
  const detalle = document.getElementById("detalle");
  if (!detalle) return;
  new MutationObserver(() => {
    const h2 = detalle.querySelector("h2");
    if (!h2 || detalle.querySelector(".dato-decidir")) return;
    const titulo = h2.textContent.trim();
    const p = peliculas.find(x => x.titulo === titulo);
    if (!p) return;
    const lineas = datoParaDecidir(p);
    if (!lineas.length) return;
    const div = document.createElement("div");
    div.className = "dato-decidir";
    div.innerHTML = '<strong>Para decidir</strong>' + lineas.map(l => '<span>' + esc(l) + '</span>').join('');
    h2.insertAdjacentElement("afterend", div);
  }).observe(detalle, { childList: true });
})();

// 2) Tarjeta del día en Inicio: una curiosidad distinta cada día, elegida por el orden adaptativo
function renderTarjetaDia() {
  const sec = document.getElementById("tarjetaDia");
  if (!sec || !document.body.classList.contains("con-sesion") || !peliculas.length) return;
  const lista = curioFiltrada();
  if (!lista.length) { sec.style.display = "none"; return; }
  const dia = Math.floor(Date.now() / 86400000);
  const c = lista[dia % lista.length];
  sec.innerHTML =
    '<p class="tarjeta-dia-etiqueta">Curiosidad de hoy</p>' +
    '<p class="tarjeta-dia-texto">' + esc(c.texto) + '</p>' +
    '<p class="meta">' + esc(c.peli ? c.peli.titulo : "") + (c.fuente ? ' · Fuente: ' + esc(c.fuente) : '') + '</p>' +
    '<div class="saludo-acciones"><button type="button" class="pildora" data-accion="ver-curio">Ver curiosidades</button></div>';
  sec.style.display = "block";
}

(function tarjetaDiaEventos() {
  const sec = document.getElementById("tarjetaDia");
  if (!sec) return;
  sec.addEventListener("click", e => {
    if (e.target.closest("[data-accion='ver-curio']")) abrirCuriosidad();
  });
  setTimeout(renderTarjetaDia, 2500);
  setInterval(renderTarjetaDia, 10 * 60 * 1000);
})();

/* ===== Fase 5: datos de internet (solo los verificados) ===== */
let curiosidadesInternet = [];
const DATOS_CACHE_KEY = "datos_internet_cache";

function construirCuriosidadesInternet(copia) {
  const filas = (copia.values || []);
  if (filas.length < 2) return [];
  const enc = filas[0];
  const c = n => enc.indexOf(n);
  return filas.slice(1)
    .map(r => ({ tmdb: r[c("tmdb_id")], titulo: r[c("titulo")], dato: r[c("dato")], fuente: r[c("fuente")], url: r[c("url")], fecha: r[c("fecha_consulta")], estado: r[c("estado")], tipo: r[c("tipo")] }))
    .filter(x => x.estado === "verificado" && x.dato)
    .map(x => {
      const peli = peliculas.find(p => String(p.tmdb_id || "").trim() === String(x.tmdb).trim());
      return peli ? {
        peli: peli,
        tema: "Internet · " + (x.tipo || "Dato"),
        texto: x.dato,
        fuente: x.fuente + " · consultado " + x.fecha + " · " + x.url
      } : null;
    })
    .filter(Boolean);
}

async function cargarDatosInternet() {
  if (!accessToken || !navigator.onLine || !HOJA_ID) { usarCacheInternet(); return; }
  try {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${HOJA_ID}/values/datos_internet!A:H`,
      { headers: { Authorization: "Bearer " + accessToken } });
    if (!r.ok) { usarCacheInternet(); return; }
    const copia = await r.json();
    localStorage.setItem(DATOS_CACHE_KEY, JSON.stringify(copia));
    curiosidadesInternet = construirCuriosidadesInternet(copia);
  } catch (e) { usarCacheInternet(); }
}

function usarCacheInternet() {
  try {
    const c = JSON.parse(localStorage.getItem(DATOS_CACHE_KEY) || "null");
    if (c) curiosidadesInternet = construirCuriosidadesInternet(c);
  } catch (e) {}
}

setTimeout(() => { if (document.body.classList.contains("con-sesion")) cargarDatosInternet(); else usarCacheInternet(); }, 9000);

/* ===== Fase 6: madurez y autonomía ===== */
const CURIO_REPORTES_KEY = "curio_reportes";
const CURIO_CUARENTENA = 2;   // con 2 reportes, la curiosidad sale de la lista hasta que cambie su dato

function curioReportes() {
  try { return JSON.parse(leerLS(CURIO_REPORTES_KEY) || "{}"); } catch (e) { return {}; }
}

function curioReportar(c) {
  const r = curioReportes();
  const k = claveCurio(c);
  r[k] = (r[k] || 0) + 1;
  escribirLS(CURIO_REPORTES_KEY, JSON.stringify(r));
}

// Autocorrección: una curiosidad solo se muestra si está completa, tiene fuente cuando la necesita y no está en cuarentena
function curioEstaSana(c) {
  if (!c || !c.peli || !c.peli.titulo || !String(c.texto || "").trim()) return false;
  if (/internet/i.test(String(c.tema || "")) && !/^https?:\/\//.test(String(c.fuente || "").split(" · ").pop() || "")) return false;
  return (curioReportes()[claveCurio(c)] || 0) < CURIO_CUARENTENA;
}

// Autodiagnóstico: una línea con el estado real de la función
function curioDiagnostico() {
  const todas = todasLasCuriosidades().concat(curiosidadesInternet);
  const sanas = todas.filter(curioEstaSana).length;
  const enRevision = todas.filter(c => (curioReportes()[claveCurio(c)] || 0) >= CURIO_CUARENTENA).length;
  const internet = curiosidadesInternet.filter(curioEstaSana).length;
  return sanas + " curiosidades listas · " + internet + " de internet verificadas" +
    (enRevision ? " · " + enRevision + " en revisión" : "");
}

// Pruebas automáticas al cargar: si algo falla, se registra y no se muestra la parte afectada
(function pruebasCuriosidad() {
  setTimeout(() => {
    if (!document.body.classList.contains("con-sesion")) return;
    const todas = todasLasCuriosidades().concat(curiosidadesInternet);
    const fallos = todas.filter(c => !c || !c.peli || !String(c.texto || "").trim());
    if (fallos.length) console.warn("Curiosidades: " + fallos.length + " entradas incompletas omitidas.");
    const sinSpoiler = todas.filter(c => esSpoiler(c.texto)).length;
    if (sinSpoiler) console.info("Curiosidades: " + sinSpoiler + " con posible spoiler, ocultas hasta «Revelar».");
  }, 12000);
})();

/* ---------- Inicio adaptativo: el orden de los bloques depende de tu uso real ---------- */
(function () {
  const bloque = document.getElementById("inicioBloques");
  if (!bloque) return;
  const base = {
    avisoFecha: 0, avisoEstancados: 0,
    saludoPersonal: 1,
    hoy: 2, queVer: 3,
    recomendaciones: 4, estaSemana: 5, pregunta: 6, bienvenida: 7,
    tarjetaAuto: 8, tarjetaDia: 9
  };
  function ordenarInicio() {
    const c = contarEstados();
    const pref = Object.assign({}, base);
    if (c.pendientes > 0) { pref.hoy = 1; pref.queVer = 2; }          // con pendientes: primero qué ver
    if (c.vistas >= 5) pref.recomendaciones = 3;                       // con historial: recomendaciones arriba
    if (c.vistas === 0 && c.pendientes === 0) {                        // cuenta nueva: bienvenida primero
      pref.saludoPersonal = 0; pref.bienvenida = 1;
    }
    Array.from(bloque.children).forEach(el => {
      const v = String(pref[el.id] !== undefined ? pref[el.id] : 20);
      if (el.style.order !== v) el.style.order = v;                   // solo escribe si cambia: sin bucles
    });
  }
  let turno = 0;
  const programar = () => { cancelAnimationFrame(turno); turno = requestAnimationFrame(ordenarInicio); };
  new MutationObserver(programar).observe(bloque, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"]
  });
  ordenarInicio();
})();

/* ---------- Diagnóstico de datos: revisa tu cuenta y su estado, con respaldo de un toque ---------- */
function abrirDiagnostico() {
  cerrarPaneles();
  const claves = new Set(peliculas.map(p => claveDe(p)));
  const enMarcas = Object.keys(marcas).filter(k => !k.startsWith("__"));
  const huerfanas = enMarcas.filter(k => !claves.has(k));
  const conMarcas = enMarcas.filter(k => claves.has(k)).length;
  const porTitulo = {};
  peliculas.forEach(p => { porTitulo[p.titulo] = (porTitulo[p.titulo] || 0) + 1; });
  const repetidos = Object.keys(porTitulo).filter(t => porTitulo[t] > 1);
  const sinId = peliculas.filter(p => !/^\d+$/.test(String(p.tmdb_id || "").trim())).length;
  const kb = (new Blob([JSON.stringify(marcas)]).size / 1024).toFixed(1) + " KB";
  const fmt = iso => { if (!iso) return "todavía no"; const d = new Date(iso); return isNaN(d) ? "desconocida" : d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }); };
  let copiaSemanal = null;
  try { copiaSemanal = localStorage.getItem("respaldo_drive_fecha"); } catch (e) {}
  const enLinea = navigator.onLine !== false;

  const filas = [
    { t: "Películas en tu hoja", v: String(peliculas.length), ok: true },
    { t: "Películas con marcas", v: String(conMarcas), ok: true },
    { t: "Tamaño de tus marcas", v: kb, ok: true },
    { t: "Último guardado en Drive", v: fmt(ultimaSyncOk), ok: !!ultimaSyncOk && !syncPendiente },
    { t: "Cambios sin subir", v: syncPendiente ? "sí" : "no", ok: !syncPendiente },
    { t: "Último respaldo semanal", v: copiaSemanal ? fmt(copiaSemanal) : "todavía no", ok: !!copiaSemanal },
    { t: "Conexión", v: enLinea ? "en línea" : "sin señal", ok: enLinea },
    { t: "Marcas sin película en la hoja", v: String(huerfanas.length), ok: huerfanas.length === 0,
      nota: "Son marcas de películas que ya no están en tu hoja. No afectan lo que ves." },
    { t: "Títulos repetidos en la hoja", v: String(repetidos.length), ok: repetidos.length === 0,
      nota: "Dos películas con el mismo título comparten marcas. Dales un tmdb_id distinto en la hoja." },
    { t: "Películas sin tmdb_id", v: String(sinId), ok: sinId === 0,
      nota: "Se identifican por el título. Si lo cambias en la hoja, sus marcas no lo siguen." }
  ];
  const lista = filas.map(f =>
    '<li><span>' + (f.ok ? '<b class="dg-ok">✓</b> ' : '<b class="dg-warn">⚠</b> ') + esc(f.t) +
    (f.nota ? '<small class="dg-nota">' + esc(f.nota) + '</small>' : '') + '</span><b>' + esc(f.v) + '</b></li>'
  ).join("");
  const cuerpo = '<ul class="dg-lista">' + lista + '</ul>' +
    '<button type="button" class="pildora destacado" data-respaldo>⬇ Respaldar ahora</button>';
  abrirVentanaSimple("diagnostico", "Diagnóstico de datos", cuerpo);
  const btn = document.querySelector("#diagnostico [data-respaldo]");
  if (btn) btn.addEventListener("click", () => respaldarMarcas());
}
document.getElementById("diagnosticoDatos").addEventListener("click", abrirDiagnostico);

