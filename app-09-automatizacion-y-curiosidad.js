/* ---------- Automatización de la experiencia (etapa 4) ---------- */
let tarjetaMostradaSesion = false;

// Fecha actual; para probar, guarda una fecha en el navegador: localStorage.setItem("fecha_prueba", "2026-11-09")
function fechaAuto() {
  const p = leerLS("fecha_prueba");
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) { const [y, m, d] = p.split("-").map(Number); return new Date(y, m - 1, d, 12); }
  return new Date();
}
function isoAuto(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function semanaAuto(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const n = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + "-S" + String(n).padStart(2, "0");
}
function lunesAuto(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() || 7) - 1));
  return x;
}
function interruptorAuto(clave) { return leerLS(clave) !== "no"; }
function sugeridasRecientes() {
  try { return JSON.parse(leerLS("auto_sugeridas") || "[]"); } catch (e) { return []; }
}

function candidataSaga(hoy) {
  const mk = t => marcas[t] || {};
  const empezadas = new Set(peliculas
    .filter(p => mk(p.titulo).vista && String(p.saga || "").trim() && String(p.saga).trim() !== "-")
    .map(p => String(p.saga).trim()));
  const ahora = hoy.getTime();
  const p = peliculas.find(x => {
    const s = String(x.saga || "").trim();
    if (!s || s === "-" || !empezadas.has(s)) return false;
    const m = mk(x.titulo);
    if (m.vista || m.descartada || leerLS("auto_saga_" + x.titulo) === "1") return false;
    const f = Date.parse(String(x.estreno || "").slice(0, 10));
    if (!f) return false;
    const dias = (f - ahora) / 86400000;
    return dias >= -14 && dias <= 30;
  });
  if (!p) return null;
  const f = String(p.estreno).slice(0, 10);
  return {
    clave: "auto_saga_" + p.titulo, tipo: "Saga",
    titulo: "Se estrena algo de «" + p.saga + "»",
    texto: "«" + p.titulo + "» " + (f > isoAuto(hoy) ? "llega el " + f : "se estrenó el " + f) + ". Ya empezaste esta saga."
  };
}

function candidataFinde(hoy) {
  const dia = hoy.getDay();
  if (dia !== 5 && dia !== 6 && dia !== 0) return null;
  const clave = "auto_finde_" + semanaAuto(hoy);
  if (leerLS(clave) === "1") return null;
  const mk = t => marcas[t] || {};
  const recientes = new Set(sugeridasRecientes().filter(x => Date.now() - x.f < 7 * 86400000).map(x => x.t));
  const pool = peliculas.filter(p => {
    const m = mk(p.titulo);
    const min = minutos(p);
    return m.pendiente && !m.vista && !m.descartada && min > 0 && min <= 120 && !recientes.has(p.titulo);
  });
  if (!pool.length) return null;
  const elegida = pool[Math.floor(Math.random() * pool.length)];
  let texto = "Para esta noche: «" + elegida.titulo + "» (" + minutos(elegida) + " min).";
  const resto = pool.filter(p => p !== elegida).sort(() => Math.random() - 0.5);
  let total = minutos(elegida);
  const maraton = [elegida];
  for (const p of resto) {
    if (maraton.length >= 3) break;
    if (total + minutos(p) <= 240) { maraton.push(p); total += minutos(p); }
  }
  if (maraton.length >= 2) texto += " Si quieres maratón: " + maraton.map(p => "«" + p.titulo + "»").join(" + ") + " (" + total + " min en total).";
  const guardar = JSON.parse(leerLS("auto_sugeridas") || "[]").concat(maraton.map(p => ({ t: p.titulo, f: Date.now() })));
  escribirLS("auto_sugeridas", JSON.stringify(guardar.slice(-30)));
  return { clave: clave, tipo: "Fin de semana", titulo: "Para este fin de semana", texto: texto };
}

function candidataLunes(hoy) {
  const clave = "auto_lunes_" + semanaAuto(hoy);
  if (leerLS(clave) === "1") return null;
  const mk = t => marcas[t] || {};
  const inicioSem = lunesAuto(hoy);
  const inicioAnt = new Date(inicioSem); inicioAnt.setDate(inicioAnt.getDate() - 7);
  const finAnt = new Date(inicioSem); finAnt.setDate(finAnt.getDate() - 1);
  const a = isoAuto(inicioAnt), b = isoAuto(finAnt);
  const vistas = peliculas.filter(p => { const d = String(mk(p.titulo).vistaDesde || ""); return mk(p.titulo).vista && d >= a && d <= b; }).length;
  const pend = peliculas.filter(p => mk(p.titulo).pendiente && !mk(p.titulo).vista && !mk(p.titulo).descartada).length;
  const reto = retoActual();
  const planes = recordatoriosActivos().length;
  let texto = vistas
    ? "La semana pasada viste " + vistas + " película" + (vistas === 1 ? "" : "s") + ". Te quedan " + pend + " pendiente" + (pend === 1 ? "" : "s") + "."
    : "Semana tranquila. ¿Retomamos algún pendiente?";
  texto += " 🏆 " + reto.texto + ".";
  if (planes) texto += " Tienes " + planes + " plan" + (planes === 1 ? "" : "es") + " con alguien en los próximos días.";
  return { clave: clave, tipo: "Resumen", titulo: "Tu semana", texto: texto };
}

function renderTarjetaAuto() {
  const sec = $("tarjetaAuto");
  if (!sec || tarjetaMostradaSesion || !document.body.classList.contains("con-sesion") || !peliculas.length) return;
  const hoy = fechaAuto();
  const opciones = [
    { on: "auto-lunes", fn: () => candidataLunes(hoy) },
    { on: "auto-viernes", fn: () => candidataFinde(hoy) },
    { on: "auto-sagas", fn: () => candidataSaga(hoy) }
  ];
  // Prioridad: saga, fin de semana, resumen. Una tarjeta por entrada.
  const orden = [opciones[2], opciones[1], opciones[0]];
  for (const o of orden) {
    const clave = o.on === "auto-sagas" ? "auto_sagas" : o.on === "auto-viernes" ? "auto_viernes" : "auto_lunes";
    if (leerLS(clave) === "no") continue;
    const c = o.fn();
    if (!c) continue;
    if (c.clave.indexOf("auto_lunes_") === 0 || c.clave.indexOf("auto_finde_") === 0) escribirLS(c.clave, "1");
    if (c.clave.indexOf("auto_saga_") === 0) escribirLS(c.clave, "1");
    sec.innerHTML =
      '<button type="button" class="saludo-cerrar" data-accion="cerrar-auto" aria-label="Cerrar">×</button>' +
      '<h2>' + esc(c.titulo) + '</h2><p>' + esc(c.texto) + '</p>';
    sec.style.display = "block";
    tarjetaMostradaSesion = true;
    return;
  }
}

$("tarjetaAuto").addEventListener("click", e => {
  if (e.target.closest("[data-accion='cerrar-auto']")) {
    $("tarjetaAuto").style.display = "none";
  }
});
setTimeout(renderTarjetaAuto, 15000);



/* ---------- Curiosidad con botón: se movió a app-09b-curiosidad-boton.js ---------- */
