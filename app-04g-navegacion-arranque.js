/* ===== Fase 0 · Módulo «navegacion-arranque» (lo que quedaba de app-04): navegación (noche, pestañas, paneles, filtros, zonas), arranque de la sesión y acciones de borrar y exportar. Se carga en la misma posición que app-04 para conservar el orden original. Migrado sin cambios de comportamiento. ===== */
/* ---------- Qué ver esta noche: elige según el tiempo disponible ---------- */
let ultimaNoche = null;

const estiloNoche = document.createElement("style");
estiloNoche.textContent = `
.noche-panel{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:min(420px,92vw);background:var(--tarjeta);color:var(--texto);border-radius:var(--radio-grande);box-shadow:var(--sombra);padding:16px;z-index:60}
.noche-cab{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.noche-cab button{background:none;border:0;font-size:22px;color:var(--gris);cursor:pointer}
.noche-panel select{width:100%;padding:10px 12px;border-radius:999px;border:1px solid var(--borde);background:var(--fondo);color:var(--texto);font-size:14px;margin-bottom:10px}
.noche-tarjeta{display:flex;gap:12px;margin-top:12px;align-items:flex-start}
.noche-tarjeta img{width:96px;height:144px;object-fit:cover;border-radius:12px;flex-shrink:0}
.noche-tarjeta .noche-sin{width:96px;height:144px;display:grid;place-items:center;font-size:36px;background:var(--boton-suave);border-radius:12px;flex-shrink:0}
.noche-info{min-width:0}
.noche-info h3{margin:0 0 4px;font-size:17px}
.noche-info p{margin:0 0 10px;font-size:13px;color:var(--gris)}
.noche-acciones{display:flex;flex-wrap:wrap;gap:6px}
.noche-acciones button{border:0;border-radius:999px;padding:7px 12px;font-size:13px;background:var(--boton-suave);color:var(--texto);cursor:pointer}
.noche-acciones button.principal{background:var(--azul);color:#fff}
.noche-vacio{font-size:14px;color:var(--gris);margin:12px 0 0}`;
document.head.appendChild(estiloNoche);

function abrirQueVerEstaNoche() {
  let panel = document.getElementById("nochePanel");
  if (panel) panel.remove();
  panel = document.createElement("div");
  panel.id = "nochePanel";
  panel.className = "noche-panel";

  const cab = document.createElement("div");
  cab.className = "noche-cab";
  const titulo = document.createElement("b");
  titulo.textContent = "🍿 ¿Cuánto tiempo tienes?";
  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.setAttribute("aria-label", "Cerrar");
  cerrar.textContent = "×";
  cerrar.addEventListener("click", () => panel.remove());
  cab.append(titulo, cerrar);

  const sel = document.createElement("select");
  sel.id = "nocheTiempo";
  [["60", "Hasta 1 hora"], ["90", "Hasta 1 h 30 min"], ["120", "Hasta 2 horas"], ["150", "Hasta 2 h 30 min"], ["180", "Hasta 3 horas"], ["0", "Sin límite"]]
    .forEach(([v, t], i) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = t;
      if (v === "120") o.selected = true;
      sel.appendChild(o);
    });

  const elegir = document.createElement("button");
  elegir.type = "button";
  elegir.className = "pildora destacado";
  elegir.textContent = "Elegir película";
  elegir.addEventListener("click", () => elegirNoche(false));

  const resultado = document.createElement("div");
  resultado.id = "nocheResultado";
  panel.append(cab, sel, elegir, resultado);
  document.body.appendChild(panel);
  ultimaNoche = null;
  elegirNoche(false);
}

