/* ===== Fase 0 · Módulo «avisos-descartadas»: aviso de películas estancadas con botón Decidir, y pestaña de descartadas. Migrado de app-03 sin cambios de comportamiento. ===== */
/* ---------- Aviso de estancadas con botón Decidir ---------- */
function listaEstancadas() {
  const pend = Nucleo.datos.peliculas()
    .filter(p => {
      const m = Nucleo.datos.marcas()[p.titulo] || {};
      if (m.descartada) return false;
      const d = diasPendiente(p);
      return estadoDe(p).pendiente && d !== null && d > 30;
    })
    .map(p => ({ p, tipo: "pendiente", dias: diasPendiente(p) }));
  const planeadas = Nucleo.datos.peliculas()
    .filter(p => {
      const d = diasConAlguien(p);
      return estadoDe(p).conAlguien && d !== null && d > 30;
    })
    .map(p => ({ p, tipo: "planeada", dias: diasConAlguien(p) }));
  return [...pend, ...planeadas];
}

function renderAvisoEstancados() {
  const aviso = $("avisoEstancados");
  const items = listaEstancadas();

  const firmaActual = items.map(x => x.p.titulo + x.tipo).join("|");
  if (firmaActual !== firmaAvisoCerrado) avisoCerrado = false;

  if (hayFiltros() || pestana !== "catalogo" || !items.length || avisoCerrado) {
    aviso.style.display = "none";
    return;
  }

  const n = items.filter(x => x.tipo === "pendiente").length;
  const planeadas = items.length - n;
  const partes = [];
  if (n) partes.push(n + (n === 1 ? " pendiente lleva" : " pendientes llevan") + " más de 30 días sin ver");
  if (planeadas) partes.push(planeadas + (planeadas === 1 ? " planeada con alguien lleva" : " planeadas con alguien llevan") + " más de 30 días");
  $("avisoEstancadosTexto").textContent = partes.join(" · ") + ".";

  $("avisoLista").innerHTML = items.map(x => {
    const k = esc(x.p.titulo);
    const detalle = x.tipo === "pendiente"
      ? "Pendiente hace " + x.dias + " días"
      : "Planeada con alguien hace " + x.dias + " días" + ((Nucleo.datos.marcas()[x.p.titulo] || {}).conFecha ? " · " + esc(Nucleo.datos.marcas()[x.p.titulo].conFecha) : "");
    const abierta = decidiendo === x.p.titulo;
    const opciones = x.tipo === "pendiente"
      ? '<button class="pildora destacado" data-decidir="ver" data-clave="' + k + '">Ver ahora</button>' +
        '<button class="pildora" data-decidir="planear" data-clave="' + k + '">Planear fecha</button>' +
        '<button class="pildora" data-decidir="descartar" data-clave="' + k + '">Descartar</button>'
      : '<button class="pildora destacado" data-decidir="ver" data-clave="' + k + '">Ver ahora</button>' +
        '<button class="pildora" data-decidir="cambiarFecha" data-clave="' + k + '">Cambiar fecha</button>' +
        '<button class="pildora" data-decidir="quitarPlan" data-clave="' + k + '">Quitar de planeadas</button>';
    return '<div class="aviso-item"><div class="info-aviso">' + esc(x.p.titulo) +
      '<small>' + detalle + '</small></div>' +
      (abierta
        ? '<div class="aviso-opciones">' + opciones + '</div>'
        : '<div class="aviso-opciones"><button class="pildora" data-decidir-abrir="' + k + '">Decidir</button></div>') +
      '</div>';
  }).join("");

  aviso.style.display = "block";
}

// Muestra el aviso con Deshacer. items: [{ titulo, previo }], donde previo es el estado anterior (o null)
function mostrarDeshacer(texto, items) {
  if (deshacerDescarte && deshacerDescarte.timer) clearTimeout(deshacerDescarte.timer);
  deshacerDescarte = { items };
  $("avisoDeshacerTexto").textContent = texto;
  $("avisoDeshacer").hidden = false;
  deshacerDescarte.timer = setTimeout(() => {
    $("avisoDeshacer").hidden = true;
    deshacerDescarte = null;
  }, 6000);
}

