/* ===== Fase 0 · Módulo «atajos»: atajos de teclado (computadora) y ayuda de atajos ===== */
/* Migrado de app-05 sin cambiar el comportamiento. Se carga justo antes de app-05 para conservar el
   orden original de los listeners de teclado. Se registra en el núcleo (app-00-nucleo.js). Aún sin interruptor. */
/* ---------- Atajos de teclado (computadora) ---------- */
function enCampoDeTexto(t) {
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

function ventanaAbierta() {
  const m = document.getElementById("modal");
  const c = document.getElementById("chatPanel");
  const a = document.getElementById("ayudaAtajos");
  return (m && m.classList.contains("abierto")) || (c && c.classList.contains("abierto")) || !!a;
}

function toggleAyudaAtajos() {
  const previa = document.getElementById("ayudaAtajos");
  if (previa) { previa.remove(); return; }
  const div = document.createElement("div");
  div.id = "ayudaAtajos";
  div.className = "ayuda-atajos";
  div.innerHTML = '<div class="ayuda-caja" role="dialog" aria-label="Atajos de teclado">' +
    '<h3>Atajos de teclado</h3>' +
    '<dl><dt>/</dt><dd>Ir a la búsqueda</dd>' +
    '<dt>A</dt><dd>Sugerir una película al azar</dd>' +
    '<dt>N</dt><dd>Qué ver esta noche</dd>' +
    '<dt>Ctrl/Cmd + Z</dt><dd>Deshacer el último cambio</dd>' +
    '<dt>Esc</dt><dd>Cerrar la ventana abierta</dd>' +
    '<dt>?</dt><dd>Mostrar u ocultar esta ayuda</dd></dl>' +
    '<button type="button" class="pildora" id="cerrarAyudaAtajos">Entendido</button></div>';
  div.addEventListener("click", e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  document.getElementById("cerrarAyudaAtajos").addEventListener("click", () => div.remove());
}

document.addEventListener("keydown", e => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
    e.preventDefault();
    abrirExplorar();
    return;
  }
  if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z" && !enCampoDeTexto(e.target)) {
    e.preventDefault();
    deshacerUltimo();
    return;
  }
  if (e.key === "Escape" && document.getElementById("ayudaAtajos")) {
    document.getElementById("ayudaAtajos").remove();
    return;
  }
  if (ctrl || e.altKey || enCampoDeTexto(e.target) || ventanaAbierta()) return;
  if (e.key === "/") {
    e.preventDefault();
    const b = document.getElementById("buscar");
    if (b) b.focus();
  } else if (e.key === "a" || e.key === "A") {
    document.getElementById("aleatorio").click();
  } else if (e.key === "n" || e.key === "N") {
    document.getElementById("queVerNoche").click();
  } else if (e.key === "?") {
    toggleAyudaAtajos();
  }
});

if (window.Nucleo) {
  Nucleo.registrar("atajos", { version: "1.0", emite: [], escucha: [] });
}