function elegirNoche(otra) {
  const sel = document.getElementById("nocheTiempo");
  const res = document.getElementById("nocheResultado");
  if (!sel || !res) return;
  const tiempo = Number(sel.value);
  const base = baseElegir({ estado: "no-vistas" });
  let pool = base.filter(p => estadoDe(p).pendiente && cabeEnTiempo(p, tiempo));
  if (!pool.length) pool = base.filter(p => cabeEnTiempo(p, tiempo));
  if (otra && ultimaNoche && pool.length > 1) pool = pool.filter(p => p.titulo !== ultimaNoche.titulo);

  res.textContent = "";
  if (!pool.length) {
    const vacio = document.createElement("p");
    vacio.className = "noche-vacio";
    vacio.textContent = "Ninguna de tus pendientes cabe en ese tiempo. Prueba con más minutos o agrega películas a pendientes.";
    res.appendChild(vacio);
    return;
  }
  const p = pool[Math.floor(Math.random() * pool.length)];
  ultimaNoche = p;

  const tarjeta = document.createElement("div");
  tarjeta.className = "noche-tarjeta";
  if (p.portada) {
    const img = document.createElement("img");
    img.src = p.portada;
    img.alt = "";
    tarjeta.appendChild(img);
  } else {
    const sinPortada = document.createElement("div");
    sinPortada.className = "noche-sin";
    sinPortada.textContent = "🎬";
    tarjeta.appendChild(sinPortada);
  }

  const info = document.createElement("div");
  info.className = "noche-info";
  const h = document.createElement("h3");
  h.textContent = p.titulo;
  const meta = document.createElement("p");
  const partes = [p["año"], p.duracion, p.director].filter(Boolean);
  const durMin = minutos(p);
  const fmtMin = m => (Math.floor(m / 60) ? Math.floor(m / 60) + " h " : "") + (m % 60) + " min";
  meta.textContent = partes.join(" · ");
  if (tiempo && durMin) {
    const sobra = document.createElement("span");
    sobra.className = "noche-sobra";
    sobra.textContent = "Te sobran " + fmtMin(tiempo - durMin);
    meta.appendChild(document.createElement("br"));
    meta.appendChild(sobra);
  }
  const acciones = document.createElement("div");
  acciones.className = "noche-acciones";

  const verFicha = document.createElement("button");
  verFicha.type = "button";
  verFicha.className = "principal";
  verFicha.textContent = "Ver ficha";
  verFicha.addEventListener("click", () => { document.getElementById("nochePanel")?.remove(); abrirDetalle(p); });

  const otraBtn = document.createElement("button");
  otraBtn.type = "button";
  otraBtn.textContent = "Otra";
  otraBtn.addEventListener("click", () => elegirNoche(true));

  const vista = document.createElement("button");
  vista.type = "button";
  vista.textContent = "Ya la vi";
  vista.addEventListener("click", () => {
    cambiarEstado(p.titulo, { vista: true });
    refrescarTodo();
    elegirNoche(true);
  });

  acciones.append(verFicha, otraBtn, vista);
  info.append(h, meta, acciones);
  tarjeta.appendChild(info);
  res.appendChild(tarjeta);
}

function refrescarTodo() {
  pintar();
  if ($("modal").classList.contains("abierto")) {
    const actual = peliculas.find(p => p.titulo === $("detalle").querySelector("h2")?.textContent);
    if (actual) abrirDetalle(actual);
  }
}

const ZONAS_PELICULAS = [["lista","Lista"],["estrenos","Estrenos"],["sagas","Sagas"],["actores","Actores"],["duelo","Duelo"]];
const ZONAS_VISTAS = [["lista","Películas vistas"],["resumen","Resumen"],["actividad","Actividad"],["mapa","Mapa de gustos"],["descartadas","Descartadas"]];

// Qué pestaña de la barra está activa
function tabActiva() {
  if (pestana === "descartadas") return "vistas";
  if (pestana === "catalogo") return zonaPeli === "inicio" ? "inicio" : "catalogo";
  return pestana;
}

// Qué bloque de la página corresponde a la vista actual
function zonaActual() {
  if (pestana === "catalogo") return zonaPeli;
  if (pestana === "vistas") return zonaVistas;
  return "lista";
}

// Cambia el estado según la pestaña de la barra (sin pintar)
function fijarTab(nombre) {
  if (nombre === "inicio") { pestana = "catalogo"; zonaPeli = "inicio"; return; }
  if (nombre === "catalogo") { pestana = "catalogo"; zonaPeli = "lista"; return; }
  if (nombre === "vistas") { pestana = "vistas"; zonaVistas = "lista"; return; }
  pestana = nombre; // notas, pendientes, descartadas
}

