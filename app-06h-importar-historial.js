/* ===== Fase 5 · Módulo «importar-historial» (importar tu historial de Letterboxd o Trakt) =====
   Formatos: CSV de Letterboxd (watched.csv y ratings.csv) y JSON de Trakt.
   Coincidencia: título normalizado y año. Si no coincide el año, no se importa.
   No pisa datos: una película ya vista se conserva, y una calificación existente no cambia.
   Letterboxd usa medias estrellas (0.5 a 5): se redondean a estrellas enteras.
   Acceso: Yo → Importar historial. ===== */
(function () {
  // ---- lectura de formatos ----
  function csvFilas(texto) {
    const filas = [];
    let fila = [], campo = "", comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (comillas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') comillas = false;
        else campo += c;
      } else if (c === '"') comillas = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        fila.push(campo); filas.push(fila); fila = []; campo = "";
      } else campo += c;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    return filas.filter(f => f.some(x => x.trim() !== ""));
  }

  // Devuelve [{ titulo, anio, estrellas }] desde CSV de Letterboxd (watched o ratings) o JSON de Trakt
  function leerArchivo(texto) {
    const t = texto.trim();
    if (t.startsWith("[") || t.startsWith("{")) {
      const datos = JSON.parse(t);
      const lista = Array.isArray(datos) ? datos : (datos.movies || datos.watched || []);
      return lista.map(e => {
        const peli = e.movie || e;
        const estrellas = typeof e.rating === "number" ? Math.max(1, Math.min(5, Math.round(e.rating / 2))) : null;   // Trakt: 1 a 10
        return { titulo: String(peli.title || "").trim(), anio: peli.year ? String(peli.year) : "", estrellas };
      }).filter(e => e.titulo);
    }
    const filas = csvFilas(t);
    if (!filas.length) return [];
    const cab = filas[0].map(x => x.trim().toLowerCase());
    const iNombre = cab.indexOf("name"), iAnio = cab.indexOf("year"), iRating = cab.indexOf("rating");
    if (iNombre < 0) throw new Error("El CSV no tiene la columna Name.");
    return filas.slice(1).map(f => {
      const r = iRating >= 0 ? parseFloat(f[iRating]) : NaN;
      return {
        titulo: String(f[iNombre] || "").trim(),
        anio: iAnio >= 0 ? String(f[iAnio] || "").trim() : "",
        estrellas: isNaN(r) ? null : Math.max(1, Math.min(5, Math.round(r)))
      };
    }).filter(e => e.titulo);
  }

  // ---- coincidencia con el catálogo ----
  function buscar(entrada) {
    const n = norm(entrada.titulo);
    const candidatas = Nucleo.datos.peliculas().filter(p => norm(p.titulo) === n);
    if (!candidatas.length) return null;
    if (entrada.anio) {
      const conAnio = candidatas.find(p => String(p["año"] || "") === entrada.anio);
      return conAnio || null;
    }
    return candidatas.length === 1 ? candidatas[0] : null;
  }

  // ---- aplicar ----
  function importar(entradas) {
    const r = { vistas: 0, calificadas: 0, noEncontradas: 0, yaVistas: 0 };
    entradas.forEach(e => {
      const p = buscar(e);
      if (!p) { r.noEncontradas++; return; }
      const m = Nucleo.datos.marcas()[p.titulo] || {};
      if (!m.vista) { cambiarEstado(p.titulo, { vista: true }); r.vistas++; }
      else r.yaVistas++;
      if (e.estrellas && !(Nucleo.datos.marcas()[p.titulo] || {}).estrellas) {
        cambiarEstado(p.titulo, { estrellas: e.estrellas });
        r.calificadas++;
      }
    });
    return r;
  }

  function resumen(r, total) {
    return "Historial importado: " + r.vistas + " vistas nuevas, " + r.calificadas + " calificaciones, " +
      r.yaVistas + " ya estaban vistas, " + r.noEncontradas + " no encontradas en tu catálogo (de " + total + ").";
  }

  function abrirImportar() {
    const cuerpo =
      '<p class="meta">Elige el archivo: <strong>watched.csv</strong> o <strong>ratings.csv</strong> de Letterboxd, o el JSON del historial de Trakt.</p>' +
      '<input type="file" accept=".csv,.json,application/json,text/csv" data-importar-archivo>' +
      '<p class="meta">Solo se marcan como vistas las películas que están en tu catálogo, y no se cambia lo que ya tienes.</p>';
    abrirVentanaSimple("importar", "Importar historial", cuerpo);
    const ventana = document.getElementById("importar");
    if (!ventana) return;
    ventana.addEventListener("change", e => {
      const input = e.target.closest && e.target.closest("input[data-importar-archivo]");
      if (!input || !input.files || !input.files[0]) return;
      const lector = new FileReader();
      lector.onload = () => {
        try {
          const entradas = leerArchivo(String(lector.result));
          if (!entradas.length) { avisar("El archivo no tiene películas que importar."); return; }
          const r = importar(entradas);
          avisar(resumen(r, entradas.length));
          ventana.remove();
        } catch (err) {
          avisar("No pude leer el archivo: " + (err.message || "formato no reconocido") + ".");
        }
      };
      lector.readAsText(input.files[0]);
    });
  }

  if (window.Nucleo) {
    Nucleo.importar = { abrir: abrirImportar, leer: leerArchivo, aplicar: importar };
    Nucleo.registrar("importar-historial", { version: "1.0", emite: [], escucha: [] });
  }
})();
