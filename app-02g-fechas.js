/* ===== Fase 0 · Módulo «fechas»: fechas de tus películas (vistas, calificaciones, estrenos). Migrado de app-02 sin cambios de comportamiento. ===== */
/* ---------- Fechas ---------- */
function fechaValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function diasHasta(s) {
  const [y, m, d] = s.split("-").map(Number);
  const obj = Date.UTC(y, m - 1, d);
  const hoy = new Date();
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((obj - hoyUTC) / 86400000);
}

function lineaFechaConAlguien(p) {
  const m = Nucleo.datos.marcas()[p.titulo] || {};
  if (!m.conFecha) return '<div class="meta" style="margin-top:6px">📅 Sin fecha</div>';
  const d = diasHasta(m.conFecha);
  const cuando = d === 0 ? "hoy" : d === 1 ? "mañana" : d < 0 ? "pasó hace " + (-d) + " días" : "en " + d + " días";
  return '<div class="meta" style="margin-top:6px">📅 ' + esc(m.conFecha) + ' · ' + cuando + '</div>';
}

// Recordatorio: planes con alguien hoy, mañana o pasado mañana. "×" lo oculta por hoy.
function recordatoriosActivos() {
  const hoy = hoyLocalISO();
  const cerrados = leerJSON("recordatorio_cerrados", []);
  const salida = [];
  Nucleo.datos.peliculas().forEach(p => {
    const m = Nucleo.datos.marcas()[p.titulo] || {};
    if (!m.conAlguien || !m.conFecha) return;
    const d = diasHasta(m.conFecha);
    if (d < 0 || d > 2) return;
    if (cerrados.includes(p.titulo + "|" + m.conFecha + "|" + hoy)) return;
    salida.push({ p, m, d });
  });
  return salida;
}

function actualizarAvisoFecha() {
  const aviso = $("avisoFecha");
  if (hayFiltros() || pestana !== "catalogo") {
    aviso.style.display = "none";
    return;
  }
  const items = recordatoriosActivos();
  if (!items.length) {
    aviso.style.display = "none";
    return;
  }
  const etiquetas = ["Hoy", "Mañana", "Pasado mañana"];
  const lineas = [0, 1, 2]
    .map(d => ({ d, nombres: items.filter(x => x.d === d).map(x => x.p.titulo + (x.m.conQuien ? " con " + x.m.conQuien : "")) }))
    .filter(g => g.nombres.length)
    .map(g => etiquetas[g.d] + ": " + g.nombres.join(" · "));
  $("avisoFechaTexto").innerHTML = lineas.map(esc).join("<br>");
  aviso.style.display = "block";
}

function cerrarRecordatorio() {
  const hoy = hoyLocalISO();
  const previos = leerJSON("recordatorio_cerrados", []).filter(k => k.endsWith("|" + hoy));
  const nuevos = recordatoriosActivos().map(({ p, m }) => p.titulo + "|" + m.conFecha + "|" + hoy);
  guardarJSON("recordatorio_cerrados", previos.concat(nuevos));
  actualizarAvisoFecha();
}

function diasPendiente(p) {
  const f = (Nucleo.datos.marcas()[p.titulo] || {}).pendienteDesde;
  if (!f) return null;
  const ms = Date.now() - new Date(f + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function diasConAlguien(p) {
  const f = (Nucleo.datos.marcas()[p.titulo] || {}).conAlguienDesde;
  if (!f) return null;
  const ms = Date.now() - new Date(f + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function diasDescartada(p) {
  const f = (Nucleo.datos.marcas()[p.titulo] || {}).descartadaDesde;
  if (!f) return null;
  const ms = Date.now() - new Date(f + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function controlesHtml(p) {
  const s = estadoDe(p);
  const k = esc(p.titulo);
  let estrellas = "";
  for (let n = 1; n <= 5; n++) {
    estrellas += '<button class="estrella' + (n <= s.estrellas ? ' on' : '') + '" data-accion="estrella" data-clave="' + k + '" data-n="' + n + '" aria-label="Calificar con ' + n + (n === 1 ? ' estrella' : ' estrellas') + '">★</button>';
  }
  const dias = s.pendiente ? diasPendiente(p) : null;
  let textoDias = "";
  if (dias !== null) {
    textoDias = '<span class="meta" style="margin:0">' + (dias === 0 ? 'desde hoy' : 'hace ' + dias + (dias === 1 ? ' día' : ' días')) + '</span>';
  } else if (s.pendiente) {
    textoDias = '<span class="meta" style="margin:0">fecha desconocida</span>';
  }
  const descartada = !!(Nucleo.datos.marcas()[p.titulo] || {}).descartada;
  const botonRestaurar = descartada
    ? ' <button class="chipc" data-accion="restaurar" data-clave="' + k + '">↩ Restaurar</button>'
    : '';
  const quien = (Nucleo.datos.marcas()[p.titulo] || {}).conQuien;
  const etiquetaAlguien = s.conAlguien
    ? '👥 Con alguien' + (quien ? ' · ' + esc(quien) : '')
    : '👥 Con alguien';
  const fechaPlan = (Nucleo.datos.marcas()[p.titulo] || {}).conFecha;
  const botonFecha = s.conAlguien
    ? '<button class="chipc' + (fechaPlan ? ' activo' : '') + '" data-accion="conFecha" data-clave="' + k + '">📅 ' + (fechaPlan ? esc(fechaPlan) : 'Fecha') + '</button>'
    : '';
  return '<div class="controles">' +
    '<button class="chipc' + (s.vista ? ' activo' : '') + '" data-accion="vista" data-clave="' + k + '">' + (s.vista ? '✓ Vista' : 'Marcar vista') + '</button>' +
    '<button class="chipc' + (s.pendiente ? ' activo' : '') + '" data-accion="pendiente" data-clave="' + k + '">' + (s.pendiente ? '⏳ En pendientes' : 'Pendiente') + '</button>' +
    '<button class="chipc' + (s.conAlguien ? ' activo' : '') + '" data-accion="conAlguien" data-clave="' + k + '">' + etiquetaAlguien + '</button>' +
    botonFecha +
    textoDias +
    botonRestaurar +
    '<span class="estrellas">' + estrellas + '</span></div>';
}

function contarEstados() {
  let vistas = 0, pendientes = 0;
  Nucleo.datos.peliculas().forEach(p => {
    const s = estadoDe(p);
    if (s.vista) vistas++;
    if (s.pendiente) pendientes++;
  });
  return { vistas, pendientes };
}

if (window.Nucleo) { Nucleo.registrar("fechas", { version: "1.0", emite: [], escucha: [] }); }
