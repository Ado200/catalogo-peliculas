/* ===== Fase 0 · Módulo «busqueda»: búsqueda con tolerancia a errores y sugerencias ===== */
/* Migrado de app-03 sin cambiar el comportamiento. Mantiene los mismos nombres globales.
   Se registra en el núcleo (app-00-nucleo.js). */
// Búsqueda: «género: Terror» o «año: 2026» filtran; cualquier otro texto busca como antes
function coincideBusqueda(p, f) {
  const g = norm(f).trim();
  const gen = g.match(/^genero:\s*(.+)$/);
  if (gen) return generosDe(p).some(x => norm(x) === gen[1].trim());
  const anio = g.match(/^ano:\s*(\d{4})$/);
  if (anio) return String(p["año"]) === anio[1];
  const m = Nucleo.datos.marcas()[p.titulo] || {};
  // Sin acentos ni mayúsculas, y cada palabra debe aparecer (con tolerancia a una o dos letras mal escritas)
  const texto = norm([p.titulo, p.director, p.reparto, p.genero, m.nota || "", m.conQuien || ""].join(" "));
  const tokens = texto.split(/[^a-z0-9]+/).filter(Boolean);
  const palabras = g.split(/\s+/).filter(Boolean);
  if (!palabras.length) return true;
  return palabras.every(w => {
    if (texto.includes(w)) return true;
    if (!busquedaActiva() || w.length < 4) return false;   // apagado: sin tolerancia a errores
    const tolerancia = w.length >= 7 ? 2 : 1;
    return tokens.some(t => Math.abs(t.length - w.length) <= tolerancia && distanciaEdicion(w, t) <= tolerancia);
  });
}

// Distancia de Levenshtein: cuántas letras hay que cambiar para pasar de una palabra a otra
// Cuenta también el intercambio de dos letras vecinas como un solo error (amelei -> amelie)
function distanciaEdicion(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 0; j <= b.length; j++) { d[0][j] = j; }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function llenarSugerencias() {
  if (!busquedaActiva()) { $("sugerencias").innerHTML = ""; return; }
  const nombres = new Set();
  Nucleo.datos.peliculas().forEach(p => {
    nombres.add(p.titulo);
    personasDe(p).forEach(n => nombres.add(n));
  });
  const dl = $("sugerencias");
  const extras = [];
  [...new Set(Nucleo.datos.peliculas().flatMap(generosDe))].sort((a, b) => a.localeCompare(b, "es"))
    .forEach(g => extras.push("género: " + g));
  [...new Set(Nucleo.datos.peliculas().map(p => String(p["año"] || "")).filter(Boolean))].sort((a, b) => b.localeCompare(a))
    .forEach(a => extras.push("año: " + a));
  dl.innerHTML = extras.map(x => '<option value="' + esc(x) + '"></option>').join("") +
    [...nombres].sort((a, b) => a.localeCompare(b, "es"))
    .map(n => '<option value="' + esc(n) + '"></option>').join("");
}

if (window.Nucleo) {
  Nucleo.registrar("busqueda", { version: "1.0", emite: [], escucha: [] });
}

// El módulo se puede apagar desde Ajustes (modulo_busqueda = "no")
function busquedaActiva() { return !window.Nucleo || Nucleo.activo("busqueda"); }

// Interruptor de Ajustes y reacción inmediata al cambiar
if (window.Nucleo) {
  const interruptor = document.getElementById("moduloBusquedaOn");
  if (interruptor) {
    interruptor.checked = busquedaActiva();
    interruptor.addEventListener("change", () => Nucleo.activar("busqueda", interruptor.checked));
  }
  Nucleo.on("modulo:cambiado", d => {
    if (!d || d.nombre !== "busqueda") return;
    llenarSugerencias();
    if (typeof pintar === "function") pintar();
  });
}
