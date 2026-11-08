/* ===== Fase C · «Hoy»: una sola tarjeta que se adapta a la hora (sin pestañas) ===== */
(function () {
  const w = document.getElementById("queVer");
  if (!w) return;

  // Encabezado único: título que cambia con la vista y un botón para ver la otra opción
  const cab = document.createElement("div");
  cab.className = "hoy-cab";
  cab.innerHTML =
    '<span class="hoy-etiqueta" id="hoyEtiqueta"></span>' +
    '<button type="button" class="hoy-cambiar" id="hoyCambiar"></button>';
  w.prepend(cab);

  // Vista inicial según la hora (la persona puede cambiarla y la elección se conserva en la sesión)
  const h = new Date().getHours();
  if (typeof verActual !== "undefined" && !window.__hoyElegido) {
    verActual = (h >= 18 || h < 5) ? "noche" : "ahora";
  }

  function pintarEncabezado() {
    const noche = w.classList.contains("solo-noche");
    const etq = document.getElementById("hoyEtiqueta");
    const nuevaEtq = noche ? "Esta noche" : "Para esta hora";
    if (etq.textContent !== nuevaEtq) etq.textContent = nuevaEtq;
    const otra = document.getElementById("hoyCambiar");
    const ahoraDisponible = document.getElementById("ahora").style.display !== "none";
    const nocheDisponible = document.getElementById("cena").style.display !== "none";
    const nuevoTexto = noche ? "Ver la de ahora" : "Ver la de la noche";
    if (otra.textContent !== nuevoTexto) otra.textContent = nuevoTexto;
    const mostrar = (ahoraDisponible && nocheDisponible) ? "" : "none";
    if (otra.style.display !== mostrar) otra.style.display = mostrar;   // solo escribe si cambia: sin bucles
  }

  document.getElementById("hoyCambiar").addEventListener("click", () => {
    verActual = verActual === "noche" ? "ahora" : "noche";
    window.__hoyElegido = true;
    ajustarQueVer();
  });

  // Se actualiza sola cuando cambian las vistas, sin que tengas que tocar nada
  new MutationObserver(pintarEncabezado).observe(w, { attributes: true, attributeFilter: ["class", "style"], subtree: true, attributeOldValue: false });
  ajustarQueVer();
  pintarEncabezado();
})();

/* Fase 0 · Registro del módulo «hoy» en el núcleo (el código de arriba no cambia) */
if (window.Nucleo) {
  Nucleo.registrar("hoy", { version: "1.0", emite: [], escucha: [] });
}
