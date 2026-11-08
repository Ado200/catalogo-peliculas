/* ===== Fase 3 · Módulo «filtros-visuales»: filtros rápidos y tarjetas de género con su color.
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

  // Filtros rápidos: se muestran solo si la opción existe en los datos del catálogo
  const RAPIDOS = [
    { texto: "Cortas (< 1.5h)", campo: "duracion", busca: /1[.,]?5|corta|menos de/i },
    { texto: "+2 horas", campo: "duracion", busca: /2 ?h|m[aá]s de 2|larga/i },
    { texto: "Año 2024", campo: "anio", valor: "2024" },
    { texto: "Mejor valoradas", campo: "estado", busca: /valorad|favorit/i }
  ];
  function opcionRapida(r) {
    const campo = CAMPOS.find(c => c.clave === r.campo);
    const s = campo && campo.select();
    if (!s) return null;
    const op = r.valor !== undefined
      ? [...s.options].find(o => o.value === r.valor)
      : [...s.options].find(o => r.busca.test(o.text));
    return op ? { s: s, op: op, campo: r.campo } : null;
  }

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
  }

  // Géneros más comunes para la cuadrícula; «Ver todos» muestra el resto
  let verTodosGeneros = false;
  // Filtros que se muestran plegados detrás de «Más filtros»
  let verMasFiltros = false;
  const PRINCIPALES = ["tipo", "duracion"];
  const TOP_GENEROS = 6;

  let host = document.getElementById("filtrosVisuales");
  if (!host) {
    host = document.createElement("div");
    host.id = "filtrosVisuales";
    host.className = "filtros-visuales";
    pestana.appendChild(host);
  }

  function pintarFiltros() {
    const rapidos = RAPIDOS.map(r => ({ r: r, o: opcionRapida(r) })).filter(x => x.o);
    const bloqueRapidos = rapidos.length
      ? '<div class="fv-bloque"><h3>Filtros rápidos</h3><div class="fv-pilas">' +
        rapidos.map(x => '<button type="button" class="fv-rapido' + (x.o.s.value === x.o.op.value ? " activo" : "") +
          '" data-campo="' + x.o.campo + '" data-valor="' + esc(x.o.op.value) + '">' + esc(x.r.texto) + '</button>').join("") +
        '</div></div>'
      : "";

    const mostrarCampo = c => c.grid || PRINCIPALES.includes(c.clave) || verMasFiltros;
    const hayMas = CAMPOS.some(c => !c.grid && !PRINCIPALES.includes(c.clave));
    const botonMas = hayMas
      ? '<button type="button" class="fv-mas" data-accion="mas-filtros">' + (verMasFiltros ? "Menos filtros" : "Más filtros") + '</button>'
      : "";

    host.innerHTML = bloqueRapidos + CAMPOS.filter(mostrarCampo).map(c => {
      const s = c.select();
      if (!s) return "";
      const opciones = [...s.options];
      if (c.grid) {
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
      return '<div class="fv-bloque"><h3>' + esc(c.etiqueta) + '</h3><div class="fv-pilas">' +
        opciones.map(o => '<button type="button" class="fv-pila' + (o.value === s.value ? " activo" : "") +
          '" data-campo="' + c.clave + '" data-valor="' + esc(o.value) + '">' + esc(o.text) + '</button>').join("") +
        '</div></div>';
    }).join("") + botonMas;
  }

  // Al tocar una opción (o un filtro rápido): cambia el valor del select original y repinta la lista
  host.addEventListener("click", e => {
    const v = e.target.closest && e.target.closest("[data-accion='ver-todos']");
    if (v) { verTodosGeneros = !verTodosGeneros; pintarFiltros(); return; }
    const m = e.target.closest && e.target.closest("[data-accion='mas-filtros']");
    if (m) { verMasFiltros = !verMasFiltros; pintarFiltros(); return; }
    const b = e.target.closest && e.target.closest("[data-campo]");
    if (!b) return;
    const campo = CAMPOS.find(c => c.clave === b.dataset.campo);
    const s = campo && campo.select();
    if (!s) return;
    // Tocar un filtro rápido activo lo quita
    s.value = (b.classList.contains("activo") && b.classList.contains("fv-rapido")) ? "" : b.dataset.valor;
    pintar();
  });

  // Cada vez que se pinta la lista, se refrescan las tarjetas (reflejan también «Limpiar» y los filtros guardados)
  const pintarOriginal = window.pintar;
  window.pintar = function () {
    normalizarGeneros();
    const r = pintarOriginal.apply(this, arguments);
    pintarFiltros();
    return r;
  };
  pintarFiltros();

  if (window.Nucleo) {
    Nucleo.registrar("filtros-visuales", { version: "1.1", emite: [], escucha: [] });
  }
})();
