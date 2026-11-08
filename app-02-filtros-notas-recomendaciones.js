/* ---------- Mis filtros guardados ---------- */
function leerPresets() { return Array.isArray(marcas.__filtros) ? marcas.__filtros : []; }

// Los filtros viven dentro de marcas.json (en tu Drive), bajo la clave reservada "__filtros"
function guardarListaPresets(lista) {
  marcas.__filtros = lista;
  programarGuardado();
}

function renderPresets() {
  const lista = leerPresets();
  $("presetsSel").innerHTML = '<option value="">Filtros guardados…</option>' +
    lista.map((x, i) => '<option value="' + i + '">' + esc(x.nombre) + '</option>').join("");
}

function guardarPreset() {
  const nombre = (prompt("Nombre para estos filtros:", "") || "").trim();
  if (!nombre) return;
  const valores = { buscar: buscar.value, orden: $("orden").value };
  Object.entries(sel).forEach(([k, el]) => { valores[k] = el.value; });
  const lista = leerPresets().filter(x => x.nombre !== nombre);
  lista.push({ nombre, valores });
  guardarListaPresets(lista);
  renderPresets();
  setEstado("Filtros guardados como «" + nombre + "».");
}

function aplicarPreset() {
  const i = $("presetsSel").value;
  if (i === "") return;
  const p = leerPresets()[Number(i)];
  if (!p) return;
  buscar.value = p.valores.buscar || "";
  $("orden").value = p.valores.orden || $("orden").value;
  Object.entries(sel).forEach(([k, el]) => { el.value = p.valores[k] || ""; });
  pintar();
}

function borrarPreset() {
  const i = $("presetsSel").value;
  if (i === "") return;
  const lista = leerPresets();
  const x = lista[Number(i)];
  if (!x) return;
  if (!confirm("¿Borrar «" + x.nombre + "»?")) return;
  lista.splice(Number(i), 1);
  guardarListaPresets(lista);
  renderPresets();
}

/* ---------- ¿Qué sigue? (desde una película vista) ---------- */
function siguienteHtml(p) {
  if (!estadoDe(p).vista) return "";
  const libre = x => x !== p && !estadoDe(x).vista && !(marcas[x.titulo] || {}).descartada;
  let cands = [], razon = "";
  if (p.saga && p.saga !== "-") {
    cands = peliculas.filter(x => libre(x) && x.saga === p.saga);
    if (cands.length) razon = "De la saga " + p.saga;
  }
  if (!cands.length) {
    const dirs = directoresDe(p);
    if (dirs.length) {
      cands = peliculas.filter(x => libre(x) && directoresDe(x).some(d => dirs.includes(d)));
      if (cands.length) razon = "Del mismo director";
    }
  }
  cands = cands.slice(0, 3);
  if (!cands.length) return "";
  return '<div class="siguiente"><b>¿Qué sigue?</b> <span class="meta">' + esc(razon) + '</span>' +
    '<div class="insignias" style="margin-top:6px">' +
      cands.map(x => '<button class="pildora" data-siguiente="' + esc(x.titulo) + '">' + esc(x.titulo) + '</button>').join("") +
    '</div></div>';
}

/* ---------- Historial de cambios de una película ---------- */
function historialHtml(p) {
  const h = (marcas[p.titulo] || {}).historial || [];
  if (!h.length) return "";
  return '<details class="historial"><summary>Historial (' + h.length + ')</summary><ul>' +
    h.slice().reverse().map(e => '<li>' + esc(e.f) + ' · ' + esc(e.a) + '</li>').join("") +
    '</ul></details>';
}

/* ---------- Orden de notas ---------- */
function ordenNotasFn() {
  const v = $("ordenNotas") ? $("ordenNotas").value : "fecha";
  const m = t => marcas[t] || {};
  const porFecha = (a, b) => String(m(b.titulo).notaFecha || "").localeCompare(String(m(a.titulo).notaFecha || ""));
  if (v === "titulo") return (a, b) => String(a.titulo).localeCompare(String(b.titulo), "es");
  if (v === "calif") return (a, b) => ((m(b.titulo).estrellas || 0) - (m(a.titulo).estrellas || 0)) || porFecha(a, b);
  return porFecha;
}

/* ---------- Actividad: racha, insignias y compartir recomendación ---------- */
function sumarDiasISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(y, m - 1, d + n);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

function inicioSemanaISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(y, m - 1, d);
  const dow = (x.getDay() + 6) % 7;
  return sumarDiasISO(iso, -dow);
}

function vistasConFecha() {
  return peliculas.filter(p => {
    const m = marcas[p.titulo] || {};
    return m.vista && typeof m.vistaDesde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.vistaDesde);
  });
}

function rachaSemanas() {
  const semanas = new Set(vistasConFecha().map(p => inicioSemanaISO((marcas[p.titulo] || {}).vistaDesde)));
  let cursor = inicioSemanaISO(hoyLocalISO());
  if (!semanas.has(cursor)) cursor = sumarDiasISO(cursor, -7);
  let racha = 0;
  while (semanas.has(cursor)) {
    racha++;
    cursor = sumarDiasISO(cursor, -7);
  }
  return racha;
}

