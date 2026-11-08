/* ===== Fase 0 · Módulo «bloques-app04»: bloques interactivos de la app (voz, gestos y ayudas de la lista, entre otros). Se carga justo después de app-04, en el mismo orden que tenían en el archivo original. Migrado sin cambios de comportamiento. ===== */
/* --- bloque 2 --- */
(function () {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById("voz");
  const buscarEl = document.getElementById("buscar");
  if (!Rec || !btn) return;

  btn.hidden = false;
  const rec = new Rec();
  rec.lang = "es-MX";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let escuchando = false;

  function mensaje(texto) {
    const el = document.getElementById("estadoGuardado");
    if (el) el.textContent = texto;
  }
  function parar() {
    escuchando = false;
    btn.classList.remove("escuchando");
  }

  rec.onresult = e => {
    let texto = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      texto += e.results[i][0].transcript;
    }
    buscarEl.value = texto.replace(/[.,;:!?¿¡]+/g, " ").replace(/\s+/g, " ").trim();
    buscarEl.dispatchEvent(new Event("input"));
  };

  rec.onerror = e => {
    parar();
    mensaje(e.error === "not-allowed"
      ? "Permite el uso del micrófono en el navegador para buscar por voz."
      : "No entendí, intenta de nuevo.");
  };

  rec.onend = parar;

  btn.addEventListener("click", () => {
    if (escuchando) {
      rec.stop();
      parar();
      return;
    }
    try {
      rec.start();
      escuchando = true;
      btn.classList.add("escuchando");
      mensaje("Escuchando... di un título, director o actor.");
    } catch (e) {
      mensaje("No pude iniciar el micrófono. Intenta de nuevo.");
    }
  });
})();

/* --- bloque 3 --- */
(function () {
  const header = document.querySelector("#app > header");
  const rango = document.getElementById("vidrioAlfa");
  const valor = document.getElementById("vidrioAlfaValor");
  if (!header || !rango || !valor) return;

  function aplicarVidrio(v) {
    const n = Math.min(95, Math.max(40, Math.round(Number(v)) || 72));
    document.documentElement.style.setProperty("--opacidad", (n / 100).toFixed(2));
    document.documentElement.style.setProperty("--desenfoque", Math.round(n * 0.3) + "px");
    rango.value = n;
    valor.textContent = n;
    return n;
  }
  aplicarVidrio(modoGuardado("vidrio_alfa", "72"));

  rango.addEventListener("input", () => {
    const n = aplicarVidrio(rango.value);
    try { localStorage.setItem("vidrio_alfa", String(n)); } catch (e) {}
  });


  // Reglas:
  // - Se compacta solo al bajar, pasando 180 px (así siempre hay espacio para compensar el salto).
  // - Se expande solo al llegar arriba (y <= 20). Nunca mientras se sube, para no pelear con el scroll.
  // - La compensación del scroll solo se aplica al compactar, que es cuando el contenido sube.
  const UMBRAL_COMPACTA = 180;
  let compacta = false, ultimoY = window.scrollY, ignorarHasta = 0, pendiente = false;

  function cambiarEstado(v, y) {
    if (compacta === v) return;
    compacta = v;
    const antes = header.offsetHeight;
    document.body.classList.toggle("barra-compacta", v);
    const despues = header.offsetHeight;
    if (v && y > 0 && despues !== antes) {
      ignorarHasta = performance.now() + 200;
      window.scrollBy(0, despues - antes);
    }
  }

  function alDesplazar() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      if (performance.now() < ignorarHasta) return;
      const y = window.scrollY;
      if (!compacta) {
        if (y > UMBRAL_COMPACTA && y > ultimoY) cambiarEstado(true, y);
      } else if (y <= 20) {
        cambiarEstado(false, y);
      }
      ultimoY = y;
    });
  }

  window.addEventListener("scroll", alDesplazar, { passive: true });
})();

