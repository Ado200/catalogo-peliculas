/* ===== Vitrina · Fase 1 · color del póster en la ficha =====
   Al abrir una película, toma el color dominante de su póster (paletaDePoster, ya existente)
   y lo deja en la variable --vt-acento-poster del modal. Si no hay póster o el modo ahorro
   lo impide, no cambia nada: la ficha usa el color neutro --vt-acento. ===== */
(function () {
  const modal = document.getElementById("modal");
  if (!modal) return;
  let pedido = null;

  function colorDelPoster(p) {
    if (!p || !p.portada) return;
    if (typeof datosLimitados === "function" && datosLimitados()) return;
    if (typeof paletaDePoster !== "function") return;
    pedido = p;
    paletaDePoster(p.portada).then(colores => {
      if (pedido !== p || !colores || !colores.length) return;
      const c = colores[0];
      modal.style.setProperty("--vt-acento-poster", "rgb(" + c.join(",") + ")");
    }).catch(() => {});
  }

  new MutationObserver(() => {
    if (!modal.classList.contains("abierto")) return;
    if (pedido === detalleActual) return;
    modal.style.removeProperty("--vt-acento-poster");
    colorDelPoster(detalleActual);
  }).observe(modal, { attributes: true, attributeFilter: ["class"] });
})();