function maxVistasEnUnMes() {
  const porMes = {};
  vistasConFecha().forEach(p => {
    const k = (marcas[p.titulo] || {}).vistaDesde.slice(0, 7);
    porMes[k] = (porMes[k] || 0) + 1;
  });
  return Math.max(0, ...Object.values(porMes));
}

function insigniasDeActividad() {
  const vistas = vistasConFecha().length;
  const totalVistas = peliculas.filter(p => estadoDe(p).vista).length;
  const racha = rachaSemanas();
  const mesMax = maxVistasEnUnMes();
  return [
    { t: "Primera vista", ok: totalVistas >= 1 },
    { t: "10 vistas", ok: totalVistas >= 10 },
    { t: "25 vistas", ok: totalVistas >= 25 },
    { t: "50 vistas", ok: totalVistas >= 50 },
    { t: "Racha de 3 semanas", ok: racha >= 3 },
    { t: "5 vistas en un mes", ok: mesMax >= 5 }
  ];
}

/* ---------- Racha de calificaciones: películas calificadas esta semana (lunes a hoy) ---------- */
// Usa el historial. Cada película cuenta una vez, con su última acción de la semana.
// Si la última acción fue quitar la calificación, no cuenta.
function calificacionesDeSemana() {
  const hoy = hoyLocalISO();
  const inicio = inicioSemanaISO(hoy);
  const salida = [];
  peliculas.forEach(p => {
    const h = (marcas[p.titulo] || {}).historial || [];
    const evs = h.filter(e => e.f >= inicio && e.f <= hoy &&
      (String(e.a).indexOf("calificada") === 0 || e.a === "sin calificación"));
    if (!evs.length) return;
    const ultimo = evs[evs.length - 1];
    if (ultimo.a === "sin calificación") return;
    salida.push({ p, estrellas: Number(String(ultimo.a).replace("calificada ", "").replace("★", "")) });
  });
  return salida;
}

function textoCalificaciones() {
  const cal = calificacionesDeSemana();
  if (!cal.length) return "Aún no calificas películas esta semana.";
  const n = cal.length;
  let texto = "Calificaste " + n + (n === 1 ? " película" : " películas") + " esta semana";
  if (n >= 3) {
    const prom = cal.reduce((a, x) => a + x.estrellas, 0) / n;
    texto += " · promedio " + prom.toFixed(1) + "★";
  }
  return texto + ".";
}

function renderActividad() {
  const sec = $("actividad");
  const hayFiltrosAct = hayFiltros();
  if (!peliculas.length || pestana !== "vistas") {
    sec.style.display = "none";
    return;
  }
  const racha = rachaSemanas();
  const insignias = insigniasDeActividad();
  const lineaCal = textoCalificaciones();
  sec.innerHTML =
    '<div class="actividad-card">' +
      '<h3>Tu actividad</h3>' +
      '<p class="racha">Racha: <b>' + racha + '</b> ' + (racha === 1 ? 'semana' : 'semanas') + ' seguidas con alguna vista</p>' +
      '<p class="meta">' + esc(lineaCal) + '</p>' +
      '<div class="insignias">' +
        insigniasDeActividad().map(i =>
          '<span class="insignia' + (i.ok ? '' : ' bloq') + '">' + (i.ok ? '🏅 ' : '🔒 ') + esc(i.t) + '</span>'
        ).join("") +
      '</div>' +
    '</div>';
  sec.style.display = "block";
}

function textoRecomendacion(r) {
  const f = r.desglose.find(d => d.puntos > 0);
  const fuente = f && f.fuentes && f.fuentes[0];
  const razon = r.razon || (f ? f.etiqueta : "");
  return "Te recomiendo «" + r.p.titulo + "»" +
    (razon ? " — " + razon : "") +
    (fuente ? ", que te gustó en " + fuente.titulo : "") + ".";
}

async function compartirRecomendacion() {
  const r = calcularRecomendaciones()[0];
  if (!r) { setEstado("Aún no hay recomendación para compartir."); return; }
  const texto = textoRecomendacion(r);
  if (navigator.share) {
    try { await navigator.share({ text: texto }); } catch (e) {}
    return;
  }
  try {
    await navigator.clipboard.writeText(texto);
    setEstado("Recomendación copiada.");
  } catch (e) {
    setEstado(texto);
  }
}

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

