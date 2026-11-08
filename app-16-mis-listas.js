/* ===== Fase 2 · Módulo «mis-listas»: barra de 4 botones (Inicio, Catálogo, Mis Listas, Buscar).
   Mis Listas reúne Vistas, Pendientes (con Planes) y Notas en tarjetas grandes.
   No cambia la lógica de pestañas: usa cambiarPestana y los botones que ya existen. ===== */
(function () {
  const tabbar = document.getElementById("tabbar");
  const lista = document.getElementById("lista");
  if (!tabbar || !lista) return;

  const hub = document.createElement("section");
  hub.id = "hubListas";
  hub.className = "hub-listas";
  hub.hidden = true;
  lista.parentNode.insertBefore(hub, lista);

  const pestanaBuscar = document.getElementById("pestanaBuscar");
  const cabecera = document.querySelector("#app > header");

  // La pestaña Buscar muestra el buscador, los botones y los filtros; las demás no
  function mostrarBuscar(on) {
    if (pestanaBuscar) pestanaBuscar.hidden = !on;
  }

  function marcarActiva(tab) {
    tabbar.querySelectorAll("button[data-tab]").forEach(b => b.classList.toggle("activa", b.dataset.tab === tab));
  }

  function contar() {
    const marcas = Nucleo.datos.marcas();
    const c = { vistas: 0, pendientes: 0, planes: 0, notas: 0 };
    Nucleo.datos.peliculas().forEach(p => {
      const m = marcas[p.titulo] || {};
      if (m.vista) c.vistas++;
      if (m.pendiente) { c.pendientes++; if (m.conAlguien) c.planes++; }
      if (m.nota) c.notas++;
    });
    return c;
  }

  function pintarHub() {
    const c = contar();
    const tarjeta = (clase, icono, titulo, sub, accion) =>
      '<button type="button" class="hub-tarjeta ' + clase + '" data-hub="' + accion + '">' +
        '<span class="hub-ico" aria-hidden="true">' + icono + '</span>' +
        '<strong>' + titulo + '</strong>' +
        '<span class="hub-sub">' + sub + '</span>' +
      '</button>';
    hub.innerHTML =
      '<h2 class="hub-titulo">Mis Listas</h2>' +
      '<div class="hub-grid">' +
        tarjeta("v", "✓", "Vistas", c.vistas + (c.vistas === 1 ? " película" : " películas"), "vistas") +
        tarjeta("p", "⏳", "Pendientes", c.pendientes + " por ver · " + c.planes + " con alguien", "pendientes") +
        tarjeta("n", "📝", "Notas", c.notas + (c.notas === 1 ? " nota" : " notas"), "notas") +
        tarjeta("a", "⚙", "Ajustes y cuenta", "Estadísticas, respaldo y más", "yo") +
      '</div>';
  }

  function mostrarHub(on) {
    if (on) pintarHub();
    hub.hidden = !on;
    lista.style.display = on ? "none" : "";
  }

  // Captura: «Mis Listas» y «Buscar» se atienden aquí, antes de cambiarPestana
  tabbar.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("button[data-tab]");
    if (!b) return;
    const tab = b.dataset.tab;
    if (tab === "listas") {
      e.stopPropagation(); e.preventDefault();
      mostrarBuscar(false);
      mostrarHub(true);
      marcarActiva("listas");
    } else if (tab === "buscar") {
      e.stopPropagation(); e.preventDefault();
      mostrarHub(false);
      mostrarBuscar(true);
      cambiarPestana("catalogo");
      marcarActiva("buscar");
      const campo = document.getElementById("buscar");
      if (campo) campo.focus();
    } else if (tab === "inicio" || tab === "catalogo") {
      mostrarHub(false);
      mostrarBuscar(false);
    }
  }, true);

  // Al tocar Inicio o Catálogo desde el hub, la lista vuelve a mostrarse (se ejecuta después de cambiarPestana)
  // Tarjetas del hub
  hub.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-hub]");
    if (!b) return;
    const accion = b.dataset.hub;
    if (accion === "yo") {
      const yo = tabbar.querySelector('button[data-tab="yo"]');
      if (yo) yo.click();
      return;
    }
    mostrarHub(false);
    mostrarBuscar(false);
    cambiarPestana(accion);
    marcarActiva("listas");
  });

  // Título grande que se reduce al hacer scroll
  window.addEventListener("scroll", () => {
    if (cabecera) cabecera.classList.toggle("compacto", window.scrollY > 24);
  }, { passive: true });

  if (window.Nucleo) {
    Nucleo.registrar("mis-listas", { version: "1.0", emite: [], escucha: [] });
  }
})();
