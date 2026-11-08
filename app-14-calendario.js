/* ===== Fase H · Calendario: deslizar y flechas del teclado para cambiar de mes ===== */
(function () {
  function botones() {
    return { prev: document.getElementById("calPrev"), next: document.getElementById("calNext") };
  }
  // Etiquetas accesibles para los botones de mes (los crea htmlCalendario al pintar)
  function etiquetar() {
    const { prev, next } = botones();
    if (prev && !prev.getAttribute("aria-label")) prev.setAttribute("aria-label", "Mes anterior");
    if (next && !next.getAttribute("aria-label")) next.setAttribute("aria-label", "Mes siguiente");
  }
  // Anima la entrada del nuevo mes desde el lado de donde vino el movimiento
  function animar(direccion) {
    setTimeout(() => {
      const { prev } = botones();
      if (!prev) return;
      etiquetar();
      let cal = prev.parentElement;
      while (cal && !cal.querySelector(".cal-dia")) cal = cal.parentElement;
      if (!cal) return;
      cal.classList.remove("cal-entra-der", "cal-entra-izq");
      void cal.offsetWidth;                       // reinicia la animación
      cal.classList.add(direccion > 0 ? "cal-entra-der" : "cal-entra-izq");
    }, 0);
  }
  function mover(direccion) {
    const { prev, next } = botones();
    const boton = direccion > 0 ? next : prev;
    if (!boton) return;
    boton.click();
    animar(direccion);
  }

  // Teclado: flechas izquierda y derecha, solo cuando estás en Pendientes y no escribes ni tienes un diálogo abierto
  document.addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const t = e.target;
    if (t && (t.closest && t.closest("input, textarea, select, [contenteditable]"))) return;
    if (document.querySelector("#modal.abierto, #statsModal.abierto, #clasificador.abierto, .ayuda-atajos")) return;
    if (typeof pestana !== "undefined" && pestana !== "pendientes") return;
    if (!botones().prev) return;
    e.preventDefault();
    mover(e.key === "ArrowRight" ? 1 : -1);
  });

  // Deslizar: gesto horizontal sobre el calendario (no sobre el resto de la lista)
  let inicio = null;
  document.addEventListener("touchstart", e => {
    const { prev } = botones();
    if (!prev || !prev.parentElement) { inicio = null; return; }
    const t = e.touches[0];
    const cal = e.target.closest && e.target.closest(".cal-dia, .cal-num, .cal-chip");
    inicio = cal ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!inicio) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - inicio.x, dy = t.clientY - inicio.y;
    inicio = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 40) return;   // solo gestos claramente horizontales
    mover(dx < 0 ? 1 : -1);                                // deslizar a la izquierda: mes siguiente
  }, { passive: true });

  // Cada vez que se pinta el calendario, sus botones quedan etiquetados
  new MutationObserver(etiquetar).observe(document.getElementById("lista") || document.body, { childList: true, subtree: true });
})();
