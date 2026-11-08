/* ===== Fase 0 · Módulo «explorar-hoy»: pestaña Explorar, buscador de herramientas y pantalla «Hoy» ===== */
/* Migrado de app-05 sin cambiar el comportamiento. Mantiene los mismos nombres globales.
   Se registra en el núcleo (app-00-nucleo.js). Aún sin interruptor en Ajustes. */
/* ---------- Explorar: herramientas visibles desde la pantalla de inicio ---------- */
function gruposHerramientas() {
  return [...document.querySelectorAll("#panelAvanzados .grupo-menu, #panelMas .grupo-menu")]
    .filter(g => !/^(Ver|Ayuda|Datos|Cuenta|Ajustes)$/.test((g.querySelector(".grupo-titulo") || {}).textContent || ""))
    .filter(g => [...g.querySelectorAll("button[id]")].some(b => DESC_HERRAMIENTAS[b.id]));
}

function abrirGrupoHerramientas(indice) {
  const g = gruposHerramientas()[indice];
  if (!g) return;
  const titulo = g.querySelector(".grupo-titulo").textContent;
  const botones = [...g.querySelectorAll("button[id]")];
  abrirVentanaSimple("explorarGrupo", titulo,
    '<div class="explorar-lista">' + botones.map(b =>
      '<button type="button" class="explorar-item" data-id="' + b.id + '">' + b.innerHTML + '</button>').join("") +
    '</div>');
  document.querySelectorAll("#explorarGrupo .explorar-item").forEach(b => b.addEventListener("click", () => {
    document.querySelector("#explorarGrupo [data-cerrar]").click();
    const destino = document.getElementById(b.dataset.id);
    if (destino) destino.click();
  }));
}

function herramientaDelDia() {
  const lista = todasHerramientas();
  if (!lista.length) return "";
  const hoy = new Date();
  const diaDelAno = Math.floor((hoy - new Date(hoy.getFullYear(), 0, 0)) / 86400000);
  const x = lista[diaDelAno % lista.length];
  return '<div class="hoy-dia"><span>✨ Prueba hoy: <b>' + esc(x.texto) + '</b></span>' +
    '<button type="button" class="pildora" data-run="' + x.id + '">Probar</button></div>';
}

function bloqueExplorar() {
  const grupos = gruposHerramientas();
  if (!grupos.length) return "";
  return '<div class="explorar-titulo">Explorar</div><div class="explorar-grid">' +
    grupos.map((g, i) => {
      const n = g.querySelectorAll("button[id]").length;
      return '<button type="button" class="explorar-tile" data-grupo="' + i + '">' +
        '<b>' + esc(g.querySelector(".grupo-titulo").textContent) + '</b>' +
        '<span class="meta">' + n + ' herramientas</span></button>';
    }).join("") + '</div>';
}

/* ---------- Explorar: buscador de herramientas (pestaña, Ctrl+K) ---------- */
function todasHerramientas() {
  const out = [];
  gruposHerramientas().forEach(g => {
    const grupo = g.querySelector(".grupo-titulo").textContent;
    g.querySelectorAll("button[id]").forEach(b => out.push({ id: b.id, html: b.innerHTML, texto: b.textContent.trim(), grupo: grupo }));
  });
  return out;
}

function ejecutarHerramienta(id) {
  const destino = document.getElementById(id);
  if (destino) destino.click();
}

