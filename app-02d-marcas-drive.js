/* ===== Fase 0 · Módulo «marcas-drive»: marcas personales guardadas en Drive. Migrado de app-02 sin cambios de comportamiento. ===== */
/* ---------- Marcas personales en Drive ---------- */
function marcasLocales() {
  try { return JSON.parse(localStorage.getItem("catalogo_estado") || "{}"); } catch (e) { return {}; }
}

async function driveFetch(url, opts = {}) {
  const headers = Object.assign({ Authorization: "Bearer " + accessToken }, opts.headers || {});
  const r = await fetch(url, Object.assign({}, opts, { headers }));
  if (!r.ok) throw new Error("Drive respondió " + r.status);
  return r;
}

function estadoDe(p) {
  const o = Nucleo.datos.marcas()[p.titulo] || {};
  return {
    vista: !!o.vista,
    pendiente: !!o.pendiente,
    estrellas: o.estrellas || 0,
    conAlguien: !!o.conAlguien
  };
}

function cambiarEstado(titulo, cambios) {
  const previo = Nucleo.datos.marcas()[titulo] || {};
  const nuevo = Object.assign({}, previo, cambios);
  if (cambios.vista === true) {
    if (previo.conAlguien && previo.conQuien) nuevo.vistaCon = previo.conQuien;
    else delete nuevo.vistaCon;
  }
  if (cambios.vista === false) delete nuevo.vistaCon;
  if (cambios.pendiente === true && !previo.pendiente) {
    nuevo.pendienteDesde = new Date().toISOString().slice(0, 10);
  }
  if (cambios.pendiente === false || (cambios.pendiente === undefined && !nuevo.pendiente)) {
    delete nuevo.pendienteDesde;
  }
  if (cambios.vista === true || cambios.descartada === true) {
    delete nuevo.conAlguien;
    delete nuevo.conQuien;
    delete nuevo.conAlguienDesde;
    delete nuevo.conFecha;
  }
  if (cambios.descartada === true && !previo.descartada) {
    nuevo.descartadaDesde = new Date().toISOString().slice(0, 10);
    delete nuevo.revisionHecha;
  }
  if (cambios.descartada === false) {
    delete nuevo.descartadaDesde;
    delete nuevo.revisionHecha;
  }
  const eventos = [];
  if (cambios.pendiente === true && !previo.pendiente) eventos.push("pendiente");
  if (cambios.vista === true && !previo.vista) eventos.push("vista");
  if (cambios.descartada === true && !previo.descartada) eventos.push("descartada");
  if (cambios.estrellas !== undefined && cambios.estrellas !== (previo.estrellas || 0)) {
    eventos.push(cambios.estrellas ? "calificada " + cambios.estrellas + "★" : "sin calificación");
  }
  if (eventos.length) {
    const hoyH = hoyLocalISO();
    nuevo.historial = (previo.historial || []).concat(eventos.map(a => ({ f: hoyH, a }))).slice(-30);
  }
  Nucleo.datos.marcas()[titulo] = nuevo;
  programarGuardado();
}

function alternarConAlguien(titulo) {
  const previo = Nucleo.datos.marcas()[titulo] || {};
  if (previo.conAlguien) {
    const nuevo = Object.assign({}, previo);
    delete nuevo.conAlguien;
    delete nuevo.conQuien;
    delete nuevo.conAlguienDesde;
    delete nuevo.conFecha;
    Nucleo.datos.marcas()[titulo] = nuevo;
    programarGuardado();
    setEstado("Quitada de «Para ver con alguien».");
    return;
  }
  const quien = prompt("¿Con quién la quieres ver? (opcional, puedes dejarlo vacío)", "");
  if (quien === null) return;
  const fecha = prompt("¿Qué día la quieren ver? (opcional, formato AAAA-MM-DD, por ejemplo 2026-11-15)", "");
  if (fecha === null) return;

  const nuevo = Object.assign({}, previo, {
    conAlguien: true,
    conAlguienDesde: new Date().toISOString().slice(0, 10)
  });
  const q = String(quien).trim();
  if (q) nuevo.conQuien = q; else delete nuevo.conQuien;

  const f = String(fecha).trim();
  let aviso = "";
  if (f) {
    if (fechaValida(f)) nuevo.conFecha = f;
    else aviso = " La fecha no era válida, así que se guardó sin fecha.";
  } else {
    delete nuevo.conFecha;
  }

  Nucleo.datos.marcas()[titulo] = nuevo;
  programarGuardado();
  if (!nuevo.pendiente) {
    setEstado("Marcada para ver con alguien." + aviso + " Si la quieres ver pronto, también puedes ponerla en pendientes.");
  } else {
    setEstado("Marcada para ver con alguien." + aviso);
  }
}

function cambiarFechaConAlguien(titulo) {
  const previo = Nucleo.datos.marcas()[titulo] || {};
  if (!previo.conAlguien) {
    setEstado("Primero marca la película como «Para ver con alguien».");
    return;
  }
  const txt = prompt("Fecha para verla (AAAA-MM-DD). Déjalo vacío para quitar la fecha.", previo.conFecha || "");
  if (txt === null) return;
  const f = String(txt).trim();
  const nuevo = Object.assign({}, previo);
  if (!f) {
    delete nuevo.conFecha;
    setEstado("Fecha quitada.");
  } else if (!fechaValida(f)) {
    setEstado("Fecha no válida. Usa el formato AAAA-MM-DD, por ejemplo 2026-11-15.");
    return;
  } else {
    nuevo.conFecha = f;
    setEstado("Fecha guardada: " + f + ".");
  }
  Nucleo.datos.marcas()[titulo] = nuevo;
  programarGuardado();
}

function guardarNota(titulo, texto) {
  const t = String(texto || "").trim();
  const nuevo = Object.assign({}, Nucleo.datos.marcas()[titulo] || {});
  if (t) {
    nuevo.nota = t;
    nuevo.notaFecha = new Date().toISOString().slice(0, 10);
  } else {
    delete nuevo.nota;
    delete nuevo.notaFecha;
  }
  Nucleo.datos.marcas()[titulo] = nuevo;
  programarGuardado();
}

function borrarNota() {
  if (!detalleActual) return;
  const ok = confirm("¿Borrar tu nota de esta película? No se puede deshacer.");
  if (!ok) return;
  guardarNota(detalleActual.titulo, "");
  setEstado("Nota borrada");
  abrirDetalle(detalleActual);
}

if (window.Nucleo) { Nucleo.registrar("marcas-drive", { version: "1.0", emite: [], escucha: [] }); }
