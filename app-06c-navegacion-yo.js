/* ===== Fase 2 · Módulo «navegacion-yo»: pestaña Yo. No cambia de pantalla: abre una ventana con accesos
   a Estadísticas, Ajustes, Diagnóstico y Exportar, que disparan los botones originales. Borrar marcas y
   salir de este dispositivo siguen en Ajustes. ===== */
(function () {
  const tabbar = document.getElementById("tabbar");
  if (!tabbar) return;
  // Captura: se atiende antes que cambiarPestana, para que «Yo» no llegue a cambiar la pantalla
  tabbar.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest('button[data-tab="yo"]');
    if (!b) return;
    e.stopPropagation();
    e.preventDefault();
    abrirYo();
  }, true);

  function abrirYo() {
    const cuerpo =
      '<p class="meta">Tus herramientas de cuenta. Borrar marcas y salir de este dispositivo están en Ajustes.</p>' +
      '<div class="yo-accesos">' +
      '<button type="button" class="pildora" data-yo="estadisticas">📊 Estadísticas</button>' +
      '<button type="button" class="pildora" data-yo="toggleAvanzados">⚙️ Ajustes</button>' +
      '<button type="button" class="pildora" data-yo="diagnosticoDatos">🩺 Diagnóstico de datos</button>' +
      '<button type="button" class="pildora" data-yo="respaldarMarcas">💾 Respaldar ahora</button>' +
      '<button type="button" class="pildora" data-yo="verGuia">📖 Guía de la app</button>' +
      '<button type="button" class="pildora" data-yo="reglas">🔔 Reglas automáticas</button>' +
      '<button type="button" class="pildora" data-yo="criterios">🚫 Criterios excluidos</button>' +
      '<button type="button" class="pildora" data-yo="exportar">⬇ Exportar mis datos</button>' +
      '</div>';
    abrirVentanaSimple("yo", "Yo", cuerpo);
    const ventana = document.getElementById("yo");
    if (!ventana) return;
    ventana.addEventListener("click", e => {
      const b = e.target.closest && e.target.closest("button[data-yo]");
      if (!b) return;
      if (b.dataset.yo === "reglas") { ventana.remove(); if (window.Nucleo && Nucleo.reglas) Nucleo.reglas.abrir(); return; }
      if (b.dataset.yo === "criterios") { ventana.remove(); if (window.Nucleo && Nucleo.criterios) Nucleo.criterios.abrir(); return; }
      const destino = document.getElementById(b.dataset.yo);
      ventana.remove();
      if (destino) destino.click();
    });
  }
})();

if (window.Nucleo) {
  Nucleo.registrar("navegacion-yo", { version: "1.0", emite: [], escucha: [] });
}
