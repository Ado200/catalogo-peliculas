/* ---------- Automatización de la experiencia (etapa 4) ---------- */
let tarjetaMostradaSesion = false;

// Fecha actual; para probar, guarda una fecha en el navegador: localStorage.setItem("fecha_prueba", "2026-11-09")
function fechaAuto() {
  const p = leerLS("fecha_prueba");
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) { const [y, m, d] = p.split("-").map(Number); return new Date(y, m - 1, d, 12); }
  return new Date();
}
function isoAuto(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function semanaAuto(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const n = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + "-S" + String(n).padStart(2, "0");
}
function lunesAuto(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() || 7) - 1));
  return x;
}
function interruptorAuto(clave) { return leerLS(clave) !== "no"; }
function sugeridasRecientes() {
  try { return JSON.parse(leerLS("auto_sugeridas") || "[]"); } catch (e) { return []; }
}

function candidataSaga(hoy) {
  const mk = t => marcas[t] || {};
  const empezadas = new Set(peliculas
    .filter(p => mk(p.titulo).vista && String(p.saga || "").trim() && String(p.saga).trim() !== "-")
    .map(p => String(p.saga).trim()));
  const ahora = hoy.getTime();
  const p = peliculas.find(x => {
    const s = String(x.saga || "").trim();
    if (!s || s === "-" || !empezadas.has(s)) return false;
    const m = mk(x.titulo);
    if (m.vista || m.descartada || leerLS("auto_saga_" + x.titulo) === "1") return false;
    const f = Date.parse(String(x.estreno || "").slice(0, 10));
    if (!f) return false;
    const dias = (f - ahora) / 86400000;
    return dias >= -14 && dias <= 30;
  });
  if (!p) return null;
  const f = String(p.estreno).slice(0, 10);
  return {
    clave: "auto_saga_" + p.titulo, tipo: "Saga",
    titulo: "Se estrena algo de «" + p.saga + "»",
    texto: "«" + p.titulo + "» " + (f > isoAuto(hoy) ? "llega el " + f : "se estrenó el " + f) + ". Ya empezaste esta saga."
  };
}

function candidataFinde(hoy) {
  const dia = hoy.getDay();
  if (dia !== 5 && dia !== 6 && dia !== 0) return null;
  const clave = "auto_finde_" + semanaAuto(hoy);
  if (leerLS(clave) === "1") return null;
  const mk = t => marcas[t] || {};
  const recientes = new Set(sugeridasRecientes().filter(x => Date.now() - x.f < 7 * 86400000).map(x => x.t));
  const pool = peliculas.filter(p => {
    const m = mk(p.titulo);
    const min = minutos(p);
    return m.pendiente && !m.vista && !m.descartada && min > 0 && min <= 120 && !recientes.has(p.titulo);
  });
  if (!pool.length) return null;
  const elegida = pool[Math.floor(Math.random() * pool.length)];
  let texto = "Para esta noche: «" + elegida.titulo + "» (" + minutos(elegida) + " min).";
  const resto = pool.filter(p => p !== elegida).sort(() => Math.random() - 0.5);
  let total = minutos(elegida);
  const maraton = [elegida];
  for (const p of resto) {
    if (maraton.length >= 3) break;
    if (total + minutos(p) <= 240) { maraton.push(p); total += minutos(p); }
  }
  if (maraton.length >= 2) texto += " Si quieres maratón: " + maraton.map(p => "«" + p.titulo + "»").join(" + ") + " (" + total + " min en total).";
  const guardar = JSON.parse(leerLS("auto_sugeridas") || "[]").concat(maraton.map(p => ({ t: p.titulo, f: Date.now() })));
  escribirLS("auto_sugeridas", JSON.stringify(guardar.slice(-30)));
  return { clave: clave, tipo: "Fin de semana", titulo: "Para este fin de semana", texto: texto };
}

