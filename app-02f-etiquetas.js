/* ===== Fase 0 · Módulo «etiquetas»: funciones de etiquetas con # dentro de las notas. Se carga antes que app-02; sus listeners siguen en app-02 en su orden original. Migrado sin cambios de comportamiento. ===== */
/* ---------- Etiquetas con # dentro de las notas ---------- */
const TAG_RE = /#[\p{L}\p{N}_-]+/gu;

function etiquetasDeNota(texto) {
  const encontradas = String(texto || "").match(TAG_RE) || [];
  const vistos = new Set();
  const salida = [];
  encontradas.forEach(t => {
    const limpia = t.slice(1).toLowerCase();
    const clave = norm(limpia);
    if (!clave || vistos.has(clave)) return;
    vistos.add(clave);
    salida.push(limpia);
  });
  return salida;
}

function coincideEtiqueta(p, etiqueta) {
  const m = Nucleo.datos.marcas()[p.titulo] || {};
  const buscada = norm(etiqueta);
  return etiquetasDeNota(m.nota).some(t => norm(t) === buscada);
}

function etiquetasFichaHtml(texto) {
  const tags = etiquetasDeNota(texto);
  if (!tags.length) {
    return '<span class="ayuda-etiquetas">Escribe #palabra en tu nota para crear etiquetas.</span>';
  }
  return tags.map(t => '<button class="etiqueta" data-tag="' + esc(t) + '">#' + esc(t) + '</button>').join("");
}

function renderBarraEtiquetas() {
  const bar = $("tagsNotas");
  const conteo = new Map();
  Nucleo.datos.peliculas().forEach(p => {
    etiquetasDeNota((Nucleo.datos.marcas()[p.titulo] || {}).nota).forEach(t => {
      const clave = norm(t);
      const previo = conteo.get(clave) || { t, n: 0 };
      previo.n++;
      conteo.set(clave, previo);
    });
  });
  if (!conteo.size) {
    bar.style.display = "none";
    bar.innerHTML = "";
    return;
  }
  const actual = norm(buscar.value.trim());
  const orden = [...conteo.values()].sort((a, b) => b.n - a.n || a.t.localeCompare(b.t, "es"));
  bar.style.display = "flex";
  bar.innerHTML = orden.map(x =>
    '<button class="etiqueta' + (actual === "#" + norm(x.t) ? ' activa' : '') + '" data-tag="' + esc(x.t) + '">#' +
    esc(x.t) + ' (' + x.n + ')</button>'
  ).join("");
}

if (window.Nucleo) { Nucleo.registrar("etiquetas", { version: "1.0", emite: [], escucha: [] }); }