/* --- bloque 4 --- */
(function () {
  const modal = document.getElementById("modal");
  const ventana = modal.querySelector(".ventana");

  const tirador = document.createElement("div");
  tirador.className = "hoja-tirador";
  tirador.setAttribute("aria-hidden", "true");
  ventana.insertBefore(tirador, ventana.firstChild);

  // Escape cierra la ficha
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("abierto")) cerrarDetalle();
  });

  // Deslizar hacia abajo cierra la hoja (solo cuando el contenido está arriba del todo)
  let inicio = null, dy = 0, arrastrando = false;

  function reiniciar() {
    inicio = null;
    arrastrando = false;
    dy = 0;
  }

  ventana.addEventListener("touchstart", e => {
    if (ventana.scrollTop > 0 || e.target.closest("textarea, input, select, iframe")) { reiniciar(); return; }
    inicio = e.touches[0].clientY;
    arrastrando = false;
    dy = 0;
  }, { passive: true });

  ventana.addEventListener("touchmove", e => {
    if (inicio === null) return;
    const d = e.touches[0].clientY - inicio;
    if (!arrastrando) {
      if (d < 8) return;
      arrastrando = true;
      ventana.style.transition = "none";
    }
    if (e.cancelable) e.preventDefault();
    dy = Math.max(0, d);
    ventana.style.transform = "translateY(" + (dy * 0.9) + "px)";
  }, { passive: false });

  ventana.addEventListener("touchend", () => {
    if (inicio === null) return;
    const cerrar = arrastrando && dy > 110;
    const estabaArrastrando = arrastrando;
    reiniciar();
    if (!estabaArrastrando) return;
    ventana.style.transition = "transform .3s var(--ease)";
    if (cerrar) {
      ventana.style.transform = "translateY(100%)";
      setTimeout(() => {
        cerrarDetalle();
        ventana.style.transform = "";
        ventana.style.transition = "";
      }, 260);
    } else {
      ventana.style.transform = "";
    }
  });

  ventana.addEventListener("touchcancel", () => {
    reiniciar();
    ventana.style.transition = "transform .3s var(--ease)";
    ventana.style.transform = "";
  });
})();

/* --- bloque 5 --- */
(function () {
  const estado = document.getElementById("estado");
  const botones = document.querySelectorAll(".segmentado button");
  if (!estado || !botones.length) return;

  function sincronizar() {
    botones.forEach(b => {
      const activa = b.dataset.seg === estado.value;
      b.classList.toggle("activa", activa);
      b.setAttribute("aria-pressed", activa ? "true" : "false");
    });
  }

  botones.forEach(b => {
    b.addEventListener("click", () => {
      estado.value = b.dataset.seg;
      estado.dispatchEvent(new Event("input"));
      sincronizar();
    });
  });

  // Mantiene el selector sincronizado con los demás controles (panel, chips, Limpiar)
  estado.addEventListener("input", sincronizar);
  document.addEventListener("click", () => setTimeout(sincronizar, 0));
  sincronizar();

  // Aviso «Deshacer» para Vista y Pendiente desde los botones de la tarjeta o la ficha
  let snap = null;
  document.addEventListener("click", e => {
    const b = e.target.closest('[data-accion="pendiente"], [data-accion="vista"]');
    if (!b) { snap = null; return; }
    const t = b.dataset.clave;
    snap = {
      titulo: t,
      tipo: b.dataset.accion,
      previo: marcas[t] ? Object.assign({}, marcas[t]) : null
    };
  }, true);

  document.addEventListener("click", () => {
    if (!snap) return;
    const s = snap;
    snap = null;
    const antes = JSON.stringify(s.previo);
    const despues = JSON.stringify(marcas[s.titulo] || null);
    if (antes === despues) return;
    const etiqueta = s.tipo === "vista" ? "marcada como vista" : "puesta en pendientes";
    mostrarDeshacer("«" + s.titulo + "» " + etiqueta + ".", [{ titulo: s.titulo, previo: s.previo }]);
  });
})();