function guardarTab() {
  const v = pestana === "catalogo" ? (zonaPeli === "inicio" ? "inicio" : "catalogo") : pestana;
  try { localStorage.setItem("pestana_activa", v); } catch (e) {}
}

// Paneles del encabezado (⚙ filtros y ⋯ menú): se muestran como hoja inferior y solo uno a la vez
function cerrarPaneles() {
  document.getElementById("panelMas").classList.remove("abierto");
  document.getElementById("panelAvanzados").classList.remove("abierto");
  document.body.classList.remove("panel-abierto");
}

function alternarPanel(id) {
  const el = document.getElementById(id);
  const abrir = !el.classList.contains("abierto");
  cerrarPaneles();
  if (abrir) {
    el.classList.add("abierto");
    el.scrollTop = 0;
    document.body.classList.add("panel-abierto");
  }
}

document.getElementById("velo").addEventListener("click", cerrarPaneles);
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarPaneles(); });

function limpiarFiltros() {
  buscar.value = "";
  Object.values(sel).forEach(s => s.value = "");
  cerrarPaneles();
}

// Muestra solo los bloques de la zona actual, marca la pestaña y el selector interno
function aplicarZona() {
  const actual = zonaActual();
  document.querySelectorAll("[data-zona]").forEach(el => {
    el.classList.toggle("fuera-zona", el.dataset.zona !== actual);
  });
  const tab = tabActiva();
  document.querySelectorAll("#tabbar button").forEach(b => b.classList.toggle("activa", b.dataset.tab === tab));

  const cont = $("selectorZona");
  let opciones = null;
  if (pestana === "catalogo" && zonaPeli !== "inicio") opciones = ZONAS_PELICULAS;
  else if (pestana === "vistas" || pestana === "descartadas") opciones = ZONAS_VISTAS;
  if (!opciones) { cont.style.display = "none"; cont.innerHTML = ""; return; }
  const activa = pestana === "descartadas" ? "descartadas" : actual;
  cont.style.display = "";
  cont.innerHTML = opciones.map(([v, t]) =>
    '<button type="button" data-zona-op="' + v + '" class="' + (v === activa ? "activa" : "") + '">' + t + '</button>'
  ).join("");
}

function aplicarEstadoTabs() {
  document.body.classList.toggle("solo-lista", pestana !== "catalogo");
  $("buscar").placeholder = pestana === "notas"
    ? "Busca en tus notas o escribe #etiqueta..."
    : pestana === "descartadas" ? "Buscar en descartadas..." : "Busca por título, director o actor";
  aplicarZona();
}

