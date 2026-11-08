/* ===== Fase 0 · Módulo «recomendaciones»: recomendaciones según tus calificaciones. Migrado de app-02 sin cambios de comportamiento. ===== */
/* ---------- Recomendaciones según calificaciones ---------- */
// Frase de origen: «, como en «Título»» (una sola película de tu historial)
function sobreFuente(f) { return f && f[0] ? ", como en «" + f[0].titulo + "»" : ""; }

function calcularRecomendaciones() {
  const pesoGenero = {}, pesoDirector = {};
  const fuentesGenero = {}, fuentesDirector = {};
  const restaGenero = {}, restaDirector = {};
  const fuentesRestaGenero = {}, fuentesRestaDirector = {};
  const pesoActor = {}, fuentesActor = {};

  Nucleo.datos.peliculas().forEach(p => {
    const s = estadoDe(p);
    if (s.estrellas >= 4) {
      generosDe(p).forEach(g => {
        pesoGenero[g] = (pesoGenero[g] || 0) + 1;
        (fuentesGenero[g] = fuentesGenero[g] || []).push({ titulo: p.titulo, estrellas: s.estrellas });
      });
      directoresDe(p).forEach(d => {
        pesoDirector[d] = (pesoDirector[d] || 0) + 2;
        (fuentesDirector[d] = fuentesDirector[d] || []).push({ titulo: p.titulo, estrellas: s.estrellas });
      });
      if (s.estrellas >= 5) {
        String(p.reparto || "").split(",").map(x => x.trim()).filter(Boolean).forEach(a => {
          pesoActor[a] = (pesoActor[a] || 0) + 1;
          (fuentesActor[a] = fuentesActor[a] || []).push({ titulo: p.titulo, estrellas: s.estrellas });
        });
      }
    }
    if ((Nucleo.datos.marcas()[p.titulo] || {}).descartada) {
      generosDe(p).forEach(g => {
        restaGenero[g] = (restaGenero[g] || 0) + 1;
        (fuentesRestaGenero[g] = fuentesRestaGenero[g] || []).push({ titulo: p.titulo });
      });
      directoresDe(p).forEach(d => {
        restaDirector[d] = (restaDirector[d] || 0) + 2;
        (fuentesRestaDirector[d] = fuentesRestaDirector[d] || []).push({ titulo: p.titulo });
      });
    }
  });

  if (!Object.keys(pesoGenero).length && !Object.keys(pesoDirector).length && !Object.keys(pesoActor).length) return [];

  const candidatas = [];
  Nucleo.datos.peliculas().forEach(p => {
    const o = Nucleo.datos.marcas()[p.titulo] || {};
    if (o.vista || o.pendiente || o.descartada || o.estrellas) return;

    let puntaje = 0;
    let mejorRazon = null, mejorPeso = 0;
    const desglose = [];

    directoresDe(p).forEach(d => {
      const w = pesoDirector[d] || 0;
      const r = restaDirector[d] || 0;
      if (w > 0) {
        puntaje += w;
        desglose.push({ etiqueta: "Director " + d, puntos: w, fuentes: fuentesDirector[d] });
        if (w > mejorPeso) { mejorPeso = w; mejorRazon = "Por el director " + d + sobreFuente(fuentesDirector[d]); }
      }
      if (r > 0) {
        puntaje -= r;
        desglose.push({ etiqueta: "Director " + d, puntos: -r, fuentes: fuentesRestaDirector[d] });
      }
    });
    String(p.reparto || "").split(",").map(x => x.trim()).filter(Boolean).forEach(a => {
      const w = pesoActor[a] || 0;
      if (w > 0) {
        puntaje += w;
        desglose.push({ etiqueta: "Actor " + a, puntos: w, fuentes: fuentesActor[a] });
        if (w > mejorPeso) { mejorPeso = w; mejorRazon = "Con " + a + sobreFuente(fuentesActor[a]); }
      }
    });
    generosDe(p).forEach(g => {
      const w = pesoGenero[g] || 0;
      const r = restaGenero[g] || 0;
      if (w > 0) {
        puntaje += w;
        desglose.push({ etiqueta: "Género " + g, puntos: w, fuentes: fuentesGenero[g] });
        if (w > mejorPeso) { mejorPeso = w; mejorRazon = "Género: " + g + sobreFuente(fuentesGenero[g]); }
      }
      if (r > 0) {
        puntaje -= r;
        desglose.push({ etiqueta: "Género " + g, puntos: -r, fuentes: fuentesRestaGenero[g] });
      }
    });

    if (puntaje > 0) candidatas.push({ p, puntaje, razon: mejorRazon, desglose });
  });

  candidatas.sort((a, b) => b.puntaje - a.puntaje || String(a.p.titulo).localeCompare(String(b.p.titulo), "es"));
  return candidatas.slice(0, 6);
}