const DESC_HERRAMIENTAS = {
  nocheTema: "Elige una pendiente del género que toca hoy.",
  maraton: "Arma hasta 3 pendientes que quepan en el tiempo que tienes.",
  sorpresa: "Una película según duración, género o actor.",
  animoBtn: "Ordena el catálogo según cómo te sientes hoy.",
  mapaViaje: "Qué países has visitado con tus películas.",
  parejaBtn: "Activa elegir solo entre las películas para ver con alguien.",
  votarPareja: "Cada quien vota sí o no, y ves en qué coinciden.",
  capsula: "Tu resumen del año: vistas, favoritas y géneros.",
  clasificar: "Clasifica rápido las películas que aún no tienes marcadas.",
  estadisticas: "Gráficas de tus calificaciones y tus hábitos.",
  diario: "Tus películas vistas con fecha y notas.",
  buzon: "Escribe cartas a tu yo futuro sobre una película.",
  prepararViaje: "Guarda tus pendientes para verlas sin internet.",
  verViaje: "Abre la lista guardada para llevarla.",
  guardarPaletas: "Calcula y guarda los colores de los pósters.",
  deshacer: "Regresa el último cambio en tus marcas.",
  atajos: "Muestra los atajos de teclado.",
  vista: "Cambia entre vista normal y compacta de la lista.",
  agrupar: "Agrupa las películas por tema.",
  limpiar: "Quita todos los filtros.",
  presetGuardar: "Guarda los filtros actuales para reusarlos.",
  presetBorrar: "Borra el filtro guardado seleccionado.",
  exportar: "Descarga tu catálogo en un archivo CSV.",
  respaldarMarcas: "Descarga una copia de tus marcas.",
  restaurarMarcas: "Carga una copia de tus marcas.",
  borrarMarcas: "Borra todas tus marcas (no se puede deshacer).",
  salirDispositivo: "Cierra tu sesión en este dispositivo.",
  toggleSalud: "Muestra el estado de los datos de la hoja.",
  aleatorio: "Sugiere una película al azar.",
  queVerNoche: "Te dice qué ver esta noche según el tiempo que tengas.",
  verGuia: "Abre esta guía."
};

function abrirExplorar() {
  if (window.Nucleo && !Nucleo.activo("explorar-hoy")) return; // interruptor de Ajustes
  const grupos = gruposHerramientas().map(g => ({
    titulo: g.querySelector(".grupo-titulo").textContent,
    items: [...g.querySelectorAll("button[id]")].map(b => ({
      id: b.id, html: b.innerHTML, texto: b.textContent.trim(), desc: DESC_HERRAMIENTAS[b.id] || ""
    }))
  }));
  const filtrar = q => {
    const t = q.trim().toLowerCase();
    return grupos.map(g => ({
      titulo: g.titulo,
      items: g.items.filter(x => !t || (x.texto + " " + x.desc + " " + g.titulo).toLowerCase().includes(t))
    })).filter(g => g.items.length);
  };
  const pintar = q => {
    const gs = filtrar(q);
    const plano = gs.flatMap(g => g.items);
    caja.innerHTML = gs.map(g =>
      '<h4 class="explorar-grupo">' + esc(g.titulo) + '</h4>' +
      g.items.map(x => '<button type="button" class="explorar-item" data-id="' + x.id + '">' +
        '<b>' + x.html + '</b><span class="meta">' + esc(x.desc) + '</span></button>').join("")
    ).join("") || '<p class="meta">Ninguna herramienta coincide. Prueba con otra palabra.</p>';
    return plano;
  };
  abrirVentanaSimple("explorarTodo", "Herramientas",
    '<input id="explorarBusca" class="campo-busca" type="search" placeholder="Busca por nombre o para qué sirve…" autocomplete="off">' +
    '<div id="explorarResultados" class="explorar-lista"></div>');
  const caja = document.getElementById("explorarResultados");
  const busca = document.getElementById("explorarBusca");
  pintar("");
  busca.addEventListener("input", () => pintar(busca.value));
  busca.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const primera = pintar(busca.value)[0];
    if (primera) { document.querySelector("#explorarTodo [data-cerrar]").click(); ejecutarHerramienta(primera.id); }
  });
  caja.addEventListener("click", e => {
    const b = e.target.closest(".explorar-item");
    if (!b) return;
    document.querySelector("#explorarTodo [data-cerrar]").click();
    ejecutarHerramienta(b.dataset.id);
  });
  busca.focus();
}

