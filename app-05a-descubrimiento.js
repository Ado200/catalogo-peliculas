/* ===== Fase 0 · Módulo «descubrimiento»: etapas de selección, ánimo, mapa, rachas, buzón, modo viaje y estrenos ===== */
/* Migrado de app-05 sin cambiar el comportamiento. Mantiene los mismos nombres globales.
   Se registra en el núcleo (app-00-nucleo.js). Aún sin interruptor en Ajustes. */
/* ---------- Etapa 1: selección inteligente ---------- */
const TEMAS_NOCHE = [
  { dia: "domingo", tema: "Ciencia ficción", genero: "ciencia ficci" },
  { dia: "lunes", tema: "Animación", genero: "animaci" },
  { dia: "martes", tema: "Comedia", genero: "comedia" },
  { dia: "miércoles", tema: "Drama", genero: "drama" },
  { dia: "jueves", tema: "Aventura", genero: "aventura" },
  { dia: "viernes", tema: "Terror o suspenso", genero: "terror|suspenso|thriller" },
  { dia: "sábado", tema: "Romance", genero: "romance" }
];

function pendientesNoVistas() {
  return peliculas.filter(p => (marcas[p.titulo] || {}).pendiente && !(marcas[p.titulo] || {}).vista);
}

function generoCoincide(p, patron) {
  return new RegExp(patron, "i").test(String(p.genero || ""));
}

function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

/* 1) Noche temática según el día */
function nocheTematica() {
  const hoy = TEMAS_NOCHE[new Date().getDay()];
  const pool = pendientesNoVistas();
  if (!pool.length) {
    avisar("No tienes pendientes sin ver. Agrega algunas para elegir.");
    return;
  }
  const del_tema = pool.filter(p => generoCoincide(p, hoy.genero));
  if (!del_tema.length) {
    avisar("Hoy es noche de " + hoy.tema + ", pero no tienes pendientes de ese género. Te muestro otra.");
    abrirDetalle(elegirAlAzar(pool));
    return;
  }
  avisar("Noche de " + hoy.tema + " (" + hoy.dia + ").");
  abrirDetalle(elegirAlAzar(del_tema));
}

/* 3) Maratón: arma hasta 3 películas que quepan en el tiempo indicado */
function abrirMaraton() {
  abrirVentanaSimple("maraton", "Maratón",
    '<p class="meta">¿Cuántos minutos tienes para ver películas?</p>' +
    '<div class="fila-form"><input id="maraMin" type="number" min="30" step="15" value="300" inputmode="numeric">' +
    '<button type="button" class="pildora destacado" id="maraGo">Armar</button></div>' +
    '<div id="maraRes"></div>');
  document.getElementById("maraGo").addEventListener("click", () => armarMaraton(Number(document.getElementById("maraMin").value)));
  armarMaraton(300);
}

function armarMaraton(minutosPedidos) {
  const res = document.getElementById("maraRes");
  if (!minutosPedidos || minutosPedidos <= 0) { res.innerHTML = '<p class="meta">Escribe un número de minutos.</p>'; return; }
  const pool = pendientesNoVistas().map(p => ({ p, m: minutos(p) })).filter(x => x.m > 0);
  if (!pool.length) {
    res.innerHTML = '<p class="meta">Ninguna pendiente tiene duración escrita. Revisa la columna «duracion» de la hoja, por ejemplo «1 h 45 min».</p>';
    return;
  }
  const { elegidas, total } = armarLista({ pool, minutosMax: minutosPedidos, maximo: 3, separacion: 0 });
  if (!elegidas.length) {
    res.innerHTML = '<p class="meta">Ninguna pendiente cabe en ' + minutosPedidos + ' minutos. Prueba con más tiempo.</p>';
    return;
  }
  const h = Math.floor(total / 60), mm = total % 60;
  res.innerHTML = '<p class="meta">Total: ' + h + ' h ' + mm + ' min · ' + elegidas.length + ' películas</p><ol>' +
    elegidas.map(x => '<li><b>' + esc(x.p.titulo) + '</b> · ' + x.m + ' min</li>').join("") + '</ol>';
}

