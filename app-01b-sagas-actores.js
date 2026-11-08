/* ===== Fase 0 · Módulo «sagas-actores» (sagas y actores, desde la columna reparto): migrado de app-01 sin cambios de comportamiento. Se carga después de app-01, que define el estado. ===== */
/* ---------- Sagas (requiere columna "saga" en la hoja) ---------- */
function sagasAgrupadas() {
  const mapa = {};
  Nucleo.datos.peliculas().forEach(p => {
    const nombre = String(p.saga || "").trim();
    if (!nombre || nombre === "-") return; // "-" = sin saga o serie
    (mapa[nombre] = mapa[nombre] || []).push(p);
  });
  return Object.entries(mapa)
    .filter(([, lista]) => lista.length >= 2)
    .map(([nombre, lista]) => {
      const vistas = lista.filter(p => estadoDe(p).vista).length;
      const pendientesPosibles = lista.filter(p => {
        const s = estadoDe(p);
        return !s.vista && !s.pendiente && !(Nucleo.datos.marcas()[p.titulo] || {}).descartada;
      }).length;
      return { nombre, total: lista.length, vistas, pendientesPosibles, lista };
    })
    .sort((a, b) => (b.vistas / b.total) - (a.vistas / a.total) || a.nombre.localeCompare(b.nombre, "es"));
}

// Número de orden dentro de la saga (columna opcional "saga_orden"); null si no está escrito
function numeroOrdenSaga(p) {
  const t = String(p.saga_orden ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return isFinite(n) ? n : null;
}

// Orden de visualización: saga_orden si existe; si no, año de estreno; luego título
function ordenEnSaga(a, b) {
  const oa = numeroOrdenSaga(a), ob = numeroOrdenSaga(b);
  if (oa !== null && ob !== null && oa !== ob) return oa - ob;
  if (oa !== null && ob === null) return -1;
  if (oa === null && ob !== null) return 1;
  const ya = Number(a["año"]) || 9999, yb = Number(b["año"]) || 9999;
  if (ya !== yb) return ya - yb;
  return String(a.titulo).localeCompare(String(b.titulo), "es");
}

function etiquetaEstadoSaga(p) {
  const s = estadoDe(p);
  if (s.vista) return "✓ Vista";
  if (s.pendiente) return "⏳ Pendiente";
  if ((Nucleo.datos.marcas()[p.titulo] || {}).descartada) return "Descartada";
  return "Sin ver";
}

function marcarSagaPendiente(nombre) {
  const grupo = sagasAgrupadas().find(g => g.nombre === nombre);
  if (!grupo) return;
  let n = 0;
  grupo.lista.forEach(p => {
    const s = estadoDe(p);
    if (!s.vista && !s.pendiente && !(Nucleo.datos.marcas()[p.titulo] || {}).descartada) {
      cambiarEstado(p.titulo, { pendiente: true, vista: false });
      n++;
    }
  });
  setEstado(n ? n + " de «" + nombre + "» marcadas como pendientes." : "No había películas de esa saga para marcar.");
  pintar();
}

function renderSagas() {
  const sec = $("sagas");
  if (!Nucleo.datos.peliculas().length || hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  const grupos = sagasAgrupadas();
  if (!grupos.length) {
    sec.style.display = "none";
    return;
  }
  sec.innerHTML = '<div class="actividad-card sagas-wrap"><h3>Sagas</h3>' +
    grupos.map(g => {
      const pct = Math.round(g.vistas / g.total * 100);
      const peliculasEnOrden = [...g.lista].sort(ordenEnSaga);
      const siguiente = peliculasEnOrden.find(p => { const e = estadoDe(p); return !e.vista && !(Nucleo.datos.marcas()[p.titulo] || {}).descartada; });
      const tarjetas = peliculasEnOrden.map((p, i) => {
        const n = numeroOrdenSaga(p);
        const e = estadoDe(p);
        const visto = !!e.vista;
        const esSiguiente = siguiente === p;
        const portada = (p.portada && !datosLimitados())
          ? '<img src="' + esc(p.portada) + '" alt="" loading="lazy">'
          : '<div class="sg-sinportada">🎬</div>';
        const insignia = visto ? '<span class="sg-ins ok">✓</span>' : (e.pendiente ? '<span class="sg-ins pend">⏳</span>' : '');
        return '<div class="sg-card' + (visto ? ' visto' : '') + (esSiguiente ? ' siguiente' : '') + '" data-idx="' + Nucleo.datos.peliculas().indexOf(p) + '">' +
          '<div class="sg-poster">' + portada +
            '<span class="sg-num">' + esc(n !== null ? n : i + 1) + '</span>' + insignia +
            (esSiguiente ? '<span class="sg-tag">Sigue aquí</span>' : '') +
          '</div>' +
          '<div class="sg-titulo">' + esc(p.titulo) + '</div>' +
          '<div class="sg-anio">' + esc(p["año"] || "") + '</div>' +
        '</div>';
      }).join("");
      return '<div class="saga-fila sg-bloque">' +
        '<div class="sg-cabecera"><div><b class="sg-nombre">' + esc(g.nombre) + '</b>' +
          '<div class="sg-sub">' + (siguiente ? 'Siguiente: ' + esc(siguiente.titulo) : '¡Saga completa!') + '</div></div>' +
          '<div class="sg-pct">' + pct + '%</div></div>' +
        '<div class="saga-barra sg-barra"><div style="width:' + pct + '%"></div></div>' +
        '<div class="sg-tira">' + tarjetas + '</div>' +
        '<div class="sg-pie"><span class="meta">' + g.vistas + ' de ' + g.total + ' vistas</span>' +
        (g.pendientesPosibles ? '<button class="pildora" data-saga-pend="' + esc(g.nombre) + '">Marcar las que faltan como pendientes</button>' : '') +
        '</div></div>';
    }).join("") +
    '</div>';
  sec.style.display = "block";
}

/* ---------- Actores (desde la columna reparto; sin llamadas nuevas) ---------- */
function nombresReparto(p) {
  const de_reparto = String(p.reparto || "").split(",").map(x => x.trim()).filter(Boolean);
  let de_info = [];
  try { de_info = Object.keys(JSON.parse(p.actores_info || "{}") || {}); } catch (e) { de_info = []; }
  return [...new Set([...de_reparto, ...de_info])];
}

// Caché: el agrupado depende solo del catálogo; se recalcula cuando cambia la lista de películas
let actoresCache = { ref: null, n: -1, datos: null };
function actoresAgrupados() {
  if (actoresCache.ref === Nucleo.datos.peliculas() && actoresCache.n === Nucleo.datos.peliculas().length) return actoresCache.datos;
  const mapa = {};
  Nucleo.datos.peliculas().forEach(p => {
    nombresReparto(p).forEach(n => { (mapa[n] = mapa[n] || []).push(p); });
  });
  const datos = Object.entries(mapa)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "es"));
  actoresCache = { ref: Nucleo.datos.peliculas(), n: Nucleo.datos.peliculas().length, datos };
  return datos;
}

