/* ===== Fase 0 · Núcleo: estado único y bus de eventos ===== */
/* Se carga ANTES que los demás app-XX. No cambia nada visible: las variables globales
   actuales siguen funcionando; este núcleo las refleja y ofrece un canal común. */
(function () {
  const escuchas = {};          // evento -> [{ fn, modulo }]
  const modulos = {};           // nombre -> { version, escucha, emite, activo }
  const estado = {};            // clave -> valor (espejo de lo que ya guardan las variables)
  const errores = [];           // registro de fallos aislados
  const MAX_ERRORES = 50;

  function registrarError(origen, e) {
    errores.push({ origen: origen, mensaje: String((e && e.message) || e), hora: Date.now() });
    if (errores.length > MAX_ERRORES) errores.shift();
    console.warn("[Núcleo] " + origen + ": " + ((e && e.message) || e));
  }

  // Un módulo apagado desde Ajustes no recibe eventos. Se apaga con localStorage "modulo_<nombre>" = "no".
  function activo(nombre) {
    if (!modulos[nombre]) return false;
    try { return localStorage.getItem("modulo_" + nombre) !== "no"; } catch (e) { return true; }
  }

  const Nucleo = {
    // Suscribirse a un evento. Devuelve una función para cancelar la suscripción.
    on(evento, fn, nombreModulo) {
      (escuchas[evento] = escuchas[evento] || []).push({ fn: fn, modulo: nombreModulo || null });
      return function () {
        escuchas[evento] = (escuchas[evento] || []).filter(x => x.fn !== fn);
      };
    },

    // Emitir un hecho. Un error en un oyente no impide que avisen los demás.
    emit(evento, datos) {
      (escuchas[evento] || []).slice().forEach(x => {
        if (x.modulo && !activo(x.modulo)) return;
        try { x.fn(datos); } catch (e) { registrarError(evento + (x.modulo ? " (" + x.modulo + ")" : ""), e); }
      });
    },

    // Estado compartido. Cada cambio avisa con el evento "estado:<clave>".
    set(clave, valor) {
      if (estado[clave] === valor) return;          // sin cambios: no avisa
      estado[clave] = valor;
      this.emit("estado:" + clave, valor);
    },
    get(clave) { return estado[clave]; },

    // Registro de módulos: declaran versión, qué escuchan y qué emiten.
    registrar(nombre, info) {
      info = info || {};
      modulos[nombre] = {
        version: info.version || "1",
        escucha: info.escucha || [],
        emite: info.emite || []
      };
      return modulos[nombre];
    },
    activo: activo,

    // Enciende o apaga un módulo (lo llama el interruptor de Ajustes) y avisa a todos
    activar(nombre, on) {
      try { localStorage.setItem("modulo_" + nombre, on ? "si" : "no"); } catch (e) {}
      this.emit("modulo:cambiado", { nombre: nombre, activo: !!on });
    },

    // Ejecuta una función aislada: si falla, se registra y la app sigue.
    seguro(nombre, fn) {
      try { return fn(); } catch (e) { registrarError(nombre, e); return undefined; }
    },

    // Diagnóstico para la futura pantalla Yo
    diagnostico() {
      return {
        modulos: Object.keys(modulos).map(n => ({ nombre: n, version: modulos[n].version, activo: activo(n) })),
        eventos: Object.keys(escuchas).length,
        errores: errores.slice()
      };
    }
  };

  window.Nucleo = Nucleo;

// Punto de acceso único a los datos de la app. Por ahora los datos siguen en las variables globales;
// todo el código nuevo debe leerlos por aquí (Nucleo.datos.marcas(), Nucleo.datos.peliculas()).
Nucleo.datos = {
  marcas: function () { return typeof marcas !== "undefined" ? marcas : {}; },
  peliculas: function () { return typeof peliculas !== "undefined" ? peliculas : []; }
};
  Nucleo.registrar("nucleo", { version: "0.1", emite: ["estado:*"], escucha: [] });
})();
