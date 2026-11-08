/* ===== Fase 0 · Módulo «listeners-pliegues» (lo que quedaba de app-02): listeners de etiquetas, bloques plegables y configuración que se aplica al arrancar. Se carga en la misma posición que app-02 para conservar el orden original. Migrado sin cambios de comportamiento. ===== */
/* ---------- Mis filtros guardados ---------- */
function leerPresets() { return Array.isArray(marcas.__filtros) ? marcas.__filtros : []; }

// Los filtros viven dentro de marcas.json (en tu Drive), bajo la clave reservada "__filtros"
function guardarListaPresets(lista) {
  marcas.__filtros = lista;
  programarGuardado();
}

function renderPresets() {
  const lista = leerPresets();
  $("presetsSel").innerHTML = '<option value="">Filtros guardados…</option>' +
    lista.map((x, i) => '<option value="' + i + '">' + esc(x.nombre) + '</option>').join("");
}

function guardarPreset() {
  const nombre = (prompt("Nombre para estos filtros:", "") || "").trim();
  if (!nombre) return;
  const valores = { buscar: buscar.value, orden: $("orden").value };
  Object.entries(sel).forEach(([k, el]) => { valores[k] = el.value; });
  const lista = leerPresets().filter(x => x.nombre !== nombre);
  lista.push({ nombre, valores });
  guardarListaPresets(lista);
  renderPresets();
  setEstado("Filtros guardados como «" + nombre + "».");
}

function aplicarPreset() {
  const i = $("presetsSel").value;
  if (i === "") return;
  const p = leerPresets()[Number(i)];
  if (!p) return;
  buscar.value = p.valores.buscar || "";
  $("orden").value = p.valores.orden || $("orden").value;
  Object.entries(sel).forEach(([k, el]) => { el.value = p.valores[k] || ""; });
  pintar();
}

function borrarPreset() {
  const i = $("presetsSel").value;
  if (i === "") return;
  const lista = leerPresets();
  const x = lista[Number(i)];
  if (!x) return;
  if (!confirm("¿Borrar «" + x.nombre + "»?")) return;
  lista.splice(Number(i), 1);
  guardarListaPresets(lista);
  renderPresets();
}

/* ---------- ¿Qué sigue? (desde una película vista) ---------- */
function siguienteHtml(p) {
  if (!estadoDe(p).vista) return "";
  const libre = x => x !== p && !estadoDe(x).vista && !(marcas[x.titulo] || {}).descartada;
  let cands = [], razon = "";
  if (p.saga && p.saga !== "-") {
    cands = peliculas.filter(x => libre(x) && x.saga === p.saga);
    if (cands.length) razon = "De la saga " + p.saga;
  }
  if (!cands.length) {
    const dirs = directoresDe(p);
    if (dirs.length) {
      cands = peliculas.filter(x => libre(x) && directoresDe(x).some(d => dirs.includes(d)));
      if (cands.length) razon = "Del mismo director";
    }
  }
  cands = cands.slice(0, 3);
  if (!cands.length) return "";
  return '<div class="siguiente"><b>¿Qué sigue?</b> <span class="meta">' + esc(razon) + '</span>' +
    '<div class="insignias" style="margin-top:6px">' +
      cands.map(x => '<button class="pildora" data-siguiente="' + esc(x.titulo) + '">' + esc(x.titulo) + '</button>').join("") +
    '</div></div>';
}

/* ---------- Historial de cambios de una película ---------- */
function historialHtml(p) {
  const h = (marcas[p.titulo] || {}).historial || [];
  if (!h.length) return "";
  return '<details class="historial"><summary>Historial (' + h.length + ')</summary><ul>' +
    h.slice().reverse().map(e => '<li>' + esc(e.f) + ' · ' + esc(e.a) + '</li>').join("") +
    '</ul></details>';
}

/* ---------- Orden de notas ---------- */
function ordenNotasFn() {
  const v = $("ordenNotas") ? $("ordenNotas").value : "fecha";
  const m = t => marcas[t] || {};
  const porFecha = (a, b) => String(m(b.titulo).notaFecha || "").localeCompare(String(m(a.titulo).notaFecha || ""));
  if (v === "titulo") return (a, b) => String(a.titulo).localeCompare(String(b.titulo), "es");
  if (v === "calif") return (a, b) => ((m(b.titulo).estrellas || 0) - (m(a.titulo).estrellas || 0)) || porFecha(a, b);
  return porFecha;
}

/* ---------- Actividad: racha, insignias y compartir recomendación ---------- */
function sumarDiasISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(y, m - 1, d + n);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

function inicioSemanaISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(y, m - 1, d);
  const dow = (x.getDay() + 6) % 7;
  return sumarDiasISO(iso, -dow);
}

function vistasConFecha() {
  return peliculas.filter(p => {
    const m = marcas[p.titulo] || {};
    return m.vista && typeof m.vistaDesde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.vistaDesde);
  });
}

