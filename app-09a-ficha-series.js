/* ===== Fase 0 · Módulo «ficha-series»: ficha como hoja, foco de teclado en la ficha y series en la app ===== */
/* Migrado de app-09 sin cambiar el comportamiento. Son bloques autoejecutables; se registra en el núcleo. */
/* ===== FASE 4: ficha como hoja (comportamiento) ===== */
(function fichaHoja() {
  const modal = document.getElementById("modal");
  if (!modal) return;

  function prepararFicha() {
    const caja = modal.querySelector(".ventana");
    if (!caja) return;
    if (!caja.querySelector(".ficha-compacta")) {
      const barra = document.createElement("div");
      barra.className = "ficha-compacta";
      barra.id = "fichaCompacta";
      caja.insertBefore(barra, caja.firstChild);
    }
    if (!caja.querySelector(".ficha-cerrar-abajo")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ficha-cerrar-abajo";
      b.id = "fichaCerrarAbajo";
      b.textContent = "Cerrar";
      b.addEventListener("click", () => { const x = document.getElementById("cerrarModal"); if (x) x.click(); });
      caja.appendChild(b);
    }
    if (!caja.dataset.fichaListo) {
      caja.dataset.fichaListo = "1";
      caja.addEventListener("scroll", actualizarCompacta, { passive: true });
      // El color del póster debe ganar a las reglas del tema: se fija como !important
      new MutationObserver(() => {
        const bg = caja.style.getPropertyValue("background");
        if (bg && caja.style.getPropertyPriority("background") !== "important") {
          caja.style.setProperty("background", bg, "important");
        }
      }).observe(caja, { attributes: true, attributeFilter: ["style"] });
    }
  }

  function actualizarCompacta() {
    const caja = modal.querySelector(".ventana");
    const h2 = document.querySelector("#detalle h2");
    const barra = document.getElementById("fichaCompacta");
    if (!caja || !h2 || !barra) return;
    const compacta = h2.getBoundingClientRect().bottom < caja.getBoundingClientRect().top + 56;
    // Solo escribir si cambia: escribir la misma clase dispara el observador otra vez (bucle infinito)
    if (modal.classList.contains("ficha-es-compacta") !== compacta) modal.classList.toggle("ficha-es-compacta", compacta);
    barra.textContent = h2.textContent;
  }

  function colorDelPoster() {
    const caja = modal.querySelector(".ventana");
    if (!caja || typeof detalleActual === "undefined" || !detalleActual) return;
    const c = paletaDeTexto(detalleActual[NOMBRE_PALETA])[0];
    caja.style.setProperty("--acento", c ? "rgb(" + c.join(",") + ")" : "var(--azul)");
  }

  // Al abrir la ficha: prepara la hoja, el color y el encabezado.
  // Reacciona solo al CAMBIO de estado abierto/cerrado, y nunca escribe una clase que ya está como debe.
  let abiertoAntes = null;
  new MutationObserver(() => {
    const abierto = modal.classList.contains("abierto");
    if (abierto === abiertoAntes) return;
    abiertoAntes = abierto;
    if (abierto) {
      prepararFicha();
      colorDelPoster();
      if (modal.classList.contains("ficha-es-compacta")) modal.classList.remove("ficha-es-compacta");
      const caja = modal.querySelector(".ventana");
      if (caja) caja.scrollTop = 0;
      setTimeout(actualizarCompacta, 50);
    } else if (modal.classList.contains("ficha-es-compacta")) {
      modal.classList.remove("ficha-es-compacta");
    }
  }).observe(modal, { attributes: true, attributeFilter: ["class"] });
})();


/* ===== FASE 7: foco de teclado en la ficha ===== */
(function focoFicha() {
  const modal = document.getElementById("modal");
  if (!modal) return;
  let quienAbrio = null;

  // Semántica: la ficha se anuncia como diálogo
  const caja0 = modal.querySelector(".ventana");
  if (caja0) {
    caja0.setAttribute("role", "dialog");
    caja0.setAttribute("aria-modal", "true");
    caja0.setAttribute("aria-label", "Ficha de película");
  }

  function enfocables() {
    const caja = modal.querySelector(".ventana");
    if (!caja) return [];
    return [...caja.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null || el.getClientRects().length);
  }

  // Al abrir: recordar quién abrió y llevar el foco dentro de la hoja
  let abiertoFoco = null;
  new MutationObserver(() => {
    const abierto = modal.classList.contains("abierto");
    if (abierto === abiertoFoco) return;
    abiertoFoco = abierto;
    if (abierto) {
      quienAbrio = document.activeElement;
      setTimeout(() => {
        const primero = document.getElementById("cerrarModal") || enfocables()[0];
        if (primero) primero.focus({ preventScroll: true });
      }, 60);
    } else if (quienAbrio) {
      // Al cerrar: devolver el foco a quien abrió la ficha, si todavía existe
      const destino = quienAbrio;
      quienAbrio = null;
      if (document.body.contains(destino) && typeof destino.focus === "function") {
        destino.focus({ preventScroll: true });
      }
    }
  }).observe(modal, { attributes: true, attributeFilter: ["class"] });

  // Tab no sale de la ficha mientras está abierta
  document.addEventListener("keydown", e => {
    if (e.key !== "Tab" || !modal.classList.contains("abierto")) return;
    const lista = enfocables();
    if (!lista.length) return;
    const primero = lista[0], ultimo = lista[lista.length - 1];
    const dentro = modal.contains(document.activeElement);
    if (!dentro) {
      e.preventDefault();
      (e.shiftKey ? ultimo : primero).focus();
    } else if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  });
})();


