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
  return peliculas.filter(p => {
    const m = marcas[p.titulo] || {};
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
  if (peliculas.some(p => p.portada && !paletaDeTexto(p[NOMBRE_PALETA]).length)) guardarPaletasEnHoja();
}

/* Memoria de gustos: ajuste visible */
const selGustos = $("gustos-memoria");
selGustos.value = leerLS("gustos_memoria") === "no" ? "no" : "si";
selGustos.addEventListener("change", () => escribirLS("gustos_memoria", selGustos.value));

/* Arranque: cuando el catálogo ya cargó */
const esperaAuto = setInterval(() => {
  if (typeof peliculas === "undefined" || !peliculas.length) return;
  clearInterval(esperaAuto);
  setTimeout(() => { restaurarFiltrosAuto(); paletasAutomaticas(); }, 800);
}, 500);

/* --- bloque 24 --- */
/* ---------- Modelo local opcional: entiende frases libres sin internet (se descarga una sola vez) ---------- */
const MODELO_LOCAL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const MODELO_LOCAL_LIB = "https://esm.sh/@mlc-ai/web-llm@0.2.79";
let motorLocal = null;
let motorLocalCargando = null;

function resumenCatalogoParaModelo() {
  const mk = p => marcas[p.titulo] || {};
  const linea = p => "- " + p.titulo + " (" + (p["año"] || "s/a") + ", " + (generosDe(p).join("/") || "s/g") + ", " + (minutos(p) || "?") + " min)";
  const pend = peliculas.filter(p => mk(p).pendiente && !mk(p).vista).slice(0, 25);
  const vist = peliculas.filter(p => mk(p).vista).slice(-12);
  return "Pendientes:\n" + pend.map(linea).join("\n") + "\nYa vistas:\n" + vist.map(linea).join("\n");
}

async function cargarModeloLocal(onProgreso) {
  if (motorLocal) return motorLocal;
  if (!navigator.gpu) throw new Error("sin-webgpu");
  if (!motorLocalCargando) {
    motorLocalCargando = (async () => {
      const webllm = await import(MODELO_LOCAL_LIB);
      motorLocal = await webllm.CreateMLCEngine(MODELO_LOCAL_ID, {
        initProgressCallback: r => { if (onProgreso) onProgreso(r); }
      });
      return motorLocal;
    })().finally(() => { motorLocalCargando = null; });
  }
  return motorLocalCargando;
}

async function respuestaConModelo(t, hist = []) {
  if (leerLS("modelo_local_modo") !== "si" || !motorLocal) return null;
  const PROMPT = "Eres Estela, una amiga cinéfila que platica en español de México. Eres cálida, cercana y natural, como en una charla, no como un robot. Tutea a la persona. Responde con frases cortas y fluidas, sin listas, asteriscos ni encabezados. Si la persona cuenta cómo se siente, responde primero con empatía. Recomienda solo películas de la lista que te doy y no inventes títulos. Si la pregunta no es de cine ni de su lista, responde con amabilidad y vuelve al cine. Máximo cuatro frases.";
  try {
    const previos = (hist || []).slice(-6).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 400) }));
    const r = await motorLocal.chat.completions.create({
      messages: [{ role: "system", content: PROMPT + "\n\n" + resumenCatalogoParaModelo() }, ...previos, { role: "user", content: String(t).slice(0, 500) }],
      max_tokens: 200,
      temperature: 0.75,
      top_p: 0.9
    });
    const txt = r && r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content;
    return txt ? txt.trim() : null;
  } catch (e) { return null; }
}

const btnModelo = $("modeloDescargar");
const estadoModelo = $("modeloEstado");
const selModelo = $("modelo-local-modo");
selModelo.value = leerLS("modelo_local_modo") || "no";

function pintarEstadoModelo(texto) {
  if (texto) { estadoModelo.textContent = texto; return; }
  if (motorLocal) estadoModelo.textContent = "Listo: Estela entiende frases libres sin internet.";
  else if (!navigator.gpu) estadoModelo.textContent = "Este navegador no puede ejecutar el modelo local. Sigue funcionando el modo sin IA.";
  else estadoModelo.textContent = "Sin descargar. Conviene hacerlo con Wi-Fi.";
}

let descargaEnCurso = false;

