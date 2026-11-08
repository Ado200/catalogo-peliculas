/* ===== Fase 0 · Módulo «carga»: inicio de sesión, lectura de la hoja y copia sin conexión ===== */
/* Migrado de app-04 sin cambiar el comportamiento. Mantiene los mismos nombres globales.
   iniciarApp sigue en app-04 (es el punto donde se conecta todo). Se registra en el núcleo. */
// Comprueba que la cuenta que inició sesión sea la institucional. Sin dominio configurado, no restringe.
async function cuentaPermitida(token) {
  if (!DOMINIO_INSTITUCIONAL) return true;
  try {
    const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!r.ok) return false;
    const j = await r.json();
    const correo = String(j.email || "").toLowerCase();
    const dominio = DOMINIO_INSTITUCIONAL.toLowerCase();
    // En Google Workspace, "hd" indica la organización de la cuenta; si viene, debe coincidir
    const orgOk = !j.hd || String(j.hd).toLowerCase() === dominio;
    return j.email_verified !== false && correo.endsWith("@" + dominio) && orgOk;
  } catch (e) {
    return false;
  }
}

function mostrarError(msg) {
  $("error").textContent = msg;
  $("btnLogin").disabled = false;
  $("btnLogin").textContent = "Iniciar sesión con Google";
}

/* ---------- Modo sin conexión: copia local del catálogo ---------- */
async function actualizarCopiaEnSegundoPlano() {
  if (!accessToken || !navigator.onLine || !HOJA_ID) return;
  try {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${HOJA_ID}/values/A:Z`, {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!r.ok) return;
    const j = await r.json();
    const nuevas = j.values || [];
    let previas = null;
    try { previas = (JSON.parse(localStorage.getItem("catalogo_hoja_cache") || "null") || {}).filas || null; } catch (e) {}
    if (JSON.stringify(previas) === JSON.stringify(nuevas)) return;
    guardarCopiaHoja(nuevas);
    const b = document.getElementById("bannerSinConexion");
    if (b) {
      b.textContent = "Hay cambios nuevos en el catálogo. Recarga la página para verlos.";
      b.hidden = false;
    }
  } catch (e) { /* sin conexión o error: se intenta en la siguiente vuelta */ }
}
function guardarCopiaHoja(filas) {
  try { localStorage.setItem("catalogo_hoja_cache", JSON.stringify({ fecha: new Date().toISOString(), filas: filas })); }
  catch (e) { /* si la copia no cabe, simplemente no se guarda */ }
}

function mostrarBannerOffline(fechaISO) {
  const b = document.getElementById("bannerSinConexion");
  if (!b) return;
  const fecha = fechaISO ? new Date(fechaISO).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  b.textContent = "Sin conexión: viendo la copia" + (fecha ? " del " + fecha : "") + ". Tus cambios se guardan aquí y se suben al volver la conexión.";
  b.hidden = false;
}

function ocultarBannerOffline() {
  const b = document.getElementById("bannerSinConexion");
  if (b) b.hidden = true;
}

async function cargarDesdeCopia() {
  let copia = null;
  try { copia = JSON.parse(localStorage.getItem("catalogo_hoja_cache") || "null"); } catch (e) { copia = null; }
  if (!copia || !copia.filas || !copia.filas.length) return false;

  const filas = copia.filas;
  encabezados = (filas[0] || []).slice();
  COL_PALETA = encabezados.indexOf(NOMBRE_PALETA);
  peliculas = [];
  filas.slice(1).forEach((f, i) => {
    if (!f[0]) return;
    const o = { _fila: i + 2 };
    encabezados.forEach((n, j) => o[n] = f[j] ?? "");
    Nucleo.datos.peliculas().push(o);
  });
  fotosActores = {};
  Nucleo.datos.peliculas().forEach(p => {
    try {
      const m = JSON.parse(p.fotos_reparto || "{}");
      Object.entries(m).forEach(([n, u]) => { if (!fotosActores[n]) fotosActores[n] = u; });
    } catch (e) {}
  });

  await cargarMarcas();
  $("login").style.display = "none";
  $("app").style.display = "block";
  const botonChat = document.getElementById("chatAbrir");
  if (botonChat) botonChat.style.display = "";
  document.body.classList.add("con-sesion");
  llenarFiltros();
  llenarSugerencias();
  renderDestacados();
  pintar();
  mostrarBannerOffline(copia.fecha);
  return true;
}

async function cargarHoja() {
  try {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${HOJA_ID}/values/A:Z`, {
      headers: { Authorization: "Bearer " + accessToken }
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error?.message || "No se pudo leer la hoja.");

    const filas = json.values || [];
    encabezados = (filas[0] || []).slice();
    COL_PALETA = encabezados.indexOf(NOMBRE_PALETA);

    peliculas = [];
    filas.slice(1).forEach((f, i) => {
      if (!f[0]) return;
      const o = { _fila: i + 2 };
      encabezados.forEach((n, j) => o[n] = f[j] ?? "");
      Nucleo.datos.peliculas().push(o);
    });

    fotosActores = {};
    Nucleo.datos.peliculas().forEach(p => {
      try {
        const m = JSON.parse(p.fotos_reparto || "{}");
        Object.entries(m).forEach(([n, u]) => { if (!fotosActores[n]) fotosActores[n] = u; });
      } catch (e) {}
    });
    guardarCopiaHoja(filas);

    $("login").style.display = "none";
    $("app").style.display = "block";
    const botonChat = document.getElementById("chatAbrir");
    if (botonChat) botonChat.style.display = "";
    document.body.classList.add("con-sesion");
    llenarFiltros();
    llenarSugerencias();
    renderDestacados();
    pintar();
    abrirDesdeUrl();
  } catch (e) {
    mostrarError(e.message);
  }
}


if (window.Nucleo) {
  Nucleo.registrar("carga", { version: "1.0", emite: [], escucha: [] });
}
