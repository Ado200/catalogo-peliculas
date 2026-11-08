/* ===== Fase 0 · Módulo «respaldo-marcas»: respaldo y restauración de tus marcas. Migrado de app-02 sin cambios de comportamiento. ===== */
/* ---------- Respaldo y restauración de marcas ---------- */
let ultimaSyncOk = null;
let syncReintentos = 0;   // reintentos seguidos por conflicto con Drive   // momento de la última sincronización correcta con Drive

function respaldarMarcas() {
  const datos = {
    formato: "catalogo-marcas",
    version: 1,
    fecha: new Date().toISOString(),
    marcas: Nucleo.datos.marcas()
  };
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "respaldo-catalogo-" + hoyLocalISO() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setEstado("Respaldo descargado: " + Object.keys(Nucleo.datos.marcas()).length + " películas con marcas.");
}

function validarRespaldo(texto) {
  let datos;
  try { datos = JSON.parse(texto); } catch (e) { return { error: "El archivo no es un JSON válido." }; }
  if (!datos || typeof datos !== "object") return { error: "El archivo no es un respaldo válido." };
  const esNuevo = datos.formato === "catalogo-marcas";
  const esViejo = datos.app === "catalogo-peliculas" || (!datos.formato && !datos.app);
  if (!esNuevo && !esViejo) return { error: "Este archivo no es un respaldo de marcas del catálogo." };
  if (datos.version !== undefined && datos.version !== 1) return { error: "Versión de respaldo no compatible." };
  if (!datos.marcas || typeof datos.marcas !== "object" || Array.isArray(datos.marcas)) return { error: "El respaldo no tiene marcas válidas." };
  return { marcas: datos.marcas };
}

async function restaurarMarcasDesdeArchivo(archivo) {
  let texto;
  try { texto = await archivo.text(); } catch (e) { setEstado("No pude leer el archivo."); return; }
  const res = validarRespaldo(texto);
  if (res.error) { setEstado(res.error); return; }

  const n = Object.keys(res.marcas).filter(k => !k.startsWith("__")).length;
  const ok = confirm("¿Reemplazar tus marcas actuales (" + Object.keys(Nucleo.datos.marcas()).filter(k => !k.startsWith("__")).length + ") por las de este respaldo (" + n + " películas)? Esto también reemplaza tus filtros guardados. Las marcas actuales se perderán.");
  if (!ok) { setEstado("Restauración cancelada."); return; }

  clearTimeout(guardadoTimer);
  marcas = envolverMarcas(res.marcas);
  syncPendiente = true; syncGuardarLocal();
  await guardarMarcasDrive();
  refrescarTodo();
  setEstado("Marcas restauradas: " + n + " películas.");
}

if (window.Nucleo) { Nucleo.registrar("respaldo-marcas", { version: "1.0", emite: [], escucha: [] }); }
