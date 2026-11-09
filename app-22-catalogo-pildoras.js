/* ===== Vitrina · Fase 4 · píldoras de acceso rápido en Películas =====
   Las píldoras no crean lógica nueva: pulsan los botones y el filtro que ya existen
   (noche, ánimo, pareja, sorpresa y género Comedia). ===== */
(function () {
  const cont = document.getElementById("pildorasRapidas");

  const clic = id => { const b = document.getElementById(id); if (b) b.click(); };

  const acciones = {
    noche: () => clic("queVerNoche"),
    animo: () => clic("animoBtn"),
    pareja: () => clic("parejaBtn"),
    sorpresa: () => clic("sorpresa"),
    tematica: () => clic("nocheTema"),
    azar: () => clic("sorpresa"),
    reir: () => {
      const sel = document.getElementById("genero");
      if (!sel) return;
      const op = Array.from(sel.options).find(o => /comedia/i.test(o.textContent));
      if (!op) return;
      sel.value = op.value;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-rapida]");
    if (b && acciones[b.dataset.rapida]) { acciones[b.dataset.rapida](); return; }
    const busc = e.target.closest && e.target.closest("#buscarFalso");
    if (busc) {
      const pestanaBuscar = document.querySelector('#tabbar button[data-tab="buscar"]');
      if (pestanaBuscar) pestanaBuscar.click();
    }
  });
})();
