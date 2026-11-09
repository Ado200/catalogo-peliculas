/* ===== Vitrina · Fase 2 · destacado de Inicio =====
   Elige una película para el destacado: entre las mejores recomendaciones no vistas.
   Cambia según el día y la franja del día (madrugada, mañana, tarde, noche), así que es
   automático y adaptable: si calificas o marcas películas, la selección se ajusta sola.
   Si no hay recomendaciones, usa películas no vistas y no descartadas. ===== */
(function () {
  const sec = document.getElementById("hero");
  if (!sec) return;
  let ultimaClave = "";

  function dispersion(texto) {
    let h = 5381;
    for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
    return h;
  }

  function franjaDelDia(d) {
    const h = d.getHours();
    return h < 6 ? "madrugada" : h < 12 ? "manana" : h < 19 ? "tarde" : "noche";
  }

  function candidatas() {
    const noVistas = p => !estadoDe(p).vista && !((marcas[p.titulo] || {}).descartada) && !!p.portada;
    let recs = [];
    try { recs = calcularRecomendaciones().map(r => r.p).filter(noVistas).slice(0, 5); } catch (e) { recs = []; }
    if (recs.length) return { lista: recs, motivo: "Recomendada para ti" };
    return { lista: peliculas.filter(noVistas).slice(0, 30), motivo: "Para hoy" };
  }

  function render() {
    const { lista, motivo } = candidatas();
    if (!lista.length) { sec.style.display = "none"; ultimaClave = ""; return; }
    const clave = hoyLocalISO() + "|" + franjaDelDia(new Date()) + "|" + lista.map(p => p.titulo).join("|");
    const elegida = lista[dispersion(clave) % lista.length];
    const idx = peliculas.indexOf(elegida);
    if (clave === ultimaClave && sec.dataset.idx === String(idx)) return;
    ultimaClave = clave;
    const img = (elegida.portada && !datosLimitados())
      ? '<img src="' + esc(elegida.portada) + '" alt="" decoding="async">' : "";
    sec.innerHTML =
      '<div class="hero-fondo">' + img + '</div>' +
      '<div class="hero-contenido">' +
        '<p class="hero-etiqueta">' + esc(motivo) + '</p>' +
        '<h2 class="hero-titulo">' + esc(elegida.titulo) + '</h2>' +
        '<p class="hero-meta">' + esc(elegida["año"]) + ' · ' + esc(elegida.duracion) + '</p>' +
        '<div class="hero-acciones">' +
          '<button type="button" class="hero-principal" data-hero="ficha">Ver ficha</button>' +
          '<button type="button" class="hero-secundario" data-hero="trailer">Tráiler</button>' +
        '</div>' +
      '</div>';
    sec.dataset.idx = String(idx);
    sec.style.display = "";
  }

  // El tráiler solo se pide al tocar el botón; la ficha se abre igual que desde cualquier lista
  sec.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-hero]");
    if (!b) return;
    const p = peliculas[Number(sec.dataset.idx)];
    if (!p) return;
    if (b.dataset.hero === "ficha") {
      if (typeof desdeAleatorio !== "undefined") desdeAleatorio = false;
      abrirDetalle(p);
    } else {
      abrirVerPelicula(p.titulo, String(p.trailer_es || ""), String(p.trailer_en || ""), String(p.link || ""));
    }
  });

  // Se recalcula cada vez que la app vuelve a pintar (marcas, filtros, cambios de pestaña)
  const pintarOriginal = window.pintar;
  window.pintar = function () {
    const r = pintarOriginal.apply(this, arguments);
    try { render(); } catch (e) { sec.style.display = "none"; }
    return r;
  };

  // Y al cambiar de franja del día sin que la app pinte
  setInterval(() => { try { render(); } catch (e) { /* sin datos aún */ } }, 10 * 60 * 1000);
  if (typeof peliculas !== "undefined" && peliculas.length) { try { render(); } catch (e) { /* sin datos aún */ } }
})();