/* 8) Modo sorpresa con reglas */
function abrirSorpresa() {
  const generos = [...new Set(peliculas.flatMap(p => String(p.genero || "").split(/[,\/]/).map(x => x.trim()).filter(Boolean)))].sort();
  abrirVentanaSimple("sorpresa", "Sorpresa con reglas",
    '<label class="campo">Duración máxima<select id="sorpDur"><option value="0">Cualquiera</option><option value="90">Hasta 90 min</option><option value="120">Hasta 2 h</option></select></label>' +
    '<label class="campo">Género<select id="sorpGen"><option value="">Cualquiera</option>' +
    generos.map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join("") + '</select></label>' +
    '<label class="campo">Actor (opcional)<input id="sorpAct" type="text" placeholder="Ej. Scarlett Johansson"></label>' +
    '<p id="sorpRes" class="meta"></p>' +
    '<button type="button" class="pildora destacado" id="sorpOtra">🎲 Sorpréndeme</button>');
  const elegir = () => {
    const dur = Number($("sorpDur") ? document.getElementById("sorpDur").value : 0);
    const gen = document.getElementById("sorpGen").value;
    const act = document.getElementById("sorpAct").value.trim().toLowerCase();
    const pool = pendientesNoVistas().filter(p =>
      (!dur || (minutos(p) > 0 && minutos(p) <= dur)) &&
      (!gen || String(p.genero || "").toLowerCase().includes(gen.toLowerCase())) &&
      (!act || String(p.reparto || "").toLowerCase().includes(act)));
    const res = document.getElementById("sorpRes");
    if (!pool.length) {
      const soloGenero = pendientesNoVistas().filter(p => !gen || String(p.genero || "").toLowerCase().includes(gen.toLowerCase())).length;
      res.textContent = soloGenero
        ? "Hay " + soloGenero + " pendiente(s) de ese género, pero ninguna cumple también la duración o el actor. Relaja una regla."
        : "No tienes pendientes de ese género. Elige «Cualquiera» o agrega películas.";
      return;
    }
    const p = elegirAlAzar(pool);
    res.innerHTML = "Te toca: <b>" + esc(p.titulo) + "</b>";
    document.querySelector("#sorpresa [data-cerrar]").click();
    abrirDetalle(p);
  };
  document.getElementById("sorpOtra").addEventListener("click", elegir);
}

/* ---------- Etapa 2a: votación en pareja (en un mismo dispositivo) ---------- */
function leerVotos() {
  try { return JSON.parse(localStorage.getItem("votos_pareja") || "{}"); } catch (e) { return {}; }
}
function guardarVotos(v) {
  try { localStorage.setItem("votos_pareja", JSON.stringify(v)); } catch (e) {}
}

function abrirVotacionPareja() {
  const votos = leerVotos();
  let quien = "1";
  const candidatas = () => pendientesNoVistas().filter(p => !(votos[p.titulo] && votos[p.titulo][quien]));

  function pintarVotacion() {
    const cola = candidatas();
    const caja = document.querySelector("#votacionPareja .ventana-larga");
    const coincidencias = pendientesNoVistas().filter(p => votos[p.titulo] && votos[p.titulo]["1"] === 1 && votos[p.titulo]["2"] === 1);
    let html = '<p class="meta">Votando: <b>Persona ' + quien + '</b> · pendientes por votar: ' + cola.length + '</p>';
    if (cola.length) {
      const p = cola[0];
      html += '<div class="voto-tarjeta"><b>' + esc(p.titulo) + '</b><div class="meta">' +
        esc(p.genero || "") + (p.duracion ? " · " + esc(p.duracion) : "") + '</div>' +
        '<div class="voto-botones"><button type="button" class="pildora" data-voto="-1">👎 No</button>' +
        '<button type="button" class="pildora destacado" data-voto="1">👍 Sí</button></div></div>';
    } else {
      html += '<p class="meta">Ya votó esta persona por todas.</p>';
    }
    html += '<button type="button" class="pildora" id="cambiarPersona">Cambiar a Persona ' + (quien === "1" ? "2" : "1") + '</button>';
    html += '<h4>Coinciden los dos (' + coincidencias.length + ')</h4><ul>' +
      coincidencias.map(p => '<li>' + esc(p.titulo) + '</li>').join("") + '</ul>';
    caja.querySelector(".voto-cuerpo").innerHTML = html;
    caja.querySelectorAll("[data-voto]").forEach(b => b.addEventListener("click", () => {
      const t = cola[0].titulo;
      votos[t] = Object.assign({}, votos[t] || {}, { [quien]: Number(b.dataset.voto) });
      guardarVotos(votos);
      pintarVotacion();
    }));
    document.getElementById("cambiarPersona").addEventListener("click", () => {
      quien = quien === "1" ? "2" : "1";
      pintarVotacion();
    });
  }

  abrirVentanaSimple("votacionPareja", "Votación en pareja",
    '<div class="voto-cuerpo"></div>' +
    '<p class="meta">Se guarda en este navegador. Es para votar en un mismo dispositivo, turnándose.</p>' +
    '<button type="button" class="pildora" id="reiniciarVotos">Empezar de cero</button>');
  document.getElementById("reiniciarVotos").addEventListener("click", () => {
    guardarVotos({});
    Object.keys(votos).forEach(k => delete votos[k]);
    pintarVotacion();
  });
  pintarVotacion();
}