/* ===== FASE 8 · PARTE 3: Series en la app ===== */
(function seriesApp() {
  let seriesCat = [];
  let episodiosCat = {};
  let serieActual = null;

  const claveCap = e => e.temporada + "x" + e.episodio;
  const capsDe = titulo => ((Nucleo.datos.marcas()[titulo] || {}).capitulos) || {};

  function aplicarSeries(copia) {
    const filas = f => { const enc = f[0] || []; return f.slice(1).map(r => Object.fromEntries(enc.map((h, i) => [h, r[i] || ""]))); };
    seriesCat = filas(copia.series || []).filter(s => s.titulo);
    episodiosCat = {};
    filas(copia.episodios || []).forEach(e => {
      if (!e.serie) return;
      (episodiosCat[e.serie] = episodiosCat[e.serie] || []).push(e);
    });
    Object.values(episodiosCat).forEach(l => l.sort((a, b) =>
      (Number(a.temporada) - Number(b.temporada)) || (Number(a.episodio) - Number(b.episodio))));
  }

  function usarCache() {
    try { const c = JSON.parse(localStorage.getItem("series_cache") || "null"); if (c) aplicarSeries(c); } catch (e) {}
  }

  async function cargarSeriesApp() {
    if (!accessToken || !navigator.onLine || !HOJA_ID) { usarCache(); return; }
    try {
      const cab = { headers: { Authorization: "Bearer " + accessToken } };
      const [rs, re] = await Promise.all([
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${HOJA_ID}/values/series!A:Z`, cab),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${HOJA_ID}/values/episodios!A:I`, cab)
      ]);
      if (!rs.ok || !re.ok) { usarCache(); return; }
      const copia = { series: (await rs.json()).values || [], episodios: (await re.json()).values || [] };
      localStorage.setItem("series_cache", JSON.stringify(copia));
      aplicarSeries(copia);
    } catch (e) { usarCache(); }
  }

  function progresoSerie(s) {
    const lista = episodiosCat[s.titulo] || [];
    const caps = capsDe(s.titulo);
    const vistos = lista.filter(e => caps[claveCap(e)]).length;
    const siguiente = lista.find(e => !caps[claveCap(e)]);
    return { total: lista.length, vistos: vistos, siguiente: siguiente };
  }

  function renderSeriesLista() {
    const cont = document.getElementById("seriesLista");
    if (!cont) return;
    if (!seriesCat.length) {
      cont.innerHTML = '<p class="meta">Aún no hay series cargadas. Revisa que se hayan ejecutado cargarSeries y cargarEpisodios en Apps Script.</p>';
      return;
    }
    const grupos = {};
    seriesCat.forEach(s => { const g = s.genero_principal || "Otros"; (grupos[g] = grupos[g] || []).push(s); });
    cont.innerHTML = Object.keys(grupos).map(g =>
      '<div class="serie-grupo"><h3>' + esc(g) + '</h3>' + grupos[g].map(s => {
        const pr = progresoSerie(s);
        const pct = pr.total ? Math.round(pr.vistos / pr.total * 100) : 0;
        const sig = pr.siguiente ? "Sigue: T" + pr.siguiente.temporada + " · E" + pr.siguiente.episodio
          : (pr.total ? "¡Al día!" : "Sin capítulos cargados");
        return '<button type="button" class="serie-card" data-serie="' + esc(s.titulo) + '">' +
          (s.portada ? '<img src="' + esc(s.portada) + '" alt="" loading="lazy" decoding="async">' : '') +
          '<span class="serie-info"><strong>' + esc(s.titulo) + '</strong>' +
          '<span class="meta">' + esc(s.año || "") + ' · ' + esc(s.temporadas || "?") + ' temp. · ' + pr.vistos + '/' + pr.total + ' capítulos</span>' +
          '<span class="serie-barra"><span style="width:' + pct + '%"></span></span>' +
          '<span class="meta">' + esc(sig) + '</span></span></button>';
      }).join("") + '</div>').join("");
  }

  function abrirSerieDetalle(titulo) {
    const s = seriesCat.find(x => x.titulo === titulo);
    const cont = document.getElementById("seriesLista");
    if (!s || !cont) return;
    serieActual = titulo;
    const caps = capsDe(titulo);
    const porTemp = {};
    (episodiosCat[titulo] || []).forEach(e => { (porTemp[e.temporada] = porTemp[e.temporada] || []).push(e); });
    cont.innerHTML =
      '<button type="button" class="pildora" id="serieVolver">← Series</button>' +
      '<h2 class="serie-titulo">' + esc(s.titulo) + '</h2>' +
      '<p class="meta">' + esc(s.año || "") + ' · ' + esc(s.genero || "") + '</p>' +
      '<p class="serie-sinopsis">' + esc(s.sinopsis || "") + '</p>' +
      Object.keys(porTemp).map(t => {
        const eps = porTemp[t];
        const v = eps.filter(e => caps[claveCap(e)]).length;
        return '<section class="temp"><div class="temp-h"><strong>Temporada ' + esc(t) + '</strong>' +
          '<span class="meta">' + v + '/' + eps.length + '</span>' +
          '<button type="button" class="pildora" data-marcar-temp="' + esc(t) + '">' + (v === eps.length ? "Desmarcar" : "Marcar todo") + '</button></div>' +
          eps.map(e => '<button type="button" class="cap' + (caps[claveCap(e)] ? ' visto' : '') + '" data-cap="' + claveCap(e) + '">' +
            '<span class="cap-check">' + (caps[claveCap(e)] ? "✓" : "") + '</span>' +
            '<span>' + esc(e.episodio) + '. ' + esc(e.titulo) + '</span>' +
            '<span class="meta">' + esc(e.estreno || "") + '</span></button>').join("") +
          '</section>';
      }).join("") || '<p class="meta">Esta serie todavía no tiene capítulos cargados.</p>';
  }

  function guardarCaps(titulo, caps) {
    cambiarEstado(titulo, { capitulos: caps });
  }

  function alternarCapitulo(clave) {
    const titulo = serieActual;
    const caps = Object.assign({}, capsDe(titulo));
    if (caps[clave]) delete caps[clave]; else caps[clave] = true;
    guardarCaps(titulo, caps);
    recargarDetalle();
  }

  function alternarTemporada(t) {
    const titulo = serieActual;
    const eps = (episodiosCat[titulo] || []).filter(e => String(e.temporada) === String(t));
    const caps = Object.assign({}, capsDe(titulo));
    const todoVisto = eps.every(e => caps[claveCap(e)]);
    eps.forEach(e => { if (todoVisto) delete caps[claveCap(e)]; else caps[claveCap(e)] = true; });
    guardarCaps(titulo, caps);
    recargarDetalle();
  }

  function recargarDetalle() {
    const cont = document.getElementById("seriesLista");
    const y = cont ? cont.parentElement.scrollTop : 0;
    abrirSerieDetalle(serieActual);
    if (cont) cont.parentElement.scrollTop = y;
  }

  const ventana = document.getElementById("seriesModal");
  const boton = document.getElementById("verSeries");
  if (!ventana || !boton) return;

  boton.addEventListener("click", () => {
    serieActual = null;
    renderSeriesLista();
    ventana.classList.add("abierto");
    cargarSeriesApp();
    setTimeout(() => { const c = document.getElementById("cerrarSeries"); if (c) c.focus(); }, 60);
  });
  document.getElementById("cerrarSeries").addEventListener("click", () => ventana.classList.remove("abierto"));
  ventana.addEventListener("click", e => { if (e.target === ventana) ventana.classList.remove("abierto"); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && ventana.classList.contains("abierto")) ventana.classList.remove("abierto");
  });

  document.getElementById("seriesLista").addEventListener("click", e => {
    const tarjeta = e.target.closest("[data-serie]");
    if (tarjeta) { abrirSerieDetalle(tarjeta.dataset.serie); return; }
    if (e.target.closest("#serieVolver")) { serieActual = null; renderSeriesLista(); return; }
    const cap = e.target.closest("[data-cap]");
    if (cap) { alternarCapitulo(cap.dataset.cap); return; }
    const temp = e.target.closest("[data-marcar-temp]");
    if (temp) alternarTemporada(temp.dataset.marcarTemp);
  });

  // Carga inicial y actualización cada 10 minutos, con sesión iniciada
  setTimeout(usarCache, 6000);
    window.seriesApi = {
    lista: () => seriesCat,
    progreso: progresoSerie,
    abrir: titulo => {
      ventana.classList.add("abierto");
      renderSeriesLista();
      abrirSerieDetalle(titulo);
    }
  };
})();

if (window.Nucleo) {
  Nucleo.registrar("ficha-series", { version: "1.0", emite: [], escucha: [] });
}
