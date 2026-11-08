/* ===== Fase 6 · Módulo «diagnostico-completo» (revisión de toda la app en una pantalla) =====
   Revisa: datos (catálogo y marcas), módulos y errores, reglas, sincronización con Google,
   versión de los datos y conexión. Cada punto muestra ✓ si está bien o ⚠ si conviene revisarlo.
   Acceso: Yo → Diagnóstico completo. Solo lee; no cambia nada. ===== */
(function () {
  const fila = (ok, titulo, valor, nota) =>
    '<li class="dg-fila"><span>' + (ok ? '<b class="dg-ok">✓</b> ' : '<b class="dg-warn">⚠</b> ') + esc(titulo) +
    (nota ? '<small class="dg-nota">' + esc(nota) + '</small>' : '') + '</span><b>' + esc(String(valor)) + '</b></li>';

  function titulo(s) { return '<h4>' + esc(s) + '</h4>'; }

  function construirHtml() {
    const partes = [];
    const peliculasLista = typeof peliculas !== "undefined" ? Nucleo.datos.peliculas() : [];
    const marcasObj = typeof marcas !== "undefined" ? Nucleo.datos.marcas() : {};

    // 1) Datos
    const titulos = new Set(peliculasLista.map(p => p.titulo));
    const claves = Object.keys(marcasObj).filter(k => !k.startsWith("__"));
    const sinPelicula = claves.filter(k => !titulos.has(k)).length;
    partes.push(titulo("Datos"));
    partes.push('<ul class="dg-lista">' +
      fila(peliculasLista.length > 0, "Películas en tu catálogo", peliculasLista.length, peliculasLista.length ? "" : "No se cargó el catálogo. Recarga la página o revisa la conexión.") +
      fila(sinPelicula === 0, "Marcas de películas que ya no están en el catálogo", sinPelicula, sinPelicula ? "No afectan lo que ves. Puedes ignorarlo." : "") +
      fila(true, "Películas con marcas", claves.length) +
      '</ul>');

    // 2) Módulos y errores
    const diag = window.Nucleo && Nucleo.diagnostico ? Nucleo.diagnostico() : { modulos: [], errores: [] };
    const apagados = diag.modulos.filter(m => !m.activo).map(m => m.nombre);
    partes.push(titulo("Módulos"));
    partes.push('<ul class="dg-lista">' +
      fila(diag.modulos.length > 0, "Módulos registrados", diag.modulos.length) +
      fila(apagados.length === 0, "Módulos apagados", apagados.length ? apagados.join(", ") : "ninguno", apagados.length ? "Puedes volver a encenderlos en Ajustes." : "") +
      fila(diag.errores.length === 0, "Errores registrados desde que abriste la app", diag.errores.length,
        diag.errores.length ? "Último: " + diag.errores[diag.errores.length - 1].origen + ". Si se repite, pégalo al pedir ayuda." : "") +
      '</ul>');

    // 3) Reglas
    const reglas = window.Nucleo && Nucleo.reglas ? Nucleo.reglas.lista() : [];
    const reglasOn = reglas.filter(r => r.activa).length;
    partes.push(titulo("Reglas automáticas"));
    partes.push('<ul class="dg-lista">' + fila(reglas.length > 0, "Reglas disponibles", reglas.length) +
      fila(true, "Reglas activas", reglasOn + " de " + reglas.length) + '</ul>');

    // 4) Sincronización con Google Calendar
    let googleOn = false, eventosGoogle = 0;
    try { googleOn = localStorage.getItem("cal_google_on") === "si"; } catch (e) {}
    try { eventosGoogle = Object.keys(JSON.parse(localStorage.getItem("cal_google_map") || "{}")).length; } catch (e) {}
    const sinToken = typeof accessToken === "undefined" || !accessToken;
    partes.push(titulo("Google Calendar"));
    partes.push('<ul class="dg-lista">' +
      fila(!googleOn || !sinToken, "Sincronización", googleOn ? "activada" : "desactivada",
        googleOn && sinToken ? "Está activada, pero no hay sesión. Vuelve a conectar tu cuenta." : "") +
      fila(true, "Planes sincronizados con Google", eventosGoogle) +
      '</ul>');

    // 5) Versión de datos y conexión
    const version = window.Nucleo && Nucleo.migraciones ? Nucleo.migraciones.version() : "?";
    const enLinea = navigator.onLine !== false;
    partes.push(titulo("Sistema"));
    partes.push('<ul class="dg-lista">' +
      fila(version === 6 || version >= 6, "Versión de tus datos", version, "Se actualiza sola cuando cambia el formato.") +
      fila(enLinea, "Conexión", enLinea ? "en línea" : "sin señal", enLinea ? "" : "Puedes seguir usando la app; los cambios se envían al volver la conexión.") +
      '</ul>');

    return partes.join("");
  }

  function abrir() {
    abrirVentanaSimple("diagnostico-completo", "Diagnóstico completo", construirHtml());
  }

  if (window.Nucleo) {
    Nucleo.diagnosticoCompleto = { abrir: abrir, html: construirHtml };
    Nucleo.registrar("diagnostico-completo", { version: "1.0", emite: [], escucha: [] });
  }
})();
