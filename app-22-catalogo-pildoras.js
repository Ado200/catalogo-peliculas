/* ===== Vitrina · Fase 4 · píldoras de acceso rápido en Películas =====
   Las píldoras no crean lógica nueva: pulsan los botones y el filtro que ya existen
   (noche, ánimo, pareja, sorpresa y género Comedia). ===== */
(function () {
  const cont = document.getElementById("pildorasRapidas");
  if (!cont) return;

  const clic = id => { const b = document.getElementById(id); if (b) b.click(); };

  const acciones = {
    noche: () => clic("queVerNoche"),
    animo: () => clic("animoBtn"),
    pareja: () => clic("parejaBtn"),
    sorpresa: () => clic("sorpresa"),
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

  cont.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-rapida]");
    if (!b || !acciones[b.dataset.rapida]) return;
    acciones[b.dataset.rapida]();
  });
})();