// Convierte el desglose en una frase corta y legible
function fraseRecomendacion(r) {
  const positivos = r.desglose.filter(d => d.puntos > 0);
  const negativos = r.desglose.filter(d => d.puntos < 0);

  if (!positivos.length) {
    return "Tiene géneros o directores que descartaste antes.";
  }

  // Los directores pesan más, así que tienen prioridad
  const dir = positivos.find(d => d.etiqueta.startsWith("Director "));
  const base = dir || positivos[0];
  const nombre = base.etiqueta.replace(/^(Director|Género) /, "");

  const titulos = base.fuentes
    .slice()
    .sort((a, b) => b.estrellas - a.estrellas)
    .map(f => "«" + f.titulo + "»");

  let lista;
  if (titulos.length === 1) lista = titulos[0];
  else if (titulos.length === 2) lista = titulos[0] + " y " + titulos[1];
  else lista = titulos[0] + " y " + titulos[1] + " y " + (titulos.length - 2) + " más";

  let frase = dir
    ? "Porque te gustó " + lista + ", dirigida por " + nombre
    : "Porque te gustaron " + lista + ", que comparten el género " + nombre;

  if (negativos.length) frase += ". Ojo: hay algo parecido a lo que descartaste";
  return frase + ".";
}

// Desglose legible: los puntos negativos muestran la película descartada que los causó
function lineasPorQue(desglose) {
  return desglose.map(d => {
    if (d.puntos < 0) {
      const f = d.fuentes[0];
      const otras = d.fuentes.length - 1;
      return d.etiqueta + " (" + d.puntos + ", por descartada: " + f.titulo +
        (otras > 0 ? " y " + otras + " más" : "") + ")";
    }
    const fuentes = d.fuentes.slice().sort((a, b) => b.estrellas - a.estrellas);
    const mejor = fuentes[0];
    const otras = fuentes.length - 1;
    return d.etiqueta + " (+" + d.puntos + ", por tu " + mejor.estrellas + "★ en " + mejor.titulo +
      (otras > 0 ? " y " + otras + " más" : "") + ")";
  });
}