async function descargarModelo() {
  if (descargaEnCurso || motorLocal) { pintarEstadoModelo(); return; }
  if (!navigator.gpu) { pintarEstadoModelo(); return; }
  descargaEnCurso = true;
  btnModelo.disabled = true;
  pintarEstadoModelo("Preparando la descarga…");
  // Si tarda demasiado, lo dice en vez de quedarse en silencio. Lo ya descargado se conserva.
  const vigilante = setTimeout(() => {
    if (!motorLocal) pintarEstadoModelo("Tarda más de lo normal. Revisa tu conexión y que tu navegador tenga WebGPU. Puedes dejarlo y volver después.");
  }, 45000);
  try {
    await cargarModeloLocal(r => pintarEstadoModelo("Descargando… " + Math.round((r.progress || 0) * 100) + "%"));
    escribirLS("modelo_local_modo", "si");
    selModelo.value = "si";
    pintarEstadoModelo("Listo: Estela entiende frases libres sin internet.");
  } catch (e) {
    const detalle = e && e.message ? " (" + String(e.message).slice(0, 80) + ")" : "";
    pintarEstadoModelo("No se pudo descargar el modelo" + detalle + ". Revisa tu conexión y vuelve a intentarlo.");
  } finally {
    clearTimeout(vigilante);
    descargaEnCurso = false;
    btnModelo.disabled = false;
  }
}

btnModelo.addEventListener("click", () => descargarModelo());
selModelo.addEventListener("change", () => escribirLS("modelo_local_modo", selModelo.value));
pintarEstadoModelo();

// Si ya se descargó antes, lo carga solo en segundo plano (la caché del navegador lo hace rápido)
if (leerLS("modelo_local_modo") === "si" && navigator.gpu) {
  setTimeout(() => { cargarModeloLocal().then(() => pintarEstadoModelo()).catch(() => pintarEstadoModelo()); }, 4000);
}

/* --- bloque 25 --- */
/* ---------- App instalable y actualización progresiva ---------- */
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const esInstalada = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let promptInstalar = null;
let pedidoActualizar = false;

function mostrarAvisoPwa(texto, acciones, id = "pwaAviso") {
  cerrarAvisoPwa(id);
  const div = document.createElement("div");
  div.id = id;
  div.className = "pwa-aviso";
  div.setAttribute("role", "status");
  const p = document.createElement("p");
  p.textContent = texto;
  const grupo = document.createElement("div");
  grupo.className = "pwa-acciones";
  acciones.forEach(a => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = a.principal ? "pildora destacado" : "pildora";
    b.textContent = a.texto;
    b.addEventListener("click", () => { a.accion(); });
    grupo.appendChild(b);
  });
  div.appendChild(p);
  div.appendChild(grupo);
  document.body.appendChild(div);
}

function cerrarAvisoPwa(id) {
  // Sin id, cierra cualquiera de los dos avisos
  const ids = id ? [id] : ["pwaAviso", "pwaAvisoInstalar"];
  ids.forEach(x => { const a = document.getElementById(x); if (a) a.remove(); });
}

function pintarInstalar() {
  const campo = document.getElementById("campoInstalar");
  const btn = document.getElementById("instalarApp");
  const estado = document.getElementById("instalarEstado");
  if (!campo || !btn) return;
  if (esInstalada) { campo.style.display = "none"; return; }
  if (promptInstalar) {
    btn.disabled = false;
    estado.textContent = "Ábrela como una app, con su icono y sin barra de direcciones.";
  } else if (esIOS) {
    btn.disabled = false;
    estado.textContent = "En iPhone: toca Compartir y luego «Añadir a pantalla de inicio».";
  } else {
    btn.disabled = true;
    estado.textContent = "Tu navegador lo instala desde su menú (⋮ → Instalar app).";
  }
}

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  promptInstalar = e;
  pintarInstalar();
});
window.addEventListener("appinstalled", () => {
  promptInstalar = null;
  pintarInstalar();
  cerrarAvisoPwa();
});

async function instalarAhora() {
  if (promptInstalar) {
    promptInstalar.prompt();
    try { await promptInstalar.userChoice; } catch (e) {}
    promptInstalar = null;
    pintarInstalar();
    return;
  }
  if (esIOS) {
    mostrarAvisoPwa("Toca el botón Compartir de Safari y luego «Añadir a pantalla de inicio».", [
      { texto: "Entendido", principal: true, accion: () => { escribirLS("instalar_visto", "1"); cerrarAvisoPwa(); } }
    ], "pwaAvisoInstalar");
  }
}

function avisarActualizacion(reg) {
  if (!reg.waiting) return;
  cerrarAvisoPwa("pwaAvisoInstalar");
  mostrarAvisoPwa("Hay una versión nueva de la app.", [
    { texto: "Actualizar", principal: true, accion: () => {
      pedidoActualizar = true;
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } },
    { texto: "Después", accion: cerrarAvisoPwa }
  ]);
}

