/* ===== Fase 6 · Módulo «novedades» (registro de cambios dentro de la app) =====
   Lista de cambios por fase, lo más reciente primero. Se abre desde Yo → Novedades.
   Al haber novedades que no has visto, avisa una sola vez en el dispositivo.
   Para añadir una entrega nueva: agrega un objeto al principio de NOVEDADES, con un id nuevo. ===== */
(function () {
  const NOVEDADES = [
    { id: "fase-5", titulo: "Ecosistema", items: [
      "Calendario: los planes se sincronizan con Google Calendar en los dos sentidos (opcional, desde Yo).",
      "Enlaces directos: ?accion=noche abre «Elegir para esta noche»; ?accion=planes abre Planes.",
      "Importación de tu historial de Letterboxd (CSV) y Trakt (JSON).",
      "Compartir una recomendación con su razón (con la hoja del teléfono o copiada)."
    ] },
    { id: "fase-4", titulo: "Inteligencia y adaptación", items: [
      "«Otra» recuerda lo que rechazaste: en Ahora y en Cena, durante 7 días.",
      "«No me interesa» por director, género o actor, con lista para volver a mostrarlos."
    ] },
    { id: "fase-3", titulo: "Reglas automáticas", items: [
      "Reglas que avisan cuando pasa algo (por ejemplo, un viernes por la tarde).",
      "Puedes apagar cada regla, y exportar su estado a un archivo."
    ] },
    { id: "fase-2", titulo: "Navegación nueva", items: [
      "Barra de cinco secciones: Inicio, Películas, Planes, Vistas y Yo.",
      "Pendientes se llama ahora Planes. Yo reúne estadísticas, ajustes, diagnóstico, respaldo y guía."
    ] },
    { id: "fase-1", titulo: "Diseño y accesibilidad", items: [
      "Alto contraste y tamaño del texto, desde Ajustes.",
      "El alto contraste tiene prioridad sobre el modo premiere."
    ] },
    { id: "fase-0", titulo: "Base modular", items: [
      "La app está organizada en módulos, con interruptores en Ajustes para tema, búsqueda, curiosidades y más."
    ] }
  ];

  const CLAVE_VISTA = "novedades_vista";
  const ultima = () => NOVEDADES[0].id;
  const vista = () => { try { return localStorage.getItem(CLAVE_VISTA); } catch (e) { return null; } };
  const marcarVista = () => { try { localStorage.setItem(CLAVE_VISTA, ultima()); } catch (e) {} };

  function abrir() {
    const cuerpo = NOVEDADES.map(n =>
      '<h4>' + esc(n.titulo) + '</h4><ul class="reglas-lista">' +
      n.items.map(i => '<li>' + esc(i) + '</li>').join("") + '</ul>'
    ).join("");
    abrirVentanaSimple("novedades", "Novedades", cuerpo);
    marcarVista();
  }

  // Aviso único al abrir la app, si hay novedades que no has visto
  function avisarSiHayNovedades() {
    if (!document.body.classList.contains("con-sesion")) return;
    if (vista() === ultima()) return;
    if (typeof avisar === "function") avisar("Hay novedades en la app: abre Yo → Novedades.");
    try { localStorage.setItem(CLAVE_VISTA, ultima()); } catch (e) {}
  }

  if (window.Nucleo) {
    Nucleo.novedades = { abrir: abrir, lista: () => NOVEDADES.slice(), ultima: ultima };
    Nucleo.registrar("novedades", { version: "1.0", emite: [], escucha: [] });
  }
  setTimeout(avisarSiHayNovedades, 6000);
})();
