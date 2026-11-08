/* --- bloque 14 --- */
/* Pinta la parte llena de cada deslizador */
document.querySelectorAll("input[type=range]").forEach(r => {
  const pintar = () => r.style.setProperty("--pct", ((r.value - r.min) / (r.max - r.min) * 100) + "%");
  r.addEventListener("input", pintar);
  pintar();
});

/* --- bloque 15 --- */
/* El menú ⋯ se saca del encabezado para que flote sobre la barra inferior */
(function () {
  const menu = document.getElementById("panelMas");
  if (menu) document.body.appendChild(menu);
  const tab = document.getElementById("tabMas");
  if (tab) tab.addEventListener("click", () => {
    if (typeof alternarPanel === "function") alternarPanel("panelMas");
  });
})();

/* --- bloque 16 --- */
/* El orbe se coloca justo en el centro de la barra, encima de su hueco */
(function () {
  const slot = document.getElementById("tabEstela");
  const orbe = document.getElementById("chatAbrir");
  if (!slot || !orbe) return;
  const colocar = () => {
    const r = slot.getBoundingClientRect();
    if (!r.width) return;
    const t = 58;
    orbe.style.left = (r.left + (r.width - t) / 2) + "px"; orbe.style.setProperty("left", (r.left + (r.width - t) / 2) + "px", "important");
    orbe.style.top = (r.top + (r.height - t) / 2) + "px"; orbe.style.setProperty("top", (r.top + (r.height - t) / 2) + "px", "important");
  };
  colocar();
  window.addEventListener("resize", colocar);
  if (window.ResizeObserver) new ResizeObserver(colocar).observe(slot);
  new MutationObserver(colocar).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", colocar);
})();

/* --- bloque 17 --- */
(function(){
  const mas = document.getElementById("panelMas");
  const av = document.getElementById("panelAvanzados");
  if (mas && av) { while (mas.firstChild) av.appendChild(mas.firstChild); }
})();

/* --- bloque 18 --- */
document.addEventListener("DOMContentLoaded", () => {
  const re = /^(\p{Extended_Pictographic}\uFE0F?)\s*/u;
  document.querySelectorAll("#panelMas button.pildora, #panelMas .pildora").forEach(b => {
    if (b.querySelector(".ico")) return;
    const m = b.textContent.match(re);
    if (!m) return;
    const resto = b.textContent.slice(m[0].length);
    b.textContent = "";
    const ico = document.createElement("span");
    ico.className = "ico"; ico.setAttribute("aria-hidden", "true"); ico.textContent = m[1];
    b.appendChild(ico);
    b.appendChild(document.createTextNode(resto));
  });
});

/* --- bloque 19 --- */
(function () {
  // Brillo que sigue al dedo o al cursor
  document.addEventListener("pointermove", e => {
    const el = e.target.closest && e.target.closest(".pildora, #tabbar button, .explorar-item, .explorar-tile, .actor-card, .tarjeta");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (e.clientX - r.left) + "px");
    el.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });
  document.addEventListener("pointerdown", e => {
    const el = e.target.closest && e.target.closest(".pildora, #tabbar button, .explorar-item, .explorar-tile, .actor-card, .tarjeta");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (e.clientX - r.left) + "px");
    el.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });

  // Indicador deslizante de la barra inferior: se estira como una gota al ir a otra pestaña y al regresar
  const barra = document.getElementById("tabbar");
  if (!barra) return;
  const ind = document.createElement("span");
  ind.className = "lg-indicador";
  barra.insertBefore(ind, barra.firstChild);
  let ultimo = null;
  const medir = b => ({ x: b.offsetLeft, w: b.offsetWidth });
  const colocar = (animar) => {
    const act = barra.querySelector("button.activa");
    if (!act || !act.offsetWidth) { ind.style.width = "0px"; ultimo = null; return; }
    const a = medir(act);
    ind.style.left = a.x + "px";
    ind.style.width = a.w + "px";
    if (false && animar && ultimo && (ultimo.x !== a.x || ultimo.w !== a.w) && ind.animate) {
      const de = ultimo;
      const izq = Math.min(de.x, a.x);
      const ancho = Math.abs(a.x - de.x) + Math.min(de.w, a.w);
      ind.animate([
        { left: de.x + "px", width: de.w + "px", offset: 0 },
        { left: izq + "px", width: ancho + "px", offset: 0.55 },
        { left: a.x + "px", width: a.w + "px", offset: 1 }
      ], { duration: 560, easing: "cubic-bezier(.22,.9,.3,1)" });
    }
    ultimo = a;
  };
  new MutationObserver(() => colocar(true)).observe(barra, { attributes: true, subtree: true, attributeFilter: ["class"] });
  if (window.ResizeObserver) new ResizeObserver(() => colocar(false)).observe(barra);
  window.addEventListener("resize", () => colocar(false));
  // Cuando la barra aparece (al entrar), se coloca sin animar
  new MutationObserver(() => { if (document.body.classList.contains("con-sesion")) setTimeout(() => colocar(false), 60); })
    .observe(document.body, { attributes: true, attributeFilter: ["class"] });
  colocar(false);
})();

