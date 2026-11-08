/* ===== Fase 0 · Módulo «pintado-principal»: funciones que pintan la lista de películas. Se carga antes que app-03; su listener de clics sigue en app-03 en su lugar original. Migrado sin cambios de comportamiento. ===== */
/* ---------- Pintado principal ---------- */
function pintar() {
  document.body.dataset.pestana = pestana;
  if (pestana !== "catalogo") { pintarPestana(); return; }
  $("tagsNotas").style.display = "none";

  const f = buscar.value.trim().toLowerCase();
  visibles = peliculas.filter(p => {
    const m = marcas[p.titulo] || {};
    const texto = [p.titulo, p.director, p.reparto, m.nota || "", m.conQuien || ""].join(" ").toLowerCase();
    return coincideBusqueda(p, f) &&
      (!sel.tipo.value || p.tipo === sel.tipo.value) &&
      (!sel.genero.value || generosDe(p).includes(sel.genero.value)) &&
      (!sel.tema.value || temasDe(p).includes(sel.tema.value)) &&
      (!sel.anio.value || String(p["año"]) === sel.anio.value) &&
      (!sel.pais.value || p.pais === sel.pais.value) &&
      enRangoDuracion(p, sel.duracion.value) &&
      coincideEstado(p, sel.estado.value);
  });
  visibles.sort(ordenes[$("orden").value]);
  visibles = ordenarPorAnimo(visibles);

  const { vistas, pendientes } = contarEstados();
  $("destacados").style.display = hayFiltros() ? "none" : "block";
  renderRecomendaciones();
  if (typeof renderSaludoPersonal === "function") renderSaludoPersonal();
  if (typeof renderTarjetaAuto === "function") renderTarjetaAuto();
  renderHoy();
  actualizarAhora();
  renderAvisoEstancados();
  actualizarAvisoFecha();
  renderCena();
  renderEstaSemana();
  renderPregunta();
  renderBienvenida();
  renderDuelo();
  renderSagas();
  renderActores();
  revisarSalud();
  actualizarBotonSalud();
  actualizarBotonAvanzados();
  renderChips();
  contador.textContent = visibles.length + " de " + peliculas.length + " títulos · " +
    vistas + " vistas · " + pendientes + " pendientes" + (datosLimitados() ? " · modo ahorro" : "");

  ajustarQueVer();
  if (!visibles.length) {
    lista.innerHTML = '<p class="vacio">No encontré películas con esos criterios. Prueba quitando algún filtro o cambiando la búsqueda.</p>';
    return;
  }
  if (agrupado) {
    lista.innerHTML = renderAgrupado();
    return;
  }
  lista.innerHTML = visibles.map((p, i) => vistaLista ? filaHtml(p, i) : tarjeta(p, i)).join("");
  marcarAnimo();
}