function renderRecomendaciones() {
  const sec = $("recomendaciones");
  if (hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  const recs = calcularRecomendaciones();
  if (!recs.length) {
    sec.style.display = "none";
    return;
  }
  sec.style.display = "block";
  $("recomCarrusel").innerHTML = recs.map(r => {
    const idx = Nucleo.datos.peliculas().indexOf(r.p);
    const img = (r.p.portada && !datosLimitados())
      ? '<img src="' + esc(r.p.portada) + '" alt="">'
      : '<div class="sinportada-mini">🎬</div>';
    const abierto = porQueAbiertos.has(r.p.titulo);
    const detalle = abierto
      ? '<p class="porque-lista">' + esc(fraseRecomendacion(r)) + '</p>' +
        '<ul class="porque-lista porque-desglose">' +
        lineasPorQue(r.desglose).map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' +
        '<button type="button" class="pildora" data-compartir-titulo="' + esc(r.p.titulo) + '" data-compartir-anio="' + esc(String(r.p["año"] || "")) + '" data-compartir-razon="' + esc(lineasPorQue(r.desglose).join(" · ")) + '">📤 Compartir</button>' + botonesNoMeInteresa(r.p)
      : '';
    return '<div class="dest" data-idx="' + idx + '">' + img +
      '<div class="dest-titulo">' + esc(r.p.titulo) + '</div>' +
      '<div class="dest-anio">' + esc(r.p["año"]) + '</div>' +
      '<div class="dest-razon">' + esc(r.razon) + '</div>' +
      '<button class="pildora porque-btn" data-porque="' + idx + '">' + (abierto ? 'Ocultar' : '¿Por qué?') + '</button>' +
      detalle + '</div>';
  }).join("");
}

if (window.Nucleo) { Nucleo.registrar("recomendaciones", { version: "1.0", emite: [], escucha: [] }); }


/* Fase 4 · Corregir el criterio: «No me interesa este director». Las recomendaciones de un director excluido
   no aparecen. La lista

/* Fase 4 · Corregir el criterio: «No me interesa» por director, género o actor. Las recomendaciones que
   coincidan con un criterio excluido no aparecen. La lista se revisa y se quita desde Yo → Criterios excluidos. */
const CLAVES_EXCL = { director: "recom_directores_excluidos", genero: "recom_generos_excluidos", actor: "recom_actores_excluidos" };
const ETIQUETAS_EXCL = { director: "Director", genero: "Género", actor: "Actor" };
const TIPOS_EXCL = ["director", "genero", "actor"];
const PLURAL_EXCL = { director: "Directores", genero: "Géneros", actor: "Actores" };
function excluidos(tipo) {
  try { return new Set(JSON.parse(localStorage.getItem(CLAVES_EXCL[tipo]) || "[]")); } catch (e) { return new Set(); }
}
function guardarExcluidos(tipo, set) {
  try { localStorage.setItem(CLAVES_EXCL[tipo], JSON.stringify([...set])); } catch (e) {}
}
function valoresDe(p, tipo) {
  if (tipo === "director") return directoresDe(p);
  if (tipo === "genero") return generosDe(p);
  return String(p.reparto || "").split(",").map(x => x.trim()).filter(Boolean);
}
function excluirValor(tipo, nombre) {
  const s = excluidos(tipo); s.add(nombre); guardarExcluidos(tipo, s);
  renderRecomendaciones();
}
function quitarValor(tipo, nombre) {
  const s = excluidos(tipo); s.delete(nombre); guardarExcluidos(tipo, s);
  renderRecomendaciones();
}
// Un botón por criterio de la recomendación (el principal de cada tipo)
function botonesNoMeInteresa(p) {
  return TIPOS_EXCL.map(tipo => {
    const v = valoresDe(p, tipo)[0];
    return v ? '<button type="button" class="pildora" data-excluir-tipo="' + tipo + '" data-excluir-valor="' + esc(v) + '">✕ ' + ETIQUETAS_EXCL[tipo] + ': ' + esc(v) + '</button>' : "";
  }).join("");
}
// Filtro envolvente: no toca el cálculo, solo quita lo que coincide con un criterio excluido
const calcularRecomendacionesBase = calcularRecomendaciones;
calcularRecomendaciones = function () {
  const base = calcularRecomendacionesBase();
  const ex = {};
  TIPOS_EXCL.forEach(t => { ex[t] = excluidos(t); });
  if (TIPOS_EXCL.every(t => !ex[t].size)) return base;
  return base.filter(r => !TIPOS_EXCL.some(t => valoresDe(r.p, t).some(v => ex[t].has(v))));
};
function abrirCriterios() {
  const bloques = TIPOS_EXCL.map(tipo => {
    const lista = [...excluidos(tipo)];
    if (!lista.length) return "";
    return '<h4>' + PLURAL_EXCL[tipo] + ' excluidos</h4><ul class="reglas-lista">' + lista.map(v =>
      '<li class="regla-fila"><span>' + esc(v) + '</span> <button type="button" class="pildora" data-quitar-tipo="' + tipo + '" data-quitar-valor="' + esc(v) + '">Volver a mostrar</button></li>'
    ).join("") + '</ul>';
  }).join("");
  const cuerpo = (bloques || '<p class="meta">No has excluido ningún director, género ni actor. Puedes hacerlo desde «¿Por qué?» en una recomendación.</p>') +
    '<p class="meta">Excluir un género puede quitar muchas recomendaciones.</p>';
  abrirVentanaSimple("criterios", "Criterios excluidos", cuerpo);
  const ventana = document.getElementById("criterios");
  if (!ventana) return;
  ventana.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-quitar-tipo]");
    if (!b) return;
    ventana.remove();
    quitarValor(b.dataset.quitarTipo, b.dataset.quitarValor);
    abrirCriterios();
  });
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-excluir-tipo]");
  if (b) excluirValor(b.dataset.excluirTipo, b.dataset.excluirValor);
});
if (window.Nucleo) {
  Nucleo.criterios = { abrir: abrirCriterios, lista: () => TIPOS_EXCL.reduce((o, t) => (o[t] = [...excluidos(t)], o), {}) };
}
