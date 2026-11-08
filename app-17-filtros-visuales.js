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

    host.innerHTML = bloqueRapidos + CAMPOS.map(c => {
      const s = c.select();
      if (!s) return "";
      const opciones = [...s.options];
      if (c.grid) {
        return '<div class="fv-bloque"><h3>' + esc(c.etiqueta) + '</h3><div class="fv-grid">' +
          opciones.map(o => {
            const e = o.value ? estiloGenero(o.value) : { a: "#6b7280", b: "#374151", i: "🎬", n: "Todos" };
            return '<button type="button" class="fv-genero' + (o.value === s.value ? " activo" : "") +
              '" data-campo="' + c.clave + '" data-valor="' + esc(o.value) + '" style="--c:' + e.a + ';--c2:' + e.b + '">' +
              '<span class="fv-ico" aria-hidden="true">' + e.i + '</span><span class="fv-nombre">' + esc(e.n) + '</span></button>';
          }).join("") +
          '</div></div>';
      }
      return '<div class="fv-bloque"><h3>' + esc(c.etiqueta) + '</h3><div class="fv-pilas">' +
        opciones.map(o => '<button type="button" class="fv-pila' + (o.value === s.value ? " activo" : "") +
          '" data-campo="' + c.clave + '" data-valor="' + esc(o.value) + '">' + esc(o.text) + '</button>').join("") +
        '</div></div>';
    }).join("");
  }

  // Al tocar una opción (o un filtro rápido): cambia el valor del select original y repinta la lista
  host.addEventListener("click", e => {
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
    const r = pintarOriginal.apply(this, arguments);
    pintarFiltros();
    return r;
  };
  pintarFiltros();

  if (window.Nucleo) {
    Nucleo.registrar("filtros-visuales", { version: "1.1", emite: [], escucha: [] });
  }
})();
