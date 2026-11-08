/* ---------- Automático y autónomo ---------- */

/* 1) Filtros: se guardan al cambiarlos y se restauran al entrar (sin botón) */
const FILTROS_AUTO = "filtros_ultimos";
function guardarFiltrosAuto() {
  try {
    const v = { orden: $("orden").value };
    Object.entries(sel).forEach(([k, el]) => { v[k] = el.value; });
    localStorage.setItem(FILTROS_AUTO, JSON.stringify(v));
  } catch (e) {}
}
function restaurarFiltrosAuto() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(FILTROS_AUTO) || "null"); } catch (e) {}
  if (!v) return;
  const aplicar = (el, valor) => {
    if (el && valor !== undefined && el.value !== valor && [...el.options].some(o => o.value === valor)) {
      el.value = valor;
      el.dispatchEvent(new Event("change"));
    }
  };
  Object.entries(sel).forEach(([k, el]) => aplicar(el, v[k]));
  aplicar($("orden"), v.orden);
}
document.addEventListener("change", e => {
  if (e.target === $("orden") || Object.values(sel).includes(e.target)) guardarFiltrosAuto();
});

/* 2) Estado de la copia: visible en Ajustes, sin buscarlo */
function tiempoHace(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return "hace " + m + " min";
  const h = Math.round(m / 60);
  if (h < 24) return "hace " + h + " h";
  const d = Math.round(h / 24);
  return "hace " + d + " día" + (d === 1 ? "" : "s");
}
function actualizarCopiaEstado() {
  const el = $("copiaEstado");
  if (!el) return;
  let t = Number(leerLS("copia_marcas_fecha") || 0);
  try {
    const c = JSON.parse(localStorage.getItem("catalogo_hoja_cache") || "null");
    if (c && c.fecha) t = Math.max(t, Date.parse(c.fecha) || 0);
  } catch (e) {}
  el.textContent = t ? "Última copia: " + tiempoHace(Date.now() - t) : "Aún no hay copias en este navegador.";
}
if (typeof syncTodo === "function") {
  const syncOriginal = syncTodo;
  syncTodo = async function () {
    const r = await syncOriginal.apply(this, arguments);
    try {
      if (accessToken && syncContarPendientes() === 0) escribirLS("copia_marcas_fecha", String(Date.now()));
    } catch (e) {}
    actualizarCopiaEstado();
    return r;
  };
}
actualizarCopiaEstado();
setInterval(actualizarCopiaEstado, 60000);

/* 3) Pendientes viejos: más de 60 días en la lista */
function pendientesViejos() {
  const limite = Date.now() - 60 * 86400000;
  return Nucleo.datos.peliculas().filter(p => {
    const m = Nucleo.datos.marcas()[p.titulo] || {};
    if (!m.pendiente || m.vista || !m.pendienteDesde) return false;
    return Date.parse(m.pendienteDesde) < limite;
  }).map(p => p.titulo);
}

/* 4) Hoy se actualiza solo cuando cambia la hora */
setInterval(() => { if (typeof renderHoy === "function") renderHoy(); }, 600000);

/* 5) Paletas: se guardan solas después de que la cuenta dueña lo confirme con el botón */
let ultimoEstadoTexto = "";
if (typeof setEstado === "function") {
  const setEstadoOriginal = setEstado;
  setEstado = function (m) { ultimoEstadoTexto = String(m || ""); return setEstadoOriginal.apply(this, arguments); };
}
$("guardarPaletas").addEventListener("click", () => {
  const inicio = Date.now();
  const t = setInterval(() => {
    if (Date.now() - inicio > 90000) { clearInterval(t); return; }
    if (/Calculando/i.test(ultimoEstadoTexto)) return;
    clearInterval(t);
    if (ultimoEstadoTexto && !/dueña|No pude/i.test(ultimoEstadoTexto)) escribirLS("paletas_duena", "1");
  }, 700);
});
function paletasAutomaticas() {
  if (leerLS("paletas_duena") !== "1" || typeof guardarPaletasEnHoja !== "function") return;
  if (Nucleo.datos.peliculas().some(p => p.portada && !paletaDeTexto(p[NOMBRE_PALETA]).length)) guardarPaletasEnHoja();
}

/* Memoria de gustos: ajuste visible */
const selGustos = $("gustos-memoria");
selGustos.value = leerLS("gustos_memoria") === "no" ? "no" : "si";
selGustos.addEventListener("change", () => escribirLS("gustos_memoria", selGustos.value));

/* Arranque: cuando el catálogo ya cargó */
const esperaAuto = setInterval(() => {
  if (typeof peliculas === "undefined" || !Nucleo.datos.peliculas().length) return;
  clearInterval(esperaAuto);
  setTimeout(() => { restaurarFiltrosAuto(); paletasAutomaticas(); }, 800);
}, 500);

/* --- bloque 24 --- */
/* --- bloque 24 (el modelo local se movió a app-08c-modelo-local.js) --- */
/* --- bloque 26 (la descarga automática se movió a app-08d-descarga-modelo.js) --- */