function deshacerUltimoDescarte() {
  if (!deshacerDescarte) return;
  deshacerDescarte.items.forEach(({ titulo, previo }) => {
    if (previo) Nucleo.datos.marcas()[titulo] = previo; else delete Nucleo.datos.marcas()[titulo];
  });
  clearTimeout(deshacerDescarte.timer);
  deshacerDescarte = null;
  $("avisoDeshacer").hidden = true;
  programarGuardado();
  refrescarTodo();
  setEstado("Cambio deshecho.");
}

function accionDecidir(accion, titulo) {
  const p = Nucleo.datos.peliculas().find(x => x.titulo === titulo);
  if (!p) return;
  decidiendo = null;

  if (accion === "ver") {
    desdeAleatorio = false;
    abrirDetalle(p);
    return;
  }
  if (accion === "planear") {
    alternarConAlguien(titulo);
    if (!(Nucleo.datos.marcas()[titulo] || {}).conAlguien) { decidiendo = titulo; renderAvisoEstancados(); }
    refrescarTodo();
    return;
  }
  if (accion === "cambiarFecha") {
    cambiarFechaConAlguien(titulo);
    refrescarTodo();
    return;
  }
  if (accion === "quitarPlan") {
    alternarConAlguien(titulo);
    refrescarTodo();
    return;
  }
  if (accion === "descartar") {
    const previo = Nucleo.datos.marcas()[titulo] ? Object.assign({}, Nucleo.datos.marcas()[titulo]) : null;
    cambiarEstado(titulo, { descartada: true, pendiente: false, vista: false });
    mostrarDeshacer("«" + titulo + "» descartada.", [{ titulo, previo }]);
    refrescarTodo();
  }
}

/* ---------- Pestaña Descartadas ---------- */
function listaDescartadas() {
  return Nucleo.datos.peliculas().filter(p => (Nucleo.datos.marcas()[p.titulo] || {}).descartada);
}

function revisionesPendientes() {
  return listaDescartadas().filter(p => {
    const m = Nucleo.datos.marcas()[p.titulo] || {};
    if (m.revisionHecha) return false;
    const d = diasDescartada(p);
    return d !== null && d >= 90;
  });
}

// Filtra solo las filas (sin repintar la barra) para no perder el foco del buscador
function filtrarFilasDescartadas() {
  const texto = ($("buscarDesc") ? $("buscarDesc").value : "").trim().toLowerCase();
  document.querySelectorAll("[data-fila-desc]").forEach(fila => {
    const titulo = fila.dataset.filaDesc.toLowerCase();
    const nota = (Nucleo.datos.marcas()[fila.dataset.filaDesc] || {}).nota || "";
    fila.style.display = (titulo + " " + nota.toLowerCase()).includes(texto) ? "" : "none";
  });
}

