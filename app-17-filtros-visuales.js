/* ===== Fase 3 · Módulo «filtros-visuales»: reemplaza los menús desplegables por tarjetas de género
   y píldoras táctiles. Usa los mismos select como fuente de verdad: al tocar una opción cambia su valor
   y llama a pintar(), así que el filtrado no cambia. ===== */
(function () {
  const pestana = document.getElementById("pestanaBuscar");
  if (!pestana) return;

  const CAMPOS = [
    { clave: "genero", etiqueta: "Género", select: () => sel.genero, grid: true },
    { clave: "tipo", etiqueta: "Tipo", select: () => sel.tipo },
    { clave: "duracion", etiqueta: "Duración", select: () => sel.duracion },
    { clave: "anio", etiqueta: "Año", select: () => sel.anio },
    { clave: "estado", etiqueta: "Estado", select: () => sel.estado },
    { clave: "tema", etiqueta: "Tema", select: () => sel.tema },
    { clave: "pais", etiqueta: "País", select: () => sel.pais },
    { clave: "orden", etiqueta: "Orden", select: () => $("orden") }
  ];

  const COLORES = {
    "Acción": "#ef4444", "Aventura": "#84cc16", "Animación": "#22c55e", "Comedia": "#f59e0b",
    "Crimen": "#7c2d12", "Documental": "#0d9488", "Drama": "#6366f1", "Familia": "#f97316",
    "Fantasía": "#a855f7", "Historia": "#92400e", "Terror": "#111827", "Romance": "#ec4899",
    "Ciencia ficción": "#06b6d4", "Suspenso": "#475569", "Guerra": "#4b5563", "Música": "#db2777",
    "Misterio": "#334155", "Western": "#a16207"
  };
  const colorDe = g => COLORES[g] || "#6b7280";

  let host = document.getElementById("filtrosVisuales");
  if (!host) {
    host = document.createElement("div");
    host.id = "filtrosVisuales";
    host.className = "filtros-visuales";
    pestana.appendChild(host);
  }

  function pintarFiltros() {
    host.innerHTML = CAMPOS.map(c => {
      const s = c.select();
      if (!s) return "";
      const opciones = [...s.options];
      if (c.grid) {
        return '<div class="fv-bloque"><h3>' + esc(c.etiqueta) + '</h3><div class="fv-grid">' +
          opciones.map(o => '<button type="button" class="fv-genero' + (o.value === s.value ? " activo" : "") +
            '" data-campo="' + c.clave + '" data-valor="' + esc(o.value) + '" style="--c:' +
            (o.value ? colorDe(o.value) : "#374151") + '"><span>' + esc(o.text) + '</span></button>').join("") +
          '</div></div>';
      }
      return '<div class="fv-bloque"><h3>' + esc(c.etiqueta) + '</h3><div class="fv-pilas">' +
        opciones.map(o => '<button type="button" class="fv-pila' + (o.value === s.value ? " activo" : "") +
          '" data-campo="' + c.clave + '" data-valor="' + esc(o.value) + '">' + esc(o.text) + '</button>').join("") +
        '</div></div>';
    }).join("");
  }

  // Al tocar una opción: cambia el valor del select original y repinta la lista
  host.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-campo]");
    if (!b) return;
    const campo = CAMPOS.find(c => c.clave === b.dataset.campo);
    const s = campo && campo.select();
    if (!s) return;
    s.value = b.dataset.valor;
    pintar();
  });

  // Cada vez que se pinta la lista, se refrescan las tarjetas (así reflejan también «Limpiar» y los filtros guardados)
  const pintarOriginal = window.pintar;
  window.pintar = function () {
    const r = pintarOriginal.apply(this, arguments);
    pintarFiltros();
    return r;
  };
  pintarFiltros();

  if (window.Nucleo) {
    Nucleo.registrar("filtros-visuales", { version: "1.0", emite: [], escucha: [] });
  }
})();
