/* ===== Fase 0 · Módulo «herramientas»: ventana simple, cápsula del año, modo pareja, reto del mes, diario, perfil de gustos y avisos ===== */
/* Migrado de app-05 sin cambiar el comportamiento. Mantiene los mismos nombres globales.
   Se registra en el núcleo (app-00-nucleo.js). Aún sin interruptor en Ajustes. */
/* ---------- Ventana sencilla reutilizable ---------- */
function abrirVentanaSimple(id, titulo, cuerpo) {
  const previa = document.getElementById(id);
  if (previa) previa.remove();
  const div = document.createElement("div");
  div.id = id;
  div.className = "ayuda-atajos";
  div.innerHTML = '<div class="ayuda-caja ventana-larga" role="dialog" aria-label="' + esc(titulo) + '">' +
    '<button type="button" class="dlg-x" data-cerrar aria-label="Cerrar">×</button>' +
    '<h3>' + esc(titulo) + '</h3>' + cuerpo + '</div>';
  div.addEventListener("click", e => { if (e.target === div || e.target.hasAttribute("data-cerrar")) div.remove(); });
  document.body.appendChild(div);
}

/* ---------- Cápsula del año ---------- */
function vistasDelAno(ano) {
  return peliculas.filter(p => ((marcas[p.titulo] || {}).historial || [])
    .some(h => h.a === "vista" && String(h.f).startsWith(ano)));
}

function abrirCapsulaAno() {
  const ano = String(new Date().getFullYear());
  const vistas = vistasDelAno(ano);
  if (!vistas.length) {
    abrirVentanaSimple("capsulaAno", "Cápsula " + ano,
      '<p class="meta">Aún no marcas películas como vistas este año. Cuando lo hagas, aquí verás tu resumen.</p>');
    return;
  }
  const est = p => (marcas[p.titulo] || {}).estrellas || 0;
  const top = vistas.slice().sort((a, b) => est(b) - est(a)).slice(0, 5);
  const genero = {};
  vistas.forEach(p => String(p.genero || "").split(/[,\/]/).map(x => x.trim()).filter(Boolean)
    .forEach(g => genero[g] = (genero[g] || 0) + 1));
  const generos = Object.entries(genero).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).join(", ") || "sin datos";
  const calificadas = vistas.filter(p => est(p) > 0);
  const promedio = calificadas.length
    ? (calificadas.reduce((s, p) => s + est(p), 0) / calificadas.length).toFixed(1) : "—";
  const cuerpo =
    '<div class="capsula-stats">' +
    '<div><b>' + vistas.length + '</b><span>vistas</span></div>' +
    '<div><b>' + promedio + '★</b><span>promedio</span></div>' +
    '<div><b>' + esc(generos) + '</b><span>géneros favoritos</span></div></div>' +
    '<h4>Tus favoritas del año</h4><ol>' +
    top.map(p => '<li>' + esc(p.titulo) + (est(p) ? ' · ' + est(p) + '★' : '') + '</li>').join('') + '</ol>';
  abrirVentanaSimple("capsulaAno", "Cápsula " + ano, cuerpo);
}

/* ---------- Modo pareja: elegir de «Para ver con alguien» ---------- */
function modoPareja() {
  if (window.Nucleo && !Nucleo.activo("herramientas")) return false; // interruptor de Ajustes
  try { return localStorage.getItem("modo_pareja") === "1"; } catch (e) { return false; }
}

function alternarModoPareja() {
  const activo = !modoPareja();
  try { localStorage.setItem("modo_pareja", activo ? "1" : "0"); } catch (e) {}
  $("parejaBtn").textContent = activo ? "💑 Modo pareja: activo" : "💑 Modo pareja";
  $("parejaBtn").classList.toggle("destacado", activo);
  setEstado(activo ? "Modo pareja activo: el aleatorio elige entre «Para ver con alguien»." : "Modo pareja desactivado.");
}

function sugerirParaDos() {
  const pool = peliculas.filter(p => (marcas[p.titulo] || {}).conAlguien && !(marcas[p.titulo] || {}).vista);
  if (!pool.length) {
    setEstado("Aún no tienen películas para ver juntos. Marca «Para ver con alguien» en una pendiente.");
    return;
  }
  abrirDetalle(pool[Math.floor(Math.random() * pool.length)]);
}

/* ---------- Reto del mes ---------- */
const RETOS_MES = [
  { texto: "Ve 3 películas este mes", meta: 3, cuenta: vs => vs.length },
  { texto: "Ve una película de un país distinto a Estados Unidos", meta: 1,
    cuenta: vs => vs.filter(p => !/estados unidos|eeuu|ee\. ?uu|usa/i.test(String(p.pais || ""))).length },
  { texto: "Ve una película anterior a 1980", meta: 1,
    cuenta: vs => vs.filter(p => Number(p["año"]) < 1980).length },
  { texto: "Ve 2 películas que califiques con 4 o 5★", meta: 2,
    cuenta: vs => vs.filter(p => ((marcas[p.titulo] || {}).estrellas || 0) >= 4).length }
];