/* ---------- Pantalla de inicio: «Hoy» ---------- */
function saludoHoy() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function retoActual() {
  const hoy = new Date();
  const mes = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0");
  const vistasMes = Nucleo.datos.peliculas().filter(p => ((Nucleo.datos.marcas()[p.titulo] || {}).historial || [])
    .some(h => h.a === "vista" && String(h.f).startsWith(mes)));
  const reto = RETOS_MES[hoy.getMonth() % RETOS_MES.length];
  return { texto: reto.texto, hecho: Math.min(reto.cuenta(vistasMes), reto.meta), meta: reto.meta };
}

function renderHoy() {
  const sec = $("hoy");
  if (!sec) return;
  if (hayFiltros() || pestana !== "catalogo") {
    sec.style.display = "none";
    return;
  }
  const pend = pendientesNoVistas().length;
  const conAlguien = Nucleo.datos.peliculas().filter(p => (Nucleo.datos.marcas()[p.titulo] || {}).conAlguien && !(Nucleo.datos.marcas()[p.titulo] || {}).vista).length;
  const r = retoActual();
  const sAhora = (typeof elegirParaAhora === "function") ? elegirParaAhora(null) : null;
  const resumenPend = pend ? pend + " pendiente" + (pend === 1 ? "" : "s") : "Aún no tienes pendientes";
  const extra = conAlguien ? " · " + conAlguien + " para ver con alguien" : "";
  sec.style.display = "block";
  sec.innerHTML =
    '<p class="hoy-saludo">' + saludoHoy() + '</p>' +
    '<h2 class="hoy-titulo">¿Qué vemos hoy?</h2>' +
    '<p class="hoy-sub">' + esc(resumenPend + extra) + '</p>' +
    (sAhora && sAhora.texto ? '<p class="hoy-ahora">Para esta hora: ' + esc(sAhora.texto) + '</p>' : '') +
    '<div class="hoy-acciones">' +
      '<button type="button" class="pildora destacado" id="hoyNoche">🎡 Noche temática</button>' +
      '<button type="button" class="pildora" id="hoyAzar">🎲 Al azar</button>' +
      '<button type="button" class="pildora" id="hoyAnimo">🎭 ¿Cómo te sientes?</button>' +
    '</div>' +
    '<div class="hoy-reto"><span>🏆 ' + esc(r.texto) + '</span>' +
      '<div class="reto-barra"><span style="width:' + Math.round(r.hecho / r.meta * 100) + '%"></span></div></div>' +
    herramientaDelDia() + bloqueExplorar() + renderAlertasEstreno();
  $("hoyNoche").addEventListener("click", nocheTematica);
  $("hoyAzar").addEventListener("click", sugerirAleatoria);
  $("hoyAnimo").addEventListener("click", abrirAnimo);
  sec.querySelectorAll("[data-run]").forEach(b => b.addEventListener("click", () => ejecutarHerramienta(b.dataset.run)));
  sec.querySelectorAll("[data-grupo]").forEach(b => b.addEventListener("click", () => abrirGrupoHerramientas(Number(b.dataset.grupo))));
}

if (window.Nucleo) {
  Nucleo.registrar("explorar-hoy", { version: "1.0", emite: [], escucha: [] });
}

/* Interruptor de Ajustes (modulo_explorar-hoy). Al apagarlo se oculta el bloque «Explorar» de Inicio,
   y abrirExplorar (pestaña, Ctrl+K) no abre el panel. Las herramientas siguen existiendo en el menú. */
if (window.Nucleo) {
  const aplicarExplorar = () => document.body.classList.toggle("sin-explorar", !Nucleo.activo("explorar-hoy"));
  const interruptorExp = document.getElementById("moduloExplorarOn");
  if (interruptorExp) {
    interruptorExp.checked = Nucleo.activo("explorar-hoy");
    interruptorExp.addEventListener("change", () => {
      Nucleo.activar("explorar-hoy", interruptorExp.checked);
      aplicarExplorar();
    });
  }
  aplicarExplorar();
}