function renderPestanaDescartadas() {
  const todas = listaDescartadas();
  const texto = ($("buscarDesc") ? $("buscarDesc").value : buscar.value).trim().toLowerCase();
  const revisiones = revisionesPendientes();

  seleccionDesc = new Set([...seleccionDesc].filter(t => todas.some(p => p.titulo === t)));

  const visiblesDesc = todas
    .filter(p => {
      const m = Nucleo.datos.marcas()[p.titulo] || {};
      return [p.titulo, m.nota || ""].join(" ").toLowerCase().includes(texto);
    })
    .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), "es"));

  visibles = visiblesDesc;
  contador.textContent = "Descartadas: " + todas.length + " · mostrando " + visiblesDesc.length;
  chips.innerHTML = "";

  let html = "";

  if (revisiones.length) {
    html += '<div class="desc-bloque"><h3>Lleva más de 90 días descartada: ¿la reconsideras?</h3>' +
      '<p class="meta">Tú decides. Nada cambia hasta que pulses un botón.</p>' +
      revisiones.map(p => {
        const k = esc(p.titulo);
        return '<div class="desc-item"><div class="info-desc">' + esc(p.titulo) +
          '<small>Descartada hace ' + diasDescartada(p) + ' días</small></div>' +
          '<div class="desc-acciones">' +
          '<button class="pildora destacado" data-revision="restaurar" data-clave="' + k + '">Restaurar</button>' +
          '<button class="pildora" data-revision="dejar" data-clave="' + k + '">Dejar así</button>' +
          '</div></div>';
      }).join("") +
      '</div>';
  }

  html += '<div class="desc-barra">' +
    '<input type="search" id="buscarDesc" placeholder="Buscar en descartadas" value="' + esc(buscar.value) + '">' +
    '<button class="pildora" id="selTodasDesc">Seleccionar todas las visibles</button>' +
    '<button class="pildora destacado" id="restaurarSelDesc"' + (seleccionDesc.size ? '' : ' disabled') + '>Restaurar seleccionadas (' + seleccionDesc.size + ')</button>' +
    '<button class="pildora" id="descartarBtnDesc">🗑 Descartar…</button>' +
    '</div>';

  if (!todas.length) {
    html += '<p class="vacio">Aún no descartas películas. Si una no te interesa, ábrela y usa «Descartar»; así no te la vuelvo a sugerir.</p>';
  } else {
    html += todas.map(p => {
      const k = esc(p.titulo);
      const d = diasDescartada(p);
      const cuando = d === null ? "fecha desconocida" : "descartada hace " + d + (d === 1 ? " día" : " días");
      return '<div class="desc-fila" data-fila-desc="' + k + '"' +
        (visiblesDesc.includes(p) ? '' : ' style="display:none"') + '>' +
        '<input type="checkbox" data-sel="' + k + '"' + (seleccionDesc.has(p.titulo) ? ' checked' : '') + '>' +
        ((p.portada && !datosLimitados()) ? '<img class="mini-portada" src="' + esc(p.portada) + '" alt="">' : '<div class="mini-portada mini-sinportada">🎬</div>') +
        '<div class="info-fila"><h2>' + esc(p.titulo) + '</h2>' +
        '<div class="meta">' + esc(p["año"]) + ' · ' + cuando + '</div></div>' +
        '<button class="chipc" data-restaurar-una="' + k + '">↩ Restaurar</button>' +
        '</div>';
    }).join("");
  }

  lista.innerHTML = html;
}

function accionRevision(accion, titulo) {
  if (accion === "restaurar") {
    cambiarEstado(titulo, { descartada: false });
  } else {
    Nucleo.datos.marcas()[titulo] = Object.assign({}, Nucleo.datos.marcas()[titulo] || {}, { revisionHecha: true });
    programarGuardado();
  }
  refrescarTodo();
}

function restaurarTitulos(titulos) {
  if (!titulos.length) return;
  titulos.forEach(t => cambiarEstado(t, { descartada: false }));
  seleccionDesc.clear();
  setEstado(titulos.length + (titulos.length === 1 ? " película restaurada." : " películas restauradas."));
  refrescarTodo();
}

// Descarta las seleccionadas desde la propia pestaña, con aviso de Deshacer
function descartarSeleccionadas() {
  const titulos = [...seleccionDesc];
  if (!titulos.length) { setEstado("Marca al menos una película para descartarla."); return; }
  const items = titulos.map(t => ({ titulo: t, previo: Nucleo.datos.marcas()[t] ? Object.assign({}, Nucleo.datos.marcas()[t]) : null }));
  titulos.forEach(t => cambiarEstado(t, { descartada: true, pendiente: false, vista: false }));
  seleccionDesc.clear();
  const texto = titulos.length + (titulos.length === 1 ? " película descartada." : " películas descartadas.");
  mostrarDeshacer(texto, items);
  setEstado(texto);
  refrescarTodo();
}

if (window.Nucleo) { Nucleo.registrar("avisos-descartadas", { version: "1.0", emite: [], escucha: [] }); }
