/* ===== Fase 6 · Módulo «migraciones» (actualizar la forma de guardar tus datos sin perderlos) =====
   Tus marcas se guardan con clave "marcas_v6_<id>": el formato actual es la versión 6.
   Al cambiar el formato, se añade una migración de una versión a la siguiente. Antes de migrar, se copian
   las marcas en "respaldo_migracion". Las migraciones corren una sola vez, en orden, antes de leer los datos.
   Hoy no hay ninguna migración: el formato no ha cambiado. ===== */
(function () {
  const VERSION_ACTUAL = 6;
  const CLAVE_VERSION = "esquema_datos";
  const PREFIJO_MARCAS = "marcas_v";
  const CLAVE_RESPALDO = "respaldo_migracion";

  // Cada migración pasa de la versión "de" a la versión "a". Se añaden al final, en orden.
  // Ejemplo (no activo): { de: 6, a: 7, migrar: marcas => marcas }
  const MIGRACIONES = [];

  const versionGuardada = () => {
    try { const v = parseInt(localStorage.getItem(CLAVE_VERSION), 10); return isNaN(v) ? VERSION_ACTUAL : v; }
    catch (e) { return VERSION_ACTUAL; }
  };

  function copiarRespaldo(versionDesde) {
    const copia = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIJO_MARCAS)) copia[k] = localStorage.getItem(k);
    }
    localStorage.setItem(CLAVE_RESPALDO, JSON.stringify({ version: versionDesde, fecha: new Date().toISOString(), datos: copia }));
  }

  function migrar() {
    let v = versionGuardada();
    const hayPendientes = MIGRACIONES.some(m => m.de >= v && m.a > v);
    if (!hayPendientes) {
      try { localStorage.setItem(CLAVE_VERSION, String(Math.max(v, VERSION_ACTUAL))); } catch (e) {}
      return { aplicadas: 0, version: Math.max(v, VERSION_ACTUAL) };
    }
    copiarRespaldo(v);
    let aplicadas = 0;
    for (const m of MIGRACIONES.filter(x => x.de >= v && x.a > v).sort((a, b) => a.de - b.de)) {
      if (m.de !== v) break;                                   // falta un paso: no seguir a ciegas
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(PREFIJO_MARCAS + m.de + "_")) continue;
        const datos = JSON.parse(localStorage.getItem(k));
        const nuevo = m.migrar(datos);
        localStorage.setItem(k.replace(PREFIJO_MARCAS + m.de + "_", PREFIJO_MARCAS + m.a + "_"), JSON.stringify(nuevo));
      }
      v = m.a;
      aplicadas++;
    }
    localStorage.setItem(CLAVE_VERSION, String(v));
    return { aplicadas, version: v };
  }

  // Corre antes de que la app lea los datos. Nunca detiene la app: si algo falla, se deja el respaldo.
  let resultado = null;
  try { resultado = migrar(); } catch (e) { resultado = { error: String(e && e.message || e) }; }

  if (window.Nucleo) {
    Nucleo.migraciones = { version: () => versionGuardada(), resultado: () => resultado, lista: () => MIGRACIONES.slice() };
    Nucleo.registrar("migraciones", { version: "1.0", emite: [], escucha: [] });
  }
})();