/* ---------- Etapa 2b: filtro por ánimo (ordena el catálogo) ---------- */
const ANIMOS = [
  { id: "tranquilo", texto: "😌 Tranquilo", generos: "animaci|documental|romance" },
  { id: "emocionado", texto: "🔥 Emocionado", generos: "acci|aventura|ciencia ficci|thriller" },
  { id: "reir", texto: "😂 Quiero reír", generos: "comedia" },
  { id: "melancolico", texto: "🌧 Melancólico", generos: "drama" },
  { id: "pensar", texto: "🧠 Para pensar", generos: "misterio|documental|historia|ciencia ficci" }
];

function animoActual() {
  try { return localStorage.getItem("animo") || ""; } catch (e) { return ""; }
}

function abrirAnimo() {
  const actual = animoActual();
  abrirVentanaSimple("animoVentana", "¿Cómo te sientes hoy?",
    ANIMOS.map(a => '<button type="button" class="pildora animo-op' + (a.id === actual ? ' destacado' : '') +
      '" data-animo="' + a.id + '">' + esc(a.texto) + '</button>').join(" ") +
    '<p class="meta">El catálogo pondrá primero las películas de ese ánimo.</p>' +
    '<button type="button" class="pildora" data-animo="">Quitar ánimo</button>');
  document.querySelectorAll("#animoVentana [data-animo]").forEach(b => b.addEventListener("click", () => {
    try { localStorage.setItem("animo", b.dataset.animo); } catch (e) {}
    document.querySelector("#animoVentana [data-cerrar]").click();
    pintar();
    const a = ANIMOS.find(x => x.id === b.dataset.animo);
    avisar(a ? "Catálogo en modo " + a.texto + "." : "Ánimo quitado.");
  }));
}

function ordenarPorAnimo(lista) {
  const a = ANIMOS.find(x => x.id === animoActual());
  if (!a) return lista;
  const re = new RegExp(a.generos, "i");
  return lista.slice().sort((x, y) => (re.test(String(y.genero || "")) ? 1 : 0) - (re.test(String(x.genero || "")) ? 1 : 0));
}

/* ---------- Etapa 2c: el ánimo cambia el color de las tarjetas ---------- */
const ANIMO_COLOR = { tranquilo: "#30b0c7", emocionado: "#ff6b35", reir: "#ffcc00", melancolico: "#5e5ce6", pensar: "#34c759" };

function marcarAnimo() {
  const lis = document.getElementById("lista");
  if (!lis) return;
  const a = ANIMOS.find(x => x.id === animoActual());
  lis.classList.toggle("animo-activo", !!a);
  if (!a) return;
  lis.style.setProperty("--animo", ANIMO_COLOR[a.id]);
  const re = new RegExp(a.generos, "i");
  lis.querySelectorAll("[data-i]").forEach(el => {
    const p = visibles[Number(el.dataset.i)];
    el.classList.toggle("animo-match", !!p && re.test(String(p.genero || "")));
  });
}

/* ---------- Etapa 3a: mapa de viaje cinematográfico ---------- */
const PAISES_MAPA = ["Estados Unidos", "México", "Francia", "Italia", "España", "Japón", "Corea del Sur", "India",
  "Brasil", "Reino Unido", "Alemania", "China", "Argentina", "Canadá", "Irán", "Australia", "Rusia", "Suecia"];