function cambiarPestana(nombre) {
  fijarTab(nombre);
  if (pestana !== "catalogo" || zonaPeli === "inicio") limpiarFiltros();
  setEstado("");
  guardarTab();
  aplicarEstadoTabs();
  pintar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Selector interno: Películas (lista, estrenos, sagas, actores, duelo) o Vistas (lista, resumen, actividad, mapa, descartadas)
function elegirZona(v) {
  if (pestana === "catalogo") zonaPeli = v;
  else if (v === "descartadas") pestana = "descartadas";
  else { pestana = "vistas"; zonaVistas = v; }
  if (pestana !== "catalogo") limpiarFiltros();
  setEstado("");
  guardarTab();
  aplicarEstadoTabs();
  pintar();
}



async function iniciarApp() {
  await cargarMarcas();
  await cargarHoja();
  cargarProximosCines();
  cargarCuriosidades();
}

window.addEventListener("load", () => {
  setInterval(actualizarCopiaEnSegundoPlano, 15 * 60 * 1000);
  window.addEventListener("online", () => {
    ocultarBannerOffline();
    setTimeout(actualizarCopiaEnSegundoPlano, 3000);
    // Intenta reconectar en silencio para subir los cambios pendientes
    if (!accessToken && tokenClient) {
      try { tokenClient.requestAccessToken({ prompt: "" }); } catch (e) {}
    }
  });
  window.addEventListener("offline", () => {
    if (accessToken && peliculas.length) mostrarBannerOffline(new Date().toISOString());
  });
  if (!navigator.onLine) {
    cargarDesdeCopia();
  }

  $("tema-modo").value = modoGuardado("tema_modo", "sistema");
  $("vista-modo").value = modoGuardado("vista_modo", "apagada");
  $("ahorro-modo").value = modoGuardado("ahorro_modo", "auto");
  actualizarTodo();
  actualizarAhorro();
  pedirUbicacion();
  setInterval(actualizarTodo, 60000);

  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => actualizarTema();
    if (mq.addEventListener) mq.addEventListener("change", alCambiar);
    else if (mq.addListener) mq.addListener(alCambiar);

    const mqDatos = window.matchMedia("(prefers-reduced-data: reduce)");
    if (mqDatos.addEventListener) mqDatos.addEventListener("change", actualizarAhorro);
  }

  if (navigator.connection && navigator.connection.addEventListener) {
    navigator.connection.addEventListener("change", actualizarAhorro);
  }

  if (DOMINIO_INSTITUCIONAL) {
    $("avisoInstitucional").textContent = "Usa tu correo @" + DOMINIO_INSTITUCIONAL + ". Las cuentas personales no tienen acceso.";
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    hosted_domain: DOMINIO_INSTITUCIONAL || undefined,
    callback: async resp => {
      if (!resp.access_token) { mostrarError("No se pudo iniciar sesión."); return; }
      const token = resp.access_token;
      $("btnLogin").textContent = "Verificando tu cuenta…";
      if (!(await cuentaPermitida(token))) {
        try { google.accounts.oauth2.revoke(token, () => {}); } catch (e) {}
        accessToken = null;
        mostrarError("Esta app es solo para cuentas institucionales" + (DOMINIO_INSTITUCIONAL ? " (@" + DOMINIO_INSTITUCIONAL + ")" : "") + ". Vuelve a intentar con tu correo institucional.");
        return;
      }
      accessToken = token;
      iniciarApp();
    }
  });

  $("btnLogin").addEventListener("click", () => {
    $("btnLogin").disabled = true;
    $("btnLogin").textContent = "Cargando películas...";
    tokenClient.requestAccessToken();
  });

  $("toggleAvanzados").addEventListener("click", () => {
    if (pestana === "catalogo" && zonaPeli === "inicio") { zonaPeli = "lista"; aplicarEstadoTabs(); pintar(); }
    alternarPanel("panelAvanzados");
  });

  $("tema-modo").addEventListener("change", () => {
    try { localStorage.setItem("tema_modo", $("tema-modo").value); } catch (e) {}
    actualizarTema();
  });

  $("vista-modo").addEventListener("change", () => {
    try { localStorage.setItem("vista_modo", $("vista-modo").value); } catch (e) {}
    actualizarCalido();
  });

  $("ahorro-modo").addEventListener("change", () => {
    try { localStorage.setItem("ahorro_modo", $("ahorro-modo").value); } catch (e) {}
    ahorroActivo = null;
    actualizarAhorro();
  });

  // La búsqueda espera 120 ms a que dejes de escribir: un solo render en vez de uno por letra
  let pintarBusquedaTimer = null;
  buscar.addEventListener("input", () => {
    clearTimeout(pintarBusquedaTimer);
    pintarBusquedaTimer = setTimeout(pintar, 120);
  });
  [sel.tipo, sel.genero, sel.tema, sel.anio, sel.pais, sel.duracion, sel.estado, $("orden")]
    .forEach(el => el.addEventListener("input", pintar));
  buscar.addEventListener("input", () => {
    if (pestana === "catalogo" && zonaPeli === "inicio" && buscar.value.trim()) { zonaPeli = "lista"; aplicarEstadoTabs(); }
  });
  $("selectorZona").addEventListener("click", e => {
    const b = e.target.closest("[data-zona-op]");
    if (b) elegirZona(b.dataset.zonaOp);
  });

  document.querySelectorAll("#tabbar button[data-tab]").forEach(b => {
    b.addEventListener("click", () => cambiarPestana(b.dataset.tab));
  });
  const guardada = modoGuardado("pestana_activa", "inicio");
  if (["inicio", "catalogo", "notas", "pendientes", "vistas", "descartadas"].includes(guardada)) fijarTab(guardada);
  aplicarEstadoTabs();

  chips.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const clave = chip.dataset.clave;
    if (clave === "buscar") buscar.value = "";
    else sel[clave].value = "";
    pintar();
  });

  // Un solo listener delegado para toda la lista: Descartadas primero, luego tarjetas
  lista.addEventListener("click", e => {
    if (suprimirClic) { suprimirClic = false; return; }
    if (e.target.id === "selTodasDesc") {
      document.querySelectorAll("[data-fila-desc]").forEach(fila => {
        if (fila.style.display === "none") return;
        const t = fila.dataset.filaDesc;
        seleccionDesc.add(t);
        const cb = fila.querySelector("[data-sel]");
        if (cb) cb.checked = true;
      });
      const btn = $("restaurarSelDesc");
      if (btn) {
        btn.textContent = "Restaurar seleccionadas (" + seleccionDesc.size + ")";
        btn.disabled = seleccionDesc.size === 0;
      }
      return;
    }
    if (e.target.id === "restaurarSelDesc") { restaurarTitulos([...seleccionDesc]); return; }
    if (e.target.id === "descartarBtnDesc") { descartarSeleccionadas(); return; }
    const una = e.target.closest("[data-restaurar-una]");
    if (una) { restaurarTitulos([una.dataset.restaurarUna]); return; }
    const rev = e.target.closest("[data-revision]");
    if (rev) { accionRevision(rev.dataset.revision, rev.dataset.clave); return; }

    // Clic en tarjetas (los controles interactivos no abren la ficha)
    if (e.target.closest("a, [data-accion], [data-tag], [data-sel], button, input")) return;
    const card = e.target.closest("[data-i]");
    if (card) {
      desdeAleatorio = false;
      origenPoster = card.querySelector("img.portada");
      abrirDetalle(visibles[Number(card.dataset.i)]);
    }
  });

  // Buscador de Descartadas: solo filtra las filas, así conserva el foco
  lista.addEventListener("input", e => {
    if (e.target.id === "buscarDesc") {
      buscar.value = e.target.value;
      filtrarFilasDescartadas();
    }
  });

  lista.addEventListener("change", e => {
    if (e.target.dataset && e.target.dataset.sel) {
      const t = e.target.dataset.sel;
      if (e.target.checked) seleccionDesc.add(t); else seleccionDesc.delete(t);
      const btn = $("restaurarSelDesc");
      if (btn) {
        btn.textContent = "Restaurar seleccionadas (" + seleccionDesc.size + ")";
        btn.disabled = seleccionDesc.size === 0;
      }
    }
  });

  $("sagas").addEventListener("click", e => {
    const d = e.target.closest("[data-idx]");
    if (d && peliculas[Number(d.dataset.idx)]) {
      desdeAleatorio = false;
      origenPoster = d.querySelector("img"); abrirDetalle(peliculas[Number(d.dataset.idx)]);
    }
  });

  $("carrusel").addEventListener("click", e => {
    const d = e.target.closest("[data-idx]");
    if (d) {
      desdeAleatorio = false;
      origenPoster = d.querySelector("img"); abrirDetalle(peliculas[Number(d.dataset.idx)]);
    }
  });

  // Carrusel de recomendaciones: el botón ¿Por qué? despliega o oculta el desglose; el resto abre la ficha
  $("recomCarrusel").addEventListener("click", e => {
    const pq = e.target.closest("[data-porque]");
    if (pq) {
      const titulo = peliculas[Number(pq.dataset.porque)].titulo;
      if (porQueAbiertos.has(titulo)) porQueAbiertos.delete(titulo);
      else porQueAbiertos.add(titulo);
      renderRecomendaciones();
      return;
    }
    const d = e.target.closest("[data-idx]");
    if (d) {
      desdeAleatorio = false;
      origenPoster = d.querySelector("img"); abrirDetalle(peliculas[Number(d.dataset.idx)]);
    }
  });

  document.addEventListener("click", e => {
    const etiqueta = e.target.closest("[data-tag]");
    if (etiqueta) {
      const tag = etiqueta.dataset.tag;
      if ($("modal").classList.contains("abierto")) cerrarDetalle();
      if (pestana !== "notas") cambiarPestana("notas");
      buscar.value = "#" + tag;
      pintar();
      return;
    }

    const abrir = e.target.closest("[data-decidir-abrir]");
    if (abrir) { decidiendo = abrir.dataset.decidirAbrir; renderAvisoEstancados(); return; }
    const decision = e.target.closest("[data-decidir]");
    if (decision) { accionDecidir(decision.dataset.decidir, decision.dataset.clave); return; }

    if (e.target.id === "avisoFechaCerrar") { cerrarRecordatorio(); return; }
    const tabVer = e.target.closest("[data-ver]");
    if (tabVer) { verActual = tabVer.dataset.ver; ajustarQueVer(); return; }
    if (e.target.id === "preguntaGuardar") { guardarRespuestaDia(e.target.dataset.titulo); return; }
    if (e.target.id === "preguntaOmitir") { omitirPreguntaHoy(); return; }
    if (e.target.id === "avisoCerrar") {
      avisoCerrado = true;
      firmaAvisoCerrado = listaEstancadas().map(x => x.p.titulo + x.tipo).join("|");
      $("avisoEstancados").style.display = "none";
      return;
    }
    if (e.target.id === "avisoDeshacerBtn") { deshacerUltimoDescarte(); return; }

    if (e.target.id === "cerrarResumen") { cerrarResumenSemana(); return; }
    if (e.target.id === "resumenVer") {
      const p = peliculas.find(x => x.titulo === e.target.dataset.titulo);
      if (p) { desdeAleatorio = false; abrirDetalle(p); }
      return;
    }
    if (e.target.id === "btnBorrarNota") { borrarNota(); return; }
    if (e.target.id === "otraSugerencia") { sugerirAleatoria(); return; }
    if (e.target.id === "btnCompartir") {
      if (detalleActual) compartirPelicula(detalleActual);
      return;
    }
    if (e.target.id === "btnEnlace") { copiarEnlace(); return; }
    if (e.target.id === "btnCompartirRec") { compartirRecomendacion(); return; }
    if (e.target.id === "btnCena" || e.target.id === "cenaOtra") { elegirCena(e.target.id === "cenaOtra"); return; }
    if (e.target.id === "calPrev" || e.target.id === "calNext") {
      mesCalendario = desplazarMes(mesCalendario || hoyLocalISO().slice(0, 7), e.target.id === "calNext" ? 1 : -1);
      pintar();
      return;
    }
    const botonActor = e.target.closest("[data-actor]");
    if (botonActor) { cerrarDetalle(); abrirActor(botonActor.dataset.actor); return; }
    const filaActor = e.target.closest("[data-actor-titulo]");
    if (filaActor) {
      const p = peliculas.find(x => x.titulo === filaActor.dataset.actorTitulo);
      cerrarActor();
      if (p) { desdeAleatorio = false; abrirDetalle(p); }
      return;
    }
    const elegidaDuelo = e.target.closest("[data-duelo-elige]");
    if (elegidaDuelo) { elegirEnDuelo(elegidaDuelo.dataset.dueloElige); return; }
    if (e.target.closest("[data-duelo-otro]")) { parDuelo = null; renderDuelo(); return; }
    const botonSaga = e.target.closest("[data-saga-pend]");
    if (botonSaga) { marcarSagaPendiente(botonSaga.dataset.sagaPend); return; }
    const botonSiguiente = e.target.closest("[data-siguiente]");
    if (botonSiguiente) {
      const p = peliculas.find(x => x.titulo === botonSiguiente.dataset.siguiente);
      if (p) { desdeAleatorio = false; abrirDetalle(p); }
      return;
    }
    if (e.target.id === "cenaVer") {
      const p = peliculas.find(x => x.titulo === e.target.dataset.titulo);
      if (p) { desdeAleatorio = false; abrirDetalle(p); }
      return;
    }

    if (e.target.id === "ahoraVer") {
      if (sugeridaActual) { desdeAleatorio = false; abrirDetalle(sugeridaActual); }
      return;
    }
    if (e.target.id === "ahoraOtra") { if (sugeridaActual) registrarRechazo(sugeridaActual); nuevaSugerencia(sugeridaActual); return; }

    const cargar = e.target.closest("[data-cargar-trailer]");
    if (cargar) {
      const caja = cargar.closest(".trailer-caja");
      const titulo = $("detalle").querySelector("h2")?.textContent || "";
      if (caja) caja.innerHTML = iframeTrailer(cargar.dataset.cargarTrailer, titulo);
      return;
    }

    const idioma = e.target.closest("[data-trailer]");
    if (idioma) {
      const caja = $("trailerCaja");
      const titulo = $("detalle").querySelector("h2")?.textContent || "";
      caja.innerHTML = contenidoTrailer(idioma.dataset.codigo, titulo);
      document.querySelectorAll("[data-trailer]").forEach(b => b.classList.toggle("activo", b === idioma));
      return;
    }

    const b = e.target.closest("[data-accion]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();

    const titulo = b.dataset.clave;
    const p = peliculas.find(x => x.titulo === titulo);
    if (!p) return;
    const s = estadoDe(p);

    if (b.dataset.accion === "vista") {
      cambiarEstado(titulo, { vista: !s.vista, pendiente: false, vistaDesde: !s.vista ? new Date().toISOString().slice(0, 10) : undefined });
    } else if (b.dataset.accion === "pendiente") {
      cambiarEstado(titulo, { pendiente: !s.pendiente, vista: false });
    } else if (b.dataset.accion === "conAlguien") {
      alternarConAlguien(titulo);
    } else if (b.dataset.accion === "conFecha") {
      cambiarFechaConAlguien(titulo);
    } else if (b.dataset.accion === "restaurar") {
      cambiarEstado(titulo, { descartada: false });
    } else if (b.dataset.accion === "estrella") {
      const n = Number(b.dataset.n);
      cambiarEstado(titulo, { estrellas: s.estrellas === n ? 0 : n });
    }
    refrescarTodo();
  });

  $("aleatorio").addEventListener("click", sugerirAleatoria);
  $("queVerNoche").addEventListener("click", abrirQueVerEstaNoche);
  $("estadisticas").addEventListener("click", abrirEstadisticas);
  $("guardarPaletas").addEventListener("click", guardarPaletasEnHoja);
  $("deshacer").addEventListener("click", deshacerUltimo);
  $("atajos").addEventListener("click", toggleAyudaAtajos);
  $("capsula").addEventListener("click", abrirCapsulaAno);
  $("parejaBtn").addEventListener("click", alternarModoPareja);
  $("diario").addEventListener("click", abrirDiario);
  $("nocheTema").addEventListener("click", nocheTematica);
  $("maraton").addEventListener("click", abrirMaraton);
  $("sorpresa").addEventListener("click", abrirSorpresa);
  $("votarPareja").addEventListener("click", abrirVotacionPareja);
  $("animoBtn").addEventListener("click", abrirAnimo);
  $("mapaViaje").addEventListener("click", abrirMapaViaje);
  $("buzon").addEventListener("click", abrirBuzon);
  $("prepararViaje").addEventListener("click", prepararViaje);
  $("verViaje").addEventListener("click", abrirModoViaje);
  if (modoPareja()) { $("parejaBtn").textContent = "💑 Modo pareja: activo"; $("parejaBtn").classList.add("destacado"); }
  $("cerrarStats").addEventListener("click", cerrarEstadisticas);
  $("statsModal").addEventListener("click", e => { if (e.target.id === "statsModal") cerrarEstadisticas(); });

  $("cerrarModal").addEventListener("click", cerrarDetalle);
  $("modal").addEventListener("click", e => { if (e.target.id === "modal") cerrarDetalle(); });

  $("vista").addEventListener("click", () => {
    vistaLista = !vistaLista;
    document.body.classList.toggle("lista", vistaLista);
    $("vista").textContent = vistaLista ? "Vista amplia" : "Vista compacta";
    try { localStorage.setItem("vista_tarjetas", vistaLista ? "compacta" : "amplia"); } catch (e) {}
    pintar();
  });

  function alternarAgrupado() {
    agrupado = !agrupado;
    const txt = agrupado ? "Quitar agrupación" : "Agrupar por tema";
    $("agrupar").textContent = txt;
    $("agruparNotas").textContent = txt;
    pintar();
  }
  $("agrupar").addEventListener("click", alternarAgrupado);
  $("agruparNotas").addEventListener("click", alternarAgrupado);
  $("ordenNotas").addEventListener("change", () => pintar());
  $("personaVistas").addEventListener("change", () => pintar());
  $("presetGuardar").addEventListener("click", guardarPreset);
  $("presetBorrar").addEventListener("click", borrarPreset);
  $("presetsSel").addEventListener("change", aplicarPreset);
  renderPresets();
  $("cerrarActor").addEventListener("click", cerrarActor);
  $("actorModal").addEventListener("click", e => { if (e.target.id === "actorModal") cerrarActor(); });

  $("limpiar").addEventListener("click", () => {
    buscar.value = "";
    Object.values(sel).forEach(s => s.value = "");
    $("orden").value = "titulo";
    pintar();
  });

  $("clasificar").addEventListener("click", abrirClasificador);
  $("clasCerrar").addEventListener("click", cerrarClasificador);
  $("clasIzq").addEventListener("click", () => clasAccion("izq"));
  $("clasDer").addEventListener("click", () => clasAccion("der"));
  $("clasDeshacer").addEventListener("click", clasDeshacer);

  $("toggleSalud").addEventListener("click", () => {
    const oculta = modoGuardado("salud_oculta", "1") === "1";
    try { localStorage.setItem("salud_oculta", oculta ? "0" : "1"); } catch (e) {}
    actualizarBotonSalud();
  });

  $("respaldarMarcas").addEventListener("click", respaldarMarcas);
  $("restaurarMarcas").addEventListener("click", () => $("archivoRestaurar").click());
  $("archivoRestaurar").addEventListener("change", e => {
    const archivo = e.target.files && e.target.files[0];
    e.target.value = "";
    if (archivo) restaurarMarcasDesdeArchivo(archivo);
  });
});