/* ---------- Paleta de 3 colores del póster ---------- */
function distancia(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function paletaDePoster(url) {
  if (paletaCache.has(url)) return Promise.resolve(paletaCache.get(url));
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = 64;
        const h = Math.max(1, Math.round(w * img.height / img.width));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const datos = ctx.getImageData(0, 0, w, h).data;

        const cubos = {};
        let total = 0;
        for (let i = 0; i < datos.length; i += 4) {
          const r = datos[i], g = datos[i + 1], b = datos[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max < 15 || min > 240) continue;
          if (max - min < 10) continue;
          total++;
          const clave = (r >> 4) + "," + (g >> 4) + "," + (b >> 4);
          const cubo = cubos[clave] || (cubos[clave] = { n: 0, r: 0, g: 0, b: 0 });
          cubo.n++; cubo.r += r; cubo.g += g; cubo.b += b;
        }

        const grupos = Object.values(cubos)
          .filter(c => total && c.n / total >= 0.01)
          .map(c => ({ n: c.n, rgb: [Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)] }))
          .sort((a, b) => b.n - a.n);

        const elegidos = [];
        for (const g of grupos) {
          if (elegidos.length >= 3) break;
          if (elegidos.every(e => distancia(e, g.rgb) > 40)) elegidos.push(g.rgb);
        }

        if (elegidos.length === 0) elegidos.push([100, 100, 100], [60, 60, 60], [30, 30, 30]);

        paletaCache.set(url, elegidos);
        resolve(elegidos);
      } catch (e) {
        paletaCache.set(url, []);
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = "https://tmdb-proxy.240300696.workers.dev/?url=" + encodeURIComponent(String(url));
  });
}

function rgbAHex(rgb) {
  return "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("");
}

