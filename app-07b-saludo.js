/* ===== Fase 0 · Módulo «saludo» (bloque 22): saludo personal y saludo en voz alta. Migrado sin cambios de comportamiento. ===== */
/* ---------- Saludo personal: bienvenida cálida al entrar ---------- */
const SALUDO_NOMBRE = "nombre_usuario";
const SALUDO_VISITA = "ultima_visita";
const SALUDO_OMITIDO = "nombre_omitido";
const SALUDO_MODO = "saludo_modo";
let saludoSnap = null;
let saludoCerrado = false;

function leerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function escribirLS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function quitarLS(k) { try { localStorage.removeItem(k); } catch (e) {} }

function nombreGuardado() {
  const v = (leerLS(SALUDO_NOMBRE) || "").trim();
  return v || null;
}

function plural(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }

function calcularSaludo() {
  const ultima = Number(leerLS(SALUDO_VISITA) || 0);
  const dias = ultima ? Math.floor((Date.now() - ultima) / 86400000) : null;
  const pend = pendientesNoVistas().length;
  const planes = recordatoriosActivos().length;
  return { dias: dias, pend: pend, planes: planes, viejos: pendientesViejos(), reto: retoActual() };
}

function consejoSaludo(d) {
  const ahora = new Date();
  const h = ahora.getHours();
  const dia = ahora.getDay();
  const cand = [];
  if (dia === 0 || dia === 6) cand.push("Es fin de semana: buen momento para una maratón.");
  if (dia === 5) cand.push("Viernes: ¿qué te vas a ver esta noche?");
  if (dia === 1) cand.push("Empieza la semana con algo ligero.");
  if (h < 12) cand.push("Una película corta para empezar bien el día.");
  if (h >= 21) cand.push("Ya es tarde: algo tranquilo estaría bien.");
  if (d.pend > 0) cand.push("¿Te saco una al azar de tus pendientes?");
  if (window.seriesApi) {
    const S = window.seriesApi;
    const enCurso = S.lista().filter(s => { const pr = S.progreso(s); return pr.vistos > 0 && pr.siguiente; });
    if (enCurso.length) cand.push("Tienes " + plural(enCurso.length, "serie", "series") + " a medias. ¿Por dónde vamos?");
  }
  if (!cand.length) return "";
  const ultimo = leerLS("saludo_consejo_ultimo");
  const opciones = cand.filter(c => c !== ultimo);
  const elegido = (opciones.length ? opciones : cand)[Math.floor(Math.random() * (opciones.length || cand.length))];
  escribirLS("saludo_consejo_ultimo", elegido);
  return elegido;
}

function textoSaludo(d) {
  const n = nombreGuardado();
  const nom = n ? ", " + esc(n) : "";
  const h = new Date().getHours();
  const icono = h < 12 ? "☀️" : h < 19 ? "🌤️" : "🌙";
  const franja = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  let titulo, linea;
  if (d.dias === null) {
    titulo = icono + " " + (n ? "Qué bueno que llegaste, " + esc(n) + "." : "Qué bueno que llegaste.");
    linea = "Aquí guardas lo que viste, lo que quieres ver y lo que te gustó. Empieza marcando una película, o pregúntame qué ver.";
  } else if (d.dias === 0) {
    titulo = icono + " " + franja + nom + ". Qué bueno verte otra vez.";
    linea = d.pend ? "Te esperan " + plural(d.pend, "pendiente", "pendientes") + " cuando quieras." : "Aún no tienes pendientes. ¿Qué te apetece agregar?";
  } else if (d.dias <= 2) {
    titulo = icono + " Qué gusto tenerte de vuelta" + nom + ".";
    linea = d.pend ? "Tienes " + plural(d.pend, "pendiente", "pendientes") + " por ver." : "Cuando quieras, te ayudo a elegir algo.";
  } else {
    titulo = icono + " Te extrañé" + nom + ". Hace " + d.dias + " días que no entrabas.";
    linea = d.pend ? "Tienes " + plural(d.pend, "pendiente", "pendientes") + " esperándote." : "Hay películas nuevas por descubrir. ¿Buscamos algo?";
  }
  const extras = [];
  if (d.consejo) extras.push("💬 " + esc(d.consejo));
  if (d.planes) extras.push("📅 Tienes " + plural(d.planes, "plan", "planes") + " con alguien en los próximos días.");
  if (d.viejos && d.viejos.length) extras.push("📌 " + plural(d.viejos.length, "pendiente lleva", "pendientes llevan") + " más de 2 meses esperando, como «" + esc(d.viejos[0]) + "».");
  extras.push("🏆 " + esc(d.reto.texto));
  return { titulo: titulo, linea: linea, extras: extras, tieneNombre: !!n };
}