async function borrarMisMarcas() {
  const ok = confirm("¿Borrar todas tus marcas (vistas, pendientes, estrellas, notas, «con alguien» y descartadas)? Esta acción no se puede deshacer.");
  if (!ok) return;
  if (!confirm("Última confirmación: se borrarán todas tus marcas y sus respaldos semanales de Drive, y no se pueden recuperar. ¿Seguro?")) return;
  clearTimeout(guardadoTimer);
  try {
    await syncBorrarTodoDrive();
  } catch (e) {
    setEstado("No pude borrar tus marcas de Drive. Intenta de nuevo.");
    return;
  }
  idMarcas = null;
  marcas = envolverMarcas({});
  seleccionDesc.clear();
  porQueAbiertos.clear();
  syncBorrarLocal();
  refrescarTodo();
  setEstado("Tus marcas se borraron de Drive y de este navegador.");
}

$("borrarMarcas").addEventListener("click", borrarMisMarcas);

function exportarCSV() {
  const columnas = ["titulo", "tipo", "año", "duracion", "pais", "director", "genero", "reparto", "temas", "link", "vista", "pendiente", "estrellas", "nota", "conAlguien", "conQuien", "conFecha"];

  const esc = v => {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const filas = [columnas.join(",")];
  peliculas.forEach(p => {
    const s = estadoDe(p);
    const m = marcas[p.titulo] || {};
    const valores = columnas.map(c => {
      if (c === "vista") return s.vista ? "sí" : "no";
      if (c === "pendiente") return s.pendiente ? "sí" : "no";
      if (c === "estrellas") return s.estrellas || "";
      if (c === "nota") return m.nota || "";
      if (c === "conAlguien") return s.conAlguien ? "sí" : "no";
      if (c === "conQuien") return m.conQuien || "";
      if (c === "conFecha") return m.conFecha || "";
      return p[c] ?? "";
    });
    filas.push(valores.map(esc).join(","));
  });

  const blob = new Blob(["\uFEFF" + filas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mi_catalogo_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setEstado("CSV exportado: " + peliculas.length + " títulos.");
}

$("exportar").addEventListener("click", exportarCSV);

/* --- bloques 2 a 11 se movieron a app-04f-bloques-app04.js (se cargan justo después) --- */

if (window.Nucleo) { Nucleo.registrar("navegacion-arranque", { version: "1.0", emite: [], escucha: [] }); }
