/* ===== Fase 3 · Módulo «reglas» (motor, pantalla y exportación) =====
   Reglas del tipo «cuando pasa esto, muestra aquello». Se evalúan al abrir la app (con sesión) y cuando
   cambian tus marcas. No corren en segundo plano. Cada regla avisa como mucho una vez al día.
   Desde Yo → Reglas automáticas puedes verlas, apagarlas y exportar su estado a un archivo. */
(function () {
  const CLAVE_DIA = "regla_ultimo_aviso_";
  const CLAVE_ACTIVA = "regla_activa_";

  const REGLAS = [
    {
      id: "viernes-tarde",
      nombre: "Viernes por la tarde",
      descripcion: "Los viernes entre 17:00 y 21:00 te sugiere una película para ver acompañado.",
      cuando: ahora => ahora.getDay() === 5 && ahora.getHours() >= 17 && ahora.getHours() < 21,
      entonces: () => avisar("Viernes por la tarde: ¿una película para ver acompañado? Revisa «Planes» o «Vistas».")
    }
  ];

  const fechaLocal = ahora => ahora.getFullYear() + "-" + String(ahora.getMonth() + 1).padStart(2, "0") + "-" + String(ahora.getDate()).padStart(2, "0");

  function activa(regla) {
    try { return localStorage.getItem(CLAVE_ACTIVA + regla.id) !== "no"; } catch (e) { return true; }
  }
  function fijarActiva(regla, on) {
    try { localStorage.setItem(CLAVE_ACTIVA + regla.id, on ? "si" : "no"); } catch (e) {}
  }
  function yaAvisadaHoy(regla, ahora) {
    try { return localStorage.getItem(CLAVE_DIA + regla.id) === fechaLocal(ahora); } catch (e) { return false; }
  }
  function marcarAvisada(regla, ahora) {
    try { localStorage.setItem(CLAVE_DIA + regla.id, fechaLocal(ahora)); } catch (e) {}
  }

  function evaluar() {
    if (!document.body.classList.contains("con-sesion")) return;     // nunca antes de iniciar sesión
    const ahora = new Date();
    REGLAS.forEach(regla => {
      if (!activa(regla)) return;                                     // apagada por la persona
      if (yaAvisadaHoy(regla, ahora)) return;
      let cumple = false;
      try { cumple = regla.cuando(ahora); } catch (e) { return; }     // una regla rota no detiene a las demás
      if (!cumple) return;
      try { regla.entonces(); marcarAvisada(regla, ahora); } catch (e) {}
    });
  }

  function exportarEstado() {
    const datos = {
      formato: "reglas-automaticas",
      version: 1,
      exportado: new Date().toISOString(),
      reglas: REGLAS.map(r => ({ id: r.id, nombre: r.nombre, activa: activa(r) }))
    };
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "reglas-automaticas.json";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function abrirPantalla() {
    const filas = REGLAS.map(r =>
      '<li class="regla-fila"><label class="ajuste-switch"><input type="checkbox" data-regla="' + esc(r.id) + '"' +
      (activa(r) ? ' checked' : '') + '> <strong>' + esc(r.nombre) + '</strong></label>' +
      '<small class="meta">' + esc(r.descripcion) + '</small></li>'
    ).join("");
    const cuerpo = '<p class="meta">Las reglas avisan como mucho una vez al día, y solo cuando usas la app.</p>' +
      '<ul class="reglas-lista">' + filas + '</ul>' +
      '<button type="button" class="pildora" data-exportar-reglas>⬇ Exportar reglas (archivo)</button>';
    abrirVentanaSimple("reglas", "Reglas automáticas", cuerpo);
    const ventana = document.getElementById("reglas");
    if (!ventana) return;
    ventana.addEventListener("change", e => {
      const cb = e.target.closest && e.target.closest("input[data-regla]");
      if (!cb) return;
      const regla = REGLAS.find(r => r.id === cb.dataset.regla);
      if (regla) fijarActiva(regla, cb.checked);
    });
    ventana.addEventListener("click", e => {
      if (e.target.closest && e.target.closest("[data-exportar-reglas]")) exportarEstado();
    });
  }

  if (window.Nucleo) {
    Nucleo.reglas = {
      lista: () => REGLAS.map(r => ({ id: r.id, nombre: r.nombre, descripcion: r.descripcion, activa: activa(r) })),
      evaluar: evaluar,
      abrir: abrirPantalla,
      exportar: exportarEstado
    };
    Nucleo.on("marcas:cambiadas", evaluar, "reglas");
    Nucleo.registrar("reglas", { version: "1.2", emite: [], escucha: ["marcas:cambiadas"] });
  }
  setTimeout(evaluar, 4000);
})();