function renderSaludoPersonal() {
  const sec = $("saludoPersonal");
  if (!sec || !document.body.classList.contains("con-sesion")) return;
  if (!saludoSnap) {
    saludoSnap = calcularSaludo();
    escribirLS(SALUDO_VISITA, String(Date.now()));
    if (!nombreGuardado() && !leerLS(SALUDO_OMITIDO)) abrirNombre(false);
  }
  const modo = leerLS(SALUDO_MODO) || "si";
  if (modo === "no" || saludoCerrado) { sec.style.display = "none"; return; }
  const frescos = calcularSaludo();
  saludoSnap.pend = frescos.pend;
  saludoSnap.planes = frescos.planes;
  saludoSnap.viejos = frescos.viejos;
  saludoSnap.reto = frescos.reto;
  saludoSnap.consejo = consejoSaludo(saludoSnap);
  const t = textoSaludo(saludoSnap);
  sec.innerHTML =
    '<button type="button" class="saludo-cerrar" data-accion="cerrar" aria-label="Cerrar saludo">×</button>' +
    '<h2 class="saludo-titulo">' + t.titulo + '</h2>' +
    '<p class="saludo-linea">' + t.linea + '</p>' +
    t.extras.map(x => '<p class="saludo-meta">' + x + '</p>').join("") +
    '<div class="saludo-acciones"><button type="button" class="pildora" data-accion="escuchar">🔊 Escuchar</button>' +
    '<button type="button" class="pildora" data-accion="sorpresa">🎲 Sorpréndeme</button>' +
    '<button type="button" class="pildora" data-accion="platicar">💬 Platicar</button>' +
    (window.seriesApi ? '<button type="button" class="pildora" data-accion="series">📺 Series</button>' : '') +
    '</div>';
  sec.style.display = "block";
  if (speechSynthesis && speechSynthesis.speaking) marcarHablando(true);
  if (!saludoHablo) { saludoHablo = true; setTimeout(hablarSaludo, 500); }
}

function abrirNombre(editar) {
  detenerSaludo();
  const input = $("nombreInput");
  input.value = nombreGuardado() || "";
  $("nombreError").textContent = "";
  $("nombreTitulo").textContent = editar ? "¿Cómo te llamo?" : "Qué bueno tenerte aquí";
  $("nombreFondo").classList.add("visible");
  $("nombreModal").classList.add("visible");
  setTimeout(() => input.focus(), 60);
}

function cerrarNombre() {
  $("nombreFondo").classList.remove("visible");
  $("nombreModal").classList.remove("visible");
}

function guardarNombre() {
  let val = $("nombreInput").value.trim().replace(/\s+/g, " ");
  if (!val) { $("nombreError").textContent = "Escribe cómo te gustaría que te llamara."; return; }
  if (!/^[\p{L}][\p{L} .'-]{0,23}$/u.test(val)) {
    $("nombreError").textContent = "Usa solo letras, por ejemplo tu nombre o un apodo corto.";
    return;
  }
  val = val.charAt(0).toUpperCase() + val.slice(1);
  escribirLS(SALUDO_NOMBRE, val);
  quitarLS(SALUDO_OMITIDO);
  cerrarNombre();
  renderSaludoPersonal();
}

function omitirNombre() {
  escribirLS(SALUDO_OMITIDO, "1");
  cerrarNombre();
  renderSaludoPersonal();
}

$("nombreGuardar").addEventListener("click", guardarNombre);
$("nombreOmitir").addEventListener("click", omitirNombre);
$("nombreFondo").addEventListener("click", omitirNombre);
$("nombreInput").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); guardarNombre(); } });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("nombreModal").classList.contains("visible")) omitirNombre();
});

$("saludoPersonal").addEventListener("click", e => {
  const b = e.target.closest("[data-accion]");
  if (!b) return;
  if (b.dataset.accion === "cerrar") { saludoCerrado = true; renderSaludoPersonal(); }
  if (b.dataset.accion === "escuchar") {
    if ($("saludoPersonal").classList.contains("hablando")) detenerSaludo(); else hablarSaludo();
  }
  if (b.dataset.accion === "sorpresa") {
    const pend = peliculas.filter(p => (marcas[p.titulo] || {}).pendiente && !(marcas[p.titulo] || {}).vista);
    if (pend.length) abrirDetalle(pend[Math.floor(Math.random() * pend.length)]);
  }
  if (b.dataset.accion === "platicar") { const c = document.getElementById("chatAbrir"); if (c) c.click(); }
  if (b.dataset.accion === "series") { const s = document.getElementById("verSeries"); if (s) s.click(); }
});

const selSaludo = $("saludo-modo");
selSaludo.value = leerLS(SALUDO_MODO) || "si";
selSaludo.addEventListener("change", () => {
  escribirLS(SALUDO_MODO, selSaludo.value);
  saludoCerrado = false;
  renderSaludoPersonal();
});

/* ---------- Saludo en voz alta (voz del navegador, sin conexión a datos del catálogo) ---------- */
let saludoHablo = false;
let saludoVozTimer = null;