/* --- bloque 6 --- */
(function () {
  const LOTE = 24;
  const lista = document.getElementById("lista");

  let cola = [];          // HTML de las tarjetas aún no cargadas, en orden
  let mostradas = LOTE;   // cuántas tarjetas reales hay en pantalla
  let firmaAnterior = "";

  const observerMut = new MutationObserver(() => preparar());
  const observerLote = new IntersectionObserver(entradas => {
    if (entradas.some(e => e.isIntersecting)) cargarSiguiente(false);
  }, { rootMargin: "400px 0px" });

  function pausar() { observerMut.disconnect(); }
  function reanudar() { observerMut.observe(lista, { childList: true }); }

  function quitarSentinela() {
    observerLote.disconnect();
    const s = document.getElementById("sentinelaLote");
    if (s) s.remove();
  }

  function terminar() {
    quitarSentinela();
    cola = [];
  }

  // Cambia la firma cuando cambia la búsqueda, los filtros, el orden o la pestaña.
  // Si solo cambia una marca, se conserva cuántas tarjetas ya estaban cargadas.
  function firma() {
    return [buscar.value, ...Object.values(sel).map(s => s.value), $("orden").value, pestana, agrupado].join("|");
  }

  function actualizarBoton() {
    const b = document.getElementById("cargarTodas");
    const quedan = lista.querySelectorAll(".esqueleto").length;
    if (b) b.textContent = "Cargar las " + quedan + " restantes";
  }

  function preparar() {
    pausar();
    if (pestana !== "catalogo" || agrupado) { terminar(); reanudar(); return; }

    const hijos = [...lista.children].filter(el => el.hasAttribute("data-i"));
    const f = firma();
    if (f !== firmaAnterior) { mostradas = LOTE; firmaAnterior = f; }

    if (hijos.length <= mostradas) { terminar(); reanudar(); return; }

    const resto = hijos.slice(mostradas);
    cola = resto.map(el => el.outerHTML);
    resto.forEach((el, k) => {
      const s = document.createElement("div");
      s.className = "esqueleto";
      s.dataset.n = String(k);
      s.setAttribute("aria-hidden", "true");
      el.replaceWith(s);
    });

    quitarSentinela();
    const sent = document.createElement("div");
    sent.id = "sentinelaLote";
    sent.className = "lote-sentinela";
    sent.innerHTML = '<button type="button" class="pildora" id="cargarTodas"></button>';
    lista.appendChild(sent);
    actualizarBoton();
    reanudar();
    observerLote.observe(sent);
  }

  function cargarSiguiente(todas) {
    const sk = [...lista.querySelectorAll(".esqueleto")];
    if (!sk.length) { terminar(); return; }

    pausar();
    const grupo = todas ? sk : sk.slice(0, LOTE);
    grupo.forEach(s => {
      const k = Number(s.dataset.n);
      const plantilla = document.createElement("template");
      plantilla.innerHTML = cola[k];
      const tarjeta = plantilla.content.firstElementChild;
      if (tarjeta) s.replaceWith(tarjeta); else s.remove();
    });
    mostradas += grupo.length;

    if (!lista.querySelector(".esqueleto")) { terminar(); reanudar(); return; }

    actualizarBoton();
    reanudar();
    const sent = document.getElementById("sentinelaLote");
    if (sent) { observerLote.unobserve(sent); observerLote.observe(sent); }
  }

  // Botón de respaldo: carga todas las restantes de una vez
  document.addEventListener("click", e => {
    if (e.target.closest && e.target.closest("#cargarTodas")) cargarSiguiente(true);
  });

  reanudar();
})();

