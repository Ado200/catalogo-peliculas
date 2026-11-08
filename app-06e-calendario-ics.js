/* ===== Fase 5 · Módulo «calendario-ics» (exportar planes a un calendario, con actualizaciones) =====
   Cada película con fecha de plan se exporta como un evento de día completo (.ics). Mejoras de esta versión:
   - Identificador fijo por película: al cambiar la fecha, el calendario actualiza el mismo evento.
   - Número de secuencia (SEQUENCE): cada cambio sube la versión, y el calendario reemplaza la anterior.
   - Planes quitados: se exportan como CANCELLED, para que el calendario que ya los importó los elimine.
   La app recuerda lo último que exportó, en este dispositivo. Acceso: Yo → Exportar planes al calendario. ===== */
(function () {
  const CLAVE_MAPA = "cal_exportados";

  const escICS = s => String(s).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\r?\n/g, "\\n");
  const dosDigitos = n => String(n).padStart(2, "0");
  const fechaICS = d => d.getUTCFullYear() + dosDigitos(d.getUTCMonth() + 1) + dosDigitos(d.getUTCDate());
  const selloUTC = () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  // Identificador fijo por película (no depende de la fecha ni de tildes)
  function uidDe(titulo) {
    const base = titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "").toLowerCase().slice(0, 60);
    return "plan-" + base + "@catalogo-peliculas";
  }

  function planes() {
    const salida = [];
    Object.keys(Nucleo.datos.marcas() || {}).forEach(titulo => {
      if (titulo.startsWith("__")) return;
      const fecha = (Nucleo.datos.marcas()[titulo] || {}).conFecha;
      if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
      if (typeof fechaValida === "function" && !fechaValida(fecha)) return;
      salida.push({ titulo, fecha });
    });
    return salida.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  function mapaGuardado() {
    try { return JSON.parse(localStorage.getItem(CLAVE_MAPA) || "{}"); } catch (e) { return {}; }
  }
  function guardarMapa(m) {
    try { localStorage.setItem(CLAVE_MAPA, JSON.stringify(m)); } catch (e) {}
  }

  // Une lo actual con lo exportado antes: calcula la secuencia de cada evento y detecta cancelaciones
  function eventosDeHoy() {
    const mapa = mapaGuardado();
    const actuales = planes();
    const vistos = new Set();
    const eventos = [];
    actuales.forEach(p => {
      vistos.add(p.titulo);
      const prev = mapa[p.titulo];
      let seq = 0;
      if (prev) seq = (prev.fecha === p.fecha && !prev.cancelado) ? prev.seq : prev.seq + 1;
      mapa[p.titulo] = { fecha: p.fecha, seq, cancelado: false };
      eventos.push({ titulo: p.titulo, fecha: p.fecha, seq, cancelado: false });
    });
    Object.keys(mapa).forEach(t => {
      if (vistos.has(t)) return;
      if (mapa[t].cancelado) {                                       // cancelación reciente: se repite 30 días para que el calendario la reciba
        if (Date.now() - (mapa[t].cancelladoEn || 0) < 30 * 86400000) eventos.push({ titulo: t, fecha: mapa[t].fecha, seq: mapa[t].seq, cancelado: true });
        return;
      }
      mapa[t].cancelado = true;
      mapa[t].seq += 1;
      mapa[t].cancelladoEn = Date.now();
      eventos.push({ titulo: t, fecha: mapa[t].fecha, seq: mapa[t].seq, cancelado: true });
    });
    return { eventos, mapa, planesActivos: actuales.length, cancelados: eventos.filter(e => e.cancelado).length };
  }

  function construir(eventos) {
    const sello = selloUTC();
    const lineas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Catálogo de películas//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    eventos.forEach(e => {
      const [y, m, d] = e.fecha.split("-").map(Number);
      const inicio = new Date(Date.UTC(y, m - 1, d));
      const fin = new Date(Date.UTC(y, m - 1, d + 1));
      lineas.push("BEGIN:VEVENT",
        "UID:" + uidDe(e.titulo),
        "DTSTAMP:" + sello,
        "LAST-MODIFIED:" + sello,
        "SEQUENCE:" + e.seq,
        "DTSTART;VALUE=DATE:" + fechaICS(inicio),
        "DTEND;VALUE=DATE:" + fechaICS(fin),
        "SUMMARY:" + escICS((e.cancelado ? "Cancelado: " : "Ver: ") + e.titulo),
        "STATUS:" + (e.cancelado ? "CANCELLED" : "CONFIRMED"),
        "TRANSP:TRANSPARENT",
        "END:VEVENT");
    });
    lineas.push("END:VCALENDAR");
    return lineas.join("\r\n") + "\r\n";
  }

  function exportar() {
    const { eventos, mapa, planesActivos, cancelados } = eventosDeHoy();
    if (!eventos.length) {
      if (typeof avisar === "function") avisar("No tienes películas con fecha de plan todavía.");
      return;
    }
    guardarMapa(mapa);
    const blob = new Blob([construir(eventos)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "planes-catalogo.ics";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (typeof avisar === "function") {
      avisar("Exportado: " + planesActivos + " planes" + (cancelados ? " y " + cancelados + " cancelados" : "") + ". Importa el archivo en tu calendario.");
    }
  }

  if (window.Nucleo) {
    Nucleo.calendario = { exportar: exportar, planes: planes, eventosDeHoy: eventosDeHoy };
    Nucleo.registrar("calendario-ics", { version: "2.0", emite: [], escucha: [] });
  }
})();
