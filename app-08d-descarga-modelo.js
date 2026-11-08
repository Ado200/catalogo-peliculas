/* ===== Fase 0 · Módulo «descarga-modelo» (bloque 26): descarga automática del modelo local (con permiso, solo con Wi-Fi y batería). Migrado sin cambios de comportamiento. ===== */
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

if (window.Nucleo) { Nucleo.registrar("descarga-modelo", { version: "1.0", emite: [], escucha: [] }); }
