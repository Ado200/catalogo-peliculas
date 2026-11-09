/* ===== Fase 3 · Módulo «estela-mini»: Estela como isla flotante sobre la barra.
   Estados: oculta · aviso (en Buscar) · escuchando (ondas + velo) · pensando · minimizada (última respuesta).
   Escucha con el reconocimiento de voz del navegador, envía la pregunta al mismo asistente (#chatForm)
   y observa sus respuestas (#chatMensajes). No modifica app-06b-asistente.js. ===== */
(function () {
  const panel = document.getElementById("chatPanel");
  const mensajes = document.getElementById("chatMensajes");
  const cab = document.getElementById("chatCab");
  const cerrar = document.getElementById("chatCerrar");
  const campo = document.getElementById("chatInput");
  const formulario = document.getElementById("chatForm");
  if (!panel || !mensajes || !cab || !cerrar || !campo || !formulario) return;

  // Botón de minimizar en el encabezado del panel (sigue disponible)
  const btnMin = document.createElement("button");
  btnMin.type = "button";
  btnMin.id = "chatMinimizar";
  btnMin.setAttribute("aria-label", "Minimizar a barra");
  btnMin.title = "Minimizar";
  btnMin.textContent = "–";
  cab.insertBefore(btnMin, cerrar);

  // Velo que oscurece suavemente el catálogo mientras Estela escucha
  const velo = document.createElement("div");
  velo.id = "estelaVelo";
  velo.setAttribute("aria-hidden", "true");
  document.body.appendChild(velo);

  // La isla
  const mini = document.createElement("div");
  mini.id = "estelaMini";
  mini.setAttribute("role", "button");
  mini.setAttribute("tabindex", "0");
  mini.dataset.estado = "oculta";
  mini.innerHTML =
    '<span class="em-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill="#a855f7"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></span>' +
    '<span class="em-onda" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
    '<span class="em-info"><span class="em-etiqueta">Estela</span><span class="em-texto"></span></span>' +
    '<button type="button" class="em-accion"></button>';
  document.body.appendChild(mini);
  const texto = mini.querySelector(".em-texto");
  const etiqueta = mini.querySelector(".em-etiqueta");
  const accion = mini.querySelector(".em-accion");

  const AVISO = "¿Qué tienes ganas de ver hoy?";
  const enBuscar = () => document.body.classList.contains("en-buscar");
  let estado = "oculta";
  let ocultoEnBuscar = false;
  let pidiendo = false;
  let antesRespuestas = 0;
  let temporizador = null;
  let avisoTemp = ""; // mensaje breve (error o «no te escuché») que se muestra hasta la siguiente acción
  let resultadosUltimos = null; // títulos que Estela propuso en la última respuesta
  let resultadosPendientes = null; // se abren en pantalla cuando la respuesta ya llegó

  function ultimaRespuesta() {
    const burbujas = mensajes.querySelectorAll(".chat-burbuja.ia");
    const ult = burbujas[burbujas.length - 1];
    return ult ? ult.textContent.trim() : "";
  }

  function textoDe(e) {
    if (avisoTemp) return avisoTemp;
    if (e === "escuchando") return "Escuchando…";
    if (e === "pensando") return "Estela está pensando…";
    if (e === "minimizada") {
      const t = ultimaRespuesta();
      return t ? (t.length > 70 ? t.slice(0, 70).trimEnd() + "…" : t) : AVISO;
    }
    return AVISO;
  }

  // Un solo lugar decide qué se ve
  function pintar() {
    const visible = estado !== "oculta";
    mini.dataset.estado = estado;
    mini.classList.toggle("visible", visible);
    document.body.classList.toggle("estela-mini", visible);
    velo.classList.toggle("visible", estado === "escuchando");
    texto.textContent = textoDe(estado);
    etiqueta.textContent = "Estela";
    if (estado === "minimizada") accion.textContent = "✕";
    else if (estado === "escuchando") accion.textContent = "■";
    else accion.textContent = "🎤";
    accion.setAttribute("aria-label", estado === "minimizada" ? "Cerrar a Estela"
      : estado === "escuchando" ? "Dejar de escuchar" : "Hablar con Estela");
  }

  function poner(nuevo) {
    estado = nuevo;
    pintar();
  }

  function volverAlReposo(aviso) {
    avisoTemp = aviso || "";
    poner(!panel.classList.contains("abierto") && document.body.classList.contains("con-sesion") && !(enBuscar() && ocultoEnBuscar) ? "aviso" : "oculta");
  }

  // ---------- Escucha con el reconocimiento de voz del navegador ----------
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let escuchandoAhora = false;

  function crearRec() {
    const r = new Rec();
    r.lang = "es-MX";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = e => {
      escuchandoAhora = false;
      const t = ((e.results[0] && e.results[0][0] && e.results[0][0].transcript) || "").trim();
      if (t) enviarPregunta(t);
      else volverAlReposo("No te escuché. Toca el micrófono para intentar de nuevo.");
    };
    r.onerror = e => {
      escuchandoAhora = false;
      const msg = {
        "not-allowed": "Permite el micrófono en el navegador.",
        "service-not-allowed": "Permite el micrófono para usar el dictado.",
        "no-speech": "No escuché nada. Intenta de nuevo.",
        "network": "El dictado necesita conexión a internet.",
        "audio-capture": "No encuentro un micrófono conectado."
      }[e.error] || "No pude escucharte. Intenta de nuevo.";
      volverAlReposo(msg);
    };
    r.onend = () => {
      if (escuchandoAhora) { escuchandoAhora = false; volverAlReposo(); }
    };
    return r;
  }

  function escuchar() {
    if (!Rec) { // sin dictado: se usa el micrófono del panel completo
      expandir();
      return;
    }
    avisoTemp = "";
    if (!rec) rec = crearRec();
    try {
      escuchandoAhora = true;
      poner("escuchando");
      rec.start();
    } catch (e) {
      escuchandoAhora = false;
      volverAlReposo("Espera un segundo y vuelve a tocar el micrófono.");
    }
  }

  function dejarDeEscuchar() {
    if (rec && escuchandoAhora) {
      try { rec.stop(); } catch (e) { /* ya detenido */ }
    }
  }

  // ---------- Envío al asistente y respuesta ----------
  function enviarPregunta(t) {
    campo.value = t;
    antesRespuestas = mensajes.querySelectorAll(".chat-burbuja.ia, .chat-burbuja.error").length;
    pidiendo = true;
    poner("pensando");
    formulario.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (pidiendo) { pidiendo = false; volverAlReposo("No llegó respuesta. Intenta de nuevo."); }
    }, 40000);
  }

  // Captura la acción «resultados» de cada respuesta del asistente (sin cambiar lo que hace el asistente)
  function ofrecerResultados() {
    if (!resultadosPendientes || pidiendo || !window.abrirPantallaResultados) return;
    const titulos = resultadosPendientes;
    resultadosPendientes = null;
    window.abrirPantallaResultados("Estela", titulos);
  }
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const cuerpo = init && typeof init.body === "string" ? init.body : "";
    const promesa = fetchOriginal(input, init);
    if (cuerpo.indexOf('"pregunta"') !== -1) {
      promesa.then(r => r.clone().json()).then(j => {
        const a = j && j.accion;
        const titulos = a && a.tipo === "resultados" && Array.isArray(a.titulos) && a.titulos.length ? a.titulos : null;
        resultadosUltimos = titulos;
        resultadosPendientes = titulos;
        ofrecerResultados();
        pintar();
      }).catch(() => {});
    }
    return promesa;
  };

  // Cuando llega la respuesta, la isla se contrae a barra con esa respuesta
  new MutationObserver(() => {
    if (!pidiendo) return;
    const ahora = mensajes.querySelectorAll(".chat-burbuja.ia, .chat-burbuja.error").length;
    if (ahora > antesRespuestas) {
      pidiendo = false;
      clearTimeout(temporizador);
      poner("minimizada");
      ofrecerResultados();
      mini.classList.remove("pulso");
      void mini.offsetWidth;
      mini.classList.add("pulso");
    }
  }).observe(mensajes, { childList: true, subtree: true });

  // ---------- Panel completo ----------
  function expandir() {
    if (!panel.classList.contains("abierto")) {
      const abrir = document.getElementById("chatAbrir");
      if (abrir) abrir.click();
    }
    panel.classList.remove("minimizado");
    setTimeout(() => {
      const voz = document.getElementById("chatVoz");
      if (voz && !voz.hidden && !Rec) voz.click();
      campo.focus({ preventScroll: true });
    }, 150);
    poner("oculta");
  }

  btnMin.addEventListener("click", () => {
    panel.classList.add("minimizado");
    poner("minimizada");
  });

  // El panel completo se abre o se cierra por otro camino
  new MutationObserver(() => {
    const abierto = panel.classList.contains("abierto");
    const min = abierto && panel.classList.contains("minimizado");
    panel.classList.toggle("minimizado", min);
    if (abierto && !min) { dejarDeEscuchar(); poner("oculta"); }
    else if (min) poner("minimizada");
    else volverAlReposo();
  }).observe(panel, { attributes: true, attributeFilter: ["class"] });

  cerrar.addEventListener("click", () => {
    panel.classList.remove("minimizado");
    volverAlReposo();
  });

  // Entrar o salir de Buscar muestra u oculta el aviso
  new MutationObserver(() => {
    if (!enBuscar()) ocultoEnBuscar = false;
    if (estado === "oculta" || estado === "aviso") volverAlReposo();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // ---------- Interacción ----------
  mini.addEventListener("click", e => {
    if (e.target.closest(".em-accion")) return;
    if (estado === "escuchando") { dejarDeEscuchar(); return; }
    if (estado === "minimizada" && resultadosUltimos && window.abrirPantallaResultados) {
      window.abrirPantallaResultados("Estela", resultadosUltimos);
      return;
    }
    expandir();
  });
  const avatarMic = mini.querySelector(".em-avatar");
  avatarMic.addEventListener("click", e => {
    e.stopPropagation();
    if (estado === "oculta" || estado === "aviso") escuchar();
  });
  mini.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); mini.click(); }
  });

  accion.addEventListener("click", e => {
    e.stopPropagation();
    if (estado === "escuchando") { dejarDeEscuchar(); return; }
    if (estado === "minimizada") {
      if (panel.classList.contains("abierto")) { cerrar.click(); return; }
      // Cerrar la isla: no vuelve a aparecer hasta salir y entrar de nuevo a Buscar
      if (enBuscar()) ocultoEnBuscar = true;
      avisoTemp = "";
      poner("oculta");
      return;
    }
    escuchar();
  });

  pintar();

  if (window.Nucleo) {
    Nucleo.registrar("estela-mini", { version: "3.0", emite: [], escucha: [] });
  }
})();