function pintarPestana() {
  $("resumenSemana").style.display = "none";
  $("avisoFecha").style.display = "none";
  $("avisoEstancados").style.display = "none";
  $("tagsNotas").style.display = "none";
  $("toolbarNotas").style.display = "none";
  $("toolbarVistas").style.display = "none";
  $("destacados").style.display = "none";
  $("salud").classList.add("oculto");
  $("ahora").style.display = "none";
  $("queVer").style.display = "none";
  $("estaSemana").style.display = "none";
  $("duelo").style.display = "none";
  $("pregunta").style.display = "none";
  $("bienvenida").style.display = "none";
  $("mapaGustos").style.display = "none";
  destruirMapa();
  $("recomendaciones").style.display = "none";
  chips.innerHTML = "";

  if (pestana === "vistas") {
    actualizarResumenSemana();
    renderActividad();
  renderExtrasActividad();
  }

  if (pestana === "descartadas") {
    renderPestanaDescartadas();
    return;
  }

  let items = [], extra = null, titulo = "";

  if (pestana === "notas") {
    const f = buscar.value.trim().toLowerCase();
    const etiquetaBuscada = f.startsWith("#") ? f.slice(1) : "";
    titulo = "Mis notas";
    items = peliculas.filter(p => (marcas[p.titulo] || {}).nota)
      .filter(p => etiquetaBuscada
        ? coincideEtiqueta(p, etiquetaBuscada)
        : [p.titulo, (marcas[p.titulo] || {}).nota].join(" ").toLowerCase().includes(f))
      .sort(ordenNotasFn());
    extra = p => {
      const m = marcas[p.titulo] || {};
      const txt = String(m.nota || "").slice(0, 160) + (String(m.nota || "").length > 160 ? "…" : "");
      const tags = etiquetasDeNota(m.nota).map(t => '<button class="etiqueta" data-tag="' + esc(t) + '">#' + esc(t) + '</button>').join("");
      return '<p class="nota-corta">' + esc(txt) + '</p>' +
        (tags ? '<div class="etiquetas-fila">' + tags + '</div>' : '') +
        '<div class="meta" style="margin-top:6px">Editada: ' + esc(m.notaFecha || "") + '</div>';
    };
    $("toolbarNotas").style.display = "flex";
    renderBarraEtiquetas();
  } else if (pestana === "pendientes") {
    titulo = "Pendientes";
    const todas = peliculas.filter(p => estadoDe(p).pendiente);
    const planeadas = todas.filter(p => estadoDe(p).conAlguien)
      .sort((a, b) => {
        const fa = (marcas[a.titulo] || {}).conFecha || "9999-12-31";
        const fb = (marcas[b.titulo] || {}).conFecha || "9999-12-31";
        return fa.localeCompare(fb) || String((marcas[a.titulo] || {}).conAlguienDesde || "").localeCompare(String((marcas[b.titulo] || {}).conAlguienDesde || ""));
      });
    const resto = todas.filter(p => !estadoDe(p).conAlguien)
      .sort((a, b) => String((marcas[a.titulo] || {}).pendienteDesde || "9999").localeCompare(String((marcas[b.titulo] || {}).pendienteDesde || "9999")));
    items = [...planeadas, ...resto];
    extra = p => '<div class="meta" style="margin-top:6px">' + esc(diasPendiente(p) === null ? "fecha desconocida" : "hace " + diasPendiente(p) + " días") + '</div>';

    visibles = items;
    contador.textContent = "Pendientes: " + items.length + " · con alguien: " + planeadas.length;

    if (!items.length) {
      lista.innerHTML = '<p class="vacio">Aún no tienes pendientes. Marca una película con «Pendiente» para verla después.</p>';
      return;
    }
    let html = "";
    if (planeadas.length) {
      html += '<div class="bloque-pend"><h3>Para ver con alguien (' + planeadas.length + ')</h3>' +
        '<div class="grupo-items">' +
        planeadas.map((p, i) => filaPestana(p, i,
          extra(p) +
          (marcas[p.titulo] && marcas[p.titulo].conQuien ? '<div class="meta">con ' + esc(marcas[p.titulo].conQuien) + '</div>' : '') +
          lineaFechaConAlguien(p)
        )).join("") +
        '</div></div>';
    }
    if (resto.length) {
      html += '<div class="bloque-pend"><h3>Otras pendientes (' + resto.length + ')</h3>' +
        '<div class="grupo-items">' +
        resto.map((p, i) => filaPestana(p, i, extra(p))).join("") +
        '</div></div>';
    }
    const diasResto = resto.map(p => diasPendiente(p)).filter(d => d !== null);
    const antigua = diasResto.length ? Math.max(...diasResto) : null;
    lista.innerHTML = heroPestana("pendientes", todas, { planeadas: planeadas.length, antigua: antigua }) + htmlCalendario() + html;
    return;
  } else if (pestana === "vistas") {
    titulo = "Vistas";
    items = peliculas.filter(p => estadoDe(p).vista)
      .sort((a, b) => String((marcas[b.titulo] || {}).vistaDesde || "").localeCompare(String((marcas[a.titulo] || {}).vistaDesde || "")));
    $("toolbarVistas").style.display = "flex";
    const personas = [...new Set(peliculas.map(p => (marcas[p.titulo] || {}).vistaCon).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es"));
    const selP = $("personaVistas");
    const previoP = selP.value;
    selP.innerHTML = '<option value="">Todas</option>' + personas.map(x => '<option value="' + esc(x) + '">' + esc(x) + '</option>').join("");
    selP.value = personas.includes(previoP) ? previoP : "";
    if (selP.value) items = items.filter(p => (marcas[p.titulo] || {}).vistaCon === selP.value);
    extra = p => {
      const m = marcas[p.titulo] || {};
      return (m.vistaDesde ? '<div class="meta" style="margin-top:6px">Vista el ' + esc(m.vistaDesde) + (m.vistaCon ? ' con ' + esc(m.vistaCon) : '') + '</div>' : '') +
        (m.nota ? '<details class="nota-recuerdo"><summary>Ver mi nota</summary><p class="nota-corta">' + esc(String(m.nota)) + '</p>' +
          (m.notaFecha ? '<div class="meta">Editada: ' + esc(m.notaFecha) + '</div>' : '') + '</details>' : '');
    };
  }

  visibles = items;
  contador.textContent = titulo + ": " + items.length + (items.length === 1 ? " título" : " títulos");

  if (!items.length) {
    const msg = pestana === "notas"
      ? "Aún no tienes notas. Abre una película y escribe en «Mi nota». Usa #palabras para etiquetarlas."
      : "Aún no marcas películas como vistas. Abre una película y pulsa «Vista» para empezar tu historial.";
    lista.innerHTML = '<p class="vacio">' + msg + '</p>';
    return;
  }
  const heroHtml = pestana === "vistas" ? heroPestana("vistas", items, {}) : "";
  lista.innerHTML = heroHtml + items.map((p, i) => filaPestana(p, i, extra ? extra(p) : "")).join("");
}

function iframeTrailer(codigo, titulo, auto = false) {
  const parametros = "?cc_load_policy=1&cc_lang_pref=es&hl=es&rel=0" + (auto ? "&autoplay=1" : "");
  return '<iframe src="https://www.youtube.com/embed/' + esc(codigo) + parametros + '" title="Tráiler de ' + esc(titulo) + '" ' +
    'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
    'allowfullscreen loading="lazy"></iframe>';
}

function bloqueTrailer(p) {
  const es = String(p.trailer_es || "").trim();
  const en = String(p.trailer_en || "").trim();
  const hayEs = es && es !== "sin tráiler";
  const hayEn = en && en !== "sin tráiler";

  if (!hayEs && !hayEn) {
    return '<div class="trailer"><div class="trailer-vacio">Esta película no tiene tráiler disponible.</div></div>';
  }

  if (hayEs && hayEn) {
    return '<div class="trailer"><div class="trailer-titulo">Tráiler</div>' +
      '<div class="trailer-opciones">' +
        '<button class="chipc activo" data-trailer="es" data-codigo="' + esc(es) + '">Español</button>' +
        '<button class="chipc" data-trailer="en" data-codigo="' + esc(en) + '">Inglés</button>' +
      '</div>' +
      '<div class="trailer-caja" id="trailerCaja">' + contenidoTrailer(es, p.titulo) + '</div></div>';
  }

  if (hayEs) {
    return '<div class="trailer"><div class="trailer-titulo">Tráiler en español</div>' +
      '<div class="trailer-caja">' + contenidoTrailer(es, p.titulo) + '</div></div>';
  }

  return '<div class="trailer"><div class="trailer-titulo">Tráiler en su idioma original (inglés)</div>' +
    '<div class="trailer-caja">' + contenidoTrailer(en, p.titulo) + '</div>' +
    '<div class="trailer-nota">Activa los subtítulos en el reproductor (CC) para verlos en español.</div></div>';
}

function urlReproducible(link) {
  const t = String(link || "").trim();
  if (!t) return "";
  const yt = t.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return "https://www.youtube.com/embed/" + yt[1] + "?rel=0&hl=es";
  return /^https:\/\//.test(t) ? t : "";
}
function abrirVerPelicula(titulo, es, en, link, auto = false) {
  const codigo = (es && es !== "sin tráiler") ? es : ((en && en !== "sin tráiler") ? en : "");
  const peli = urlReproducible(link);
  const peliSrc = auto && /youtube\.com\/embed/.test(peli) ? peli + (peli.includes("?") ? "&" : "?") + "autoplay=1" : peli;
  const previo = document.getElementById("miniReproductor");
  if (previo) previo.remove();
  const div = document.createElement("div");
  div.id = "miniReproductor";
  div.setAttribute("role", "region");
  div.setAttribute("aria-label", "Reproductor de " + titulo);
  div.dataset.titulo = titulo;
  div.dataset.codigo = codigo;
  div.dataset.peli = peli;
  div.innerHTML =
    '<div class="mr-barra"><span class="mr-titulo">▶ ' + esc(titulo) + '</span>' +
      '<span class="mr-pestanas">' +
        (peli ? '<button type="button" class="mr-chip activo" data-mr="peli">Película</button>' : '') +
        (codigo ? '<button type="button" class="mr-chip' + (peli ? '' : ' activo') + '" data-mr="trailer">Tráiler</button>' : '') +
      '</span>' +
      '<span class="mr-botones"><button type="button" data-mr="tamano" aria-label="Cambiar tamaño">⤢</button>' +
      (peli && !/youtube\.com\/embed/.test(peli) ? '<button type="button" data-mr="recorte" aria-label="Recortar barra lateral" title="Recortar barra lateral">✂</button>' : '') +
      '<button type="button" data-mr="min" aria-label="Minimizar">▁</button>' +
      '<button type="button" data-mr="cerrar" aria-label="Cerrar">✕</button></span></div>' +
    '<div class="mr-caja" id="mrCaja"></div>' +
    '<p class="mr-nota" id="mrNota"></p>';
  const caja = div.querySelector("#mrCaja");
  const nota = div.querySelector("#mrNota");
  const mostrar = (modo) => {
    div.querySelectorAll("[data-mr=peli],[data-mr=trailer]").forEach(b => b.classList.toggle("activo", b.dataset.mr === modo));
    if (modo === "peli" && peli) {
      caja.innerHTML = '<div class="mr-recorte" data-ancho="0"><iframe src="' + esc(peliSrc) + '" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="' + esc(titulo) + '"></iframe></div>';
      const bRec = div.querySelector("[data-mr=recorte]");
      if (bRec) bRec.hidden = false;
      nota.innerHTML = 'Si la pantalla sale en blanco, esa página no permite verla dentro de la app. <a href="' + esc(link) + '" target="_blank" rel="noopener">Abrir en otra pestaña</a>';
    } else {
      caja.innerHTML = codigo ? iframeTrailer(codigo, titulo, auto) : '<div class="mr-vacio">Esta película no tiene tráiler disponible.</div>';
      const bRec2 = div.querySelector("[data-mr=recorte]");
      if (bRec2) bRec2.hidden = true;
      nota.textContent = "Tráiler en la app.";
    }
  };
  div.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-mr]");
    if (!b) return;
    if (b.dataset.mr === "cerrar") { div.remove(); document.body.classList.remove("con-reproductor"); }
    else if (b.dataset.mr === "min") div.classList.toggle("mr-min");
    else if (b.dataset.mr === "recorte") {
      const rec = div.querySelector(".mr-recorte");
      if (rec) {
        const pasos = [0, 150, 260];
        const i = (pasos.indexOf(Number(rec.dataset.ancho)) + 1) % pasos.length;
        rec.dataset.ancho = String(pasos[i]);
        rec.style.setProperty("--recorte", pasos[i] + "px");
      }
    }
    else if (b.dataset.mr === "tamano") {
      const pantallaCompleta = div.classList.contains("mr-completa");
      div.classList.toggle("mr-completa", !pantallaCompleta);
      div.classList.remove("mr-grande");
    }
    else mostrar(b.dataset.mr);
  });
  document.body.appendChild(div);
  document.body.classList.add("con-reproductor");
  mostrar(peli ? "peli" : "trailer");
}

if (window.Nucleo) { Nucleo.registrar("pintado-principal", { version: "1.0", emite: [], escucha: [] }); }
