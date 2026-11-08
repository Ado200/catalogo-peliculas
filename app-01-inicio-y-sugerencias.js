/* JavaScript de Mi catálogo de películas. Bloques en el orden original. */

/* --- bloque 1 --- */
const CLIENT_ID = "45846987194-cm8mnhijljms8k8u8j44n8aeq674vuis.apps.googleusercontent.com";
// Dominio de la cuenta institucional (por ejemplo "universidad.edu.mx"). Solo estas cuentas pueden entrar. Déjalo vacío para no restringir.
const DOMINIO_INSTITUCIONAL = "ucaribe.edu.mx";
// Modo prueba: si existe "hoja_id_prueba" en el navegador, la app usa esa hoja en lugar de la real.
const HOJA_ID = localStorage.getItem("hoja_id_prueba") || "1W5oSA5yy4TpbVYxjya6S9T6NkeE6irwSHABXFAijO2k";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.appdata openid email";
const NOMBRE_PALETA = "paleta_poster";

let peliculas = [];
let visibles = [];
let encabezados = [];
let COL_PALETA = -1;
let tokenClient;
let accessToken = null;
let marcas = {};
let idMarcas = null;
let guardadoTimer = null;
let vistaLista = false;
let agrupado = false;
let desdeAleatorio = false;
let cenaElegida = null;
let mesCalendario = null;
let cenaMensaje = "";
let fotosActores = {};
let detalleActual = null;
let sugeridaActual = null;
let textoSugerida = "";
let ahorroActivo = null;
let chartsStats = [];
let pestana = "catalogo";
let zonaPeli = "inicio";     // dentro de Películas: inicio | lista | estrenos | sagas | actores | duelo
let zonaVistas = "lista";    // dentro de Vistas: lista | resumen | actividad | mapa
let decidiendo = null;
let deshacerDescarte = null;
let avisoCerrado = false;
let firmaAvisoCerrado = "";
let seleccionDesc = new Set();
let porQueAbiertos = new Set();
const paletaCache = new Map();

let ubicacion = { lat: 21.16, lon: -86.85 };

const $ = id => document.getElementById(id);
const lista = $("lista"), buscar = $("buscar"), contador = $("contador"), chips = $("chips");
const sel = { tipo:$("tipo"), genero:$("genero"), tema:$("tema"), anio:$("anio"), pais:$("pais"), duracion:$("duracion"), estado:$("estado") };
const etiquetas = { tipo:"Tipo", genero:"Género", tema:"Tema", anio:"Año", pais:"País", duracion:"Duración", estado:"Estado" };
const AVANZADOS = ["genero", "estado", "tipo", "tema", "anio", "pais", "duracion"];

function esc(x) {
  return String(x == null ? "" : x).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function setEstado(msg) { $("estadoGuardado").textContent = msg; }
function generosDe(p) { return String(p.genero || "").split(",").map(s => s.trim()).filter(Boolean); }
function temasDe(p) { return String(p.temas || "").split(";").map(s => s.trim()).filter(Boolean); }
function directoresDe(p) { return String(p.director || "").split(",").map(s => s.trim()).filter(Boolean); }
function personasDe(p) {
  return [...String(p.director || "").split(","), ...String(p.reparto || "").split(",")]
    .map(s => s.trim()).filter(Boolean);
}

function minutos(p) {
  const s = String(p.duracion || "");
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*min/);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

function enRangoDuracion(p, valor) {
  if (!valor) return true;
  const m = minutos(p);
  if (valor === "corta") return m > 0 && m < 90;
  if (valor === "media") return m >= 90 && m <= 120;
  if (valor === "larga") return m > 120;
  return true;
}

const ordenes = {
  titulo: (a, b) => String(a.titulo).localeCompare(String(b.titulo), "es"),
  recientes: (a, b) => (Number(b["año"]) || 0) - (Number(a["año"]) || 0),
  antiguas: (a, b) => (Number(a["año"]) || 0) - (Number(b["año"]) || 0),
  duracion: (a, b) => minutos(b) - minutos(a)
};

/* ---------- Secciones de inicio (ahorro a pregunta del día): se movieron a app-01c-inicio-secciones.js ---------- */
