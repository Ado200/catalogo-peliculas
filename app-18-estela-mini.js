/* ===== Fase 4 · Módulo «estela-mini»: Estela minimizada como barra de una línea sobre la isla.
   No modifica el asistente: observa su panel (#chatPanel) y sus mensajes (#chatMensajes).
   Minimizar solo oculta el panel; la conversación sigue intacta. ===== */
(function () {
  const panel = document.getElementById("chatPanel");
  const mensajes = document.getElementById("chatMensajes");
  const cab = document.getElementById("chatCab");
  const cerrar = document.getElementById("chatCerrar");
  if (!panel || !mensajes || !cab || !cerrar) return;

  // Botón de minimizar en el encabezado del panel
  const btnMin = document.createElement("button");
  btnMin.type = "button";
  btnMin.id = "chatMinimizar";
  btnMin.setAttribute("aria-label", "Minimizar a barra");
  btnMin.title = "Minimizar";
  btnMin.textContent = "–";
  cab.insertBefore(btnMin, cerrar);

  // Barra mínima: avatar, última respuesta y cerrar
  const mini = document.createElement("div");
  mini.id = "estelaMini";
  mini.setAttribute("role", "button");
  mini.setAttribute("tabindex", "0");
  mini.setAttribute("aria-label", "Abrir la conversación con Estela");
  mini.innerHTML =
    '<span class="em-avatar" aria-hidden="true">E</span>' +
    '<span class="em-texto"></span>' +
    '<button type="button" class="em-cerrar" aria-label="Cerrar a Estela">✕</button>';
  document.body.appendChild(mini);
  const texto = mini.querySelector(".em-texto");

  function ultimaRespuesta() {
    const burbujas = mensajes.querySelectorAll(".chat-burbuja.ia");
    const ult = burbujas[burbujas.length - 1];
    return ult ? ult.textContent.trim() : "";
  }

  function actualizarTexto(pulsar) {
    const t = ultimaRespuesta();
    const corto = t ? (t.length > 70 ? t.slice(0, 70).trimEnd() + "…" : t) : "Pregúntame sobre tu catálogo";
    if (texto.textContent === corto) return;
    texto.textContent = corto;
    if (pulsar) {
      mini.classList.remove("pulso");
      void mini.offsetWidth; // reinicia la animación
      mini.classList.add("pulso");
    }
  }

  // Un solo lugar decide qué se ve: panel, barra o nada
  function sincronizar() {
    const abierto = panel.classList.contains("abierto");
    const min = abierto && panel.classList.contains("minimizado");
    panel.classList.toggle("minimizado", min);
    mini.classList.toggle("visible", min);
    document.body.classList.toggle("estela-mini", min);
    if (min) actualizarTexto(false);
  }

  btnMin.addEventListener("click", () => {
    panel.classList.add("minimizado");
    sincronizar();
  });

  function expandir() {
    panel.classList.remove("minimizado");
    sincronizar();
    const campo = document.getElementById("chatInput");
    if (campo) campo.focus({ preventScroll: true });
  }
  mini.addEventListener("click", e => {
    if (e.target.closest(".em-cerrar")) return;
    expandir();
  });
  mini.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); expandir(); }
  });
  mini.querySelector(".em-cerrar").addEventListener("click", e => {
    e.stopPropagation();
    cerrar.click();
  });

  // Al cerrar desde el panel, se limpia el estado minimizado
  cerrar.addEventListener("click", () => {
    panel.classList.remove("minimizado");
    sincronizar();
  });

  // Cuando el panel se abre o cierra por otro camino (fondo, botón del asistente), se sincroniza
  new MutationObserver(sincronizar).observe(panel, { attributes: true, attributeFilter: ["class"] });

  // Respuesta nueva mientras está minimizada: se actualiza la línea y se pulsa
  new MutationObserver(() => {
    if (mini.classList.contains("visible")) actualizarTexto(true);
  }).observe(mensajes, { childList: true, subtree: true });

  if (window.Nucleo) {
    Nucleo.registrar("estela-mini", { version: "1.0", emite: [], escucha: [] });
  }
})();