function vozSaludoActiva() {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
  if ((leerLS("saludo_voz") || "si") === "no") return false;
  if (leerLS("chat_voz") === "0") return false;
  return true;
}

// ── Voz: una sola selección para el chat y el saludo, con y sin internet ──
// Sin internet (o si la voz de red falla) usa solo voces del propio dispositivo.
function elegirVozEsp(localSolo = false) {
  const todas = speechSynthesis.getVoices();
  const vs = todas.filter(v => /^es/i.test(v.lang));
  if (!vs.length) return null;
  const sinRed = localSolo || navigator.onLine === false;
  let cand = sinRed ? vs.filter(v => v.localService) : vs;
  if (!cand.length && sinRed) cand = todas.filter(v => v.localService);
  if (!cand.length) cand = vs;
  const calidad = /natural|neural|online|premium|enhanced|google|mejorad|plus/i;
  const puntos = v => (/^es[-_]MX/i.test(v.lang) ? 4 : 0) + (calidad.test(v.name) ? 3 : 0) + (!sinRed && !v.localService ? 2 : 0);
  return cand.slice().sort((a, b) => puntos(b) - puntos(a))[0];
}

function hablarTrozos(trozos, opc = {}) {
  const { desde = 0, localSolo = false, velocidad = 1, alInicio = null, alFinal = null, alError = null } = opc;
  const voz = elegirVozEsp(localSolo);
  let reiniciado = false;
  trozos.slice(desde).forEach((trozo, i) => {
    const k = desde + i;
    const u = new SpeechSynthesisUtterance(trozo);
    u.lang = voz ? voz.lang : "es-MX";
    if (voz) u.voice = voz;
    u.rate = velocidad;
    u.pitch = 1.0;
    if (k === 0 && alInicio) u.onstart = alInicio;
    if (k === trozos.length - 1 && alFinal) u.onend = alFinal;
    u.onerror = e => {
      const red = /network|synthesis|unavailable|unsupported/i.test((e && e.error) || "");
      if (!red) return;
      if (!localSolo && !reiniciado) {
        // La voz de red falló (p. ej. sin internet): repite desde este trozo con voz local
        reiniciado = true;
        speechSynthesis.cancel();
        hablarTrozos(trozos, { ...opc, desde: k, localSolo: true });
      } else if (alError) alError();
    };
    speechSynthesis.speak(u);
  });
}

function vozEspanola() {
  return elegirVozEsp();
}

function textoParaVoz() {
  const sec = $("saludoPersonal");
  return [...sec.querySelectorAll(".saludo-titulo, .saludo-linea, .saludo-meta")]
    .map(el => el.textContent.trim()).filter(Boolean).join(". ")
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, "")
    .replace(/·/g, ",").replace(/\s+/g, " ").replace(/\.\s*\./g, ".").trim();
}

function marcarHablando(on) {
  const sec = $("saludoPersonal");
  if (!sec) return;
  sec.classList.toggle("hablando", on);
  const b = sec.querySelector('[data-accion="escuchar"]');
  if (b) b.textContent = on ? "⏹ Detener" : "🔊 Escuchar";
}

function detenerSaludo() {
  if (saludoVozTimer) { clearTimeout(saludoVozTimer); saludoVozTimer = null; }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  marcarHablando(false);
}

function hablarSaludo(intento = 0) {
  if (!vozSaludoActiva() || !$("saludoPersonal")) return;
  const texto = textoParaVoz();
  if (!texto) return;
  if (!speechSynthesis.getVoices().length && intento === 0) {
    esperarVoces().then(() => hablarSaludo(1));
    return;
  }
  detenerSaludo();
  hablarTrozos(trocearParaVoz(texto), {
    velocidad: 1.0,
    alInicio: () => { if (saludoVozTimer) { clearTimeout(saludoVozTimer); saludoVozTimer = null; } marcarHablando(true); mantenerVoz(); },
    alFinal: () => marcarHablando(false),
    alError: () => marcarHablando(false)
  });
  // Si el navegador bloquea la voz sin un toque previo, se intenta una sola vez en el primer toque
  saludoVozTimer = setTimeout(() => {
    saludoVozTimer = null;
    if (!speechSynthesis.speaking) {
      marcarHablando(false);
      document.addEventListener("pointerdown", () => { if (!speechSynthesis.speaking) hablarSaludo(1); }, { once: true });
    }
  }, 1500);
}

$("cambiarNombreBtn").addEventListener("click", () => abrirNombre(true));

const selVoz = $("saludo-voz");
selVoz.value = leerLS("saludo_voz") || "si";
selVoz.addEventListener("change", () => {
  escribirLS("saludo_voz", selVoz.value);
  if (selVoz.value === "no") detenerSaludo();
});

if (window.Nucleo) { Nucleo.registrar("saludo", { version: "1.0", emite: [], escucha: [] }); }