/* --- bloque 7 --- */
(function () {
  // 1. Tarjetas y carrusel accesibles con teclado
  function hacerEnfocables(raiz) {
    raiz.querySelectorAll("[data-i]:not([tabindex]), [data-idx]:not([tabindex])").forEach(el => {
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      if (!el.getAttribute("aria-label")) {
        const t = el.querySelector("h2, .dest-titulo");
        if (t) el.setAttribute("aria-label", t.textContent.trim());
      }
    });
  }
  hacerEnfocables(document);
  const obsEnfocables = new MutationObserver(() => hacerEnfocables(document));
  obsEnfocables.observe(document.getElementById("app"), { childList: true, subtree: true });

  // Enter o Espacio abren la ficha cuando la tarjeta misma tiene el foco
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (!t.matches || !t.matches("[data-i][tabindex], [data-idx][tabindex]")) return;
    e.preventDefault();
    t.click();
  });

  // 2. Foco al abrir la ficha y regreso al elemento anterior al cerrar
  const modal = document.getElementById("modal");
  let elementoPrevio = null;
  new MutationObserver(() => {
    if (modal.classList.contains("abierto")) {
      if (!elementoPrevio) {
        elementoPrevio = document.activeElement;
        const cerrar = document.getElementById("cerrarModal");
        if (cerrar) cerrar.focus({ preventScroll: true });
      }
    } else if (elementoPrevio) {
      const previo = elementoPrevio;
      elementoPrevio = null;
      if (previo && previo.isConnected && previo.focus) previo.focus({ preventScroll: true });
    }
  }).observe(modal, { attributes: true, attributeFilter: ["class"] });

  // 3. Foco visible en controles del encabezado y barra inferior (ya cubierto por CSS global; aquí se asegura el aria-pressed del segmentado)
  document.querySelectorAll("#tabbar button").forEach(b => {
    b.setAttribute("aria-label", b.textContent.trim());
    b.setAttribute("aria-current", b.classList.contains("activa") ? "page" : "false");
  });
  new MutationObserver(() => {
    document.querySelectorAll("#tabbar button").forEach(b => {
      b.setAttribute("aria-current", b.classList.contains("activa") ? "page" : "false");
    });
  }).observe(document.getElementById("tabbar"), { attributes: true, subtree: true, attributeFilter: ["class"] });
})();

/* --- bloque 8 --- */
(function () {
  // Tarjeta de sugerencia: tocarla abre la ficha
  document.addEventListener("click", e => {
    const card = e.target.closest("#ahoraCaja .ahora-card");
    if (!card || e.target.closest("button")) return;
    const b = document.getElementById("ahoraVer");
    if (b) b.click();
  });

  // Descartadas ahora está en el menú ⋯
  document.addEventListener("click", e => {
    if (!e.target.closest || !e.target.closest("#verDescartadas")) return;
    cerrarPaneles();
    cambiarPestana("descartadas");
  });

  // Si la última pestaña guardada era Descartadas, vuelve al catálogo
  window.addEventListener("load", () => {
    if (pestana === "descartadas") cambiarPestana("catalogo");
  });
})();

/* --- bloque 9 --- */
(function () {
  // El título de la sugerencia cambia según la hora del día
  function tituloSegunHora() {
    const h = new Date().getHours();
    const t = h >= 19 || h < 5 ? "Para esta noche" : h < 12 ? "Para esta mañana" : "Para esta tarde";
    const el = document.getElementById("tituloAhora");
    if (el && el.textContent !== t) el.textContent = t;
  }
  tituloSegunHora();
  setInterval(tituloSegunHora, 60000);
})();