function infoActores() {
  const mapa = {};
  Nucleo.datos.peliculas().forEach(p => {
    let m = {};
    try { m = JSON.parse(p.actores_info || "{}") || {}; } catch (e) { m = {}; }
    Object.keys(m).forEach(n => {
      if (!mapa[n] || (!mapa[n].bio && m[n].bio)) mapa[n] = m[n];
    });
  });
  return mapa;
}

function fotoDeActor(nombre, info) {
  if (datosLimitados()) return "";
  return (info && info.foto) || fotosActores[nombre] || "";
}

function inicialesDe(nombre) {
  return nombre.split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase();
}

function bioHtml(info) {
  const es = info.bio || "";
  const en = info.bio_original || "";
  if (!es && !en) return '<p class="meta">Todavía no tenemos la biografía de esta persona.</p>';
  const texto = es || en;
  const aviso = (!info.bio && en) ? ' <span class="meta">(traducción automática)</span>' : '';
  return '<p class="actor-bio" id="actorBio" data-es="' + esc(es || en) + '" data-en="' + esc(en) + '" data-vista="es">' +
    esc(texto.slice(0, 280)) + (texto.length > 280 ? '…' : '') + aviso + '</p>' +
    (texto.length > 280 ? '<button type="button" class="pildora" id="actorBioMas">Leer más</button> ' : '') +
    (en && es ? '<button type="button" class="pildora" id="actorBioIdioma">🌐 Ver original en inglés</button>' : '');
}