const PAIS_ALIAS = {
  "United States of America": "Estados Unidos", "United States": "Estados Unidos", "USA": "Estados Unidos", "EE. UU.": "Estados Unidos",
  "Mexico": "México", "Spain": "España", "France": "Francia", "Italy": "Italia", "Japan": "Japón",
  "South Korea": "Corea del Sur", "Korea": "Corea del Sur", "Germany": "Alemania", "United Kingdom": "Reino Unido",
  "Brazil": "Brasil", "Canada": "Canadá", "Iran": "Irán", "Russia": "Rusia", "Sweden": "Suecia"
};
function normPais(c) {
  const x = String(c || "").trim();
  return PAIS_ALIAS[x] || x;
}
function paisesDe(p) {
  return String(p.pais || "").split(/[,\/]/).map(x => normPais(x)).filter(Boolean);
}

function abrirMapaViaje() {
  const mapa = {};
  peliculas.forEach(p => {
    const o = marcas[p.titulo] || {};
    paisesDe(p).forEach(c => {
      mapa[c] = mapa[c] || { total: 0, vistas: 0, films: [] };
      mapa[c].total++;
      if (o.vista) mapa[c].vistas++;
      mapa[c].films.push(p);
    });
  });
  const paises = Object.keys(mapa).sort((x, y) => x.localeCompare(y, "es"));
  const visitados = paises.filter(c => mapa[c].vistas > 0).length;
  const sugerido = paises.filter(c => mapa[c].vistas === 0).sort((x, y) => mapa[y].total - mapa[x].total)[0];
  abrirVentanaSimple("mapaViaje", "Mapa de viaje",
    '<p class="meta">Has visto películas de ' + visitados + ' de ' + paises.length + ' países de tu catálogo. Toca un país para ver sus películas.</p>' +
    '<div class="paises-grid">' + paises.map(c =>
      '<button type="button" class="pais-chip' + (mapa[c].vistas ? ' visto' : '') + '" data-pais="' + esc(c) + '">' +
      esc(c) + ' · ' + mapa[c].total + '</button>').join("") + '</div>' +
    (sugerido ? '<p class="pais-sugerencia">Te sugiero <b>' + esc(sugerido) + '</b>, donde aún no has visto ninguna.</p>' : '') +
    '<div id="paisDetalle"></div>');
  const ventana = document.getElementById("mapaViaje");
  ventana.addEventListener("click", e => {
    const pais = e.target.closest("[data-pais]");
    const peli = e.target.closest("[data-titulo]");
    if (peli) {
      const p = peliculas.find(x => x.titulo === peli.dataset.titulo);
      ventana.remove();
      if (p) abrirDetalle(p);
      return;
    }
    if (!pais) return;
    const c = pais.dataset.pais;
    const films = mapa[c].films;
    document.getElementById("paisDetalle").innerHTML = '<h4>' + esc(c) + ' (' + films.length + ')</h4>' +
      films.map(p => {
        const o = marcas[p.titulo] || {};
        const estado = o.vista ? "✓ vista" : o.pendiente ? "⏳ pendiente" : "sin ver";
        return '<button type="button" class="explorar-item" data-titulo="' + esc(p.titulo) + '"><b>' + esc(p.titulo) +
          '</b><span class="meta">' + esc(p["año"] || "") + ' · ' + estado + '</span></button>';
      }).join("");
  });
}

/* ---------- Etapa 3b: rachas de gustos ---------- */
function detectarRachas() {
  const avisos = [];
  const vistas = peliculas.map(p => ({ p, o: marcas[p.titulo] || {} }))
    .filter(x => x.o.vista && x.o.estrellas)
    .map(x => {
      const ultima = (x.o.historial || []).filter(h => h.a === "vista").slice(-1)[0];
      return { p: x.p, o: x.o, f: ultima ? String(ultima.f) : "" };
    })
    .sort((a, b) => a.f.localeCompare(b.f));

  const dir = {};
  vistas.forEach(v => { if (v.o.estrellas >= 4 && v.p.director) dir[v.p.director] = (dir[v.p.director] || 0) + 1; });
  Object.entries(dir).filter(x => x[1] >= 3).forEach(([d, n]) =>
    avisos.push("Te gusta mucho " + d + ": " + n + " películas suyas con 4 o 5★."));

  if (vistas.length >= 16) {
    const topGenero = arr => {
      const c = {};
      arr.forEach(v => String(v.p.genero || "").split(/[,\/]/).map(x => x.trim()).filter(Boolean)
        .forEach(g => c[g] = (c[g] || 0) + 1));
      const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
      return e ? e[0] : "";
    };
    const antes = topGenero(vistas.slice(-16, -8)), ahora = topGenero(vistas.slice(-8));
    if (antes && ahora && antes !== ahora)
      avisos.push("Últimamente te inclinas por " + ahora + " (antes era " + antes + ").");
  }
  return avisos;
}