/* --- bloque 10 --- */
(function () {
  // ---------- Estado visible de la copia en Drive ----------
  function textoEstadoRespaldo() {
    let fecha = null, lunes = null;
    try { fecha = localStorage.getItem("respaldo_drive_fecha"); lunes = localStorage.getItem("respaldo_semana"); } catch (e) {}
    if (!fecha && !lunes) return { texto: "Aún no hay copia en tu Drive. Se crea sola cuando tengas marcas.", alerta: true };
    if (!fecha) return { texto: "Copia semanal activa (semana del " + lunes + "). Se conservan las últimas 4.", alerta: false };
    const d = new Date(fecha);
    const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
    const cuando = dias <= 0 ? "hoy" : dias === 1 ? "ayer" : "hace " + dias + " días";
    const dia = d.toLocaleDateString("es-MX", { day: "numeric", month: "long" });
    return {
      texto: "Última copia en tu Drive: " + cuando + " (" + dia + "). Se conservan las últimas 4." + (dias > 8 ? " Hace más de una semana; revisa tu conexión." : ""),
      alerta: dias > 8
    };
  }

  function mostrarEstadoRespaldo() {
    const el = document.getElementById("estadoRespaldo");
    if (!el) return;
    const r = textoEstadoRespaldo();
    el.textContent = r.texto;
    el.classList.toggle("alerta-respaldo", r.alerta);
  }

  // ---------- 2. Respaldo semanal de marcas en tu Drive (se conservan 4) ----------
  async function respaldoSemanal() {
    if (!accessToken || !idMarcas || !Object.keys(marcas).length) return;
    const lunes = inicioSemanaISO(hoyLocalISO());
    if (modoGuardado("respaldo_semana", "") === lunes) return;
    try {
      const nombre = "respaldo-marcas-" + lunes + ".json";
      const frontera = "respaldo_frontera";
      const meta = JSON.stringify({ name: nombre, parents: ["appDataFolder"] });
      const cuerpo = JSON.stringify(marcas);
      const partes = "--" + frontera + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta +
        "\r\n--" + frontera + "\r\nContent-Type: application/json\r\n\r\n" + cuerpo + "\r\n--" + frontera + "--";
      await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + frontera },
        body: partes
      });
      const q = encodeURIComponent("name contains 'respaldo-marcas-'");
      const orden = encodeURIComponent("name desc");
      const r = await driveFetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=" + q + "&orderBy=" + orden + "&fields=files(id,name)");
      const j = await r.json();
      for (const f of (j.files || []).slice(4)) {
        await driveFetch("https://www.googleapis.com/drive/v3/files/" + f.id, { method: "DELETE" });
      }
      try { localStorage.setItem("respaldo_semana", lunes); localStorage.setItem("respaldo_drive_fecha", new Date().toISOString()); } catch (e) {}
      mostrarEstadoRespaldo();
    } catch (e) {}
  }

  // ---------- 3. Limpieza de avisos y datos viejos (cada minuto) ----------
  function mantener() {
    const hoy = hoyLocalISO();
    guardarJSON("recordatorio_cerrados", leerJSON("recordatorio_cerrados", []).filter(k => k.endsWith("|" + hoy)));
    if (!peliculas.length || pestana !== "catalogo") return;
    renderAvisoEstancados();
    actualizarAvisoFecha();
  }

  // ---------- 4. Recordar dónde te quedaste ----------
  const CLAVE_SESION = "ultima_sesion";
  const CAMPOS = ["estado", "tipo", "genero", "tema", "anio", "pais", "duracion"];

  function guardarSesion() {
    if (!peliculas.length) return;
    const datos = { y: window.scrollY, buscar: buscar.value, orden: $("orden").value };
    CAMPOS.forEach(k => { datos[k] = sel[k].value; });
    guardarJSON(CLAVE_SESION, datos);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") guardarSesion(); });
  window.addEventListener("pagehide", guardarSesion);

  function restaurarSesion() {
    if (new URLSearchParams(location.search).get("id")) return;
    const s = leerJSON(CLAVE_SESION, null);
    if (!s) return;
    buscar.value = s.buscar || "";
    $("orden").value = s.orden || "titulo";
    CAMPOS.forEach(k => { sel[k].value = s[k] || ""; });
    // Con filtros activos, la portada se oculta: muestra la lista para que se vean los resultados
    if (hayFiltros()) { zonaPeli = "lista"; aplicarEstadoTabs(); }
    sel.estado.dispatchEvent(new Event("input"));
    // Siempre se empieza arriba, en el menú principal
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  // Cuando la hoja ya cargó: restaura la sesión y revisa el respaldo una vez
  const espera = setInterval(() => {
    if (!peliculas.length || $("app").style.display !== "block") return;
    clearInterval(espera);
    restaurarSesion();
    respaldoSemanal();
    mostrarEstadoRespaldo();
  }, 300);

  setInterval(mantener, 60000);
  setInterval(respaldoSemanal, 600000);
})();

/* --- bloque 11 --- */

if (window.Nucleo) { Nucleo.registrar("bloques-app04", { version: "1.0", emite: [], escucha: [] }); }
