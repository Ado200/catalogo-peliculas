/* ===== Fase 3 · Módulo «filtros-visuales»: cuadrícula de géneros en Buscar y, en Catálogo, los filtros
   (tipo, duración, año, estado, tema, país y orden) directamente, sin «Más filtros».
   Usa los mismos select como fuente de verdad: al tocar una opción cambia su valor y llama a pintar(). ===== */
(function () {
  const pestana = document.getElementById("pestanaBuscar");
  if (!pestana) return;

  const CAMPOS = [
    { clave: "genero", etiqueta: "Explorar géneros", select: () => sel.genero, grid: true },
    { clave: "tipo", etiqueta: "Tipo", select: () => sel.tipo },
    { clave: "duracion", etiqueta: "Duración", select: () => sel.duracion },
    { clave: "anio", etiqueta: "Año", select: () => sel.anio },
    { clave: "estado", etiqueta: "Estado", select: () => sel.estado },
    { clave: "tema", etiqueta: "Tema", select: () => sel.tema },
    { clave: "pais", etiqueta: "País", select: () => sel.pais },
    { clave: "orden", etiqueta: "Orden", select: () => $("orden") }
  ];

  // Colores, icono y nombre visible de cada género
  const GENEROS = {
    "Acción": { a: "#ff4b6e", b: "#ff5a36", i: "💥" },
    "Comedia": { a: "#f7c948", b: "#2ecdb2", i: "😂" },
    "Drama": { a: "#3f7ff5", b: "#8b5cf6", i: "🎭" },
    "Terror": { a: "#1f2937", b: "#0f172a", i: "👻" },
    "Ciencia ficción": { a: "#06b6d4", b: "#0369a1", i: "🛸", n: "Sci-Fi" },
    "Romance": { a: "#e0445c", b: "#7e1d5c", i: "💘" },
    "Animación": { a: "#22c55e", b: "#0f766e", i: "🖍️" },
    "Crimen": { a: "#7c2d12", b: "#451a03", i: "🔎" },
    "Documental": { a: "#0d9488", b: "#134e4a", i: "🎥" },
    "Familia": { a: "#f97316", b: "#ea580c", i: "🧸" },
    "Fantasía": { a: "#a855f7", b: "#4c1d95", i: "🐉" },
    "Suspenso": { a: "#475569", b: "#1e293b", i: "🔪" },
    "Aventura": { a: "#84cc16", b: "#3f6212", i: "🗺️" },
    "Historia": { a: "#b45309", b: "#78350f", i: "🏛️" },
    "Guerra": { a: "#4b5563", b: "#1f2937", i: "🪖" },
    "Música": { a: "#db2777", b: "#9d174d", i: "🎵" },
    "Misterio": { a: "#334155", b: "#0f172a", i: "🕵️" },
    "Western": { a: "#a16207", b: "#713f12", i: "🤠" }
  };
  const estiloGenero = g => {
    const d = GENEROS[g] || { a: "#6b7280", b: "#374151", i: "🎬" };
    return { a: d.a, b: d.b, i: d.i, n: d.n || g };
  };

  // Unifica variantes de escritura (Acción / acción): "Acción" en todos los datos y en el select
  let generosNormalizados = false;
  const canonico = g => { const t = String(g || "").trim().toLowerCase(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; };
  function normalizarGeneros() {
    if (generosNormalizados || !Nucleo.datos.peliculas().length) return;
    Nucleo.datos.peliculas().forEach(p => {
      if (typeof p.genero === "string" && p.genero) {
        p.genero = [...new Set(p.genero.split(",").map(canonico).filter(Boolean))].join(", ");
      }
    });
    const conteo = {};
    Nucleo.datos.peliculas().forEach(p => (p.genero || "").split(",").map(x => x.trim()).filter(Boolean)
      .forEach(g => conteo[g] = (conteo[g] || 0) + 1));
    const s = sel.genero;
    if (s) {
      s.innerHTML = '<option value="">Todos los géneros</option>' +
        Object.keys(conteo).sort((a, b) => a.localeCompare(b, "es"))
          .map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join("");
    }
    generosNormalizados = true;
    if (typeof llenarSugerencias === "function") llenarSugerencias(); // la lista de búsqueda ya no repite variantes
  }

  // Géneros más comunes para la cuadrícula; «Ver todos» muestra el resto
  let verTodosGeneros = false;
  const TOP_GENEROS = 6;

  // Buscar: solo la cuadrícula de géneros
  let host = document.getElementById("filtrosVisuales");
  if (!host) {
    host = document.createElement("div");
    host.id = "filtrosVisuales";
    host.className = "filtros-visuales";
    pestana.appendChild(host);
  }

  // Catálogo: los demás filtros, directamente visibles, justo debajo de la píldora de secciones
  let hostCatalogo = document.getElementById("filtrosCatalogo");
  if (!hostCatalogo) {
    hostCatalogo = document.createElement("div");
    hostCatalogo.id = "filtrosCatalogo";
    hostCatalogo.className = "filtros-visuales solo-catalogo";
    hostCatalogo.setAttribute("data-zona", "lista");
    // Justo debajo de la píldora de secciones (Lista / Estrenos / Sagas…), que se ve siempre en Catálogo
    const ref = document.getElementById("selectorZona");
    if (ref && ref.parentNode) ref.parentNode.insertBefore(hostCatalogo, ref.nextSibling);
    else { const lista = document.getElementById("lista"); if (lista) lista.parentNode.insertBefore(hostCatalogo, lista); }
  }

  function bloqueGeneros() {
    const c = CAMPOS.find(x => x.grid);
    const s = c && c.select();
    if (!s) return "";
    const opciones = [...s.options];
    const conteoG = {};
    Nucleo.datos.peliculas().forEach(p => (p.genero || "").split(",").map(x => x.trim()).filter(Boolean)
      .forEach(g => conteoG[g] = (conteoG[g] || 0) + 1));
    const todas = opciones.filter(o => o.value);
    const topVal = todas.slice().sort((a, b) => (conteoG[b.value] || 0) - (conteoG[a.value] || 0)).slice(0, TOP_GENEROS).map(o => o.value);
    const visibles = verTodosGeneros ? opciones : opciones.filter(o => !o.value || topVal.includes(o.value) || o.value === s.value);
    const boton = todas.length > TOP_GENEROS
      ? '<button type="button" class="fv-ver-todos" data-accion="ver-todos">' + (verTodosGeneros ? "Ver menos" : "Ver todos") + '</button>' : "";
    return '<div class="fv-bloque"><h3>' + esc(c.etiqueta) + '</h3><div class="fv-grid">' +
      visibles.map(o => {
        const e = o.value ? estiloGenero(o.value) : { a: "#6b7280", b: "#374151", i: "🎬", n: "Todos" };
        const marcada = o.value !== "" && o.value === s.value; // «Todos» no se marca como elegido
        return '<button type="button" class="fv-genero' + (marcada ? " activo" : "") +
          '" data-campo="' + c.clave + '" data-valor="' + esc(o.value) + '" style="--c:' + e.a + ';--c2:' + e.b + '">' +
          '<span class="fv-ico" aria-hidden="true">' + e.i + '</span><span class="fv-nombre">' + esc(e.n) + '</span></button>';
      }).join("") +
      '</div>' + boton + '</div>';
  }

  function bloqueCampo(c) {
    const s = c.select();
    if (!s) return "";
    return '<div class="fv-bloque"><h3>' + esc(c.etiqueta) + '</h3><div class="fv-pilas">' +
      [...s.options].map(o => '<button type="button" class="fv-pila' + (o.value === s.value ? " activo" : "") +
        '" data-campo="' + c.clave + '" data-valor="' + esc(o.value) + '">' + esc(o.text) + '</button>').join("") +
      '</div></div>';
  }

  function pintarFiltros() {
    host.innerHTML = bloqueGeneros();
    hostCatalogo.innerHTML = CAMPOS.filter(c => !c.grid).map(bloqueCampo).join("");
  }

  // Al tocar una opción: cambia el valor del select original y repinta la lista
  const alClic = e => {
    const v = e.target.closest && e.target.closest("[data-accion='ver-todos']");
    if (v) { verTodosGeneros = !verTodosGeneros; pintarFiltros(); return; }
    const b = e.target.closest && e.target.closest("[data-campo]");
    if (!b) return;
    // Un género (no «Todos») abre su propia pantalla, con una respuesta táctil breve
    if (b.dataset.campo === "genero" && b.dataset.valor && typeof abrirPantallaGenero === "function") {
      b.classList.add("pulsa");
      setTimeout(() => { b.classList.remove("pulsa"); abrirPantallaGenero(b.dataset.valor); }, 120);
      return;
    }
    const campo = CAMPOS.find(c => c.clave === b.dataset.campo);
    const s = campo && campo.select();
    if (!s) return;
    // Tocar una opción activa la quita
    s.value = (b.classList.contains("activo") && !b.classList.contains("fv-genero")) ? "" : b.dataset.valor;
    pintar();
  };
  host.addEventListener("click", alClic);
  hostCatalogo.addEventListener("click", alClic);

  // Cada vez que se pinta la lista, se refrescan las tarjetas (reflejan también «Limpiar» y los filtros guardados)
  const pintarOriginal = window.pintar;
  // Pestaña Buscar: sin controles de Notas/Vistas y sin películas hasta que haya un criterio
  const TEXTO_AJENO = /^(Ordenar notas|Agrupar por tema)$/;
  const ocultadosAjenos = new Set();
  let listaOcultaPorBuscar = false;
  function criterioActivo() {
    return !!(buscar && buscar.value.trim()) || Object.values(sel).some(x => x && x.value);
  }
  function ajustarBuscar() {
    const enB = document.body.classList.contains("en-buscar");
    document.querySelectorAll("#app label, #app button").forEach(el => {
      if (el.closest("#pestanaBuscar")) return;
      if (!TEXTO_AJENO.test((el.textContent || "").trim())) return;
      const bloque = el.closest(".campo, .barra-acciones, .toolbar, .toolbar-notas, .toolbar-vistas") || el;
      if (enB) { bloque.style.display = "none"; ocultadosAjenos.add(bloque); }
      else if (ocultadosAjenos.has(bloque)) { bloque.style.display = ""; ocultadosAjenos.delete(bloque); }
    });
    const lista = document.getElementById("lista");
    const hub = document.getElementById("hubListas");
    if (!lista) return;
    if (enB && !criterioActivo()) { lista.style.display = "none"; listaOcultaPorBuscar = true; }
    else if (listaOcultaPorBuscar && (!hub || hub.hidden)) { lista.style.display = ""; listaOcultaPorBuscar = false; }
  }

  window.pintar = function () {
    normalizarGeneros();
    const r = pintarOriginal.apply(this, arguments);
    pintarFiltros();
    ajustarBuscar();
    return r;
  };
  pintarFiltros();

  if (window.Nucleo) {
    Nucleo.registrar("filtros-visuales", { version: "1.2", emite: [], escucha: [] });
  }
})();