function renderRetoMes() {
  const sec = $("retoMes");
  const hoy = new Date();
  const mes = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0");
  const vistasMes = peliculas.filter(p => ((marcas[p.titulo] || {}).historial || [])
    .some(h => h.a === "vista" && String(h.f).startsWith(mes)));
  const reto = RETOS_MES[hoy.getMonth() % RETOS_MES.length];
  const hecho = Math.min(reto.cuenta(vistasMes), reto.meta);
  const listo = hecho >= reto.meta;
  sec.style.display = "block";
  sec.innerHTML = '<div class="reto-caja' + (listo ? ' listo' : '') + '">' +
    '<div class="reto-titulo">🏆 Reto del mes</div>' +
    '<div class="reto-texto">' + esc(reto.texto) + '</div>' +
    '<div class="reto-barra"><span style="width:' + Math.round(hecho / reto.meta * 100) + '%"></span></div>' +
    '<div class="meta">' + (listo ? '¡Reto cumplido este mes!' : hecho + " de " + reto.meta + " logrado") + '</div></div>';
}

/* ---------- Diario de cine ---------- */
function abrirDiario() {
  const entradas = [];
  peliculas.forEach(p => {
    const o = marcas[p.titulo] || {};
    if (!o.vista) return;
    const v = (o.historial || []).filter(h => h.a === "vista").slice(-1)[0];
    entradas.push({ p, o, f: v ? String(v.f) : "" });
  });
  entradas.sort((a, b) => (b.f || "0").localeCompare(a.f || "0"));
  if (!entradas.length) {
    abrirVentanaSimple("diarioCine", "Diario de cine",
      '<p class="meta">Tu diario se llena solo cuando marcas películas como vistas. Escribe una nota en cada una y aparecerá aquí.</p>');
    return;
  }
  let html = "", mesActual = "";
  entradas.slice(0, 200).forEach(e => {
    const mes = e.f ? e.f.slice(0, 7) : "Sin fecha";
    if (mes !== mesActual) { mesActual = mes; html += '<h4>' + esc(mes) + '</h4>'; }
    html += '<div class="diario-entrada"><b>' + esc(e.p.titulo) + '</b>' +
      (e.o.estrellas ? ' <span class="meta">' + e.o.estrellas + '★</span>' : '') +
      (e.f ? ' <span class="meta">· ' + esc(e.f) + '</span>' : '') +
      (e.o.nota ? '<p>' + esc(e.o.nota) + '</p>' : '') + '</div>';
  });
  abrirVentanaSimple("diarioCine", "Diario de cine", html);
}

/* ---------- Perfil de gustos para Estela (sale de tus marcas) ---------- */
function perfilGustos() {
  const gen = {}, dir = {}, neg = {};
  let pend = 0;
  peliculas.forEach(p => {
    const o = marcas[p.titulo] || {};
    const gs = String(p.genero || "").split(/[,\/]/).map(x => x.trim()).filter(Boolean);
    if (o.pendiente) pend++;
    if (o.vista && (o.estrellas || 0) >= 4) {
      gs.forEach(g => gen[g] = (gen[g] || 0) + 1);
      if (p.director) dir[p.director] = (dir[p.director] || 0) + 1;
    }
    if (o.descartada) gs.forEach(g => neg[g] = (neg[g] || 0) + 1);
  });
  const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).join(", ") || "sin datos";
  return "le gustan los géneros " + top(gen) + "; directores " + top(dir) +
    "; descarta " + top(neg) + "; tiene " + pend + " pendientes";
}

/* ---------- Avisos visibles (aparecen sobre la barra inferior) ---------- */
let toastTimer = null;
function avisar(msg) {
  setEstado(msg);
  let t = document.getElementById("toastApp");
  if (!t) {
    t = document.createElement("div");
    t.id = "toastApp";
    t.className = "toast-app";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("visible"), 4200);
}

if (window.Nucleo) {
  Nucleo.registrar("herramientas", { version: "1.0", emite: [], escucha: [] });
}

/* Interruptor de Ajustes (modulo_herramientas). Al apagarlo se ocultan la cápsula del año, el modo pareja
   (y su efecto), el diario de cine, el reto del mes y el perfil de gustos. La memoria de gustos de la IA
   es un ajuste aparte y no cambia. */
if (window.Nucleo) {
  const aplicarHerramientas = () => document.body.classList.toggle("sin-herramientas", !Nucleo.activo("herramientas"));
  const interruptorHerr = document.getElementById("moduloHerramientasOn");
  if (interruptorHerr) {
    interruptorHerr.checked = Nucleo.activo("herramientas");
    interruptorHerr.addEventListener("change", () => {
      Nucleo.activar("herramientas", interruptorHerr.checked);
      aplicarHerramientas();
    });
  }
  aplicarHerramientas();
}
