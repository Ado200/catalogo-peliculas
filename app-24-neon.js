/* ===== Estilo neón · módulo app-24 =====
   Tema oscuro con brillos de color. Cada póster toma el color de su género y muestra
   su estado (vista, pendiente). Se puede apagar en localStorage: estilo_neon = "0". ===== */
(function () {
  const activo = () => localStorage.getItem("estilo_neon") !== "0";

  function aplicarClase() {
    document.body.classList.toggle("neon", activo());
  }

  function generoClave(p) {
    const g = String(p.genero || "").toLowerCase();
    if (/terror|suspenso|thriller/.test(g)) return "terror";
    if (/ciencia|fantas/.test(g)) return "scifi";
    if (/acci/.test(g)) return "accion";
    if (/comedia/.test(g)) return "comedia";
    if (/animaci|familia/.test(g)) return "animacion";
    if (/drama|romance/.test(g)) return "drama";
    return "base";
  }

  function marcarTarjetas() {
    if (!activo()) return;
    document.querySelectorAll("#lista .tarjeta[data-i]").forEach(el => {
      const p = peliculas[Number(el.dataset.i)];
      if (!p) return;
      const s = estadoDe(p);
      el.dataset.genero = generoClave(p);
      el.dataset.estado = s.vista ? "vista" : s.pendiente ? "pendiente" : "";
    });
  }

  // Columnas de la rejilla: 3 o 4, con el botón de cuadrícula en la barra superior
  const ICONO_COLUMNAS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>';
  function aplicarColumnas() {
    const n = localStorage.getItem("columnas_rejilla") === "4" ? 4 : 3;
    document.documentElement.style.setProperty("--cols", String(n));
    const b = document.getElementById("btnColumnas");
    if (b) {
      b.innerHTML = ICONO_COLUMNAS;
      b.setAttribute("aria-label", "Cambiar a " + (n === 4 ? "3" : "4") + " columnas");
      b.title = (n === 4 ? "4" : "3") + " columnas";
      b.classList.toggle("activo", n === 4);
    }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("#btnColumnas");
    if (!b) return;
    localStorage.setItem("columnas_rejilla", localStorage.getItem("columnas_rejilla") === "4" ? "3" : "4");
    aplicarColumnas();
  });
  aplicarColumnas();

  // Íconos de la barra superior: filtros (deslizadores) y configuración (engranaje)
  const ICONO_FILTROS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2.2" fill="#fff"/><circle cx="15" cy="12" r="2.2" fill="#fff"/><circle cx="8" cy="18" r="2.2" fill="#fff"/></svg>';
  const ICONO_CONFIG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>';

  function aplicarIconos() {
    const bf = document.getElementById("toggleAvanzados");
    if (bf) {
      const n = Number((bf.getAttribute("aria-label") || "").match(/(\d+) activos/) ? RegExp.$1 : 0);
      bf.innerHTML = ICONO_FILTROS + (n ? '<span class="conteo-filtros">' + n + "</span>" : "");
      bf.setAttribute("aria-label", "Más filtros");
      bf.title = "Más filtros";
    }
    const bc = document.getElementById("toggleMas");
    if (bc) {
      bc.innerHTML = ICONO_CONFIG;
      bc.setAttribute("aria-label", "Configuración");
      bc.title = "Configuración";
    }
  }
  aplicarIconos();

  // Íconos de cabecera: filtros abre "Más filtros"; configuración abre la ventana grande
  function botonMasFiltros() {
    const fila = document.getElementById("pildorasRapidas");
    if (!fila) return null;
    return Array.from(fila.querySelectorAll("button")).find(b => /Más filtros/.test(b.textContent)) || null;
  }
  // El panel de Más filtros va debajo de la fila de píldoras y se pliega/despliega con el ícono de filtros
  function colocarPanelMas() {
    const host = document.getElementById("filtrosCatalogo");
    const fila = document.getElementById("pildorasRapidas");
    if (host && fila && fila.nextElementSibling !== host) fila.after(host);
  }
  function sincronizarMasFiltros() {
    colocarPanelMas();
    const boton = document.querySelector("#filtrosCatalogo [data-accion=\"mas-filtros\"]");
    const abierto = !!boton && boton.getAttribute("aria-expanded") === "true";
    document.body.classList.toggle("mas-filtros-abiertos", abierto);
    const ico = document.getElementById("toggleAvanzados");
    if (ico) ico.classList.toggle("activo", abierto);
  }
  function ocultarMasFiltrosPildora() { sincronizarMasFiltros(); }
  const btnFiltros = document.getElementById("toggleAvanzados");
  if (btnFiltros) btnFiltros.addEventListener("click", e => {
    e.stopImmediatePropagation();
    if (typeof pestana !== "undefined" && pestana === "catalogo" && zonaPeli === "inicio") { zonaPeli = "lista"; aplicarEstadoTabs(); pintar(); }
    const boton = document.querySelector("#filtrosCatalogo [data-accion=\"mas-filtros\"]");
    if (boton) boton.click();
    sincronizarMasFiltros();
    asegurarCierres();
    sincronizarCapa();
    setTimeout(() => { sincronizarMasFiltros(); asegurarCierres(); sincronizarCapa(); }, 80);
  }, true);
  const btnConfig = document.getElementById("toggleMas");
  if (btnConfig) btnConfig.addEventListener("click", e => {
    e.stopImmediatePropagation();
    alternarPanel("panelAvanzados");
  }, true);
  sincronizarMasFiltros();

  // Ficha de película: campo para guardar hasta qué minuto llegaste (alimenta Continuar en Inicio)
  (function fichaProgreso() {
    const modal = document.getElementById("modal");
    if (!modal) return;
    function duracionMin(p) {
      const s = String(p.duracion || "");
      const h = s.match(/(\d+)\s*h/i), m = s.match(/(\d+)\s*min/i);
      if (h || m) return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
      const n = s.match(/^\s*(\d+)\s*$/);
      return n ? Number(n[1]) : 0;
    }
    function pintarControl() {
      const det = document.getElementById("detalle");
      if (!det) return;
      det.querySelectorAll(".ficha-progreso").forEach(n => n.remove());
      const p = typeof detalleActual !== "undefined" ? detalleActual : null;
      if (!p || String(p.tipo || "").toLowerCase() === "serie") return;
      const total = duracionMin(p);
      const actual = Number((Nucleo.datos.marcas()[p.titulo] || {}).progresoMin || 0);
      const div = document.createElement("div");
      div.className = "ficha-progreso";
      div.innerHTML = '<p class="fp-titulo">¿Hasta qué minuto llegaste?</p>' +
        '<div class="fp-fila"><input type="number" min="0" ' + (total ? 'max="' + total + '" ' : '') +
        'value="' + (actual || "") + '" placeholder="min" aria-label="Minuto">' +
        '<button type="button" class="fp-guardar">Guardar</button></div>' +
        '<p class="fp-sub">Así aparece en Continuar, en tu Inicio.</p>';
      div.querySelector(".fp-guardar").addEventListener("click", () => {
        const v = Math.max(0, Math.min(total || 99999, Math.round(Number(div.querySelector("input").value) || 0)));
        cambiarEstado(p.titulo, { progresoMin: v });
        if (window.refrescarInicioIA) window.refrescarInicioIA();
        div.querySelector(".fp-sub").textContent = "Guardado: minuto " + v + ".";
      });
      det.appendChild(div);
    }
    new MutationObserver(() => {
      if (modal.classList.contains("abierto")) setTimeout(pintarControl, 0);
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
  })();

  // El aviso de TMDB vive en la ventana de configuración (no en Inicio ni en Catálogo)
  (function moverAvisoTmdb() {
    const pie = document.querySelector("footer.pie");
    const config = document.getElementById("panelAvanzados");
    if (pie && config && pie.parentElement !== config) config.appendChild(pie);
  })();

  // Capa propia para las ventanas: fuera de la cabecera y del contenido, siempre centrada
  const capa = document.createElement("div");
  capa.id = "capaVentanas";
  document.body.appendChild(capa);
  const origenVentana = new Map();
  function llevarA(el, dentro) {
    if (!el) return;
    if (dentro) {
      if (el.parentElement !== capa) {
        origenVentana.set(el, { parent: el.parentElement, next: el.nextSibling });
        capa.appendChild(el);
      }
    } else if (origenVentana.has(el)) {
      const o = origenVentana.get(el);
      origenVentana.delete(el);
      if (o.next && o.next.parentNode === o.parent) o.parent.insertBefore(el, o.next);
      else o.parent.appendChild(el);
    }
  }
  function sincronizarCapa() {
    const filtros = document.body.classList.contains("mas-filtros-abiertos");
    const buscando = document.body.classList.contains("en-buscar") && document.body.classList.contains("buscando");
    llevarA(document.getElementById("filtrosCatalogo"), filtros);
    llevarA(document.getElementById("lista"), buscando);
    document.body.classList.toggle("ventana-abierta", filtros || buscando);
  }

  // Mientras la ficha de una película está abierta, las ventanas de filtros y búsqueda se ocultan
  (function vigilarFicha() {
    const modal = document.getElementById("modal");
    if (!modal) return;
    new MutationObserver(() => {
      document.body.classList.toggle("ficha-abierta", modal.classList.contains("abierto"));
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
  })();
  // Cierre de filtros: el estado se actualiza de forma directa y luego se vuelve a confirmar
  function cerrarFiltros() {
    const b = document.querySelector("#filtrosCatalogo [data-accion=\"mas-filtros\"]");
    if (b) b.click();
    document.body.classList.remove("mas-filtros-abiertos");
    sincronizarCapa();
    setTimeout(() => { sincronizarMasFiltros(); sincronizarCapa(); }, 80);
  }
  // Ventana de búsqueda: los resultados se abren sobre el contenido al escribir
  const campoBuscar = document.getElementById("buscar");
  if (campoBuscar) campoBuscar.addEventListener("input", () => {
    document.body.classList.toggle("buscando", campoBuscar.value.trim() !== "");
    asegurarCierres();
    sincronizarCapa();
  });
  // Ventanas de filtros y búsqueda, con el mismo diseño que la ficha
  function asegurarCierres() {
    const f = document.getElementById("filtrosCatalogo");
    if (f) {
      if (!f.querySelector(".cerrar-ventana")) {
        f.insertAdjacentHTML("afterbegin",
          '<button type="button" class="cerrar-ventana" data-cerrar-filtros aria-label="Cerrar filtros">×</button>' +
          '<div class="vt-cab-ventana"><p class="vt-titulo">Filtros</p><p class="vt-sub">Ajusta lo que quieres ver</p></div>');
      }
      if (!f.querySelector(".vt-pie-ventana")) {
        f.insertAdjacentHTML("beforeend",
          '<div class="vt-pie-ventana"><button type="button" class="vt-btn vt-btn-sec" data-filtros-limpiar>Limpiar</button>' +
          '<button type="button" class="vt-btn vt-btn-pri" data-cerrar-filtros>Aplicar</button></div>');
      }
    }
    const l = document.getElementById("lista");
    if (l && document.body.classList.contains("buscando")) {
      const q = campoBuscar ? campoBuscar.value.trim() : "";
      const n = l.querySelectorAll(".tarjeta").length;
      let cab = l.querySelector(".vt-cab-ventana");
      if (!cab) {
        l.insertAdjacentHTML("afterbegin",
          '<button type="button" class="cerrar-ventana" data-cerrar-buscar aria-label="Cerrar búsqueda">×</button>' +
          '<div class="vt-cab-ventana"><p class="vt-titulo">Resultados</p><p class="vt-sub"></p></div>');
        cab = l.querySelector(".vt-cab-ventana");
      }
      cab.querySelector(".vt-sub").textContent = "\u201c" + q + "\u201d · " + n + (n === 1 ? " película" : " películas");
    }
  }
  document.addEventListener("click", e => {
    if (e.target.closest && e.target.closest("[data-filtros-limpiar]")) {
      const lim = document.getElementById("limpiar");
      if (lim) lim.click();
      return;
    }
    if (e.target.closest && e.target.closest("[data-cerrar-filtros]")) {
      cerrarFiltros();
      return;
    }
    if (e.target.closest && e.target.closest("[data-cerrar-buscar]") && campoBuscar) {
      campoBuscar.value = "";
      campoBuscar.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  // Tocar el fondo oscuro también cierra la búsqueda (borra el texto)
  document.getElementById("velo").addEventListener("click", () => {
    if (document.body.classList.contains("buscando") && campoBuscar) {
      campoBuscar.value = "";
      campoBuscar.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  // La cabecera mide su altura para que las ventanas empiecen justo debajo
  function medirCabecera() {
    const h = document.querySelector("#app > header");
    if (h) document.documentElement.style.setProperty("--cab-h", h.offsetHeight + "px");
  }
  window.addEventListener("resize", medirCabecera);
  medirCabecera();
  // Tocar el fondo oscuro cierra la ventana de filtros
  document.getElementById("velo").addEventListener("click", () => {
    if (document.body.classList.contains("mas-filtros-abiertos")) cerrarFiltros();
  });

  aplicarClase();
  const pintarOriginal = window.pintar;
  window.pintar = function () {
    const r = pintarOriginal.apply(this, arguments);
    try {
      document.body.classList.toggle("zona-inicio", typeof pestana !== "undefined" && pestana === "catalogo" && typeof zonaPeli !== "undefined" && zonaPeli === "inicio");
      if (typeof pestana !== "undefined" && pestana === "catalogo") {
        const h1 = document.querySelector(".titulo-grande");
        if (h1) h1.textContent = typeof zonaPeli !== "undefined" && zonaPeli === "inicio" ? "Inicio" : "Películas";
      }
      aplicarClase(); marcarTarjetas(); aplicarIconos(); aplicarColumnas(); sincronizarMasFiltros();
      if (!document.body.classList.contains("en-buscar")) document.body.classList.remove("buscando");
      asegurarCierres();
      sincronizarCapa();
      medirCabecera();
    } catch (e) { /* sin datos aún */ }
    return r;
  };
  if (typeof peliculas !== "undefined" && peliculas.length) { try { aplicarClase(); marcarTarjetas(); } catch (e) {} }
})();
