/* ===== Fase 0 · Módulo «instalable» (bloque 25): app instalable, aviso de instalación y actualización progresiva. Migrado sin cambios de comportamiento. ===== */
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


if (window.Nucleo) { Nucleo.registrar("instalable", { version: "1.0", emite: [], escucha: [] }); }
