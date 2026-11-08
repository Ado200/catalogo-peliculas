/* ===== Fase 0 · Utilidad «modoGuardado»: lectura segura de preferencias guardadas. Se carga antes que todos los módulos porque app-02 la usa al cargar. ===== */
function modoGuardado(clave, defecto) {
  try { return localStorage.getItem(clave) || defecto; } catch (e) { return defecto; }
}
