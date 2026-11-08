/* ===== Fase 5 · Módulo «atajos-enlaces»: abrir la app directamente en una acción =====
   Enlaces que abren la app en una acción concreta, por ejemplo:
     https://TU-SITIO/?accion=noche    → «Elegir para esta noche»
     https://TU-SITIO/?accion=planes   → pestaña Planes
   Solo acepta estas dos acciones. Quita el parámetro de la dirección para que no se repita al recargar. ===== */
(function () {
  const acciones = {
    noche: () => { const b = document.getElementById("queVerNoche"); if (b) b.click(); },
    planes: () => { if (typeof cambiarPestana === "function") cambiarPestana("pendientes"); }
  };
  const accion = new URLSearchParams(location.search).get("accion");
  if (!accion || !acciones[accion]) return;

  try {
    const url = new URL(location.href);
    url.searchParams.delete("accion");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch (e) {}

  let intentos = 0;
  const esperar = () => {
    if (document.body.classList.contains("con-sesion") && typeof peliculas !== "undefined" && Nucleo.datos.peliculas().length) {
      acciones[accion]();
      return;
    }
    if (++intentos < 60) setTimeout(esperar, 500);                   // hasta unos 30 segundos
  };
  setTimeout(esperar, 1500);

  if (window.Nucleo) Nucleo.registrar("atajos-enlaces", { version: "1.0", emite: [], escucha: [] });
})();
