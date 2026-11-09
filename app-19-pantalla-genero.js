/* ===== Fase 2 · Módulo «pantalla-genero»: al tocar un género se abre su propia pantalla con pósters.
   Transición lateral, botón «‹» para volver y solo pósters (el texto se reduce al mínimo).
   Lo llama app-17 desde la cuadrícula de géneros. ===== */
(function () {
  const pantalla = document.createElement("section");
  pantalla.id = "pantallaGenero";
  pantalla.className = "pantalla-genero";
  pantalla.hidden = true;
  pantalla.setAttribute("role", "dialog");
  pantalla.setAttribute("aria-label", "Películas del género");
  pantalla.innerHTML =
    '<header class="pg-cab">' +
      '<button type="button" class="pg-atras" aria-label="Volver a Buscar">‹ <span>Buscar</span></button>' +
    '</header>' +
    '<h2 class="pg-titulo"></h2>' +
    '<p class="pg-conteo"></p>' +
    '<div class="pg-grid"></div>';
  document.body.appendChild(pantalla);
  const titulo = pantalla.querySelector(".pg-titulo");
  const conteo = pantalla.querySelector(".pg-conteo");
  const grid = pantalla.querySelector(".pg-grid");

  let abierta = false;
  let temporizador = null;

  function cerrar() {
    if (!abierta) return;
    abierta = false;
    pantalla.classList.remove("abierta");
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { if (!abierta) pantalla.hidden = true; }, 360);
  }

  function tarjetaPoster(p) {
    const imagen = p.portada
      ? '<img src="' + esc(p.portada) + '" alt="" loading="lazy">'
      : '<span class="pg-sin">' + esc(p.titulo) + '</span>';
    return '<button type="button" class="pg-poster" data-titulo="' + esc(p.titulo) + '" aria-label="' + esc(p.titulo) + '">' +
      imagen + '</button>';
  }

  // Muestra una lista de películas a pantalla completa (sirve para géneros y para resultados de Estela)
  function mostrar(tituloTexto, lista, vacio) {
    titulo.textContent = tituloTexto;
    conteo.textContent = lista.length + (lista.length === 1 ? " película" : " películas");
    grid.innerHTML = lista.length ? lista.map(tarjetaPoster).join("")
      : '<p class="pg-vacio">' + esc(vacio) + '</p>';
    clearTimeout(temporizador);
    pantalla.hidden = false;
    pantalla.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      pantalla.classList.add("abierta");
      abierta = true;
    }));
  }

  function abrir(genero) {
    const lista = Nucleo.datos.peliculas()
      .filter(p => (p.genero || "").split(",").map(x => x.trim()).includes(genero))
      .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), "es"));
    mostrar(genero, lista, "No hay películas de este género todavía.");
  }

  // Resultados de Estela: en el orden en que los propuso, sin repetir
  function abrirLista(tituloTexto, titulos) {
    const porTitulo = new Map(Nucleo.datos.peliculas().map(p => [p.titulo, p]));
    const lista = titulos.map(t => porTitulo.get(t)).filter(Boolean);
    mostrar(tituloTexto, lista, "Estela no encontró películas para esa búsqueda.");
  }

  pantalla.querySelector(".pg-atras").addEventListener("click", cerrar);

  // Tocar un póster abre la ficha de la película
  grid.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-titulo]");
    if (!b) return;
    const p = Nucleo.datos.peliculas().find(x => x.titulo === b.dataset.titulo);
    if (p && typeof abrirDetalle === "function") abrirDetalle(p);
  });

  // Escape cierra la pantalla
  document.addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });

  // Tocar otra pestaña de la barra cierra la pantalla del género
  const tabbar = document.getElementById("tabbar");
  if (tabbar) tabbar.addEventListener("click", cerrar, true);

  window.abrirPantallaGenero = abrir;
  window.abrirPantallaResultados = abrirLista;
  window.cerrarPantallaGenero = cerrar;

  if (window.Nucleo) {
    Nucleo.registrar("pantalla-genero", { version: "1.0", emite: [], escucha: [] });
  }
})();
