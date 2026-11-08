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

  peliculas.forEach(p => {
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
    if ((marcas[p.titulo] || {}).descartada) {
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
  peliculas.forEach(p => {
    const o = marcas[p.titulo] || {};
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
    const idx = peliculas.indexOf(r.p);
    const img = (r.p.portada && !datosLimitados())
      ? '<img src="' + esc(r.p.portada) + '" alt="">'
      : '<div class="sinportada-mini">🎬</div>';
    const abierto = porQueAbiertos.has(r.p.titulo);
    const detalle = abierto
      ? '<p class="porque-lista">' + esc(fraseRecomendacion(r)) + '</p>' +
        '<ul class="porque-lista porque-desglose">' +
        lineasPorQue(r.desglose).map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>'
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
