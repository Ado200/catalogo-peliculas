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
  hub.dataset.zona = "lista";
  const anclaInicio = document.getElementById("inicioBloques");
  if (anclaInicio) anclaInicio.insertAdjacentElement("afterend", hub);
  else lista.parentNode.insertBefore(hub, lista);

  const pestanaBuscar = document.getElementById("pestanaBuscar");
  const cabecera = document.querySelector("#app > header");

  // La pestaña Buscar muestra el buscador, los botones y los filtros; las demás no
  const TITULOS = { inicio: "Inicio", catalogo: "Películas", listas: "Mis Listas", buscar: "Buscar" };
  const h1 = document.querySelector("#app > header h1");
  function ponerTitulo(tab) {
    if (h1 && TITULOS[tab]) h1.textContent = TITULOS[tab];
  }

  function mostrarBuscar(on) {
    if (pestanaBuscar) pestanaBuscar.hidden = !on;
    document.body.classList.toggle("en-buscar", on);
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
        tarjeta("v", '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M8 12.2l2.7 2.6L16 9.4"/></svg>', "Vistas", c.vistas + (c.vistas === 1 ? " película" : " películas"), "vistas") +
        tarjeta("p", '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10M7 21h10"/><path d="M8 3c0 4.5 8 5.5 8 9s-8 4.5-8 9M16 3c0 4.5-8 5.5-8 9s8 4.5 8 9"/></svg>', "Pendientes", c.pendientes + " por ver · " + c.planes + " con alguien", "pendientes") +
        tarjeta("n", '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M14 3.5V8h4"/><path d="M9 13h6M9 16.5h4"/></svg>', "Notas", c.notas + (c.notas === 1 ? " nota" : " notas"), "notas") +
        tarjeta("a", '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>', "Ajustes y cuenta", "Estadísticas, respaldo y más", "yo") +
      '</div>';
  }

  // Bloques de la pestaña Películas que no deben verse junto a Mis Listas
  const BLOQUES_CATALOGO = ["salud", "destacados", "queVer", "estaSemana", "duelo", "pregunta", "bienvenida",
    "mapaGustos", "recomendaciones", "ahora", "resumenSemana", "avisoFecha", "avisoEstancados",
    "tagsNotas", "toolbarNotas", "toolbarVistas", "chips", "selectorZona"];

  function mostrarHub(on) {
    if (on) pintarHub();
    hub.hidden = !on;
    lista.style.display = on ? "none" : "";
    BLOQUES_CATALOGO.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = on ? "none" : "";
    });
  }

  // Fase 4: el contenido se desvanece al cambiar de pestaña; la barra se queda fija
  function animarEntrada() {
    [lista, hub].forEach(el => {
      if (!el) return;
      el.classList.remove("entra");
      void el.offsetWidth; // reinicia la animación
      el.classList.add("entra");
    });
  }

  // Captura: «Mis Listas» y «Buscar» se atienden aquí, antes de cambiarPestana
  tabbar.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("button[data-tab]");
    if (!b) return;
    const tab = b.dataset.tab;
    document.body.classList.toggle("en-inicio", tab === "inicio");
    if (TITULOS[tab] || tab === "listas") animarEntrada();
    if (TITULOS[tab]) ponerTitulo(tab);
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
    } else if (tab === "inicio") {
      mostrarBuscar(false);
      mostrarHub(false);
      pintarHub();
      hub.hidden = false;
    } else if (tab === "catalogo") {
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

  // Al abrir la app, Inicio ya muestra Mis Listas
  if (document.querySelector('#tabbar button[data-tab="inicio"].activa')) {
    document.body.classList.add("en-inicio");
    pintarHub();
    hub.hidden = false;
  }
  if (window.Nucleo) {
    Nucleo.registrar("mis-listas", { version: "1.0", emite: [], escucha: [] });
  }
})();
