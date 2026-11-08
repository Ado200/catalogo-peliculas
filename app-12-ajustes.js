/* ===== Ajustes: interruptores de Juegos (racha, insignias, reto, pregunta) y de privacidad del chat ===== */
(function () {
  function leer(clave) { try { return localStorage.getItem(clave) !== "no"; } catch (e) { return true; } }
  function guardar(clave, valor) { try { localStorage.setItem(clave, valor ? "si" : "no"); } catch (e) {} }

  const juego = document.getElementById("juegoOn");
  function aplicarJuego() { document.body.classList.toggle("sin-juego", !leer("juego_on")); }
  if (juego) {
    juego.checked = leer("juego_on");
    juego.addEventListener("change", () => { guardar("juego_on", juego.checked); aplicarJuego(); });
  }
  aplicarJuego();

  const personal = document.getElementById("chatPersonalOn");
  if (personal) {
    personal.checked = leer("chat_personal");
    personal.addEventListener("change", () => guardar("chat_personal", personal.checked));
  }
})();

/* Fase 0 · Registro del módulo «ajustes» en el núcleo (el código de arriba no cambia) */
if (window.Nucleo) {
  Nucleo.registrar("ajustes", { version: "1.0", emite: [], escucha: [] });
}