function ofrecerInstalarUnaVez() {
  if (esInstalada || leerLS("instalar_visto") === "1") return;
  if (document.getElementById("pwaAviso")) return; // la actualización tiene prioridad
  if (promptInstalar) {
    mostrarAvisoPwa("Instala Mi catálogo en tu pantalla de inicio para abrirlo como app.", [
      { texto: "Instalar", principal: true, accion: () => { instalarAhora(); cerrarAvisoPwa(); escribirLS("instalar_visto", "1"); } },
      { texto: "Ahora no", accion: () => { escribirLS("instalar_visto", "1"); cerrarAvisoPwa(); } }
    ], "pwaAvisoInstalar");
  } else if (esIOS) {
    mostrarAvisoPwa("Para tenerla como app: toca Compartir y «Añadir a pantalla de inicio».", [
      { texto: "Entendido", principal: true, accion: () => { escribirLS("instalar_visto", "1"); cerrarAvisoPwa(); } }
    ], "pwaAvisoInstalar");
  }
}

document.getElementById("instalarApp").addEventListener("click", instalarAhora);
pintarInstalar();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      if (reg.waiting && navigator.serviceWorker.controller) avisarActualizacion(reg);
      reg.addEventListener("updatefound", () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener("statechange", () => {
          if (nuevo.state === "installed" && navigator.serviceWorker.controller) avisarActualizacion(reg);
        });
      });
    } catch (e) { /* sin service worker: la app sigue funcionando normal */ }
  });
  // Solo recarga si la persona pidió «Actualizar»; la primera instalación no recarga
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (pedidoActualizar) location.reload();
  });
}

// Oferta de instalación: una sola vez, después de que la app ya cargó
setTimeout(() => {
  if (document.body.classList.contains("con-sesion")) ofrecerInstalarUnaVez();
}, 9000);

/* --- bloque 26 --- */
/* ---------- Descarga automática del modelo (con permiso, solo con Wi-Fi y batería) ---------- */
function wifiDisponible() {
  const c = navigator.connection;
  return !!(c && c.type === "wifi");
}

async function bateriaSuficiente() {
  try {
    if (!navigator.getBattery) return true;
    const b = await navigator.getBattery();
    return b.charging || b.level >= 0.5;
  } catch (e) { return true; }
}

async function intentarDescargaAutomatica() {
  if (leerLS("modelo_auto") !== "si" || leerLS("modelo_local_modo") === "no") return;
  if (motorLocal || descargaEnCurso || !navigator.gpu) return;
  if (!wifiDisponible()) { pintarEstadoModelo("Se descargará sola cuando estés en Wi-Fi."); return; }
  if (!(await bateriaSuficiente())) { pintarEstadoModelo("Se descargará sola cuando tengas más batería o conectes el cargador."); return; }
  descargarModelo();
}

function pedirPermisoModelo() {
  mostrarAvisoPwa("¿Quieres que Estela se descargue sola para funcionar sin internet? Pesa unos 400 MB y solo se descarga con Wi-Fi y batería suficiente.", [
    { texto: "Sí, con Wi-Fi", principal: true, accion: () => {
        escribirLS("modelo_auto", "si");
        cerrarAvisoPwa("pwaAvisoModelo");
        intentarDescargaAutomatica();
    } },
    { texto: "No por ahora", accion: () => {
        escribirLS("modelo_auto", "no");
        cerrarAvisoPwa("pwaAvisoModelo");
    } }
  ], "pwaAvisoModelo");
}

// Una sola vez, cuando ya cargó la app y no hay otros avisos encima
setTimeout(() => {
  if (!document.body.classList.contains("con-sesion")) return;
  if (!navigator.gpu || motorLocal || leerLS("modelo_local_modo") === "no") return;
  if (leerLS("modelo_auto") !== null) { intentarDescargaAutomatica(); return; }
  if (document.getElementById("pwaAviso") || document.getElementById("pwaAvisoInstalar")) return;
  pedirPermisoModelo();
}, 20000);

// Reintenta cuando cambia la conexión o cada 10 minutos
if (navigator.connection && navigator.connection.addEventListener) {
  navigator.connection.addEventListener("change", intentarDescargaAutomatica);
}
setInterval(intentarDescargaAutomatica, 10 * 60 * 1000);

/* --- bloque 27 --- */
