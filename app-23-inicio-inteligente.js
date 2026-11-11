/* ===== Inicio inteligente · módulo app-23 =====
   Saludo con avisos útiles, Tu noche, Próximos en cine, Por calificar, Tu semana
   y contadores de Mis listas. Usa solo datos que ya tiene la app (no llama a TMDB). ===== */
(function () {
  const $ = id => document.getElementById(id);
  const M = () => (Nucleo.datos.marcas && Nucleo.datos.marcas()) || {};
  const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const hoyIso = () => hoyLocalISO();

  function minutosDe(p) {
    const s = String(p.duracion || "");
    const h = s.match(/(\d+)\s*h/i), m = s.match(/(\d+)\s*min/i);
    if (h || m) return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
    const n = s.match(/^\s*(\d+)\s*$/);
    return n ? Number(n[1]) : 0;
  }
  function intensidad(p) {
    const g = String(p.genero || "").toLowerCase();
    if (/animaci|familia|comedia|aventura/.test(g)) return 1;
    if (/terror|suspenso|crimen|accion|acción|thriller/.test(g)) return 3;
    return 2;
  }
  function diasDesde(iso) {
    return (Date.parse(hoyIso() + "T00:00:00") - Date.parse(iso + "T00:00:00")) / 86400000;
  }
  function fechaCorta(iso) {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  }
  function lunesIso() {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  const listas = () => {
    const m = M();
    const pendientes = peliculas.filter(p => estadoDe(p).pendiente);
    const vistas = peliculas.filter(p => estadoDe(p).vista);
    const notas = peliculas.filter(p => String((m[p.titulo] || {}).nota || "").trim());
    return { m, pendientes, vistas, notas };
  };

  // ---------- Saludo con avisos ----------
  function alertas(L) {
    const out = [];
    const viejos = L.pendientes.filter(p => {
      const d = (L.m[p.titulo] || {}).pendienteDesde;
      return d && diasDesde(d) > 30;
    });
    if (viejos.length) out.push({ texto: viejos.length + (viejos.length === 1 ? " pendiente lleva" : " pendientes llevan") + " más de 30 días sin ver", accion: "pendientes" });
    const hoy = hoyIso();
    const proxPend = (typeof proximosCines !== "undefined" ? proximosCines : [])
      .filter(r => r[1] >= hoy && L.pendientes.some(p => norm(p.titulo) === norm(r[0])))
      .slice(0, 1);
    if (proxPend.length) out.push({ texto: "«" + proxPend[0][0] + "» llega a cines el " + fechaCorta(proxPend[0][1]) + " y está en tus pendientes", accion: "proximos" });
    const sinCal = L.vistas.filter(p => !estadoDe(p).estrellas).length;
    if (sinCal >= 3) out.push({ texto: sinCal + " vistas sin calificar. Calificarlas mejora tus recomendaciones", accion: "calificar" });
    return out.slice(0, 2);
  }

  // ---------- Encabezado: fecha, frase editorial y aviso principal ----------
  const FRASES = {
    madrugada: ["Si no puedes dormir, una película corta te acompaña.", "Madrugada de cine: algo tranquilo para cerrar el día."],
    manana: ["Buen día para una película ligera con el café.", "Empieza el día con algo que te haga sonreír."],
    tarde: ["Tarde perfecta para ponerte al día con tus pendientes.", "Una película para el descanso de la tarde."],
    noche: ["Una película corta antes de dormir.", "Hora de elegir algo que quepa en tu noche."],
    finde: ["Fin de semana: tiempo para una maratón.", "El fin de semana pide una película que dure."],
    pendientes: ["Tienes algo esperándote desde hace tiempo.", "Hay pendientes que piden atención."],
    racha: ["Vas muy bien esta semana. Sigue así.", "Tu ritmo de esta semana se nota. Buen trabajo."],
    calificar: ["Calificar lo visto te da mejores recomendaciones.", "Unas estrellas hoy mejoran todo lo que te sugiera la app."]
  };
  const franja = h => h < 6 ? "madrugada" : h < 12 ? "manana" : h < 19 ? "tarde" : "noche";

  function elegirFrase(L) {
    const d = new Date();
    const fin = d.getDay() === 0 || d.getDay() === 6;
    const viejos = L.pendientes.filter(p => { const f = (L.m[p.titulo] || {}).pendienteDesde; return f && diasDesde(f) > 30; }).length;
    const desde = lunesIso();
    const vistasSem = L.vistas.filter(p => (L.m[p.titulo] || {}).vistaDesde >= desde).length;
    const sinCal = L.vistas.filter(p => !estadoDe(p).estrellas).length;
    let categoria;
    if (viejos > 0) categoria = "pendientes";
    else if (vistasSem >= 2) categoria = "racha";
    else if (sinCal >= 3) categoria = "calificar";
    else if (fin && (franja(d.getHours()) === "noche" || franja(d.getHours()) === "tarde")) categoria = "finde";
    else categoria = franja(d.getHours());
    const lista = FRASES[categoria];
    const toques = Number(localStorage.getItem("frase_toques") || 0);
    const dia = Number(d.toISOString().slice(8, 10));
    return lista[(dia + toques) % lista.length];
  }

  function renderSaludo(L) {
    const d = new Date();
    const fecha = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
    const hora = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const av = alertas(L);
    const aviso = av.length
      ? '<button type="button" class="ia-aviso" data-alerta="' + esc(av[0].accion) + '"><span class="ia-aviso-icono" aria-hidden="true">!</span><span class="ia-aviso-texto">' + esc(av[0].texto) + '</span><span class="ia-aviso-ver">Ver</span></button>'
      : "";
    $("inteligente").innerHTML =
      '<p class="ia-fecha">' + esc(fecha) + " · " + esc(hora) + '</p>' +
      '<button type="button" class="ia-frase" data-frase aria-label="Cambiar frase"><span class="ia-frase-barra" aria-hidden="true"></span><span class="ia-frase-texto">' + esc(elegirFrase(L)) + '</span></button>' +
      aviso;
  }

  // ---------- Tu noche ----------
  let minutosNoche = 120;
  function planNoche(L) {
    const pool = peliculas.filter(p => !estadoDe(p).vista && minutosDe(p) > 0);
    pool.sort((a, b) => ((L.m[b.titulo] || {}).pendiente ? 1 : 0) - ((L.m[a.titulo] || {}).pendiente ? 1 : 0));
    const elegidas = [];
    let usado = 0;
    for (const p of pool) {
      const m = minutosDe(p);
      const extra = elegidas.length ? 10 : 0;
      if (usado + extra + m <= minutosNoche) { elegidas.push(p); usado += extra + m; }
      if (elegidas.length >= 5) break;
    }
    elegidas.sort((a, b) => intensidad(a) - intensidad(b));
    return { elegidas, usado };
  }

  function renderNoche(L) {
    const { elegidas, usado } = planNoche(L);
    const ini = new Date();
    ini.setMinutes(Math.ceil(ini.getMinutes() / 5) * 5, 0, 0);
    let t = ini.getTime();
    const botones = [60, 120, 180].map(m =>
      '<button type="button" class="ia-pastilla' + (m === minutosNoche ? ' activa' : '') + '" data-noche="' + m + '">' + (m / 60) + ' h</button>').join("");
    const lista = elegidas.length
      ? elegidas.map((p, i) => {
          const hora = new Date(t).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
          t += (minutosDe(p) + 10) * 60000;
          return '<button type="button" class="ia-fila" data-peli="' + esc(p.titulo) + '">' +
            '<span class="ia-hora">' + esc(hora) + '</span>' +
            '<span class="ia-tit">' + esc(p.titulo) + '<small>' + minutosDe(p) + ' min</small></span></button>';
        }).join("")
      : '<p class="ia-vacio">No tengo películas sin ver que quepan en ese tiempo.</p>';
    $("tuNoche").innerHTML =
      '<div class="ia-cabecera"><h3>Tu noche</h3><div class="ia-pastillas">' + botones + '</div></div>' +
      '<p class="ia-sub">' + (elegidas.length ? elegidas.length + " películas · " + Math.round(usado / 60 * 10) / 10 + " h, de ligeras a intensas" : "") + '</p>' +
      lista;
  }

  // ---------- Próximos en cine ----------
  function renderProximos(L) {
    const el = $("proximosInicio");
    if (!el) return;
    const hoy = hoyIso();
    const filas = (typeof proximosCines !== "undefined" ? proximosCines : [])
      .filter(r => r[1] && r[1] >= hoy).slice(0, 6);
    if (!filas.length) { el.innerHTML = ""; return; }
    const diasHasta = iso => Math.round((Date.parse(iso + "T00:00:00") - Date.parse(hoy + "T00:00:00")) / 86400000);
    const etiquetaDias = n => n === 0 ? "Hoy" : n === 1 ? "Mañana" : "en " + n + " días";
    const tarjetas = filas.map(r => {
      const titulo = r[0];
      const esPend = L.pendientes.some(p => norm(p.titulo) === norm(titulo));
      const enCat = peliculas.find(p => norm(p.titulo) === norm(titulo));
      const poster = r[2] ? '<img src="' + esc(r[2]) + '" alt="" loading="lazy">' : '<div class="ia-sinposter">🎬</div>';
      const attr = enCat ? ' data-peli="' + esc(titulo) + '"' : '';
      return '<button type="button" class="ia-poster"' + attr + ' aria-label="' + esc(titulo) + ', ' + esc(etiquetaDias(diasHasta(r[1]))) + '">' +
        poster +
        '<span class="ia-tit">' + esc(titulo) + '</span>' +
        '<small>' + esc(etiquetaDias(diasHasta(r[1]))) + '</small>' +
        (esPend ? '<em class="ia-etq">En tus pendientes</em>' : '') +
      '</button>';
    }).join("");
    el.innerHTML =
      '<div class="ia-cabecera"><h3>Próximos en cine</h3></div>' +
      '<div class="ia-carril">' + tarjetas + '</div>';
  }

  // ---------- Por calificar ----------
  // ---------- Tu huella del año (vistas, minutos, racha de semanas) ----------
  function renderSemana(L) {
    const anio = String(new Date().getFullYear());
    const vistasAnio = L.vistas.filter(p => String((L.m[p.titulo] || {}).vistaDesde || "").slice(0, 4) === anio);
    const minutos = vistasAnio.reduce((s, p) => s + minutosDe(p), 0);
    const meta = Number(localStorage.getItem("meta_anual") || 24);
    const pct = Math.min(100, Math.round(vistasAnio.length / meta * 100));
    const q = n => String(n).padStart(2, "0");
    const claveSemana = d => d.getFullYear() + "-" + q(d.getMonth() + 1) + "-" + q(d.getDate());
    const semanas = new Set(L.vistas.map(p => (L.m[p.titulo] || {}).vistaDesde).filter(Boolean).map(f => {
      const d = new Date(f + "T12:00:00");
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return claveSemana(d);
    }));
    let racha = 0;
    const cur = new Date(lunesIso() + "T12:00:00");
    while (semanas.has(claveSemana(cur))) { racha++; cur.setDate(cur.getDate() - 7); }
    $("tuSemana").innerHTML =
      '<div class="hu-tarjeta">' +
        '<p class="hu-titulo">Tu huella ' + esc(anio) + '</p>' +
        '<div class="hu-anillo" style="--p:' + pct + '"><span>' + vistasAnio.length + '</span></div>' +
        '<p class="hu-sub">' + esc(String(minutos)) + ' min · racha ' + racha + ' sem.</p>' +
      '</div>';
  }

  // ---------- Por calificar (se despliega al tocarlo) ----------
  function renderPorCalificar(L) {
    const el = $("porCalificar");
    if (!el) return;
    const sin = L.vistas.filter(p => !estadoDe(p).estrellas);
    if (!sin.length) { el.innerHTML = ""; return; }
    const filas = sin.slice(0, 6).map(p =>
      '<div class="ia-fila ia-fila-estrellas"><span class="ia-tit">' + esc(p.titulo) + '</span>' +
      '<span class="ia-estrellas">' + [1, 2, 3, 4, 5].map(n =>
        '<button type="button" data-estrella="' + n + '" data-titulo="' + esc(p.titulo) + '" aria-label="' + n + ' estrellas">★</button>').join("") +
      '</span></div>').join("");
    el.innerHTML =
      '<div class="pc-tarjeta">' +
        '<button type="button" class="pc-cab" data-pc-toggle aria-expanded="false">' +
          '<span class="pc-titulo">Por calificar</span>' +
          '<span class="pc-num">' + sin.length + '</span>' +
          '<span class="pc-sub">vistas sin estrellas</span>' +
        '</button>' +
        '<div class="pc-lista" hidden>' + filas + '</div>' +
      '</div>';
  }

  // ---------- Contadores de Mis listas ----------
  function renderContadores(L) {
    $("contadoresListas").innerHTML =
      '<button type="button" class="ia-contador" data-contador="vistas"><b>' + L.vistas.length + '</b><span>Vistas</span></button>' +
      '<button type="button" class="ia-contador" data-contador="pendientes"><b>' + L.pendientes.length + '</b><span>Pendientes</span></button>' +
      '<button type="button" class="ia-contador" data-contador="notas"><b>' + L.notas.length + '</b><span>Notas</span></button>';
  }

  // ---------- Clima (Open-Meteo, sin clave; caché de 30 minutos) ----------
  const CLIMA_DEFECTO = { nombre: "Cancún", lat: 21.16, lon: -86.85 };
  const CLIMA_VIGENCIA = 30 * 60 * 1000;
  const CODIGOS_CLIMA = {
    0: ["sol", "Despejado"], 1: ["sol", "Mayormente despejado"], 2: ["nube", "Parcialmente nublado"], 3: ["nube", "Nublado"],
    45: ["niebla", "Niebla"], 48: ["niebla", "Niebla"],
    51: ["lluvia", "Llovizna"], 53: ["lluvia", "Llovizna"], 55: ["lluvia", "Llovizna"],
    61: ["lluvia", "Lluvia"], 63: ["lluvia", "Lluvia"], 65: ["lluvia", "Lluvia fuerte"],
    80: ["lluvia", "Chubascos"], 81: ["lluvia", "Chubascos"], 82: ["lluvia", "Chubascos fuertes"],
    95: ["tormenta", "Tormenta"], 96: ["tormenta", "Tormenta"], 99: ["tormenta", "Tormenta"]
  };
  // Íconos del clima en SVG (no dependen de librerías externas)
  const ICONOS_CLIMA = {
    sol: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    nube: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#8e8e93" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z"/></svg>',
    lluvia: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#3b82f6" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 14z"/><path d="M8 17l-1 2M12 17l-1 2M16 17l-1 2"/></svg>',
    niebla: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#8e8e93" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7 11h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 11z"/><path d="M3 15h18M5 19h14"/></svg>',
    tormenta: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 14z"/><path d="M13 14l-2 4h3l-2 4"/></svg>'
  };
  let climaDato = null;

  function leerClimaCache() {
    try {
      const c = JSON.parse(localStorage.getItem("clima_cache") || "null");
      if (c && Date.now() - c.t < CLIMA_VIGENCIA) return c;
    } catch (e) { /* caché inválida */ }
    return null;
  }

  function ubicacion() {
    return new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(
        p => res({ nombre: "Tu ubicación", lat: p.coords.latitude, lon: p.coords.longitude }),
        () => res(null),
        { timeout: 5000, maximumAge: 600000 }
      );
    });
  }

  async function cargarClima() {
    const c = leerClimaCache();
    if (c) { climaDato = c.dato; renderClima(); return; }
    const u = (await ubicacion()) || CLIMA_DEFECTO;
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + u.lat + "&longitude=" + u.lon +
      "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto";
    try {
      const j = await fetch(url).then(r => r.json());
      const dato = {
        nombre: u.nombre || CLIMA_DEFECTO.nombre,
        temp: Math.round(j.current.temperature_2m),
        codigo: j.current.weather_code,
        max: Math.round(j.daily.temperature_2m_max[0]),
        min: Math.round(j.daily.temperature_2m_min[0]),
        lluvia: j.daily.precipitation_probability_max[0]
      };
      climaDato = dato;
      localStorage.setItem("clima_cache", JSON.stringify({ t: Date.now(), dato: dato }));
      renderClima();
    } catch (e) {
      climaDato = null;
      renderClima();
    }
  }

  function renderClima() {
    const el = $("clima");
    if (!el) return;
    if (!climaDato) { el.innerHTML = ""; return; }
    const cond = CODIGOS_CLIMA[climaDato.codigo] || ["nube", "Variable"];
    el.innerHTML =
      '<div class="ia-clima"><span class="ia-clima-icono">' + (ICONOS_CLIMA[cond[0]] || ICONOS_CLIMA.nube) + '</span>' +
      '<div class="ia-clima-texto"><p class="ia-clima-titulo">' + esc(climaDato.nombre) + ' · ' + climaDato.temp + '° · ' + esc(cond[1]) + '</p>' +
      '<p class="ia-clima-sub">Máx ' + climaDato.max + '° · Mín ' + climaDato.min + '° · Lluvia ' + climaDato.lluvia + '%</p></div></div>';
  }

  // ---------- Principal: para esta noche (2 h) ----------
  function renderPrincipal(L) {
    const el = $("principal");
    if (!el) return;
    const pool = peliculas.filter(p => !estadoDe(p).vista && minutosDe(p) > 0 && minutosDe(p) <= 120);
    pool.sort((a, b) => ((L.m[b.titulo] || {}).pendiente ? 1 : 0) - ((L.m[a.titulo] || {}).pendiente ? 1 : 0) || intensidad(a) - intensidad(b));
    const p = pool[0];
    if (!p) { el.innerHTML = ""; return; }
    const fondo = p.portada && !datosLimitados() ? '<img src="' + esc(p.portada) + '" alt="" decoding="async">' : "";
    el.dataset.peli = p.titulo;
    el.innerHTML =
      '<div class="ia-principal">' +
        '<div class="ia-principal-fondo">' + fondo + '</div>' +
        '<div class="ia-principal-texto">' +
          '<p class="ia-principal-etiqueta">PARA ESTA NOCHE · CABE EN ' + Math.round(minutosDe(p) / 6) / 10 + ' H</p>' +
          '<p class="ia-principal-titulo">' + esc(p.titulo) + '</p>' +
          '<button type="button" class="ia-boton-primario" data-principal="ficha">Empezar</button>' +
        '</div>' +
      '</div>';
  }

  // ---------- Continuar: películas con progreso guardado ----------
  function renderContinuar(L) {
    const el = $("continuar");
    if (!el) return;
    const pelis = peliculas.filter(p => {
      const m = L.m[p.titulo] || {};
      return !estadoDe(p).vista && Number(m.progresoMin) > 0;
    }).map(p => {
      const total = minutosDe(p) || 1;
      const prog = Math.min(Number((L.m[p.titulo] || {}).progresoMin), total);
      return { tipo: "peli", p: p, pct: Math.round(prog / total * 100), prog: prog, faltan: Math.max(0, total - prog) };
    });
    const series = (window.seriesApi && window.seriesApi.lista ? window.seriesApi.lista() : []).map(s => {
      const pr = window.seriesApi.progreso(s);
      return { tipo: "serie", s: s, pr: pr };
    }).filter(x => x.pr.vistos > 0 && x.pr.vistos < x.pr.total);
    const items = pelis.concat(series).slice(0, 6);
    if (!items.length) {
      el.innerHTML = '<div class="ia-cabecera"><h3>Continuar</h3></div>' +
        '<div class="ia-continuar-vacio"><span class="ia-continuar-icono" aria-hidden="true">▶</span>' +
        '<p class="ia-continuar-texto">Aquí verás lo que empieces. Toca <b>Reanudar</b> en una película o guarda el minuto en su ficha.</p></div>';
      return;
    }
    const tarjetas = items.map(x => {
      if (x.tipo === "peli") {
        const p = x.p;
        return '<div class="ia-cont">' +
          '<div class="ia-cont-poster">' + (p.portada ? '<img src="' + esc(p.portada) + '" alt="" loading="lazy">' : '') + '</div>' +
          '<p class="ia-cont-titulo">' + esc(p.titulo) + '</p>' +
          '<div class="ia-cont-barra"><span style="width:' + x.pct + '%"></span></div>' +
          '<p class="ia-cont-sub">Minuto ' + esc(String(x.prog)) + ' · faltan ' + esc(String(x.faltan)) + ' min</p>' +
          '<button type="button" class="ia-cont-accion" data-peli-reanudar="' + esc(p.titulo) + '">Reanudar</button>' +
          '<button type="button" class="ia-cont-accion" data-cont-actualizar="' + esc(p.titulo) + '">Actualizar minuto</button>' +
        '</div>';
      }
      const s = x.s, pr = x.pr, sig = pr.siguiente || {};
      const pct = Math.round(pr.vistos / pr.total * 100);
      return '<div class="ia-cont">' +
        '<div class="ia-cont-poster">' + (s.portada ? '<img src="' + esc(s.portada) + '" alt="" loading="lazy">' : '') + '</div>' +
        '<p class="ia-cont-titulo">' + esc(s.titulo) + '</p>' +
        '<div class="ia-cont-barra"><span style="width:' + pct + '%"></span></div>' +
        '<p class="ia-cont-sub">T' + esc(String(sig.temporada || "")) + ' · E' + esc(String(sig.episodio || "")) + ' · ' + esc(String(pr.vistos)) + ' de ' + esc(String(pr.total)) + '</p>' +
        '<button type="button" class="ia-cont-accion" data-serie-reanudar="' + esc(s.titulo) + '">Reanudar</button>' +
      '</div>';
    }).join("");
    el.innerHTML = '<div class="ia-cabecera"><h3>Continuar</h3></div><div class="ia-cont-fila">' + tarjetas + '</div>';
  }

  // ---------- Sesión de reproducción: se calcula sola al regresar ----------
  function iniciarSesion(titulo) {
    const p = peliculas.find(x => x.titulo === titulo);
    if (!p) return;
    const desde = Number((M()[titulo] || {}).progresoMin || 0);
    cambiarEstado(titulo, { sesion: { inicio: Date.now(), desde: desde } });
    if (p.link) window.open(String(p.link), "_blank", "noopener");
    renderTodo();
  }

  function revisarSesiones() {
    const m = M();
    Object.keys(m).forEach(titulo => {
      const s = m[titulo] && m[titulo].sesion;
      if (!s || !s.inicio) return;
      const p = peliculas.find(x => x.titulo === titulo);
      if (!p) return;
      const total = minutosDe(p) || 99999;
      const transcurrido = Math.round((Date.now() - s.inicio) / 60000);
      const estimado = Math.min(total, Math.max(0, Number(s.desde || 0) + transcurrido));
      if (transcurrido < 1) { cambiarEstado(titulo, { sesion: null }); return; }
      const guardar = window.confirm("Llevas unos " + transcurrido + " min de «" + titulo + "».\n¿Guardar el minuto " + estimado + " para seguir desde ahí?");
      if (guardar) cambiarEstado(titulo, { progresoMin: estimado, sesion: null });
      else cambiarEstado(titulo, { sesion: null });
    });
    renderTodo();
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { try { revisarSesiones(); } catch (e) { /* sin datos aún */ } cargarClima(); }
  });
  // Refresco periódico: franjas del día, cuenta de días de próximos estrenos y horarios de Tu noche
  setInterval(() => { try { renderTodo(); } catch (e) { /* sin datos aún */ } }, 5 * 60 * 1000);

  function renderTodo() {
    try {
      const L = listas();
      renderSaludo(L);
      renderPrincipal(L);
      renderContinuar(L);
      renderClima();
      renderNoche(L);
      renderProximos(L);
      renderPorCalificar(L);
      renderSemana(L);
      renderContadores(L);
    } catch (e) { /* sin datos aún */ }
  }

  // ---------- Eventos ----------
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-noche],[data-alerta],[data-peli],[data-estrella],[data-contador],[data-frase],[data-pc-toggle],[data-principal],[data-cont-actualizar],[data-serie-reanudar],[data-peli-reanudar],#abrirAjustes");
    if (!t) return;
    if (t.dataset.noche) { minutosNoche = Number(t.dataset.noche); renderTodo(); return; }
    if (t.hasAttribute("data-pc-toggle")) {
      const lista = t.parentElement.querySelector(".pc-lista");
      const abre = lista.hidden;
      lista.hidden = !abre;
      t.setAttribute("aria-expanded", String(abre));
      return;
    }
    if (t.dataset.peliReanudar) { iniciarSesion(t.dataset.peliReanudar); return; }
    if (t.dataset.serieReanudar) { if (window.seriesApi) window.seriesApi.abrir(t.dataset.serieReanudar); return; }
    if (t.dataset.principal) { const p = peliculas.find(x => x.titulo === $("principal").dataset.peli); if (p) { if (typeof desdeAleatorio !== "undefined") desdeAleatorio = false; abrirDetalle(p); } return; }
    if (t.dataset.contActualizar) {
      const titulo = t.dataset.contActualizar;
      const p = peliculas.find(x => x.titulo === titulo);
      const actual = p ? Number((M()[titulo] || {}).progresoMin || 0) : 0;
      const txt = window.prompt("¿En qué minuto vas de «" + titulo + "»?", String(actual));
      if (txt === null) return;
      const min = Math.max(0, Math.round(Number(txt) || 0));
      cambiarEstado(titulo, { progresoMin: min });
      renderTodo();
      return;
    }
    if (t.hasAttribute("data-frase")) { localStorage.setItem("frase_toques", String(Number(localStorage.getItem("frase_toques") || 0) + 1)); renderTodo(); return; }
    if (t.dataset.alerta) {
      const a = t.dataset.alerta;
      if (a === "pendientes") cambiarPestana("pendientes");
      else if (a === "proximos") $("proximosInicio").scrollIntoView({ behavior: "smooth", block: "start" });
      else if (a === "calificar") $("porCalificar").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (t.dataset.peli) {
      const p = peliculas.find(x => x.titulo === t.dataset.peli);
      if (p) { if (typeof desdeAleatorio !== "undefined") desdeAleatorio = false; abrirDetalle(p); }
      return;
    }
    if (t.dataset.estrella) {
      cambiarEstado(t.dataset.titulo, { estrellas: Number(t.dataset.estrella) });
      renderTodo();
      return;
    }
    if (t.dataset.contador) { cambiarPestana(t.dataset.contador); return; }
    if (t.id === "abrirAjustes") {
      const yo = document.querySelector('#tabbar button[data-tab="yo"]');
      if (yo) yo.click();
    }
  });
  document.addEventListener("change", e => {
    const s = e.target.closest && e.target.closest("[data-meta]");
    if (!s) return;
    localStorage.setItem("meta_semana", s.value);
    renderTodo();
  });

  // Se recalcula cada vez que la app pinta (marcas, filtros, cambios de pestaña)
  const pintarOriginal = window.pintar;
  window.pintar = function () {
    const r = pintarOriginal.apply(this, arguments);
    renderTodo();
    return r;
  };
  window.refrescarInicioIA = renderTodo;
  cargarClima();
  setInterval(cargarClima, CLIMA_VIGENCIA);
  if (typeof peliculas !== "undefined" && peliculas.length) renderTodo();
})();