function candidataLunes(hoy) {
  const clave = "auto_lunes_" + semanaAuto(hoy);
  if (leerLS(clave) === "1") return null;
  const mk = t => marcas[t] || {};
  const inicioSem = lunesAuto(hoy);
  const inicioAnt = new Date(inicioSem); inicioAnt.setDate(inicioAnt.getDate() - 7);
  const finAnt = new Date(inicioSem); finAnt.setDate(finAnt.getDate() - 1);
  const a = isoAuto(inicioAnt), b = isoAuto(finAnt);
  const vistas = peliculas.filter(p => { const d = String(mk(p.titulo).vistaDesde || ""); return mk(p.titulo).vista && d >= a && d <= b; }).length;
  const pend = peliculas.filter(p => mk(p.titulo).pendiente && !mk(p.titulo).vista && !mk(p.titulo).descartada).length;
  const reto = retoActual();
  const planes = recordatoriosActivos().length;
  let texto = vistas
    ? "La semana pasada viste " + vistas + " película" + (vistas === 1 ? "" : "s") + ". Te quedan " + pend + " pendiente" + (pend === 1 ? "" : "s") + "."
    : "Semana tranquila. ¿Retomamos algún pendiente?";
  texto += " 🏆 " + reto.texto + ".";
  if (planes) texto += " Tienes " + planes + " plan" + (planes === 1 ? "" : "es") + " con alguien en los próximos días.";
  return { clave: clave, tipo: "Resumen", titulo: "Tu semana", texto: texto };
}

function renderTarjetaAuto() {
  const sec = $("tarjetaAuto");
  if (!sec || tarjetaMostradaSesion || !document.body.classList.contains("con-sesion") || !peliculas.length) return;
  const hoy = fechaAuto();
  const opciones = [
    { on: "auto-lunes", fn: () => candidataLunes(hoy) },
    { on: "auto-viernes", fn: () => candidataFinde(hoy) },
    { on: "auto-sagas", fn: () => candidataSaga(hoy) }
  ];
  // Prioridad: saga, fin de semana, resumen. Una tarjeta por entrada.
  const orden = [opciones[2], opciones[1], opciones[0]];
  for (const o of orden) {
    const clave = o.on === "auto-sagas" ? "auto_sagas" : o.on === "auto-viernes" ? "auto_viernes" : "auto_lunes";
    if (leerLS(clave) === "no") continue;
    const c = o.fn();
    if (!c) continue;
    if (c.clave.indexOf("auto_lunes_") === 0 || c.clave.indexOf("auto_finde_") === 0) escribirLS(c.clave, "1");
    if (c.clave.indexOf("auto_saga_") === 0) escribirLS(c.clave, "1");
    sec.innerHTML =
      '<button type="button" class="saludo-cerrar" data-accion="cerrar-auto" aria-label="Cerrar">×</button>' +
      '<h2>' + esc(c.titulo) + '</h2><p>' + esc(c.texto) + '</p>';
    sec.style.display = "block";
    tarjetaMostradaSesion = true;
    return;
  }
}

$("tarjetaAuto").addEventListener("click", e => {
  if (e.target.closest("[data-accion='cerrar-auto']")) {
    $("tarjetaAuto").style.display = "none";
  }
});
setTimeout(renderTarjetaAuto, 15000);


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
  const capsDe = titulo => ((marcas[titulo] || {}).capitulos) || {};

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

/* ---------- Curiosidad con botón: datos reales de tu colección, distinta cada vez ---------- */
const CURIO_VISTAS_KEY = "curio_vistas";
let curioActual = null;

function claveCurio(c) {
  return (c.peli ? c.peli.titulo : "") + "|" + (c.tema || "") + "|" + String(c.texto || "").slice(0, 40);
}

function curioVistas() {
  try { return JSON.parse(leerLS(CURIO_VISTAS_KEY) || "[]"); } catch (e) { return []; }
}

function marcarCurioVista(c) {
  const v = curioVistas().filter(x => x !== claveCurio(c));
  v.push(claveCurio(c));
  escribirLS(CURIO_VISTAS_KEY, JSON.stringify(v.slice(-60)));
}

