/* ===== Fase 0 · Módulo «tema»: clima solar, modo oscuro, vista cálida y ubicación =====
   Migrado de app-03 sin cambiar el comportamiento. Mantiene los mismos nombres globales.
   Emite «tema:cambiado» al cambiar el modo. Se registra en el núcleo (app-00-nucleo.js). */
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

// El módulo se puede apagar desde Ajustes (modulo_tema = "no")
function temaActivo() { return !window.Nucleo || Nucleo.activo("tema"); }

// Con el módulo apagado, sus opciones avanzadas se deshabilitan y el selector muestra la opción simple.
// No se borra lo guardado: al volver a encender el módulo, se recupera la elección anterior.
const OPCIONES_AVANZADAS_TEMA = ["sol", "hora", "premiere"];

function aplicarControlesTema() {
  const selTema = $("tema-modo"), selVista = $("vista-modo");
  if (!selTema || !selVista) return;
  const on = temaActivo();
  OPCIONES_AVANZADAS_TEMA.forEach(v => {
    const o = selTema.querySelector('option[value="' + v + '"]');
    if (o) o.disabled = !on;
  });
  selVista.disabled = !on;

  let tema = modoGuardado("tema_modo", "sistema");
  if (!on && OPCIONES_AVANZADAS_TEMA.includes(tema)) tema = "sistema";
  if (selTema.value !== tema) selTema.value = tema;

  const vista = on ? modoGuardado("vista_modo", "apagada") : "apagada";
  if (selVista.value !== vista) selVista.value = vista;
}

function actualizarTema() {
  aplicarControlesTema();
  if (!temaActivo()) {
    // Módulo apagado: el tema solo sigue al sistema, sin premiere ni horario
    document.body.classList.toggle("oscuro", oscuroDelSistema());
    document.body.classList.remove("premiere");
    return;
  }
  const modo = $("tema-modo").value;
  const oscuro = decidirOscuro(modo);
  document.body.classList.toggle("oscuro", oscuro);
  document.body.classList.toggle("premiere", modo === "premiere");
  if (window.Nucleo) Nucleo.emit("tema:cambiado", { modo: modo, oscuro: oscuro });
}

function intensidadPorSol() {
  const alt = alturaSol(new Date(), ubicacion.lat, ubicacion.lon);
  const t = (4 - alt) / 10;
  return Math.max(0, Math.min(1, t));
}

const INTENSIDAD_MAXIMA = 0.28;

function actualizarCalido() {
  if (!temaActivo()) { $("calido").style.opacity = "0"; return; }
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
  if (!temaActivo() || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      ubicacion = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      actualizarTodo();
    },
    () => {},
    { timeout: 8000, maximumAge: 86400000 }
  );
}


if (window.Nucleo) {
  Nucleo.registrar("tema", { version: "1.0", emite: ["tema:cambiado"], escucha: [] });

  // Interruptor de Ajustes
  const interruptor = document.getElementById("moduloTemaOn");
  if (interruptor) {
    interruptor.checked = temaActivo();
    interruptor.addEventListener("change", () => Nucleo.activar("tema", interruptor.checked));
  }

  // Al encender o apagar, se aplica de inmediato. Este listener no depende del módulo, para que siga activo al volver a encenderlo.
  Nucleo.on("modulo:cambiado", d => {
    if (!d || d.nombre !== "tema") return;
    actualizarTodo();
    if (d.activo) pedirUbicacion();
  });
}