/* ---------- Etapa 3c: buzón de cartas a tu yo futuro ---------- */
function fechaMasMeses(iso, meses) {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + meses);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function cartasListas() {
  const hoy = hoyLocalISO();
  return peliculas.filter(p => {
    const c = (marcas[p.titulo] || {}).carta;
    return c && !c.leida && fechaMasMeses(c.fecha, c.meses) <= hoy;
  });
}

function abrirBuzon() {
  const listas = cartasListas();
  const vistas = peliculas.filter(p => (marcas[p.titulo] || {}).vista && !(marcas[p.titulo] || {}).carta);
  const cartaHtml = p => {
    const c = marcas[p.titulo].carta;
    return '<div class="carta-caja"><b>' + esc(p.titulo) + '</b> <span class="meta">escrita el ' + esc(c.fecha) + '</span>' +
      '<p>' + esc(c.texto) + '</p></div>';
  };
  const cuerpo =
    (listas.length
      ? '<h4>Cartas que ya puedes leer (' + listas.length + ')</h4>' + listas.map(cartaHtml).join("") +
        '<button type="button" class="pildora" id="marcarLeidas">Marcar como leídas</button>'
      : '<p class="meta">No hay cartas listas para leer.</p>') +
    '<h4>Escribir una carta</h4>' +
    (vistas.length
      ? '<label class="campo">Película vista<select id="cartaPeli">' +
        vistas.map(p => '<option>' + esc(p.titulo) + '</option>').join("") + '</select></label>' +
        '<label class="campo">Tu mensaje<textarea id="cartaTexto" rows="4" placeholder="¿Qué sentiste hoy? ¿Qué quieres recordar?"></textarea></label>' +
        '<label class="campo">Leer en<select id="cartaMeses"><option value="6">6 meses</option><option value="12">1 año</option></select></label>' +
        '<button type="button" class="pildora destacado" id="guardarCarta">Guardar carta</button>'
      : '<p class="meta">Marca una película como vista para escribirle una carta.</p>');
  abrirVentanaSimple("buzon", "Buzón de cartas", cuerpo);

  const marcarLeidas = document.getElementById("marcarLeidas");
  if (marcarLeidas) marcarLeidas.addEventListener("click", () => {
    listas.forEach(p => { marcas[p.titulo] = Object.assign({}, marcas[p.titulo], { carta: Object.assign({}, marcas[p.titulo].carta, { leida: true }) }); });
    programarGuardado();
    document.querySelector("#buzon [data-cerrar]").click();
    pintar();
    avisar("Cartas marcadas como leídas.");
  });

  const guardar = document.getElementById("guardarCarta");
  if (guardar) guardar.addEventListener("click", () => {
    const titulo = document.getElementById("cartaPeli").value;
    const texto = document.getElementById("cartaTexto").value.trim();
    if (!texto) { avisar("Escribe algo en la carta antes de guardarla."); return; }
    marcas[titulo] = Object.assign({}, marcas[titulo], {
      carta: { texto, fecha: hoyLocalISO(), meses: Number(document.getElementById("cartaMeses").value), leida: false }
    });
    programarGuardado();
    document.querySelector("#buzon [data-cerrar]").click();
    avisar("Carta guardada. Se abrirá dentro de " + document.getElementById("cartaMeses").selectedOptions[0].text + ".");
  });
}

/* ---------- Extras de Actividad: rachas y cartas listas ---------- */
function renderExtrasActividad() {
  const sec = $("retoMes");
  const avisos = detectarRachas();
  let html = avisos.map(a => '<p class="meta racha">· ' + esc(a) + '</p>').join("");
  const listas = cartasListas().length;
  if (listas) html += '<button type="button" class="pildora destacado" id="abrirBuzonBtn">📬 Tienes ' + listas + ' carta(s) lista(s)</button>';
  html += renderAlertasEstreno();
  sec.insertAdjacentHTML("beforeend", html);
  const b = document.getElementById("abrirBuzonBtn");
  if (b) b.addEventListener("click", abrirBuzon);
}