function rachaSemanas() {
  const semanas = new Set(vistasConFecha().map(p => inicioSemanaISO((marcas[p.titulo] || {}).vistaDesde)));
  let cursor = inicioSemanaISO(hoyLocalISO());
  if (!semanas.has(cursor)) cursor = sumarDiasISO(cursor, -7);
  let racha = 0;
  while (semanas.has(cursor)) {
    racha++;
    cursor = sumarDiasISO(cursor, -7);
  }
  return racha;
}

function maxVistasEnUnMes() {
  const porMes = {};
  vistasConFecha().forEach(p => {
    const k = (marcas[p.titulo] || {}).vistaDesde.slice(0, 7);
    porMes[k] = (porMes[k] || 0) + 1;
  });
  return Math.max(0, ...Object.values(porMes));
}

function insigniasDeActividad() {
  const vistas = vistasConFecha().length;
  const totalVistas = peliculas.filter(p => estadoDe(p).vista).length;
  const racha = rachaSemanas();
  const mesMax = maxVistasEnUnMes();
  return [
    { t: "Primera vista", ok: totalVistas >= 1 },
    { t: "10 vistas", ok: totalVistas >= 10 },
    { t: "25 vistas", ok: totalVistas >= 25 },
    { t: "50 vistas", ok: totalVistas >= 50 },
    { t: "Racha de 3 semanas", ok: racha >= 3 },
    { t: "5 vistas en un mes", ok: mesMax >= 5 }
  ];
}

/* ---------- Racha de calificaciones: películas calificadas esta semana (lunes a hoy) ---------- */
// Usa el historial. Cada película cuenta una vez, con su última acción de la semana.
// Si la última acción fue quitar la calificación, no cuenta.
function calificacionesDeSemana() {
  const hoy = hoyLocalISO();
  const inicio = inicioSemanaISO(hoy);
  const salida = [];
  peliculas.forEach(p => {
    const h = (marcas[p.titulo] || {}).historial || [];
    const evs = h.filter(e => e.f >= inicio && e.f <= hoy &&
      (String(e.a).indexOf("calificada") === 0 || e.a === "sin calificación"));
    if (!evs.length) return;
    const ultimo = evs[evs.length - 1];
    if (ultimo.a === "sin calificación") return;
    salida.push({ p, estrellas: Number(String(ultimo.a).replace("calificada ", "").replace("★", "")) });
  });
  return salida;
}

function textoCalificaciones() {
  const cal = calificacionesDeSemana();
  if (!cal.length) return "Aún no calificas películas esta semana.";
  const n = cal.length;
  let texto = "Calificaste " + n + (n === 1 ? " película" : " películas") + " esta semana";
  if (n >= 3) {
    const prom = cal.reduce((a, x) => a + x.estrellas, 0) / n;
    texto += " · promedio " + prom.toFixed(1) + "★";
  }
  return texto + ".";
}

function renderActividad() {
  const sec = $("actividad");
  const hayFiltrosAct = hayFiltros();
  if (!peliculas.length || pestana !== "vistas") {
    sec.style.display = "none";
    return;
  }
  const racha = rachaSemanas();
  const insignias = insigniasDeActividad();
  const lineaCal = textoCalificaciones();
  sec.innerHTML =
    '<div class="actividad-card">' +
      '<h3>Tu actividad</h3>' +
      '<p class="racha">Racha: <b>' + racha + '</b> ' + (racha === 1 ? 'semana' : 'semanas') + ' seguidas con alguna vista</p>' +
      '<p class="meta">' + esc(lineaCal) + '</p>' +
      '<div class="insignias">' +
        insigniasDeActividad().map(i =>
          '<span class="insignia' + (i.ok ? '' : ' bloq') + '">' + (i.ok ? '🏅 ' : '🔒 ') + esc(i.t) + '</span>'
        ).join("") +
      '</div>' +
    '</div>';
  sec.style.display = "block";
}

function textoRecomendacion(r) {
  const f = r.desglose.find(d => d.puntos > 0);
  const fuente = f && f.fuentes && f.fuentes[0];
  const razon = r.razon || (f ? f.etiqueta : "");
  return "Te recomiendo «" + r.p.titulo + "»" +
    (razon ? " — " + razon : "") +
    (fuente ? ", que te gustó en " + fuente.titulo : "") + ".";
}

async function compartirRecomendacion() {
  const r = calcularRecomendaciones()[0];
  if (!r) { setEstado("Aún no hay recomendación para compartir."); return; }
  const texto = textoRecomendacion(r);
  if (navigator.share) {
    try { await navigator.share({ text: texto }); } catch (e) {}
    return;
  }
  try {
    await navigator.clipboard.writeText(texto);
    setEstado("Recomendación copiada.");
  } catch (e) {
    setEstado(texto);
  }
}

/* ---------- Recomendaciones según calificaciones: se movieron a app-02b-recomendaciones.js ---------- */

