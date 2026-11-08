/* ===== Fase 0 · Módulo «guia» (bloque 12): guía de la página. Migrado sin cambios de comportamiento. ===== */
(function () {
  const guia = document.getElementById("guia");

  const DESC_ZONAS = {
    lista: "Todas las películas, con búsqueda y filtros.",
    estrenos: "Recién estrenadas y próximas, según su fecha real.",
    sagas: "Sagas en orden, con tu progreso.",
    actores: "Actores con foto y biografía.",
    duelo: "Enfrenta dos películas y elige cuál ver.",
    resumen: "Tu resumen de la semana.",
    actividad: "Tu actividad y tus retos del mes.",
    mapa: "Tu mapa de gustos y de países.",
    descartadas: "Las películas que descartaste."
  };
  // Se arma leyendo el menú y las pestañas en el momento: lo que agregues aparece solo.
  function llenarGuiaAuto() {
    const cont = document.getElementById("guiaAuto");
    if (!cont) return;
    const esc2 = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const zonas = (lista, titulo) => '<div class="seccion"><h3>' + titulo + '</h3><ul>' +
      lista.map(([k, n]) => '<li><b>' + esc2(n) + '</b>' + (DESC_ZONAS[k] ? ' — ' + esc2(DESC_ZONAS[k]) : '') + '</li>').join("") +
      '</ul></div>';
    let html = zonas(ZONAS_PELICULAS, "🎬 Pestañas de Películas") + zonas(ZONAS_VISTAS, "✓ Pestañas de Vistas");
    document.querySelectorAll("#panelAvanzados .grupo-menu, #panelMas .grupo-menu").forEach(g => {
      const titulo = (g.querySelector(".grupo-titulo") || {}).textContent || "";
      if (!titulo || /^Ayuda$/.test(titulo)) return;
      const botones = [...g.querySelectorAll("button[id]")];
      if (!botones.length) return;
      html += '<div class="seccion"><h3>' + esc2(titulo) + '</h3><ul>' + botones.map(b => {
        const texto = b.textContent.replace(/\s+/g, " ").trim();
        const desc = (typeof DESC_HERRAMIENTAS !== "undefined" && DESC_HERRAMIENTAS[b.id]) || "";
        return '<li><b>' + esc2(texto) + '</b>' + (desc ? ' — ' + esc2(desc) : '') + '</li>';
      }).join("") + '</ul></div>';
    });
    cont.innerHTML = html;
  }

  function abrirGuia() { llenarGuiaAuto(); guia.classList.add("abierta"); }
  function cerrarGuia() {
    guia.classList.remove("abierta");
    if (marcas.__guia !== 1) {
      marcas.__guia = 1;   // se guarda en las marcas de la cuenta, así vale en todos sus dispositivos
      programarGuardado();
    }
  }

  // Se llama cuando las marcas de la cuenta ya cargaron
  window.mostrarGuiaSiEsNueva = function () {
    if (marcas.__guia !== 1) abrirGuia();
  };

  document.getElementById("guiaCerrar").addEventListener("click", cerrarGuia);
  document.getElementById("guiaEntendido").addEventListener("click", cerrarGuia);
  guia.addEventListener("click", e => { if (e.target === guia) cerrarGuia(); });
  document.getElementById("verGuia").addEventListener("click", abrirGuia);
})();

if (window.Nucleo) { Nucleo.registrar("guia", { version: "1.0", emite: [], escucha: [] }); }