function fechaLarga(iso) {
  const d = new Date(String(iso) + "T12:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function renderActores() {
  const sec = $("actores");
  if (!Nucleo.datos.peliculas().length || hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  const lista = actoresAgrupados();
  if (!lista.length) { sec.style.display = "none"; return; }
  const info = infoActores();
  sec.innerHTML = '<div class="actividad-card"><h3>Actores</h3><div class="actores-grid">' +
    lista.map(([n, films]) => {
      const foto = fotoDeActor(n, info[n]);
      return '<button class="actor-card" data-actor="' + esc(n) + '">' +
        (foto ? '<img class="actor-avatar" src="' + esc(foto) + '" alt="" loading="lazy">'
              : '<span class="actor-avatar sin-foto">' + esc(inicialesDe(n)) + '</span>') +
        '<b>' + esc(n) + '</b><span class="meta">' + films.length + (films.length === 1 ? ' título' : ' títulos') + '</span>' +
        '</button>';
    }).join("") + '</div></div>';
  sec.style.display = "block";
}

function abrirActor(nombre) {
  const films = Nucleo.datos.peliculas().filter(p => nombresReparto(p).includes(nombre));
  const info = infoActores()[nombre] || {};
  const foto = fotoDeActor(nombre, info);
  const vistas = films.filter(p => estadoDe(p).vista).length;
  const pendientes = films.filter(p => estadoDe(p).pendiente).length;
  const calificadas = films.filter(p => estadoDe(p).estrellas);
  const promedio = calificadas.length
    ? (calificadas.reduce((a, p) => a + estadoDe(p).estrellas, 0) / calificadas.length).toFixed(1)
    : "—";
  const nacio = info.nacimiento ? "Nació el " + fechaLarga(info.nacimiento) + (info.lugar ? " en " + info.lugar : "") : (info.lugar ? "Nació en " + info.lugar : "");
  const bio = bioHtml(info);
  $("actorTitulo").textContent = nombre;
  $("actorBody").innerHTML =
    '<div class="actor-cabecera">' +
      (foto ? '<img class="actor-foto-grande" src="' + esc(foto) + '" alt="">'
            : '<span class="actor-foto-grande sin-foto">' + esc(inicialesDe(nombre)) + '</span>') +
      '<div><p class="meta">' + esc(nacio) + '</p>' + bio + '</div>' +
    '</div>' +
    '<div class="stats-resumen">' +
      '<div class="stat"><b>' + films.length + '</b><span>títulos</span></div>' +
      '<div class="stat"><b>' + vistas + '</b><span>vistas</span></div>' +
      '<div class="stat"><b>' + pendientes + '</b><span>pendientes</span></div>' +
      '<div class="stat"><b>' + promedio + '</b><span>promedio ★</span></div>' +
    '</div>' +
    '<h4 class="actor-films-titulo">Películas en tu catálogo</h4>' +
    '<div class="actor-films">' + films.map(p => {
      const s2 = estadoDe(p);
      const estado = (Nucleo.datos.marcas()[p.titulo] || {}).descartada ? "descartada" : s2.vista ? "vista" : s2.pendiente ? "pendiente" : "sin ver";
      const portada = p.portada && !datosLimitados()
        ? '<img class="actor-film-poster" src="' + esc(p.portada) + '" alt="" loading="lazy">'
        : '<span class="actor-film-poster sinportada-mini">🎬</span>';
      return '<button type="button" class="actor-film" data-actor-titulo="' + esc(p.titulo) + '">' + portada +
        '<b>' + esc(p.titulo) + '</b><span class="meta">' + esc(p["año"] || "") + ' · ' + estado +
        (s2.estrellas ? ' · ' + s2.estrellas + '★' : '') + '</span></button>';
    }).join("") + '</div>';
  $("actorBody").onclick = e => {
    const bioEl = $("actorBio");
    if (!bioEl) return;
    const mas = e.target.closest("#actorBioMas");
    if (mas) {
      bioEl.textContent = bioEl.dataset.vista === "en" ? bioEl.dataset.en : bioEl.dataset.es;
      mas.remove();
      return;
    }
    const idioma = e.target.closest("#actorBioIdioma");
    if (idioma) {
      const verEn = bioEl.dataset.vista !== "en";
      bioEl.dataset.vista = verEn ? "en" : "es";
      bioEl.textContent = verEn ? bioEl.dataset.en : bioEl.dataset.es;
      idioma.textContent = verEn ? "🌐 Ver en español" : "🌐 Ver original en inglés";
      const mas2 = document.getElementById("actorBioMas");
      if (mas2) mas2.remove();
    }
  };
  $("actorModal").classList.add("abierto");
}

function cerrarActor() {
  $("actorModal").classList.remove("abierto");
}


if (window.Nucleo) { Nucleo.registrar("sagas-actores", { version: "1.0", emite: [], escucha: [] }); }

/* Interruptor de Ajustes (modulo_sagas-actores). Al apagarlo se ocultan las pestañas Sagas y Actores;
   si estabas en una de ellas, vuelves al catálogo al terminar de cargar la página. */
if (window.Nucleo) {
  const aplicarSagas = () => document.body.classList.toggle("sin-sagas", !Nucleo.activo("sagas-actores"));
  const interruptorSag = document.getElementById("moduloSagasOn");
  if (interruptorSag) {
    interruptorSag.checked = Nucleo.activo("sagas-actores");
    interruptorSag.addEventListener("change", () => {
      Nucleo.activar("sagas-actores", interruptorSag.checked);
      aplicarSagas();
      if (!interruptorSag.checked && typeof zonaPeli !== "undefined" && (zonaPeli === "sagas" || zonaPeli === "actores")) cambiarPestana("catalogo");
    });
  }
  aplicarSagas();
  window.addEventListener("load", () => {
    if (!Nucleo.activo("sagas-actores") && typeof zonaPeli !== "undefined" && (zonaPeli === "sagas" || zonaPeli === "actores")) cambiarPestana("catalogo");
  });
}