/* ---------- Paleta de 3 colores del póster: se movió a app-02c-paleta-poster.js ---------- */

/* ---------- Guardar paletas en la hoja (solo cuenta dueña) ---------- */
async function asegurarColumnaPaleta() {
  if (COL_PALETA !== -1) return;
  COL_PALETA = encabezados.length;
  encabezados.push(NOMBRE_PALETA);
  await sheetsFetch("values/" + letraColumna(COL_PALETA) + "1?valueInputOption=RAW", "PUT", {
    values: [[NOMBRE_PALETA]]
  });
}

async function guardarPaletasEnHoja() {
  const pendientes = peliculas.filter(p => !paletaDeTexto(p[NOMBRE_PALETA]).length && p.portada);
  if (!pendientes.length) {
    setEstado("Todas las portadas ya tienen paleta guardada.");
    return;
  }
  setEstado("Calculando paletas de " + pendientes.length + " películas...");
  const cambios = [];
  for (const p of pendientes) {
    const calc = await paletaDePoster(p.portada);
    if (calc.length) {
      p[NOMBRE_PALETA] = calc.map(rgbAHex).join(",");
      cambios.push(p);
    }
  }
  if (!cambios.length) {
    setEstado("No pude leer las portadas en este navegador.");
    return;
  }
  try {
    await asegurarColumnaPaleta();
    const data = cambios.map(p => ({
      range: letraColumna(COL_PALETA) + p._fila,
      values: [[p[NOMBRE_PALETA]]]
    }));
    await sheetsFetch("values:batchUpdate", "POST", { valueInputOption: "RAW", data: data });
    setEstado("Paletas guardadas en la hoja: " + cambios.length);
  } catch (e) {
    setEstado("No pude guardar en la hoja. Esta opción solo funciona con la cuenta dueña de la hoja.");
  }
}

/* ---------- Marcas personales en Drive: se movieron a app-02d-marcas-drive.js ---------- */

/* ---------- Respaldo y restauración de marcas: se movieron a app-02e-respaldo-marcas.js ---------- */

/* ---------- Etiquetas con #: las funciones se movieron a app-02f-etiquetas.js; los listeners quedan aquí ---------- */

document.addEventListener("change", e => {
  if (e.target.id === "notaTexto" && detalleActual) {
    guardarNota(detalleActual.titulo, e.target.value);
    const zona = $("etiquetasFicha");
    if (zona) zona.innerHTML = etiquetasFichaHtml(e.target.value);
    setEstado("Nota guardada");
  }
});

document.addEventListener("input", e => {
  if (e.target.id === "preguntaTexto") $("preguntaContador").textContent = e.target.value.length + "/500";
});

/* ---------- Bloques plegables (se recuerda cuáles están cerrados) ---------- */
const PLEGADAS_POR_DEFECTO = ["sagas", "actores", "mapaGustos"];

function leerPliegues() {
  const guardado = leerJSON("pliegues", null);
  if (guardado) return guardado;
  const o = {};
  PLEGADAS_POR_DEFECTO.forEach(id => { o[id] = true; });
  return o;
}

function aplicarPliegues() {
  const o = leerPliegues();
  document.querySelectorAll("section[id]").forEach(s => s.classList.toggle("plegado", s.id !== "sagas" && !!o[s.id]));
}

document.addEventListener("click", e => {
  const h = e.target.closest ? e.target.closest("section[id] h3") : null;
  if (!h) return;
  const s = h.closest("section[id]");
  if (s.id === "sagas") return;
  s.classList.toggle("plegado");
  const o = leerPliegues();
  o[s.id] = s.classList.contains("plegado");
  guardarJSON("pliegues", o);
});

aplicarPliegues();

document.addEventListener("click", e => {
  if (e.target.closest && e.target.closest("#toggleMas")) alternarPanel("panelMas");
});

vistaLista = modoGuardado("vista_tarjetas", "amplia") === "compacta";
document.body.classList.toggle("lista", vistaLista);
$("vista").textContent = vistaLista ? "Vista amplia" : "Vista compacta";

// Toque largo en celular: muestra las acciones rápidas de la tarjeta (se cierran al tocar fuera)
let suprimirClic = false;

function abrirRapida(card) {
  document.querySelectorAll(".rapida-abierta").forEach(x => x.classList.remove("rapida-abierta"));
  card.classList.add("rapida-abierta");
  if (navigator.vibrate) navigator.vibrate(15);
}

document.addEventListener("click", e => {
  if (!e.target.closest || !e.target.closest(".rapida-abierta")) {
    document.querySelectorAll(".rapida-abierta").forEach(x => x.classList.remove("rapida-abierta"));
  }
});

/* ---------- Fechas: se movieron a app-02g-fechas.js ---------- */

/* ---------- Estadísticas: se movieron a app-02a-estadisticas.js ---------- */

if (window.Nucleo) { Nucleo.registrar("listeners-pliegues", { version: "1.0", emite: [], escucha: [] }); }