function hexARgb(hex) {
  const m = String(hex).trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function paletaDeTexto(texto) {
  return String(texto || "").split(",").map(hexARgb).filter(Boolean).slice(0, 3);
}

function fondoDesde(paleta) {
  const [a, b, c] = paleta.length >= 3 ? paleta : (paleta.length ? [paleta[0], paleta[0], paleta[0]] : [[0,0,0],[0,0,0],[0,0,0]]);
  return `radial-gradient(circle at 0% 0%, rgba(${a.join(",")}, 0.2) 0%, transparent 50%), ` +
         `radial-gradient(circle at 100% 0%, rgba(${b.join(",")}, 0.2) 0%, transparent 50%), ` +
         `radial-gradient(circle at 50% -20%, rgba(${c.join(",")}, 0.25) 0%, transparent 60%), ` +
         `var(--tarjeta)`;
}

const PALETA_RESPALDO = [[140, 150, 170], [100, 110, 130], [60, 66, 84]];

function aplicarFondoModal(caja, posterModal, paleta) {
  caja.style.background = fondoDesde(paleta);
  if (posterModal) {
    posterModal.style.boxShadow = `0 12px 32px rgba(${paleta[0].join(",")}, 0.5)`;
  }
}

function aplicarPaleta(p) {
  const caja = document.querySelector("#modal .ventana");
  if (!caja) return;

  const paletaHoja = paletaDeTexto(p[NOMBRE_PALETA]);
  if (paletaHoja.length) {
    aplicarFondoModal(caja, caja.querySelector(".portada"), paletaHoja);
    return;
  }

  aplicarFondoModal(caja, caja.querySelector(".portada"), PALETA_RESPALDO);
  if (!p.portada || datosLimitados()) return;

  paletaDePoster(p.portada).then(calc => {
    if (calc.length && detalleActual === p) {
      aplicarFondoModal(caja, caja.querySelector(".portada"), calc);
    }
  });
}

function letraColumna(n) {
  let s = "";
  n = n + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function sheetsFetch(path, metodo, cuerpo) {
  const r = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + HOJA_ID + "/" + path, {
    method: metodo || "GET",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  if (!r.ok) throw new Error("Sheets respondió " + r.status);
  return r.json();
}

/* ---------- Guardar paletas en la hoja (solo cuenta dueña) ---------- */
async function asegurarColumnaPaleta() {
  if (COL_PALETA !== -1) return;
  COL_PALETA = encabezados.length;
  encabezados.push(NOMBRE_PALETA);
  await sheetsFetch("values/" + letraColumna(COL_PALETA) + "1?valueInputOption=RAW", "PUT", {
    values: [[NOMBRE_PALETA]]
  });
}

async function guardarPaletasEnHoja() {
  const pendientes = peliculas.filter(p => !paletaDeTexto(p[NOMBRE_PALETA]).length && p.portada);
  if (!pendientes.length) {
    setEstado("Todas las portadas ya tienen paleta guardada.");
    return;
  }
  setEstado("Calculando paletas de " + pendientes.length + " películas...");
  const cambios = [];
  for (const p of pendientes) {
    const calc = await paletaDePoster(p.portada);
    if (calc.length) {
      p[NOMBRE_PALETA] = calc.map(rgbAHex).join(",");
      cambios.push(p);
    }
  }
  if (!cambios.length) {
    setEstado("No pude leer las portadas en este navegador.");
    return;
  }
  try {
    await asegurarColumnaPaleta();
    const data = cambios.map(p => ({
      range: letraColumna(COL_PALETA) + p._fila,
      values: [[p[NOMBRE_PALETA]]]
    }));
    await sheetsFetch("values:batchUpdate", "POST", { valueInputOption: "RAW", data: data });
    setEstado("Paletas guardadas en la hoja: " + cambios.length);
  } catch (e) {
    setEstado("No pude guardar en la hoja. Esta opción solo funciona con la cuenta dueña de la hoja.");
  }
}

/* ---------- Marcas personales en Drive ---------- */
function marcasLocales() {
  try { return JSON.parse(localStorage.getItem("catalogo_estado") || "{}"); } catch (e) { return {}; }
}

async function driveFetch(url, opts = {}) {
  const headers = Object.assign({ Authorization: "Bearer " + accessToken }, opts.headers || {});
  const r = await fetch(url, Object.assign({}, opts, { headers }));
  if (!r.ok) throw new Error("Drive respondió " + r.status);
  return r;
}

function estadoDe(p) {
  const o = marcas[p.titulo] || {};
  return {
    vista: !!o.vista,
    pendiente: !!o.pendiente,
    estrellas: o.estrellas || 0,
    conAlguien: !!o.conAlguien
  };
}

function cambiarEstado(titulo, cambios) {
  const previo = marcas[titulo] || {};
  const nuevo = Object.assign({}, previo, cambios);
  if (cambios.vista === true) {
    if (previo.conAlguien && previo.conQuien) nuevo.vistaCon = previo.conQuien;
    else delete nuevo.vistaCon;
  }
  if (cambios.vista === false) delete nuevo.vistaCon;
  if (cambios.pendiente === true && !previo.pendiente) {
    nuevo.pendienteDesde = new Date().toISOString().slice(0, 10);
  }
  if (cambios.pendiente === false || (cambios.pendiente === undefined && !nuevo.pendiente)) {
    delete nuevo.pendienteDesde;
  }
  if (cambios.vista === true || cambios.descartada === true) {
    delete nuevo.conAlguien;
    delete nuevo.conQuien;
    delete nuevo.conAlguienDesde;
    delete nuevo.conFecha;
  }
  if (cambios.descartada === true && !previo.descartada) {
    nuevo.descartadaDesde = new Date().toISOString().slice(0, 10);
    delete nuevo.revisionHecha;
  }
  if (cambios.descartada === false) {
    delete nuevo.descartadaDesde;
    delete nuevo.revisionHecha;
  }
  const eventos = [];
  if (cambios.pendiente === true && !previo.pendiente) eventos.push("pendiente");
  if (cambios.vista === true && !previo.vista) eventos.push("vista");
  if (cambios.descartada === true && !previo.descartada) eventos.push("descartada");
  if (cambios.estrellas !== undefined && cambios.estrellas !== (previo.estrellas || 0)) {
    eventos.push(cambios.estrellas ? "calificada " + cambios.estrellas + "★" : "sin calificación");
  }
  if (eventos.length) {
    const hoyH = hoyLocalISO();
    nuevo.historial = (previo.historial || []).concat(eventos.map(a => ({ f: hoyH, a }))).slice(-30);
  }
  marcas[titulo] = nuevo;
  programarGuardado();
}

function alternarConAlguien(titulo) {
  const previo = marcas[titulo] || {};
  if (previo.conAlguien) {
    const nuevo = Object.assign({}, previo);
    delete nuevo.conAlguien;
    delete nuevo.conQuien;
    delete nuevo.conAlguienDesde;
    delete nuevo.conFecha;
    marcas[titulo] = nuevo;
    programarGuardado();
    setEstado("Quitada de «Para ver con alguien».");
    return;
  }
  const quien = prompt("¿Con quién la quieres ver? (opcional, puedes dejarlo vacío)", "");
  if (quien === null) return;
  const fecha = prompt("¿Qué día la quieren ver? (opcional, formato AAAA-MM-DD, por ejemplo 2026-11-15)", "");
  if (fecha === null) return;

  const nuevo = Object.assign({}, previo, {
    conAlguien: true,
    conAlguienDesde: new Date().toISOString().slice(0, 10)
  });
  const q = String(quien).trim();
  if (q) nuevo.conQuien = q; else delete nuevo.conQuien;

  const f = String(fecha).trim();
  let aviso = "";
  if (f) {
    if (fechaValida(f)) nuevo.conFecha = f;
    else aviso = " La fecha no era válida, así que se guardó sin fecha.";
  } else {
    delete nuevo.conFecha;
  }

  marcas[titulo] = nuevo;
  programarGuardado();
  if (!nuevo.pendiente) {
    setEstado("Marcada para ver con alguien." + aviso + " Si la quieres ver pronto, también puedes ponerla en pendientes.");
  } else {
    setEstado("Marcada para ver con alguien." + aviso);
  }
}

function cambiarFechaConAlguien(titulo) {
  const previo = marcas[titulo] || {};
  if (!previo.conAlguien) {
    setEstado("Primero marca la película como «Para ver con alguien».");
    return;
  }
  const txt = prompt("Fecha para verla (AAAA-MM-DD). Déjalo vacío para quitar la fecha.", previo.conFecha || "");
  if (txt === null) return;
  const f = String(txt).trim();
  const nuevo = Object.assign({}, previo);
  if (!f) {
    delete nuevo.conFecha;
    setEstado("Fecha quitada.");
  } else if (!fechaValida(f)) {
    setEstado("Fecha no válida. Usa el formato AAAA-MM-DD, por ejemplo 2026-11-15.");
    return;
  } else {
    nuevo.conFecha = f;
    setEstado("Fecha guardada: " + f + ".");
  }
  marcas[titulo] = nuevo;
  programarGuardado();
}

function guardarNota(titulo, texto) {
  const t = String(texto || "").trim();
  const nuevo = Object.assign({}, marcas[titulo] || {});
  if (t) {
    nuevo.nota = t;
    nuevo.notaFecha = new Date().toISOString().slice(0, 10);
  } else {
    delete nuevo.nota;
    delete nuevo.notaFecha;
  }
  marcas[titulo] = nuevo;
  programarGuardado();
}

function borrarNota() {
  if (!detalleActual) return;
  const ok = confirm("¿Borrar tu nota de esta película? No se puede deshacer.");
  if (!ok) return;
  guardarNota(detalleActual.titulo, "");
  setEstado("Nota borrada");
  abrirDetalle(detalleActual);
}

/* ---------- Respaldo y restauración de marcas ---------- */
let ultimaSyncOk = null;
let syncReintentos = 0;   // reintentos seguidos por conflicto con Drive   // momento de la última sincronización correcta con Drive

function respaldarMarcas() {
  const datos = {
    formato: "catalogo-marcas",
    version: 1,
    fecha: new Date().toISOString(),
    marcas: marcas
  };
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "respaldo-catalogo-" + hoyLocalISO() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setEstado("Respaldo descargado: " + Object.keys(marcas).length + " películas con marcas.");
}

function validarRespaldo(texto) {
  let datos;
  try { datos = JSON.parse(texto); } catch (e) { return { error: "El archivo no es un JSON válido." }; }
  if (!datos || typeof datos !== "object") return { error: "El archivo no es un respaldo válido." };
  const esNuevo = datos.formato === "catalogo-marcas";
  const esViejo = datos.app === "catalogo-peliculas" || (!datos.formato && !datos.app);
  if (!esNuevo && !esViejo) return { error: "Este archivo no es un respaldo de marcas del catálogo." };
  if (datos.version !== undefined && datos.version !== 1) return { error: "Versión de respaldo no compatible." };
  if (!datos.marcas || typeof datos.marcas !== "object" || Array.isArray(datos.marcas)) return { error: "El respaldo no tiene marcas válidas." };
  return { marcas: datos.marcas };
}

async function restaurarMarcasDesdeArchivo(archivo) {
  let texto;
  try { texto = await archivo.text(); } catch (e) { setEstado("No pude leer el archivo."); return; }
  const res = validarRespaldo(texto);
  if (res.error) { setEstado(res.error); return; }

  const n = Object.keys(res.marcas).filter(k => !k.startsWith("__")).length;
  const ok = confirm("¿Reemplazar tus marcas actuales (" + Object.keys(marcas).filter(k => !k.startsWith("__")).length + ") por las de este respaldo (" + n + " películas)? Esto también reemplaza tus filtros guardados. Las marcas actuales se perderán.");
  if (!ok) { setEstado("Restauración cancelada."); return; }

  clearTimeout(guardadoTimer);
  marcas = envolverMarcas(res.marcas);
  syncPendiente = true; syncGuardarLocal();
  await guardarMarcasDrive();
  refrescarTodo();
  setEstado("Marcas restauradas: " + n + " películas.");
}

/* ---------- Etiquetas con # dentro de las notas ---------- */
const TAG_RE = /#[\p{L}\p{N}_-]+/gu;

function etiquetasDeNota(texto) {
  const encontradas = String(texto || "").match(TAG_RE) || [];
  const vistos = new Set();
  const salida = [];
  encontradas.forEach(t => {
    const limpia = t.slice(1).toLowerCase();
    const clave = norm(limpia);
    if (!clave || vistos.has(clave)) return;
    vistos.add(clave);
    salida.push(limpia);
  });
  return salida;
}

function coincideEtiqueta(p, etiqueta) {
  const m = marcas[p.titulo] || {};
  const buscada = norm(etiqueta);
  return etiquetasDeNota(m.nota).some(t => norm(t) === buscada);
}

function etiquetasFichaHtml(texto) {
  const tags = etiquetasDeNota(texto);
  if (!tags.length) {
    return '<span class="ayuda-etiquetas">Escribe #palabra en tu nota para crear etiquetas.</span>';
  }
  return tags.map(t => '<button class="etiqueta" data-tag="' + esc(t) + '">#' + esc(t) + '</button>').join("");
}

function renderBarraEtiquetas() {
  const bar = $("tagsNotas");
  const conteo = new Map();
  peliculas.forEach(p => {
    etiquetasDeNota((marcas[p.titulo] || {}).nota).forEach(t => {
      const clave = norm(t);
      const previo = conteo.get(clave) || { t, n: 0 };
      previo.n++;
      conteo.set(clave, previo);
    });
  });
  if (!conteo.size) {
    bar.style.display = "none";
    bar.innerHTML = "";
    return;
  }
  const actual = norm(buscar.value.trim());
  const orden = [...conteo.values()].sort((a, b) => b.n - a.n || a.t.localeCompare(b.t, "es"));
  bar.style.display = "flex";
  bar.innerHTML = orden.map(x =>
    '<button class="etiqueta' + (actual === "#" + norm(x.t) ? ' activa' : '') + '" data-tag="' + esc(x.t) + '">#' +
    esc(x.t) + ' (' + x.n + ')</button>'
  ).join("");
}

document.addEventListener("change", e => {
  if (e.target.id === "notaTexto" && detalleActual) {
    guardarNota(detalleActual.titulo, e.target.value);
    const zona = $("etiquetasFicha");
    if (zona) zona.innerHTML = etiquetasFichaHtml(e.target.value);
    setEstado("Nota guardada");
  }
});

document.addEventListener("input", e => {
  if (e.target.id === "preguntaTexto") $("preguntaContador").textContent = e.target.value.length + "/500";
});

/* ---------- Bloques plegables (se recuerda cuáles están cerrados) ---------- */
const PLEGADAS_POR_DEFECTO = ["sagas", "actores", "mapaGustos"];

function leerPliegues() {
  const guardado = leerJSON("pliegues", null);
  if (guardado) return guardado;
  const o = {};
  PLEGADAS_POR_DEFECTO.forEach(id => { o[id] = true; });
  return o;
}

function aplicarPliegues() {
  const o = leerPliegues();
  document.querySelectorAll("section[id]").forEach(s => s.classList.toggle("plegado", s.id !== "sagas" && !!o[s.id]));
}

document.addEventListener("click", e => {
  const h = e.target.closest ? e.target.closest("section[id] h3") : null;
  if (!h) return;
  const s = h.closest("section[id]");
  if (s.id === "sagas") return;
  s.classList.toggle("plegado");
  const o = leerPliegues();
  o[s.id] = s.classList.contains("plegado");
  guardarJSON("pliegues", o);
});

aplicarPliegues();

document.addEventListener("click", e => {
  if (e.target.closest && e.target.closest("#toggleMas")) alternarPanel("panelMas");
});

vistaLista = modoGuardado("vista_tarjetas", "amplia") === "compacta";
document.body.classList.toggle("lista", vistaLista);
$("vista").textContent = vistaLista ? "Vista amplia" : "Vista compacta";

// Toque largo en celular: muestra las acciones rápidas de la tarjeta (se cierran al tocar fuera)
let suprimirClic = false;

function abrirRapida(card) {
  document.querySelectorAll(".rapida-abierta").forEach(x => x.classList.remove("rapida-abierta"));
  card.classList.add("rapida-abierta");
  if (navigator.vibrate) navigator.vibrate(15);
}

document.addEventListener("click", e => {
  if (!e.target.closest || !e.target.closest(".rapida-abierta")) {
    document.querySelectorAll(".rapida-abierta").forEach(x => x.classList.remove("rapida-abierta"));
  }
});

/* ---------- Fechas ---------- */
function fechaValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function diasHasta(s) {
  const [y, m, d] = s.split("-").map(Number);
  const obj = Date.UTC(y, m - 1, d);
  const hoy = new Date();
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((obj - hoyUTC) / 86400000);
}

function lineaFechaConAlguien(p) {
  const m = marcas[p.titulo] || {};
  if (!m.conFecha) return '<div class="meta" style="margin-top:6px">📅 Sin fecha</div>';
  const d = diasHasta(m.conFecha);
  const cuando = d === 0 ? "hoy" : d === 1 ? "mañana" : d < 0 ? "pasó hace " + (-d) + " días" : "en " + d + " días";
  return '<div class="meta" style="margin-top:6px">📅 ' + esc(m.conFecha) + ' · ' + cuando + '</div>';
}

// Recordatorio: planes con alguien hoy, mañana o pasado mañana. "×" lo oculta por hoy.
function recordatoriosActivos() {
  const hoy = hoyLocalISO();
  const cerrados = leerJSON("recordatorio_cerrados", []);
  const salida = [];
  peliculas.forEach(p => {
    const m = marcas[p.titulo] || {};
    if (!m.conAlguien || !m.conFecha) return;
    const d = diasHasta(m.conFecha);
    if (d < 0 || d > 2) return;
    if (cerrados.includes(p.titulo + "|" + m.conFecha + "|" + hoy)) return;
    salida.push({ p, m, d });
  });
  return salida;
}

function actualizarAvisoFecha() {
  const aviso = $("avisoFecha");
  if (hayFiltros() || pestana !== "catalogo") {
    aviso.style.display = "none";
    return;
  }
  const items = recordatoriosActivos();
  if (!items.length) {
    aviso.style.display = "none";
    return;
  }
  const etiquetas = ["Hoy", "Mañana", "Pasado mañana"];
  const lineas = [0, 1, 2]
    .map(d => ({ d, nombres: items.filter(x => x.d === d).map(x => x.p.titulo + (x.m.conQuien ? " con " + x.m.conQuien : "")) }))
    .filter(g => g.nombres.length)
    .map(g => etiquetas[g.d] + ": " + g.nombres.join(" · "));
  $("avisoFechaTexto").innerHTML = lineas.map(esc).join("<br>");
  aviso.style.display = "block";
}

function cerrarRecordatorio() {
  const hoy = hoyLocalISO();
  const previos = leerJSON("recordatorio_cerrados", []).filter(k => k.endsWith("|" + hoy));
  const nuevos = recordatoriosActivos().map(({ p, m }) => p.titulo + "|" + m.conFecha + "|" + hoy);
  guardarJSON("recordatorio_cerrados", previos.concat(nuevos));
  actualizarAvisoFecha();
}

function diasPendiente(p) {
  const f = (marcas[p.titulo] || {}).pendienteDesde;
  if (!f) return null;
  const ms = Date.now() - new Date(f + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function diasConAlguien(p) {
  const f = (marcas[p.titulo] || {}).conAlguienDesde;
  if (!f) return null;
  const ms = Date.now() - new Date(f + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function diasDescartada(p) {
  const f = (marcas[p.titulo] || {}).descartadaDesde;
  if (!f) return null;
  const ms = Date.now() - new Date(f + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function controlesHtml(p) {
  const s = estadoDe(p);
  const k = esc(p.titulo);
  let estrellas = "";
  for (let n = 1; n <= 5; n++) {
    estrellas += '<button class="estrella' + (n <= s.estrellas ? ' on' : '') + '" data-accion="estrella" data-clave="' + k + '" data-n="' + n + '" aria-label="Calificar con ' + n + (n === 1 ? ' estrella' : ' estrellas') + '">★</button>';
  }
  const dias = s.pendiente ? diasPendiente(p) : null;
  let textoDias = "";
  if (dias !== null) {
    textoDias = '<span class="meta" style="margin:0">' + (dias === 0 ? 'desde hoy' : 'hace ' + dias + (dias === 1 ? ' día' : ' días')) + '</span>';
  } else if (s.pendiente) {
    textoDias = '<span class="meta" style="margin:0">fecha desconocida</span>';
  }
  const descartada = !!(marcas[p.titulo] || {}).descartada;
  const botonRestaurar = descartada
    ? ' <button class="chipc" data-accion="restaurar" data-clave="' + k + '">↩ Restaurar</button>'
    : '';
  const quien = (marcas[p.titulo] || {}).conQuien;
  const etiquetaAlguien = s.conAlguien
    ? '👥 Con alguien' + (quien ? ' · ' + esc(quien) : '')
    : '👥 Con alguien';
  const fechaPlan = (marcas[p.titulo] || {}).conFecha;
  const botonFecha = s.conAlguien
    ? '<button class="chipc' + (fechaPlan ? ' activo' : '') + '" data-accion="conFecha" data-clave="' + k + '">📅 ' + (fechaPlan ? esc(fechaPlan) : 'Fecha') + '</button>'
    : '';
  return '<div class="controles">' +
    '<button class="chipc' + (s.vista ? ' activo' : '') + '" data-accion="vista" data-clave="' + k + '">' + (s.vista ? '✓ Vista' : 'Marcar vista') + '</button>' +
    '<button class="chipc' + (s.pendiente ? ' activo' : '') + '" data-accion="pendiente" data-clave="' + k + '">' + (s.pendiente ? '⏳ En pendientes' : 'Pendiente') + '</button>' +
    '<button class="chipc' + (s.conAlguien ? ' activo' : '') + '" data-accion="conAlguien" data-clave="' + k + '">' + etiquetaAlguien + '</button>' +
    botonFecha +
    textoDias +
    botonRestaurar +
    '<span class="estrellas">' + estrellas + '</span></div>';
}

function contarEstados() {
  let vistas = 0, pendientes = 0;
  peliculas.forEach(p => {
    const s = estadoDe(p);
    if (s.vista) vistas++;
    if (s.pendiente) pendientes++;
  });
  return { vistas, pendientes };
}

/* ---------- Estadísticas ---------- */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function coloresGrafica() {
  const oscuro = document.body.classList.contains("oscuro");
  return {
    texto: oscuro ? "#f5f5f7" : "#1d1d1f",
    rejilla: oscuro ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)",
    paleta: ["#0a84ff", "#30d158", "#ffd60a", "#ff9f0a", "#ff453a", "#bf5af2", "#64d2ff", "#ac8e68", "#ff375f", "#8e8e93"]
  };
}

function vistasPorMes() {
  const anio = new Date().getFullYear();
  const conteo = new Array(12).fill(0);
  Object.entries(marcas).forEach(([titulo, m]) => {
    if (!m || !m.vista || !m.vistaDesde) return;
    const f = new Date(m.vistaDesde + "T00:00:00");
    if (f.getFullYear() === anio) conteo[f.getMonth()]++;
  });
  return conteo;
}

function destruirGraficas() {
  chartsStats.forEach(c => c.destroy());
  chartsStats = [];
}

function renderGraficas() {
  if (typeof Chart === "undefined") {
    $("graficas").innerHTML = '<p class="stats-vacio">No pude cargar las gráficas. Revisa tu conexión.</p>';
    return;
  }
  destruirGraficas();
  const c = coloresGrafica();
  Chart.defaults.color = c.texto;
  Chart.defaults.borderColor = c.rejilla;

  const generos = {};
  peliculas.forEach(p => {
    if (estadoDe(p).vista) generosDe(p).forEach(g => generos[g] = (generos[g] || 0) + 1);
  });
  const topG = Object.entries(generos).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const estrellas = [0, 0, 0, 0, 0];
  peliculas.forEach(p => {
    const n = estadoDe(p).estrellas;
    if (n >= 1 && n <= 5) estrellas[n - 1]++;
  });

  const vMes = vistasPorMes();

  $("graficas").innerHTML =
    '<div class="grafica-caja"><h3>Vistas por mes (año actual)</h3><canvas id="gMes"></canvas></div>' +
    '<div class="graficas-dos">' +
      '<div class="grafica-caja"><h3>Géneros que más has visto</h3>' +
        (topG.length ? '<canvas id="gGen"></canvas>' : '<p class="stats-vacio">Marca películas como vistas para ver tus géneros.</p>') +
      '</div>' +
      '<div class="grafica-caja"><h3>Tus calificaciones</h3>' +
        (estrellas.some(x => x) ? '<canvas id="gEst"></canvas>' : '<p class="stats-vacio">Aún no calificas películas.</p>') +
      '</div>' +
    '</div>';

  chartsStats.push(new Chart($("gMes"), {
    type: "bar",
    data: { labels: MESES, datasets: [{ label: "Vistas", data: vMes, backgroundColor: c.paleta[0], borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  }));

  if (topG.length) {
    chartsStats.push(new Chart($("gGen"), {
      type: "doughnut",
      data: { labels: topG.map(x => x[0]), datasets: [{ data: topG.map(x => x[1]), backgroundColor: c.paleta }] },
      options: { plugins: { legend: { position: "bottom" } } }
    }));
  }

  if (estrellas.some(x => x)) {
    chartsStats.push(new Chart($("gEst"), {
      type: "bar",
      data: {
        labels: ["1 ★", "2 ★", "3 ★", "4 ★", "5 ★"],
        datasets: [{ label: "Películas", data: estrellas, backgroundColor: "#ffb800", borderRadius: 6 }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    }));
  }
}

function renderEstadisticas() {
  let vistas = 0, pendientes = 0, sinVer = 0, favoritas = 0;
  let minutosVistos = 0, sumaEst = 0, conEst = 0;

  peliculas.forEach(p => {
    const s = estadoDe(p);
    if (s.vista) {
      vistas++;
      minutosVistos += minutos(p);
    } else {
      sinVer++;
    }
    if (s.pendiente) pendientes++;
    if (s.estrellas >= 4) favoritas++;
    if (s.estrellas) {
      sumaEst += s.estrellas;
      conEst++;
    }
  });

  const total = peliculas.length;
  const promedio = conEst ? (sumaEst / conEst).toFixed(1) : "—";
  const horas = Math.floor(minutosVistos / 60);
  const mins = minutosVistos % 60;

  $("statsBody").innerHTML =
    '<div class="stats-resumen">' +
      '<div class="stat"><b>' + total + '</b><span>títulos</span></div>' +
      '<div class="stat"><b>' + vistas + '</b><span>vistas</span></div>' +
      '<div class="stat"><b>' + pendientes + '</b><span>pendientes</span></div>' +
      '<div class="stat"><b>' + sinVer + '</b><span>sin ver</span></div>' +
      '<div class="stat"><b>' + favoritas + '</b><span>favoritas</span></div>' +
      '<div class="stat"><b>' + promedio + '</b><span>promedio ★</span></div>' +
    '</div>' +
    '<p class="meta">Tiempo visto: <b>' + horas + ' h ' + mins + ' min</b> · ' + conEst + ' películas calificadas</p>' +
    '<div id="graficas" class="graficas"></div>';
  renderGraficas();
}

function abrirEstadisticas() {
  renderEstadisticas();
  $("statsModal").classList.add("abierto");
}

function cerrarEstadisticas() {
  $("statsModal").classList.remove("abierto");
  destruirGraficas();
}

