/* ===== Fase I · Accesibilidad: el foco se queda dentro del diálogo abierto y regresa al cerrar ===== */
(function () {
  const IDS = ["modal", "statsModal", "actorModal", "clasificador"];
  const SELECTOR_FOCO = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let activo = null;        // diálogo que tiene el foco ahora
  let origen = null;        // elemento que tenía el foco antes de abrirlo

  function visible(el) {
    return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  }
  function enfocables(d) {
    return Array.from(d.querySelectorAll(SELECTOR_FOCO)).filter(el => visible(el) && !el.closest("[hidden]"));
  }
  function dialogoAbierto() {
    const porId = IDS.map(id => document.getElementById(id)).find(d => d && d.classList.contains("abierto"));
    return porId || document.querySelector(".ayuda-atajos");
  }
  function activar(d) {
    if (activo === d) return;
    activo = d;
    origen = document.activeElement;
    if (!d.hasAttribute("tabindex")) d.setAttribute("tabindex", "-1");
    if (!d.hasAttribute("aria-label")) {
      const titulo = d.querySelector("h2, h3");
      if (titulo) d.setAttribute("aria-label", titulo.textContent.trim());
    }
    requestAnimationFrame(() => {
      const f = enfocables(d);
      (f[0] || d).focus();
    });
  }
  function desactivar() {
    const vuelta = origen;
    activo = null;
    origen = null;
    if (vuelta && document.contains(vuelta) && typeof vuelta.focus === "function") vuelta.focus();
  }

  // Revisa cada cambio en los diálogos y en el cuerpo (los de ayuda se crean y se quitan)
  const revisar = () => {
    const d = dialogoAbierto();
    if (d && d !== activo) activar(d);
    else if (!d && activo) desactivar();
  };
  IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(revisar).observe(el, { attributes: true, attributeFilter: ["class"] });
  });
  new MutationObserver(revisar).observe(document.body, { childList: true });

  // Tab y Shift+Tab dan la vuelta dentro del diálogo, sin salir hacia el fondo
  document.addEventListener("keydown", e => {
    if (e.key !== "Tab" || !activo) return;
    const f = enfocables(activo);
    if (!f.length) { e.preventDefault(); activo.focus(); return; }
    const primero = f[0], ultimo = f[f.length - 1];
    const dentro = activo.contains(document.activeElement);
    if (e.shiftKey && (!dentro || document.activeElement === primero)) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && (!dentro || document.activeElement === ultimo)) { e.preventDefault(); primero.focus(); }
  });
  // Movimiento reducido: las gráficas (Chart.js) se dibujan sin animación
  const reducir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducir && window.Chart) Chart.defaults.animation = false;
})();