/* ---------- Etapa 4a: modo viaje (lista de pendientes guardada para usar sin internet) ---------- */
function prepararViaje() {
  const lista = pendientesNoVistas().map(p => ({
    titulo: p.titulo, genero: p.genero || "", duracion: p.duracion || "",
    año: p["año"] || "", sinopsis: String(p.sinopsis || "").slice(0, 300)
  }));
  if (!lista.length) {
    avisar("No tienes pendientes para llevar. Marca algunas como «Pendiente» primero.");
    return;
  }
  try {
    localStorage.setItem("paquete_viaje", JSON.stringify({ fecha: hoyLocalISO(), lista: lista }));
  } catch (e) {
    avisar("No pude guardar la lista de viaje en este navegador.");
    return;
  }
  avisar("Lista de viaje guardada: " + lista.length + " películas. Funciona sin internet.");
  abrirModoViaje();
}

function abrirModoViaje() {
  let paq = null;
  try { paq = JSON.parse(localStorage.getItem("paquete_viaje") || "null"); } catch (e) {}
  if (!paq || !paq.lista) {
    abrirVentanaSimple("modoViaje", "Modo viaje",
      '<p class="meta">Aún no tienes una lista de viaje. Usa «Preparar viaje» cuando tengas internet.</p>');
    return;
  }
  const pendientes = paq.lista.filter(x => !((marcas[x.titulo] || {}).vista));
  const cuerpo = '<p class="meta">Preparada el ' + esc(paq.fecha) + ' · ' + pendientes.length + ' por ver</p>' +
    (pendientes.length
      ? pendientes.map(x => '<div class="viaje-fila"><div><b>' + esc(x.titulo) + '</b>' +
          '<div class="meta">' + esc([x.genero, x.duracion, x["año"]].filter(Boolean).join(" · ")) + '</div></div>' +
          '<button type="button" class="pildora" data-vista="' + esc(x.titulo) + '">✓ Vista</button></div>').join("")
      : '<p class="meta">Ya viste todo lo de tu lista. ¡Buen viaje!</p>');
  abrirVentanaSimple("modoViaje", "Modo viaje", cuerpo);
  document.querySelectorAll("#modoViaje [data-vista]").forEach(b => b.addEventListener("click", () => {
    cambiarEstado(b.dataset.vista, { vista: true });
    avisar("Marcada como vista. Se sincronizará cuando vuelva la conexión.");
    document.querySelector("#modoViaje [data-cerrar]").click();
    abrirModoViaje();
  }));
}

/* ---------- Etapa 4b: alertas de estreno (columna «estreno» con fecha AAAA-MM-DD en la hoja) ---------- */
function sumarDiasEt(iso, dias) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function alertasDeEstreno() {
  const hoy = hoyLocalISO();
  const limite = sumarDiasEt(hoy, 30);
  const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ""));
  const todas = pendientesNoVistas().filter(p => fechaOk(p.estreno));
  return {
    hoy: todas.filter(p => p.estreno === hoy || p.estreno < hoy).sort((a, b) => a.estreno.localeCompare(b.estreno)),
    proximas: todas.filter(p => p.estreno > hoy && p.estreno <= limite).sort((a, b) => a.estreno.localeCompare(b.estreno))
  };
}

function renderAlertasEstreno() {
  const { hoy, proximas } = alertasDeEstreno();
  if (!hoy.length && !proximas.length) return "";
  return '<div class="alertas-estreno">' +
    hoy.map(p => '<p>🎬 Ya se estrenó y tienes pendiente: <b>' + esc(p.titulo) + '</b> (' + esc(p.estreno) + ')</p>').join("") +
    proximas.map(p => '<p>📅 Se estrena el ' + esc(p.estreno) + ': <b>' + esc(p.titulo) + '</b></p>').join("") +
    '</div>';
}

if (window.Nucleo) {
  Nucleo.registrar("descubrimiento", { version: "1.0", emite: [], escucha: [] });
}
