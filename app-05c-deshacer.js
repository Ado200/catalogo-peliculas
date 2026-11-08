/* ===== Fase 0 · Módulo «deshacer»: deshacer general (Ctrl/Cmd+Z y botón) ===== */
/* Migrado de app-05 sin cambiar el comportamiento. Mantiene los mismos nombres globales.
   Se registra en el núcleo (app-00-nucleo.js). Aún sin interruptor en Ajustes. */
/* ---------- Deshacer general (Ctrl/Cmd+Z o botón) ---------- */
let pilaDeshacer = [];
let ultimaCopiaMarcas = null;
let deshaciendo = false;

function registrarDeshacer() {
  if (deshaciendo) return;
  const actual = JSON.stringify(marcas);
  if (ultimaCopiaMarcas !== null && ultimaCopiaMarcas !== actual && ultimaCopiaMarcas !== "{}") {
    pilaDeshacer.push(ultimaCopiaMarcas);
    if (pilaDeshacer.length > 30) pilaDeshacer.shift();
  }
  ultimaCopiaMarcas = actual;
}

function deshacerUltimo() {
  if (!pilaDeshacer.length) {
    avisar("No hay cambios recientes que deshacer.");
    return;
  }
  const previa = pilaDeshacer.pop();
  deshaciendo = true;
  try {
    marcas = JSON.parse(previa);
    programarGuardado();
  } finally {
    deshaciendo = false;
  }
  ultimaCopiaMarcas = previa;
  pintar();
  avisar("Cambio deshecho. Puedes deshacer " + pilaDeshacer.length + " más.");
}

if (window.Nucleo) {
  Nucleo.registrar("deshacer", { version: "1.0", emite: [], escucha: [] });
}
