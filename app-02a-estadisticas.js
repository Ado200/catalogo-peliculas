/* ===== Fase 0 · Módulo «estadisticas»: estadísticas y gráficas de tus marcas. Migrado de app-02 sin cambios de comportamiento. Se carga después de app-02 y antes de app-13, que amplía la ventana de estadísticas. ===== */
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
  Object.entries(Nucleo.datos.marcas()).forEach(([titulo, m]) => {
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
  Nucleo.datos.peliculas().forEach(p => {
    if (estadoDe(p).vista) generosDe(p).forEach(g => generos[g] = (generos[g] || 0) + 1);
  });
  const topG = Object.entries(generos).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const estrellas = [0, 0, 0, 0, 0];
  Nucleo.datos.peliculas().forEach(p => {
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

  Nucleo.datos.peliculas().forEach(p => {
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

  const total = Nucleo.datos.peliculas().length;
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


if (window.Nucleo) { Nucleo.registrar("estadisticas", { version: "1.0", emite: [], escucha: [] }); }