// Prefiere lo que todavía no has visto; cuando ya viste todo, vuelve a empezar
function elegirCuriosidad() {
  const lista = todasLasCuriosidades();
  if (!lista.length) return null;
  const vistas = new Set(curioVistas());
  const nuevas = lista.filter(c => !vistas.has(claveCurio(c)));
  const pool = nuevas.length ? nuevas : lista;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Historia breve armada solo con datos reales de la ficha (año, director, género, duración, sinopsis, reparto)
function historiaDe(p) {
  const partes = [];
  const anio = p["año"] ? String(p["año"]) : "";
  const dir = String(p.director || "").split(",")[0].trim();
  const gen = String(p.genero || "").split(",")[0].trim();
  const dur = String(p.duracion || "").trim();
  const frase = String(p.sinopsis || "").split(/(?<=[.!?])\s+/)[0] || "";
  const rep = String(p.reparto || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 2);
  const variantes = [
    () => [anio && dir ? "En " + anio + ", " + dir + " llevó a la pantalla «" + p.titulo + "»." : null, frase],
    () => ["«" + p.titulo + "»" + (anio ? " (" + anio + ")" : "") + (gen ? " es un " + gen.toLowerCase() : "") + (dur ? " de " + dur : "") + ".", frase, rep.length ? "En el reparto están " + rep.join(" y ") + "." : null],
    () => [dir ? "Detrás de la película está " + dir + "." : null, frase, rep.length ? "Protagonizan " + rep.join(" y ") + "." : null]
  ];
  const elegida = variantes[Math.floor(Math.random() * variantes.length)]();
  return elegida.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

const MESES_CURIO = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// Datos reales de la película: saga, país, estreno, duración, director, género, década
function hechosDePelicula(p) {
  const out = [];
  const saga = String(p.saga || "").trim();
  if (saga && saga !== "-") {
    const n = peliculas.filter(x => String(x.saga || "").trim() === saga).length;
    out.push("Es parte de la saga «" + saga + "». En tu colección hay " + n + " película" + (n === 1 ? "" : "s") + " de ella.");
  }
  const pais = String(p.pais || "").trim();
  if (pais) out.push("Se produjo en " + pais + ".");
  const est = String(p.estreno || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(est)) {
    const [y, m, d] = est.split("-").map(Number);
    out.push("Llegó a los cines el " + d + " de " + MESES_CURIO[m - 1] + " de " + y + ".");
  }
  const min = minutos(p);
  if (min) out.push("Dura " + min + " minutos.");
  const dir = String(p.director || "").split(",")[0].trim();
  if (dir) {
    const n = peliculas.filter(x => String(x.director || "").split(",")[0].trim() === dir).length;
    if (n > 1) out.push(dir + " tiene " + n + " películas en tu colección.");
  }
  const anio = Number(p["año"]);
  if (anio) out.push("Es de los años " + (Math.floor(anio / 10) * 10) + ".");
  return out;
}

// Datos reales de los actores de la película (fuente: TMDB, guardados en tu hoja)
function hechosDeActores(p) {
  const out = [];
  const info = infoActores();
  nombresReparto(p).forEach(nombre => {
    const i = info[nombre] || {};
    if (i.lugar) out.push(nombre + " nació en " + i.lugar + ".");
    else if (/^\d{4}/.test(i.nacimiento || "")) out.push(nombre + " nació en " + String(i.nacimiento).slice(0, 4) + ".");
    const bio = String(i.bio || "").split(/(?<=[.!?])\s+/)[0] || "";
    if (bio.length > 20 && bio.length < 260) out.push(nombre + ": " + bio);
    const n = peliculas.filter(x => nombresReparto(x).indexOf(nombre) !== -1).length;
    if (n > 1) out.push(nombre + " aparece en " + n + " películas de tu colección.");
  });
  return out;
}

// Conexiones: "te suena porque…" (actor en otra película que ya viste) y "puente" (actor en otra pendiente)
function conexionesDe(p) {
  const out = [];
  const m = a => marcas[a.titulo] || {};
  const reparto = nombresReparto(p);
  reparto.forEach(nombre => {
    const otras = peliculas.filter(x => x.titulo !== p.titulo && nombresReparto(x).indexOf(nombre) !== -1);
    const vistas = otras.filter(x => m(x).vista);
    if (vistas.length) out.push("Te suena porque " + nombre + " también salió en «" + vistas[0].titulo + "», que ya marcaste como vista.");
    const pend = otras.filter(x => !m(x).vista && !m(x).descartada);
    if (pend.length) out.push("Si te gusta " + nombre + ", «" + pend[0].titulo + "» también está en tu lista por ver.");
  });
  const saga = String(p.saga || "").trim();
  if (saga && saga !== "-") {
    const vistasSaga = peliculas.filter(x => x.titulo !== p.titulo && String(x.saga || "").trim() === saga && m(x).vista).length;
    if (vistasSaga) out.push("De la saga «" + saga + "» ya viste " + vistasSaga + " más.");
  }
  return out;
}

// Spoilers: el texto que pueda revelar el final se oculta hasta que la persona lo pide
const PALABRAS_SPOILER = /(final|desenlace|muere|murió|muerte|termina|resulta que|el asesino|revela|traición|se descubre|al terminar)/i;
function esSpoiler(texto) { return PALABRAS_SPOILER.test(String(texto || "")); }
const CURIO_REVELADOS = new Set();

function unDato(lista) {
  return lista.length ? lista[Math.floor(Math.random() * lista.length)] : "";
}

// ---------- Pestaña de Curiosidades (fase 1) ----------
const CURIO_REAC_KEY = "curio_reacciones";
const CURIO_HIST_KEY = "curio_historial";
let curioFiltro = "todas";
let curioIdx = 0;
let curioLista = [];

function curioTipo(c) {
  const t = String(c.tema || "").toLowerCase();
  if (/internet/.test(t)) return "internet";
  if (/actor|reparto/.test(t)) return "actores";
  if (/saga/.test(t)) return "saga";
  return "pelicula";
}

// ---------- Fase 3: orden adaptativo ----------
// Relevancia (tus gustos) · novedad (no vista) · calidad (con fuente) · aprendizaje (tus reacciones)
// Diversidad: no pone dos del mismo tipo seguidas.
function perfilCurio() {
  const m = a => marcas[a.titulo] || {};
  const favoritas = peliculas.filter(p => m(p).vista && (m(p).estrellas || 0) >= 4);
  const perfil = { genero: {}, director: {}, actor: {} };
  const sumar = (obj, clave) => { if (clave) obj[clave] = (obj[clave] || 0) + 1; };
  favoritas.forEach(p => {
    generosDe(p).forEach(g => sumar(perfil.genero, g.toLowerCase()));
    sumar(perfil.director, String(p.director || "").split(",")[0].trim().toLowerCase());
    nombresReparto(p).slice(0, 4).forEach(a => sumar(perfil.actor, a.toLowerCase()));
  });
  return perfil;
}

function pesosCurio() {
  // Cuánto te gusta cada tipo de curiosidad, según tus reacciones
  const pesos = { pelicula: 0, actores: 0, saga: 0 };
  const reac = curioReacciones();
  Object.keys(reac).forEach(k => {
    const tipo = curioTipo({ tema: String(k.split("|")[1] || "") });
    const v = reac[k];
    if (v === "gusta") pesos[tipo] += 1;
    else if (v === "sabia") pesos[tipo] -= 0.5;
    else if (v === "no") pesos[tipo] -= 1;
  });
  return pesos;
}

function puntuarCurio(c, perfil, pesos, vistas, reac) {
  const p = c.peli || {};
  const genero = generosDe(p).some(g => perfil.genero[g.toLowerCase()]) ? 1 : 0;
  const dir = perfil.director[String(p.director || "").split(",")[0].trim().toLowerCase()] ? 1 : 0;
  const act = nombresReparto(p).some(a => perfil.actor[a.toLowerCase()]) ? 1 : 0;
  const relevancia = Math.min(1, (genero * 0.4) + (dir * 0.3) + (act * 0.3));
  const novedad = vistas.has(claveCurio(c)) ? 0.3 : 1;
  const calidad = c.fuente ? 1 : 0.6;
  const aprendizaje = Math.max(-1, Math.min(1, (pesos[curioTipo(c)] || 0) / 5));
  let score = relevancia * 0.4 + novedad * 0.3 + calidad * 0.2 + aprendizaje * 0.1;
  if (reac[claveCurio(c)] === "no") score -= 1;
  return score;
}

function curioFiltrada() {
  const base = todasLasCuriosidades().concat(curiosidadesInternet);
  const filtrada = (curioFiltro === "todas" ? base : base.filter(c => curioTipo(c) === curioFiltro)).filter(curioEstaSana);
  const perfil = perfilCurio(), pesos = pesosCurio(), vistas = new Set(curioVistas()), reac = curioReacciones();
  const ordenada = filtrada
    .map(c => ({ c: c, s: puntuarCurio(c, perfil, pesos, vistas, reac) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.c);
  // Diversidad: si la siguiente es del mismo tipo que la anterior, busca otra de distinto tipo cerca
  const salida = [];
  const quedan = ordenada.slice();
  while (quedan.length) {
    const ultimo = salida.length ? curioTipo(salida[salida.length - 1]) : null;
    let i = quedan.findIndex((c, k) => k < 4 && curioTipo(c) !== ultimo);
    if (i < 0) i = 0;
    salida.push(quedan.splice(i, 1)[0]);
  }
  return salida;
}

function curioReacciones() {
  try { return JSON.parse(leerLS(CURIO_REAC_KEY) || "{}"); } catch (e) { return {}; }
}

function curioHistorial() {
  try { return JSON.parse(leerLS(CURIO_HIST_KEY) || "[]"); } catch (e) { return []; }
}

function curioRegistrar(c, reaccion) {
  const k = claveCurio(c);
  const r = curioReacciones();
  if (reaccion) r[k] = reaccion;
  escribirLS(CURIO_REAC_KEY, JSON.stringify(r));
  const hist = curioHistorial().filter(x => x.k !== k);
  hist.unshift({ k: k, titulo: c.peli ? c.peli.titulo : "", texto: c.texto, ts: Date.now() });
  escribirLS(CURIO_HIST_KEY, JSON.stringify(hist.slice(0, 100)));
}

function curioProgreso() {
  const vistas = new Set(curioVistas());
  return curioLista.filter(c => vistas.has(claveCurio(c))).length;
}

function renderCuriosidadModal() {
  const body = $("curioBody");
  if (!body) return;
  curioLista = curioFiltrada();
  if (curioIdx >= curioLista.length) curioIdx = 0;
  const c = curioLista[curioIdx];
  const filtros = [["todas","Todas"],["pelicula","Película"],["actores","Actores"],["saga","Saga"],["internet","Internet"]];
  const barra = '<div class="cur-filtros" role="tablist">' + filtros.map(f =>
    '<button type="button" role="tab" aria-selected="' + (curioFiltro === f[0]) + '" class="cur-filtro' + (curioFiltro === f[0] ? ' activo' : '') + '" data-cur="filtro" data-valor="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>';
  const diag = curioDiagnostico();
  const cabecera = '<p class="meta cur-diag">' + esc(diag) + '</p>' + '<div class="cur-cab"><h2 class="series-h2">Curiosidades</h2>' +
    '<button type="button" class="cur-icono" data-cur="historial" aria-label="Historial">🕘</button></div>' + barra;

  if (!curioLista.length) {
    body.innerHTML = cabecera + '<div class="cur-vacio"><p>Todavía no hay curiosidades para este filtro.</p><p class="meta">Agrega datos a la pestaña curiosidades o llena más películas, y aparecerán aquí.</p></div>';
    return;
  }

  const reac = curioReacciones()[claveCurio(c)] || "";
  const fondo = c.peli && c.peli.portada ? ' style="background-image:url(\'' + esc(c.peli.portada) + '\')"' : '';
  const deLaPeli = unDato(hechosDePelicula(c.peli));
  const deActores = unDato(hechosDeActores(c.peli));
  const conexion = unDato(conexionesDe(c.peli));
  const clave = claveCurio(c);
  const oculto = esSpoiler(c.texto) && !CURIO_REVELADOS.has(clave);
  const textoHtml = oculto
    ? '<p class="cur-texto cur-oculto" aria-hidden="true">' + esc(c.texto) + '</p><button type="button" class="pildora cur-revelar" data-cur="revelar">Revelar (contiene spoiler)</button>'
    : '<p class="cur-texto">' + esc(c.texto) + '</p>';
  const pos = (curioIdx + 1) + " de " + curioLista.length + " · " + curioProgreso() + " vistas";
  const reacBtn = (v, t) => '<button type="button" class="cur-reac' + (reac === v ? ' activo' : '') + '" data-cur="reac" data-valor="' + v + '" aria-pressed="' + (reac === v) + '">' + t + '</button>';

  body.innerHTML = cabecera +
    '<article class="cur-tarjeta" id="curioTarjeta">' +
      '<div class="cur-fondo"' + fondo + ' aria-hidden="true"></div>' +
      '<div class="cur-cuerpo">' +
        '<p class="cur-tema">' + esc(c.tema || "Dato") + ' · ' + esc(c.peli.titulo) + '</p>' +
        textoHtml +
        (c.fuente ? '<small class="cur-fuente">Fuente: ' + esc(c.fuente) + '</small>' : '') +
        (deLaPeli ? '<h3 class="cur-h3">Sobre la película</h3><p class="cur-historia">' + esc(deLaPeli) + '</p>' : '') +
        (deActores ? '<h3 class="cur-h3">Sobre sus actores</h3><p class="cur-historia">' + esc(deActores) + '</p>' : '') +
        (conexion ? '<h3 class="cur-h3">En tu colección</h3><p class="cur-historia">' + esc(conexion) + '</p>' : '') +
      '</div>' +
    '</article>' +
    '<div class="cur-nav">' +
      '<button type="button" class="cur-flecha" data-cur="ant" aria-label="Anterior">‹</button>' +
      '<span class="cur-pos" aria-live="polite">' + esc(pos) + '</span>' +
      '<button type="button" class="cur-flecha" data-cur="sig" aria-label="Siguiente">›</button>' +
    '</div>' +
    '<div class="cur-reacciones">' + reacBtn("gusta","👍 Me gusta") + reacBtn("sabia","✓ Ya lo sabía") + reacBtn("no","✕ No me interesa") + '</div>' +
    '<div class="cur-pie">' +
      '<button type="button" class="pildora" data-cur="compartir">Compartir</button>' +
      '<button type="button" class="pildora" data-cur="reportar">Reportar</button>' +
      '<button type="button" class="pildora" data-cur="ver">Ver ficha</button>' +
    '</div>';
  marcarCurioVista(c);
  curioRegistrar(c, null);
}

function renderCurioHistorial() {
  const body = $("curioBody");
  const hist = curioHistorial();
  body.innerHTML = '<div class="cur-cab"><button type="button" class="pildora" data-cur="volver">← Volver</button><h2 class="series-h2">Historial</h2></div>' +
    (hist.length ? '<ul class="cur-hist">' + hist.map(x =>
      '<li><strong>' + esc(x.titulo) + '</strong><span>' + esc(x.texto) + '</span></li>').join('') + '</ul>'
      : '<p class="meta">Aquí aparecen las curiosidades que ya viste.</p>');
}



function abrirCuriosidad() {
  curioActual = elegirCuriosidad();
  if (curioActual) marcarCurioVista(curioActual);
  renderCuriosidadModal(curioActual);
  const v = $("curioModal");
  if (v) v.classList.add("abierto");
}

function cerrarCuriosidad() {
  const v = $("curioModal");
  if (v) v.classList.remove("abierto");
}

(function curiosidadBoton() {
  const boton = $("btnCuriosidad"), ventana = $("curioModal");
  if (!boton || !ventana) return;
  boton.addEventListener("click", abrirCuriosidad);
  $("cerrarCurio").addEventListener("click", cerrarCuriosidad);
  ventana.addEventListener("click", e => { if (e.target === ventana) cerrarCuriosidad(); });
  document.addEventListener("keydown", e => {
    if (!ventana.classList.contains("abierto")) return;
    if (e.key === "Escape") cerrarCuriosidad();
    if (e.key === "ArrowRight") { curioIdx = (curioIdx + 1) % Math.max(curioLista.length, 1); renderCuriosidadModal(); }
    if (e.key === "ArrowLeft") { curioIdx = (curioIdx - 1 + Math.max(curioLista.length, 1)) % Math.max(curioLista.length, 1); renderCuriosidadModal(); }
  });
  let x0 = null;
  const body = $("curioBody");
  body.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  body.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 50 || !curioLista.length) return;
    curioIdx = dx < 0 ? (curioIdx + 1) % curioLista.length : (curioIdx - 1 + curioLista.length) % curioLista.length;
    renderCuriosidadModal();
  });
  body.addEventListener("click", async e => {
    const b = e.target.closest("[data-cur]");
    if (!b) return;
    const acc = b.dataset.cur;
    const c = curioLista[curioIdx];
    if (acc === "filtro") { curioFiltro = b.dataset.valor; curioIdx = 0; renderCuriosidadModal(); }
    else if (acc === "ant" && curioLista.length) { curioIdx = (curioIdx - 1 + curioLista.length) % curioLista.length; renderCuriosidadModal(); }
    else if (acc === "sig" && curioLista.length) { curioIdx = (curioIdx + 1) % curioLista.length; renderCuriosidadModal(); }
    else if (acc === "reac" && c) { curioRegistrar(c, b.dataset.valor); if (c) marcarCurioVista(c); renderCuriosidadModal(); }
    else if (acc === "reportar" && c) { curioReportar(c); b.textContent = "Gracias, lo revisamos"; b.disabled = true; }
    else if (acc === "revelar" && c) { CURIO_REVELADOS.add(claveCurio(c)); renderCuriosidadModal(); }
    else if (acc === "historial") renderCurioHistorial();
    else if (acc === "volver") renderCuriosidadModal();
    else if (acc === "ver" && c) { cerrarCuriosidad(); abrirDetalle(c.peli); }
    else if (acc === "compartir" && c) {
      const texto = c.peli.titulo + ": " + c.texto + (c.fuente ? " (Fuente: " + c.fuente + ")" : "");
      if (navigator.share) { try { await navigator.share({ text: texto }); } catch (err) {} }
      else if (navigator.clipboard) { try { await navigator.clipboard.writeText(texto); } catch (err) {} }
    }
  });
})();

