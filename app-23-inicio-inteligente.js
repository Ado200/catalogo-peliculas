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

  function renderSaludo(L) {
    const d = new Date();
    const h = d.getHours();
    const saludo = h < 6 ? "Buenas noches" : h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
    const dia = d.toLocaleDateString("es-MX", { weekday: "long" });
    const hora = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const av = alertas(L);
    $("inteligente").innerHTML =
      '<p class="ia-fecha">' + esc(dia) + " · " + esc(hora) + '</p>' +
      '<p class="ia-saludo">' + esc(saludo) + '</p>' +
      av.map(a => '<button type="button" class="ia-alerta" data-alerta="' + esc(a.accion) + '">' +
        '<span>' + esc(a.texto) + '</span><span aria-hidden="true">›</span></button>').join("");
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
    const hoy = hoyIso();
    const filas = (typeof proximosCines !== "undefined" ? proximosCines : [])
      .filter(r => r[1] && r[1] >= hoy).slice(0, 8);
    if (!filas.length) { $("proximosInicio").innerHTML = ""; return; }
    const tarjetas = filas.map(r => {
      const titulo = r[0];
      const esPend = L.pendientes.some(p => norm(p.titulo) === norm(titulo));
      const enCat = peliculas.find(p => norm(p.titulo) === norm(titulo));
      const poster = r[2] ? '<img src="' + esc(r[2]) + '" alt="" loading="lazy">' : '<div class="ia-sinposter">🎬</div>';
      const etiqueta = esPend ? "En tus pendientes" : (enCat ? "En tu catálogo" : "");
      const attr = enCat ? ' data-peli="' + esc(titulo) + '"' : '';
      return '<button type="button" class="ia-poster"' + attr + '>' + poster +
        '<span class="ia-tit">' + esc(titulo) + '</span>' +
        '<small>' + esc(fechaCorta(r[1])) + '</small>' +
        (etiqueta ? '<em class="ia-etq">' + esc(etiqueta) + '</em>' : '') + '</button>';
    }).join("");
    $("proximosInicio").innerHTML =
      '<div class="ia-cabecera"><h3>Próximos en cine</h3></div>' +
      '<p class="ia-sub">Llegan a México en los próximos 60 días</p>' +
      '<div class="ia-carril">' + tarjetas + '</div>';
  }

  // ---------- Por calificar ----------
  function renderPorCalificar(L) {
    const sin = L.vistas.filter(p => !estadoDe(p).estrellas).slice(0, 6);
    if (!sin.length) { $("porCalificar").innerHTML = ""; return; }
    const filas = sin.map(p =>
      '<div class="ia-fila ia-fila-estrellas"><span class="ia-tit">' + esc(p.titulo) + '</span>' +
      '<span class="ia-estrellas">' + [1, 2, 3, 4, 5].map(n =>
        '<button type="button" data-estrella="' + n + '" data-titulo="' + esc(p.titulo) + '" aria-label="' + n + ' estrellas">★</button>').join("") +
      '</span></div>').join("");
    $("porCalificar").innerHTML =
      '<div class="ia-cabecera"><h3>Por calificar</h3></div>' +
      '<p class="ia-sub">Un toque y tus recomendaciones mejoran</p>' + filas;
  }

  // ---------- Tu semana ----------
  function renderSemana(L) {
    const meta = Number(localStorage.getItem("meta_semana") || 2);
    const desde = lunesIso();
    const vistasSem = L.vistas.filter(p => (L.m[p.titulo] || {}).vistaDesde >= desde).length;
    const pendSem = L.pendientes.filter(p => (L.m[p.titulo] || {}).pendienteDesde >= desde).length;
    const pct = Math.min(100, Math.round(vistasSem / meta * 100));
    const opciones = [1, 2, 3, 4, 5].map(n => '<option value="' + n + '"' + (n === meta ? ' selected' : '') + '>' + n + '</option>').join("");
    $("tuSemana").innerHTML =
      '<div class="ia-cabecera"><h3>Tu semana</h3>' +
      '<label class="ia-meta">Meta <select data-meta>' + opciones + '</select></label></div>' +
      '<p class="ia-sub">' + vistasSem + ' de ' + meta + ' películas esta semana · ' + pendSem + ' nuevas pendientes</p>' +
      '<div class="ia-barra"><div style="width:' + pct + '%"></div></div>';
  }

  // ---------- Contadores de Mis listas ----------
  function renderContadores(L) {
    $("contadoresListas").innerHTML =
      '<button type="button" class="ia-contador" data-contador="vistas"><b>' + L.vistas.length + '</b><span>Vistas</span></button>' +
      '<button type="button" class="ia-contador" data-contador="pendientes"><b>' + L.pendientes.length + '</b><span>Pendientes</span></button>' +
      '<button type="button" class="ia-contador" data-contador="notas"><b>' + L.notas.length + '</b><span>Notas</span></button>';
  }

  function renderTodo() {
    try {
      const L = listas();
      renderSaludo(L);
      renderNoche(L);
      renderProximos(L);
      renderPorCalificar(L);
      renderSemana(L);
      renderContadores(L);
    } catch (e) { /* sin datos aún */ }
  }

  // ---------- Eventos ----------
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-noche],[data-alerta],[data-peli],[data-estrella],[data-contador],#abrirAjustes");
    if (!t) return;
    if (t.dataset.noche) { minutosNoche = Number(t.dataset.noche); renderTodo(); return; }
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
  if (typeof peliculas !== "undefined" && peliculas.length) renderTodo();
})();