/* --- bloque 20 --- */
// Ligeras primero, después las intensas y al final las tranquilas
function intensidadMaraton(p) {
  const g = String(p.genero || "").toLowerCase();
  if (/animaci|familia|comedia|aventura/.test(g)) return 1;
  if (/terror|suspenso|crimen|accion|acción|thriller/.test(g)) return 3;
  return 2;
}

function horaTexto(d) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// Arma la noche (sin pintar nada): la usan la ventana del maratón y el chat
function planearNoche(minutosPedidos, tema, dir) {
  let base = pendientesNoVistas();
  let aviso = "";
  if (!base.length) {
    base = peliculas.filter(p => !estadoDe(p).vista && !(marcas[p.titulo] || {}).descartada);
    aviso = "No tienes pendientes, así que armo con películas que no has visto.";
  }
  base = base.filter(p => {
    const g = String(p.genero || "");
    if (tema === "terror") return /terror|suspenso/i.test(g);
    if (tema === "animacion") return /animaci/i.test(g);
    if (tema === "comedia") return /comedia/i.test(g);
    if (tema === "director") return !!dir && String(p.director || "").toLowerCase().includes(dir.toLowerCase());
    return true;
  });
  if (!base.length) return { error: tema === "libre" ? "No tienes películas sin ver en tu catálogo. Agrega algunas o marca pendientes." : "Ya no te quedan películas sin ver de ese tema. ¿Probamos con otro género?" };
  const pool = base.map(p => ({ p, m: minutos(p) })).filter(x => x.m > 0);
  if (!pool.length) return { error: "Ninguna de estas películas tiene duración escrita. Revisa la columna «duracion» de la hoja, por ejemplo «1 h 45 min»." };

  const GAP = 10, MAX = 5;
  const { elegidas, total: usados } = armarLista({ pool, minutosMax: minutosPedidos, maximo: MAX, separacion: GAP });
  if (!elegidas.length) return { error: "Ninguna película cabe en " + minutosPedidos + " minutos. ¿Le subimos un poco al tiempo?" };
  const grupo = n => elegidas.filter(x => intensidadMaraton(x.p) === n);
  const secuencia = [...grupo(1), ...grupo(3), ...grupo(2)];
  return { aviso, elegidas, secuencia, usados, sobra: minutosPedidos - usados, GAP };
}

/* --- bloque 21 --- */
/* Coloca la pastilla sobre la opción activa de cada selector y de la barra inferior */
(function () {
  function asegurar(cont) {
    if (!cont.querySelector(":scope > .indicador")) {
      const ind = document.createElement("span");
      ind.className = "indicador";
      cont.insertBefore(ind, cont.firstChild);
    }
    return cont.querySelector(":scope > .indicador");
  }
  function mover(cont) {
    const ind = asegurar(cont);
    const act = cont.querySelector(".activa");
    if (!act || !act.offsetWidth) { ind.style.opacity = 0; return; }
    ind.style.opacity = 1;
    ind.style.width = act.offsetWidth + "px";
    ind.style.height = act.offsetHeight + "px";
    ind.style.transform = "translate(" + act.offsetLeft + "px," + act.offsetTop + "px)";
  }
  function todos() {
    document.querySelectorAll(".segmentado, #tabbar").forEach(mover);
  }
  todos();
  window.addEventListener("resize", todos);
  // Solo se recalcula cuando cambia algo: clases (cambio de pestaña) o tamaño
  new MutationObserver(todos).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  if (window.ResizeObserver) new ResizeObserver(todos).observe(document.body);
})();

/* --- bloque 22 --- */
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

/* --- bloque 23 --- */
