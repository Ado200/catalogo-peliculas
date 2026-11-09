/* ===== Fase 4 · Módulo «estela-mini»: barra de Estela sobre la isla.
   Dos modos: aviso (en Buscar, con micrófono) y minimizada (última respuesta, con ✕).
   No modifica el asistente: observa su panel (#chatPanel) y sus mensajes (#chatMensajes). ===== */
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

  // Barra: avatar, etiqueta, texto y botón de la derecha
  const mini = document.createElement("div");
  mini.id = "estelaMini";
  mini.setAttribute("role", "button");
  mini.setAttribute("tabindex", "0");
  mini.setAttribute("aria-label", "Abrir la conversación con Estela");
  mini.innerHTML =
    '<span class="em-avatar" aria-hidden="true">🍿</span>' +
    '<span class="em-info"><span class="em-etiqueta">Estela AI</span><span class="em-texto"></span></span>' +
    '<button type="button" class="em-accion"></button>';
  document.body.appendChild(mini);
  const texto = mini.querySelector(".em-texto");
  const accion = mini.querySelector(".em-accion");

  const AVISO_BUSCAR = "¿Qué tienes ganas de ver hoy?";
  let ocultoEnBuscar = false;
  const enBuscar = () => document.body.classList.contains("en-buscar");

  function ultimaRespuesta() {
    const burbujas = mensajes.querySelectorAll(".chat-burbuja.ia");
    const ult = burbujas[burbujas.length - 1];
    return ult ? ult.textContent.trim() : "";
  }

  function actualizarTexto(pulsar, minimizada) {
    const t = minimizada ? ultimaRespuesta() : "";
    const corto = t ? (t.length > 70 ? t.slice(0, 70).trimEnd() + "…" : t) : AVISO_BUSCAR;
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
    const aviso = !abierto && enBuscar() && !ocultoEnBuscar;
    panel.classList.toggle("minimizado", min);
    mini.classList.toggle("visible", min || aviso);
    document.body.classList.toggle("estela-mini", min || aviso);
    mini.classList.toggle("modo-min", min);
    if (min) accion.textContent = "✕";
    else accion.textContent = "🎤";
    accion.setAttribute("aria-label", min ? "Cerrar a Estela" : "Hablar con Estela");
    if (min || aviso) actualizarTexto(false, min);
  }

  // Al salir de Buscar, el aviso vuelve a estar disponible
  new MutationObserver(() => {
    if (!enBuscar()) ocultoEnBuscar = false;
    sincronizar();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  btnMin.addEventListener("click", () => {
    panel.classList.add("minimizado");
    sincronizar();
  });

  // Abre la conversación completa (y el micrófono del asistente si lo tiene)
  function expandir() {
    if (!panel.classList.contains("abierto")) {
      const abrir = document.getElementById("chatAbrir");
      if (abrir) abrir.click();
      return;
    }
    panel.classList.remove("minimizado");
    sincronizar();
    const campo = document.getElementById("chatInput");
    if (campo) campo.focus({ preventScroll: true });
  }

  mini.addEventListener("click", e => {
    if (e.target.closest(".em-accion")) return;
    expandir();
  });
  mini.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); expandir(); }
  });

  // Abre la conversación y empieza a dictar con el micrófono del asistente
  function dictar() {
    if (!panel.classList.contains("abierto")) {
      const abrir = document.getElementById("chatAbrir");
      if (abrir) abrir.click();
    }
    panel.classList.remove("minimizado");
    sincronizar();
    setTimeout(() => {
      const voz = document.getElementById("chatVoz");
      if (voz && !voz.hidden) voz.click();
      else expandir();
    }, 150);
  }

  // Botón de la derecha: en modo minimizado cierra; en el aviso de Buscar, dicta
  accion.addEventListener("click", e => {
    e.stopPropagation();
    if (panel.classList.contains("minimizado")) cerrar.click();
    else dictar();
  });

  // Al cerrar desde el panel, se limpia el estado minimizado
  cerrar.addEventListener("click", () => {
    panel.classList.remove("minimizado");
    sincronizar();
  });

  // Cuando el panel se abre o cierra por otro camino, se sincroniza
  new MutationObserver(sincronizar).observe(panel, { attributes: true, attributeFilter: ["class"] });

  // Respuesta nueva mientras está minimizada: se actualiza la línea y se pulsa
  new MutationObserver(() => {
    if (panel.classList.contains("minimizado")) actualizarTexto(true, true);
  }).observe(mensajes, { childList: true, subtree: true });

  if (window.Nucleo) {
    Nucleo.registrar("estela-mini", { version: "2.0", emite: [], escucha: [] });
  }
})();
