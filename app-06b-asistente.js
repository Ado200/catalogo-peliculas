/* ===== Fase 0 · Módulo «asistente» (bloque 13): Estela, conversación, recomendador y acciones. Migrado sin cambios de comportamiento. ===== */
/* --- bloque 13 --- */
(function () {
const CHAT_URL = "https://catalogo-chat.240300696.workers.dev";  const panel = document.getElementById("chatPanel");
  const lista = document.getElementById("chatMensajes");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const enviar = document.getElementById("chatEnviar");
  // Interruptor: si está apagado, no sale nada personal (preferencias, series ni perfil)
  function chatEnviarPersonal() {
    try { return localStorage.getItem("chat_personal") !== "no"; } catch (e) { return true; }
  }
  // El porcentaje de uso vive en la cabecera (#chatUso dentro de .estela-controles-sup); ya no se mueve a un aviso aparte
  let historial = [];
  let saludado = false;

  // Escribe el texto poco a poco, como si lo estuviera diciendo
  function escribirPoco(el, texto) {
    el.textContent = "";
    const paso = Math.max(2, Math.ceil(texto.length / 90));
    let i = 0;
    const tick = () => {
      i += paso;
      el.textContent = texto.slice(0, i);
      lista.scrollTop = lista.scrollHeight;
      if (i < texto.length) setTimeout(tick, 16); else el.textContent = texto;
    };
    tick();
  }

  function burbuja(texto, tipo) {
    const d = document.createElement("div");
    d.className = "chat-burbuja " + tipo;
    const visible = tipo === "ia" ? limpiarMarkdown(texto) : texto;
    lista.appendChild(d);
    if (tipo === "ia" && visible.length <= 600) {
      escribirPoco(d, visible);
    } else {
      d.textContent = visible;
    }
    lista.scrollTop = lista.scrollHeight;
    if (tipo === "ia") hablar(visible);
    return d;
  }

  /* ---------- Voz del asistente (síntesis del navegador, sin costo) ---------- */
  const vozSoportada = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  const vozActiva = () => { try { return localStorage.getItem("chat_voz") !== "0"; } catch (e) { return true; } };

  // Quita el formato de Markdown que a veces devuelve la IA (**negritas**, *cursivas*, # títulos, viñetas)
  function limpiarMarkdown(texto) {
    return String(texto || "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`+/g, "")
      .replace(/^#+\s*/gm, "")
      .replace(/^\s*[-•*]\s+/gm, "• ")
      .replace(/\*/g, "")
      .trim();
  }

  function limpiarParaVoz(texto) {
    let t = String(texto || "")
      .replace(/\p{Extended_Pictographic}/gu, " ")
      .replace(/★/g, " estrellas")
      .replace(/[•«»"]/g, " ")
      .replace(/\((\d{4})\)/g, ", $1, ")
      .replace(/\b(\d+)\s*min\b\.?/g, "$1 minutos")
      .replace(/\s[—–-]\s/g, ", ")
      .replace(/…/g, ". ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .replace(/\.\s*\./g, ".")
      .trim();
    if (t.length > 450) {
      const corte = t.slice(0, 450);
      const punto = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("? "), corte.lastIndexOf("! "));
      t = punto > 150 ? corte.slice(0, punto + 1) : corte;
    }
    return t;
  }

  const NOMBRES_MUJER = /paulina|sabina|dalia|monica|mónica|helena|marisol|paloma|luciana|sofia|sofía|valeria|camila|female|mujer/i;
  const NOMBRES_HOMBRE = /jorge|diego|juan|carlos|pablo|raul|raúl|enrique|alonso|andres|andrés|male|hombre/i;
  const CALIDAD_VOZ = /natural|neural|premium|enhanced|google|mejorad|plus/i;

  const VELOCIDADES = { lento: 0.94, normal: 1.0, rapido: 1.12 };
  const velocidadVoz = () => {
    try { return VELOCIDADES[localStorage.getItem("chat_velocidad")] || VELOCIDADES.normal; } catch (e) { return VELOCIDADES.normal; }
  };

  const generoVoz = () => { try { return localStorage.getItem("chat_genero") || "mujer"; } catch (e) { return "mujer"; } };

  function puntuarVoz(v, genero) {
    let s = 0;
    if (/^es[-_]MX/i.test(v.lang)) s += 4; else if (/^es/i.test(v.lang)) s += 2;
    if (CALIDAD_VOZ.test(v.name)) s += 3;
    const esMujer = NOMBRES_MUJER.test(v.name), esHombre = NOMBRES_HOMBRE.test(v.name);
    if (genero === "mujer") { if (esMujer) s += 5; if (esHombre) s -= 5; }
    if (genero === "hombre") { if (esHombre) s += 5; if (esMujer) s -= 5; }
    return s;
  }

  function elegirVoz() {
    const vs = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang));
    if (!vs.length) return null;
    const g = generoVoz();
    const puntos = v => puntuarVoz(v, g) + (v.localService ? 0 : 2);
    return vs.slice().sort((a, b) => puntos(b) - puntos(a))[0];
  }

  // Las voces llegan con retraso: si aún no están, espera (máximo ~2 s) para no leer con la voz genérica
  function esperarVoces(ms = 2000) {
    return new Promise(resolver => {
      if (speechSynthesis.getVoices().length) return resolver();
      const t = setTimeout(resolver, ms);
      speechSynthesis.addEventListener("voiceschanged", () => { clearTimeout(t); resolver(); }, { once: true });
    });
  }

  // Agrupa frases en trozos de tamaño natural: sin pausas cortadas ni frases sueltas
  function trocearParaVoz(texto, max = 200) {
    const frases = (texto.match(/[^.!?;:]+[.!?;:]*/g) || [texto]).map(f => f.trim()).filter(Boolean);
    const trozos = [];
    let cur = "";
    frases.forEach(f => {
      if (cur && (cur + " " + f).length > max) { trozos.push(cur); cur = f; }
      else cur = cur ? cur + " " + f : f;
    });
    if (cur) trozos.push(cur);
    return trozos;
  }

  // Chrome deja de hablar después de ~15 s; un «resume» periódico lo evita
  let vozVigilante = null;
  function mantenerVoz() {
    clearInterval(vozVigilante);
    vozVigilante = setInterval(() => {
      if (!speechSynthesis.speaking) { clearInterval(vozVigilante); return; }
      speechSynthesis.resume();
    }, 10000);
  }

  // Expuestos para el saludo (que está fuera de este bloque)
  window.mantenerVoz = mantenerVoz;
  window.trocearParaVoz = trocearParaVoz;
  window.esperarVoces = esperarVoces;

  function hablar(texto, intento = 0) {
    if (!vozSoportada || !vozActiva()) return;
    const limpio = limpiarParaVoz(texto);
    if (!limpio) return;
    if (!speechSynthesis.getVoices().length && intento === 0) {
      esperarVoces().then(() => hablar(texto, 1));
      return;
    }
    if (escuchandoConv && recConv) { try { recConv.abort(); } catch (e) {} escuchandoConv = false; }
    speechSynthesis.cancel();
    hablarTrozos(trocearParaVoz(limpio), {
      velocidad: velocidadVoz(),
      alInicio: mantenerVoz,
      alFinal: () => {
        if (typeof conversacionActiva !== "undefined" && conversacionActiva && typeof escucharConv === "function") {
          setTimeout(() => escucharConv(), 350);
        }
      }
    });
  }

  if (vozSoportada) {
    speechSynthesis.addEventListener("voiceschanged", () => {});
  }

  const selectGenero = document.getElementById("chatGenero");
  const selectVelocidad = document.getElementById("chatVelocidad");
  if (selectVelocidad) {
    try { selectVelocidad.value = localStorage.getItem("chat_velocidad") || "normal"; } catch (e) { selectVelocidad.value = "normal"; }
    selectVelocidad.addEventListener("change", () => {
      try { localStorage.setItem("chat_velocidad", selectVelocidad.value); } catch (e) {}
      if (vozSoportada) speechSynthesis.cancel();
      hablar("Así es la velocidad que elegiste.");
    });
  }

  if (selectGenero) {
    selectGenero.value = generoVoz();
    selectGenero.addEventListener("change", () => {
      try { localStorage.setItem("chat_genero", selectGenero.value); } catch (e) {}
      if (vozSoportada) speechSynthesis.cancel();
      hablar("Así suena mi voz ahora.");
    });
  }

  function actualizarIconoVoz() {
    const b = document.getElementById("chatVozOn");
    if (!b) return;
    b.textContent = vozActiva() ? "🔊" : "🔇";
    b.setAttribute("aria-label", vozActiva() ? "Silenciar voz" : "Activar voz");
  }

  if (!vozSoportada) {
    const b = document.getElementById("chatVozOn");
    if (b) b.hidden = true;
  } else {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener("voiceschanged", () => {});
    actualizarIconoVoz();
  }

  document.getElementById("chatVozOn").addEventListener("click", () => {
    const nuevo = vozActiva() ? "0" : "1";
    try { localStorage.setItem("chat_voz", nuevo); } catch (e) {}
    if (nuevo === "0" && vozSoportada) speechSynthesis.cancel();
    actualizarIconoVoz();
  });

  // Presentación completa: solo la primera vez que se usa el asistente en este navegador
  function presentacionCompleta() {
    burbuja("Hola" + (nombreUsuario() ? ", " + nombreUsuario() : "") + ". Soy " + NOMBRE_COMPA + ", y me encanta platicar de cine contigo. Puedo ayudarte a elegir qué ver, recordar qué tienes pendiente o contarte cómo va tu semana. Pregúntame lo que quieras.", "ia");
    burbuja("Tus marcas, notas y preferencias son solo tuyas. Las preguntas, tus preferencias y los datos de tu lista se envían a Gemini a través del script del administrador. Si aparece «código 429», se agotó la cuota diaria compartida; vuelve mañana.", "ia");
  }

  // Preguntas por momento del día; no repite la última
  const PREGUNTAS_SALUDO = {
    manana: ["¿Qué te apetece ver hoy?", "¿Quieres algo corto para empezar el día?", "¿Revisamos tus pendientes para hoy?"],
    tarde: ["¿Te antoja algo para la tarde?", "¿Vemos algo nuevo o retomamos un pendiente?", "¿Te recomiendo algo según tu ánimo?"],
    noche: ["¿Qué vemos esta noche?", "¿Te armo una maratón según el tiempo que tengas?", "¿Empezamos algo de tu lista hoy?"],
    general: ["¿Qué tal si elegimos algo de tus pendientes?", "¿Te cuento qué tienes por ver esta semana?"]
  };

  function franjaDelDia() {
    const h = new Date().getHours();
    return h < 12 ? "manana" : h < 19 ? "tarde" : "noche";
  }

  function saludoBreve() {
    const h = new Date().getHours();
    const franja = h < 12 ? "manana" : h < 19 ? "tarde" : "noche";
    const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
    const pool = PREGUNTAS_SALUDO[franja].concat(PREGUNTAS_SALUDO.general);
    let ultima = null;
    try { ultima = localStorage.getItem("chat_pregunta_ultima"); } catch (e) {}
    const candidatas = pool.filter(q => q !== ultima);
    const pregunta = candidatas[Math.floor(Math.random() * candidatas.length)];
    try { localStorage.setItem("chat_pregunta_ultima", pregunta); } catch (e) {}
    const nombre = nombreUsuario();
    return saludo + (nombre ? ", " + nombre : "") + ". " + pregunta;
  }

  function saludar() {
    if (saludado) return;
    saludado = true;
    let primera = false;
    try { primera = localStorage.getItem("chat_presentado") !== "1"; } catch (e) {}
    if (primera) {
      presentacionCompleta();
      try { localStorage.setItem("chat_presentado", "1"); } catch (e) {}
      return;
    }
    burbuja(saludoBreve(), "ia");
  }
  function catalogoParaIA(textoPregunta = "") {
    const base = seleccionParaIA(textoPregunta).map(p => {
      const e = estadoDe(p);
      return {
        titulo: p.titulo, año: p["año"], tipo: p.tipo,
        genero: p.genero, director: p.director, duracion: p.duracion,
        reparto: String(p.reparto || "").split(",").slice(0, 3).map(x => x.trim()).filter(Boolean).join(", "),
        vista: e.vista, pendiente: e.pendiente, estrellas: e.estrellas, conAlguien: e.conAlguien
      };
    });
    if (chatEnviarPersonal() && notas.length) base.unshift({ preferencias_del_usuario: notas });
    if (chatEnviarPersonal() && memoriaGustosActiva()) base.unshift({ gustos_del_usuario: resumenGustos() });
    if (window.seriesApi && chatEnviarPersonal()) {
      const S = window.seriesApi;
      const resumen = S.lista().slice(0, 40).map(s => {
        const pr = S.progreso(s);
        return { titulo: s.titulo, genero: s.genero_principal, año: s.año,
          capitulos_vistos: pr.vistos + "/" + pr.total,
          siguiente: pr.siguiente ? "T" + pr.siguiente.temporada + "E" + pr.siguiente.episodio : "ninguno" };
      });
      if (resumen.length) base.unshift({ series_del_usuario: resumen });
    }
    return base;
  }

  // ----- Memoria de gustos: se deriva de tus calificaciones y marcas, sin guardar nada extra -----
  function memoriaGustosActiva() {
    try { return localStorage.getItem("gustos_memoria") !== "no"; } catch (e) { return true; }
  }

  function resumenGustos() {
    const perfil = perfilGustos();
    const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
    const gustaron = Nucleo.datos.peliculas().filter(p => { const e = estadoDe(p); return e.vista && e.estrellas >= 4; }).slice(0, 8).map(p => p.titulo);
    const noGustaron = Nucleo.datos.peliculas().filter(p => { const e = estadoDe(p); return e.vista && e.estrellas && e.estrellas <= 2; }).slice(0, 8).map(p => p.titulo);
    const descartadas = Nucleo.datos.peliculas().filter(p => (Nucleo.datos.marcas()[p.titulo] || {}).descartada).slice(0, 8).map(p => p.titulo);
    return {
      generos_que_mas_disfruta: top(perfil.genero),
      directores_que_mas_disfruta: top(perfil.director),
      peliculas_que_le_gustaron: gustaron,
      peliculas_que_no_le_gustaron: noGustaron,
      descartadas: descartadas,
      instruccion: "Usa estos gustos para elegir y explica en una frase por qué recomiendas cada título. No recomiendes lo que no le gustó ni lo descartado."
    };
  }

  function listaCampo(p, campo) {
    return String(p[campo] || "").split(",").map(x => x.trim()).filter(Boolean);
  }

  function recomendarSinIA(n = 3) {
    if (!Nucleo.datos.peliculas().length) return "Primero necesito que tu catálogo cargue.";
    const perfil = { genero: {}, director: {}, reparto: {} };
    const sumar = (mapa, claves, peso) => claves.forEach(c => { mapa[c] = (mapa[c] || 0) + peso; });

    // Lo que ya viste pesa según tus estrellas (sin calificar cuenta como 1)
    Nucleo.datos.peliculas().forEach(p => {
      const e = estadoDe(p);
      if (!e.vista) return;
      const peso = e.estrellas || 1;
      sumar(perfil.genero, listaCampo(p, "genero"), peso);
      sumar(perfil.director, listaCampo(p, "director"), peso);
      sumar(perfil.reparto, listaCampo(p, "reparto").slice(0, 5), peso);
    });

    const candidatos = Nucleo.datos.peliculas().filter(p => {
      const m = Nucleo.datos.marcas()[p.titulo] || {};
      return !estadoDe(p).vista && !m.descartada;
    }).map(p => {
      const e = estadoDe(p);
      const porGenero = listaCampo(p, "genero").filter(g => perfil.genero[g]);
      const porDirector = listaCampo(p, "director").filter(d => perfil.director[d]);
      const porReparto = listaCampo(p, "reparto").slice(0, 5).filter(r => perfil.reparto[r]);
      let score = 0;
      porGenero.forEach(g => score += perfil.genero[g]);
      porDirector.forEach(d => score += perfil.director[d] * 2);
      porReparto.forEach(r => score += perfil.reparto[r]);
      if (e.pendiente) score += 1;
      return { p, score, porGenero, porDirector, porReparto };
    }).sort((a, b) => b.score - a.score);

    const elegidos = candidatos.filter(c => c.score > 0).slice(0, n);
    if (!elegidos.length) return "Aún no tengo suficientes datos de tus gustos. Marca algunas películas como vistas y vuelve a intentar.";

    const lineas = elegidos.map(c => {
      const motivos = [];
      if (c.porDirector.length) motivos.push("dirigida por " + c.porDirector[0]);
      if (c.porGenero.length) motivos.push("del género " + c.porGenero.slice(0, 2).join(" y ").toLowerCase());
      if (c.porReparto.length) motivos.push("con " + c.porReparto[0]);
      const año = c.p["año"] ? " (" + c.p["año"] + ")" : "";
      return "• " + c.p.titulo + año + (motivos.length ? ": " + motivos.join(", ") : "");
    });
    return "Según tus gustos, sin usar IA:\n\n" + lineas.join("\n");
  }

  function titulosEnTexto(texto) {
    const t = String(texto || "").toLowerCase();
    const hallados = [];
    Nucleo.datos.peliculas().forEach(p => {
      const titulo = String(p.titulo || "").toLowerCase();
      if (titulo.length < 2) return;
      const pos = t.indexOf(titulo);
      if (pos !== -1) hallados.push({ p, pos });
    });
    hallados.sort((a, b) => a.pos - b.pos);
    const unicos = [];
    hallados.forEach(h => { if (!unicos.includes(h.p)) unicos.push(h.p); });
    return unicos.slice(0, 4);
  }

  function mostrarPosters(texto) {
    const lista_ = titulosEnTexto(texto);
    if (!lista_.length) return;
    const fila = document.createElement("div");
    fila.className = "chat-posters";
    const sinDatos = typeof datosLimitados === "function" && datosLimitados();
    lista_.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat-poster";
      b.title = p.titulo;
      const img = (p.portada && !sinDatos)
        ? (() => { const i = document.createElement("img"); i.src = p.portada; i.alt = ""; i.loading = "lazy"; return i; })()
        : (() => { const d = document.createElement("div"); d.className = "chat-sinposter"; d.textContent = "🎬"; return d; })();
      const etiqueta = document.createElement("span");
      etiqueta.textContent = p.titulo + (p["año"] ? " (" + p["año"] + ")" : "");
      b.append(img, etiqueta);
      b.addEventListener("click", () => { if (typeof abrirDetalle === "function") abrirDetalle(p); });

      // Botones rápidos: marcar sin escribir comandos
      const acciones = document.createElement("div");
      acciones.className = "chat-marcar";
      const btnVista = document.createElement("button");
      btnVista.type = "button";
      const btnPend = document.createElement("button");
      btnPend.type = "button";
      const pintarEstado = () => {
        const e = estadoDe(p);
        btnVista.textContent = e.vista ? "✓ Vista" : "Vista";
        btnVista.classList.toggle("activo", e.vista);
        btnVista.disabled = e.vista;
        btnPend.textContent = e.pendiente ? "✓ Pendiente" : "Pendiente";
        btnPend.classList.toggle("activo", e.pendiente);
        btnPend.disabled = e.pendiente;
      };
      btnVista.addEventListener("click", () => {
        cambiarEstado(p.titulo, { vista: true });
        if (typeof refrescarTodo === "function") refrescarTodo();
        burbuja("Listo: «" + p.titulo + "» marcada como vista.", "ia");
        pintarEstado();
      });
      btnPend.addEventListener("click", () => {
        cambiarEstado(p.titulo, { pendiente: true, vista: false });
        if (typeof refrescarTodo === "function") refrescarTodo();
        burbuja("Listo: «" + p.titulo + "» quedó en pendientes.", "ia");
        pintarEstado();
      });
      pintarEstado();
      acciones.append(btnVista, btnPend);

      const col = document.createElement("div");
      col.className = "chat-poster-col";
      col.append(b, acciones);
      fila.appendChild(col);
    });
    lista.appendChild(fila);
    lista.scrollTop = lista.scrollHeight;
  }

  // Dictado: llena el campo para que revises antes de enviar. Siempre visible, con aviso de lo que pasa.
  (function () {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const vozBtn = document.getElementById("chatVoz");
    if (!vozBtn) return;
    vozBtn.hidden = false;
    if (!Rec) {
      vozBtn.addEventListener("click", () => avisar("Tu navegador no tiene dictado. Prueba con Chrome o Edge."));
      return;
    }
    const rec = new Rec();
    rec.lang = "es-MX";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let llegoTexto = false;
    rec.onstart = () => { vozBtn.classList.add("escuchando"); input.placeholder = "Escuchando… habla ahora"; };
    rec.onresult = e => {
      const t = (e.results[0] && e.results[0][0] && e.results[0][0].transcript || "").trim();
      if (t) { llegoTexto = true; input.value = t; input.focus(); avisar("Revisa el texto y pulsa enviar."); }
    };
    const limpiar = () => { vozBtn.classList.remove("escuchando"); input.placeholder = "Pregúntame sobre tu catálogo…"; };
    rec.onend = () => {
      limpiar();
      if (!llegoTexto) avisar("No entendí. Intenta de nuevo, hablando cerca del micrófono.");
      llegoTexto = false;
    };
    rec.onerror = e => {
      limpiar();
      const msg = {
        "not-allowed": "Permite el micrófono en el navegador (toca el candado de la barra de direcciones).",
        "service-not-allowed": "Permite el micrófono en el navegador para usar el dictado.",
        "no-speech": "No escuché nada. Intenta de nuevo.",
        "network": "El dictado necesita conexión a internet.",
        "audio-capture": "No encuentro un micrófono conectado."
      }[e.error] || "No pude usar el dictado. Intenta de nuevo.";
      avisar(msg);
    };
    vozBtn.addEventListener("click", () => {
      if (vozBtn.classList.contains("escuchando")) { rec.stop(); return; }
      llegoTexto = false;
      vozBtn.classList.add("escuchando");
      avisar("Escuchando… habla ahora.");
      try { rec.start(); }
      catch (e) { avisar("Espera un segundo y vuelve a pulsar el micrófono."); }
    });
  })();

  // Consultas con IA por persona al día. Al llegar al límite, el chat pasa solo a modo sin IA.
  const fondoChat = document.createElement("div");
  fondoChat.id = "chatFondo";
  document.body.appendChild(fondoChat);
  // Panel y botón se llevan a la raíz de la página: así siempre quedan encima del fondo y reciben los toques
  document.body.appendChild(panel);
  const tableroChat = document.createElement("div");
  tableroChat.id = "chatTablero";
  tableroChat.className = "chat-tablero";
  const usoChat = document.getElementById("chatUso");
  if (usoChat) usoChat.insertAdjacentElement("afterend", tableroChat);
  const botonAbrirChat = document.getElementById("chatAbrir");
  if (botonAbrirChat) document.body.appendChild(botonAbrirChat);
  fondoChat.addEventListener("click", () => {
    panel.classList.remove("abierto");
    fondoChat.classList.remove("visible");
    if (vozSoportada) speechSynthesis.cancel();
    detenerEscuchaConv();
  });

  const LIMITE_IA_PERSONAL_DIA = 20;
  let avisoOffline = false;
  let usoGrupo = null;

  function pintarUso(u) {
    if (!u || !u.limite) return;
    usoGrupo = u;
    const el = document.getElementById("chatUso");
    if (!el) return;
    const pct = Math.min(100, Math.round(u.hoy / u.limite * 100));
    el.textContent = pct + "%";
    el.setAttribute("aria-label", "Uso del grupo hoy: " + pct + "%, " + u.hoy + " de " + u.limite + " consultas con IA. Se reinicia en " + tiempoParaReinicio() + ".");
    el.title = el.getAttribute("aria-label");
    el.classList.toggle("alerta", pct >= 80);
    el.hidden = false;
  }

  async function consultarUso() {
    if (!accessToken) return;
    try {
      const r = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ token: accessToken, accion: "uso" })
      });
      const j = await r.json();
      if (j.uso) pintarUso(j.uso);
    } catch (e) {}
  }

  // Cambio automático a modo sin IA, avisando una sola vez en el chat
  function caeASinIA(motivo, pregunta) {
    if (pregunta) {
      burbuja(motivo + "\n\nTe ayudo igual, sin IA:", "ia");
      responderLocal(pregunta);
      return;
    }
    burbuja(motivo + "\n\nSeguimos en modo sin IA. Pregúntame lo que quieras.", "ia");
  }

  // Identidad del compañero: cámbialo aquí y en SISTEMA_CHAT del Apps Script
  const NOMBRE_COMPA = "Estela";
  // Nombre del usuario, si lo guardó con «recuerda que me llamo …»
  function nombreUsuario() {
    const guardado = nombreGuardado();
    if (guardado) return guardado;
    for (const n of notas) {
      const m = String(n).match(/me llamo\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]+)/i);
      if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    }
    return null;
  }

  const normalizarChat = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  // Sinónimos del habla cotidiana (México): se traducen a las frases que el asistente ya entiende
  const expandirChat = s => s
    .replace(/\b(pelis?|filmes?|cintas?|movies?)\b/g, "pelicula")
    .replace(/\b(dame algo|recomiendame|recomiendame algo|que me recomiendas|que me sugieres|me sugieres|sugierem|sugiereme)\b/g, "sugiereme algo")
    .replace(/\b(quiero reir|tengo ganas de reir|me quiero reir|morir de risa|reirme un rato)\b/g, "para reirme")
    .replace(/\b(quiero llorar|para llorar|llorar un rato)\b/g, "triste")
    .replace(/\b(no se que ver|no se que pongo|que pongo|que me pongo)\b/g, "que veo")
    .replace(/\b(sin pensar|sin complicarme|algo ligero|algo light)\b/g, "relajado")
    .replace(/\b(hay algo bueno|algo bueno)\b/g, "algo bueno");
  const elegir = arr => arr[Math.floor(Math.random() * arr.length)];
  const listaTitulos = arr => arr.slice(0, 5).map(p => "• " + p.titulo + (p["año"] ? " (" + p["año"] + ")" : "")).join("\n");
  const pendientesDe = () => Nucleo.datos.peliculas().filter(p => estadoDe(p).pendiente && !(Nucleo.datos.marcas()[p.titulo] || {}).descartada);
  const vistasDe = () => Nucleo.datos.peliculas().filter(p => estadoDe(p).vista);

  // ----- Recomendador local con memoria de la sesión -----
  const sesionSugeridas = new Set();
  // ----- Estela: calidez, empatía y memoria de la charla -----
  let ultimaEmocion = null;
  const CRISIS_RE = /suicid|quitarme la vida|quitarme la existencia|matarme|no quiero (seguir )?vivir|ya no quiero vivir|hacerme dano|lastimarme|autolesi|acabar con mi vida|terminar con mi vida/;
  const ANIMO_PIDE = /quiero algo|algo que|dame algo|recomiend|sugier|propon|necesito algo|algo para|que veo|pon algo/;
  const ANIMO_SIENTE = /\b(estoy|me siento|siento|ando|me encuentro|me pone|me pongo|me acuerdo|me recuerdo|extrano|me da)\b/;
  const EMOCIONES = [
    { tipo: "triste", razon: "para acompañarte con algo amable", re: /triste|tristeza|bajon|melancol|deprim|llorar|mala racha|dia gris/, gen: ["comedia", "animacion", "familia", "drama"],
      intros: ["Ay, lo siento. Cuando el ánimo anda bajito, conviene algo que abrace un poco.", "Lamento que estés así. Vamos a buscarte algo amable, sin prisa."],
      charla: "Lamento que estés así. ¿Quieres que te proponga algo para acompañarte un rato, o prefieres contarme qué pasó?" },
    { tipo: "cansado", razon: "para desconectarte sin pensar mucho", re: /cansad|agotad|estresad|estres|rendid|dia pesado|muy pesado/, gen: ["comedia", "animacion", "familia"],
      intros: ["Qué día tan pesado. Lo mejor es algo que te deje descansar la cabeza.", "Te entiendo: a veces solo toca desconectarse un rato."],
      charla: "Qué cansancio. ¿Te propongo algo ligero para desconectarte, o prefieres platicar un poco?" },
    { tipo: "aburrido", razon: "para sacudirte el aburrimiento", re: /aburrid|aburrir|sin ganas|nada que hacer/, gen: ["accion", "aventura", "suspenso", "ciencia"],
      intros: ["Ese aburrimiento se quita rápido. Mira qué te propongo:", "Vamos a sacudir ese aburrimiento:"],
      charla: "Ese aburrimiento tiene cura. ¿Quieres algo intenso o algo divertido?" },
    { tipo: "solo", razon: "para hacerte compañía", re: /me siento solo|me siento sola|estoy solo|estoy sola|soledad/, gen: ["comedia", "romance", "familia", "animacion"],
      intros: ["Una buena película también puede hacer compañía. Te propongo algo para sentirte acompañado:"],
      charla: "Me alegra que me lo cuentes. ¿Quieres que te proponga algo para acompañarte un rato?" },
    { tipo: "feliz", razon: "para mantener esa buena vibra", re: /estoy feliz|me siento feliz|contento|contenta|emocionad|de buen humor|de buen animo/, gen: ["comedia", "aventura", "musical", "animacion"],
      intros: ["¡Qué buena vibra! Vamos a mantenerla:"],
      charla: "¡Qué gusto leer eso! ¿Quieres que la celebremos con una peli?" },
    { tipo: "nervioso", razon: "para distraerte sin asustarte", re: /nervios|ansios|ansiedad|preocupad|angustia|alterad/, gen: ["comedia", "animacion", "familia"],
      intros: ["Respira un poco. Vamos con algo que te distraiga sin asustarte:"],
      charla: "Respira un poco. ¿Quieres algo tranquilo para distraerte?" },
    { tipo: "nostalgia", razon: "por su sabor a recuerdos", re: /nostalg|extrano a|extrano mi|recuerdos|de nino|de nina|de chico|de chica|cuando era/, gen: ["drama", "romance", "familia", "comedia"], anioMax: 2005,
      intros: ["La nostalgia tiene su encanto. Te propongo algo con sabor a recuerdos:"],
      charla: "La nostalgia puede ser muy bonita. ¿Quieres que te proponga algo de esos recuerdos?" },
    { tipo: "consuelo", razon: "para arroparte un rato", re: /abrace|abrazo|abrazar|consol|arrop|reconfort|algo tierno|me cuide|cuidarme/, gen: ["comedia", "animacion", "familia", "drama"],
      intros: ["Claro, algo que abrace un poco:", "Va, algo tierno para arroparte:"],
      charla: "Claro, te acompaño. ¿Quieres que te proponga algo tierno para arroparte un rato?" },
    { tipo: "dolor", razon: "porque a veces una historia ayuda a desahogarse", re: /corazon roto|me dejo|termine con|termino conmigo|desamor|ruptura|me engano/, gen: ["drama", "romance", "comedia"],
      intros: ["Lamento que estés pasando por eso. A veces una historia ayuda a sacar lo que duele:"],
      charla: "Lamento que te sientas así. ¿Quieres que te proponga algo para desahogarte viendo una historia?" }
  ];
  const ESTILO_IA = "cálido y natural, como una amiga cinéfila que platica en español de México; frases cortas y fluidas; sin listas robóticas salvo que pida una lista; si cuenta cómo se siente, responde primero con empatía; máximo cuatro frases salvo que pida más; nunca inventes títulos";

  function textoCrisis() {
    return "Gracias por contarme esto. Lo que sientes importa, y no tienes que cargarlo solo.\n\n" +
      "Si estás en peligro o sientes que podrías hacerte daño, llama al 911 ahorita mismo, o a la Línea de la Vida al 800 911 2000, que atiende las 24 horas.\n\n" +
      "Si puedes, háblale ya a alguien de tu confianza y dile que no quieres estar solo con esto. Yo soy una app de cine: no puedo acompañarte como lo haría una persona, pero quiero que estés bien. ¿Hay alguien cerca de ti ahorita?";
  }

  function momentoDia() {
    const h = new Date().getHours();
    return h < 12 ? "mañana" : h < 19 ? "tarde" : "noche";
  }

  // Artículo correcto para cada género: «la animación», «el drama»
  function articuloGenero(g) {
    const fem = /^(comedia|accion|animacion|aventura|ciencia|familia|fantasia|historia|musica|romantica|guerra|biografia|epica|intriga)/.test(normalizarChat(g));
    return (fem ? "la " : "el ") + String(g).toLowerCase();
  }

  // Perfil de gustos como texto legible para la IA (antes se enviaba «[object Object]»)
  function perfilTexto() {
    const perfil = perfilGustos();
    const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
    const g = top(perfil.genero), d = top(perfil.director);
    const partes = [];
    if (g.length) partes.push("géneros que más le gustan: " + g.join(", "));
    if (d.length) partes.push("directores que más le gustan: " + d.join(", "));
    return partes.length ? partes.join("; ") : "aún sin gustos claros";
  }

  function emocionEncaja(p, e) {
    const gens = generosDe(p).map(g => normalizarChat(g));
    const genOk = gens.some(g => e.gen.some(x => g.includes(x)));
    const anioOk = !e.anioMax || (Number(p["año"]) && Number(p["año"]) <= e.anioMax);
    return genOk && anioOk;
  }

  function sugerenciaEmocional(e) {
    const filtro = p => emocionEncaja(p, e);
    const texto = sugerirLocal(filtro, 2, e.razon) || sugerirLocal(p => emocionEncaja(p, Object.assign({}, e, { anioMax: null })), 2, e.razon) || sugerirLocal(null, 2, e.razon);
    ultimoFiltro = filtro;
    if (!texto) return "Ya te propuse todo lo que encaja con tu lista. Marca algunas más como vistas y afino las sugerencias.";
    return elegir(e.intros) + "\n\n" + texto + "\n\n¿Cuál te late?";
  }

  // Respuesta cálida a cómo se siente la persona (sin internet)
  function respuestaEmocional(n) {
    // Un «sí» corto después de una charla emocional trae la propuesta
    const afirma = /^(si|sip|sí|claro|dale|va|ok|orale|simon|por favor)\b/.test(n) && n.split(" ").length <= 3;
    if (ultimaEmocion && afirma) { const e = ultimaEmocion; ultimaEmocion = null; return sugerenciaEmocional(e); }
    if (ultimaEmocion && !ANIMO_SIENTE.test(n)) ultimaEmocion = null; // cambió de tema
    if (n.length > 160 || /pelicula|peli|filme|cinta|serie|director|actor|dirigi|reparto/.test(n)) return null;
    // Si pide un género concreto de su catálogo, manda la búsqueda normal
    if (generosCatalogo().some(g => n.includes(normalizarChat(g)))) return null;
    const e = EMOCIONES.find(x => x.re.test(n));
    if (!e || !(ANIMO_SIENTE.test(n) || ANIMO_PIDE.test(n))) return null;
    if (ANIMO_PIDE.test(n)) { ultimaEmocion = null; return sugerenciaEmocional(e); }
    ultimaEmocion = e;
    return e.charla;
  }

  function seleccionParaIA(texto) {
    // Solo se envían las películas que sirven para responder: el catálogo completo pesa mucho y vuelve lenta la respuesta
    const LIMITE = 60;   // máximo de películas que se envían a la IA
    if (Nucleo.datos.peliculas().length <= LIMITE) return Nucleo.datos.peliculas();
    const e = p => estadoDe(p);
    const pend = Nucleo.datos.peliculas().filter(p => e(p).pendiente && !e(p).vista).slice(0, 20);
    const vistas = Nucleo.datos.peliculas().filter(p => e(p).vista).slice(-10);
    const sinMarcar = Nucleo.datos.peliculas().filter(p => !e(p).vista && !e(p).pendiente);
    const palabras = normalizarChat(texto).split(/\s+/).filter(w => w.length > 3);
    const coincide = p => { const txt = normalizarChat([p.titulo, p.genero, p.director, p.reparto].join(" ")); return palabras.some(w => txt.includes(w)); };
    const perfil = perfilGustos();
    const porGusto = sinMarcar.map(p => ({ p, s: puntuar(p, perfil) })).sort((a, b) => b.s - a.s).slice(0, 20).map(x => x.p);
    const porPregunta = palabras.length ? sinMarcar.filter(coincide).slice(0, 15) : [];
    const mezcla = [...pend, ...vistas, ...porPregunta, ...porGusto];
    const vistos = new Set();
    return mezcla.filter(p => { if (vistos.has(p.titulo)) return false; vistos.add(p.titulo); return true; }).slice(0, LIMITE);
  }

  let ultimoFiltro = null;
  let ultimasSugeridas = [];

  function perfilGustos() {
    const perfil = { genero: {}, director: {} };
    vistasDe().forEach(p => {
      const peso = estadoDe(p).estrellas || 1;
      generosDe(p).forEach(g => { perfil.genero[g] = (perfil.genero[g] || 0) + peso; });
      directoresDe(p).forEach(d => { perfil.director[d] = (perfil.director[d] || 0) + peso; });
    });
    // Tus votos A/B también cuentan: la película elegida suma a sus géneros y director
    leerVotos().forEach(t => {
      const p = Nucleo.datos.peliculas().find(x => x.titulo === t);
      if (!p) return;
      generosDe(p).forEach(g => { perfil.genero[g] = (perfil.genero[g] || 0) + 1.5; });
      directoresDe(p).forEach(d => { perfil.director[d] = (perfil.director[d] || 0) + 1; });
    });
    return perfil;
  }

  // ----- Votos A/B -----
  function leerVotos() {
    try { return JSON.parse(localStorage.getItem("votos_gustos") || "[]"); } catch (e) { return []; }
  }
  function guardarVoto(titulo) {
    const v = leerVotos();
    v.push(titulo);
    try { localStorage.setItem("votos_gustos", JSON.stringify(v.slice(-60))); } catch (e) {}
  }

  function votacionAB() {
    const pool = Nucleo.datos.peliculas().filter(p => !estadoDe(p).vista && !(Nucleo.datos.marcas()[p.titulo] || {}).descartada);
    if (pool.length < 2) { burbuja("Necesito al menos dos películas sin ver para votar.", "ia"); return; }
    const a = pool[Math.floor(Math.random() * pool.length)];
    let b = a;
    while (b === a) b = pool[Math.floor(Math.random() * pool.length)];
    burbuja("Te doy dos al azar. ¿Cuál te late más?", "ia");
    const fila = document.createElement("div");
    fila.className = "chat-acciones chat-votos";
    const elegirA = crearBoton("A · " + a.titulo, true, () => { fila.remove(); guardarVoto(a.titulo); burbuja("Anotado: " + a.titulo + ". Ya cuenta para tus gustos.", "ia"); });
    const elegirB = crearBoton("B · " + b.titulo, true, () => { fila.remove(); guardarVoto(b.titulo); burbuja("Anotado: " + b.titulo + ". Ya cuenta para tus gustos.", "ia"); });
    const ninguna = crearBoton("Ninguna", false, () => { fila.remove(); burbuja("Va, otra vez cuando quieras.", "ia"); });
    fila.append(elegirA, elegirB, ninguna);
    lista.appendChild(fila);
    lista.scrollTop = lista.scrollHeight;
  }

  // ----- Racha de semanas con al menos una película vista -----
  function lunesDe(d) {
    const dia = (d.getDay() + 6) % 7;
    const m = new Date(d);
    m.setDate(d.getDate() - dia);
    return isoLocal(m);
  }
  function rachaSemanas() {
    const semanas = new Set();
    let vistasSemana = 0;
    const lunesEsta = lunesDe(new Date());
    Nucleo.datos.peliculas().forEach(p => ((Nucleo.datos.marcas()[p.titulo] || {}).historial || []).forEach(h => {
      if (h.a !== "vista") return;
      semanas.add(lunesDe(new Date(h.f + "T12:00:00")));
      if (String(h.f) >= lunesEsta) vistasSemana++;
    }));
    let cursor = new Date(lunesEsta + "T12:00:00");
    if (!semanas.has(lunesEsta)) cursor = new Date(cursor.getTime() - 7 * 86400000);
    let racha = 0;
    while (semanas.has(lunesDe(cursor))) { racha++; cursor = new Date(cursor.getTime() - 7 * 86400000); }
    return { racha: racha, vistasSemana: vistasSemana };
  }

  // ----- Tablero del asistente: modo, racha y vistas de la semana -----
  function pintarTablero() {
    const t = document.getElementById("chatTablero");
    const orbe = document.getElementById("chatAbrir");
    const local = modoSinIAActivo();
    if (orbe) { orbe.classList.toggle("modo-ia", !local); orbe.classList.toggle("modo-local", local); }
    if (!t) return;
    const r = rachaSemanas();
    t.innerHTML = "";
    [
      [local ? "Sin IA" : "Con IA", local ? "local" : "ia"],
      ["🔥 " + r.racha + (r.racha === 1 ? " semana" : " semanas") + " de racha", ""],
      ["✓ " + r.vistasSemana + " esta semana", ""]
    ].forEach(function (par) {
      const pill = document.createElement("span");
      pill.className = "tablero-pill " + par[1];
      pill.textContent = par[0];
      t.appendChild(pill);
    });
  }


  function puntuar(p, perfil) {
    let s = 0;
    generosDe(p).forEach(g => { s += perfil.genero[g] || 0; });
    directoresDe(p).forEach(d => { s += (perfil.director[d] || 0) * 2; });
    if (estadoDe(p).pendiente) s += 1;
    return s;
  }

  function razonDe(p, perfil) {
    const dir = directoresDe(p).find(d => perfil.director[d]);
    if (dir) return elegir(["porque ya te gustó algo de " + dir, "porque " + dir + " te ha gustado antes"]);
    const gen = generosDe(p).find(g => perfil.genero[g]);
    if (gen) return elegir(["porque te gusta " + articuloGenero(gen), "porque " + articuloGenero(gen) + " está entre tus géneros favoritos"]);
    return elegir(["porque está en tu lista y todavía no la has visto", "porque quedó pendiente y tiene buena pinta para ti"]);
  }

  // Razón para una recomendación de género: concreta, y no la misma frase en toda la lista
  function razonGenero(p, g, perfil) {
    const dir = directoresDe(p).find(d => perfil.director[d]);
    if (dir) return elegir(["porque es de " + g + " y ya te gustó algo de " + dir, "porque es de " + g + " y va por la línea de " + dir]);
    return elegir(["porque es justo de " + g + ", como pediste", "porque es de " + g + " y todavía no la has visto"]);
  }

  // Reparte razones distintas dentro de una misma lista (si sale repetida, vuelve a intentar)
  function razonUnica(p, perfil, razonFija, usadas) {
    const dar = () => typeof razonFija === "function" ? razonFija(p, perfil) : (razonFija || razonDe(p, perfil));
    let r = dar();
    for (let k = 0; k < 6 && usadas.has(r); k++) r = dar();
    usadas.add(r);
    return r;
  }

  function sugerirLocal(filtro, n = 2, razonFija = null) {
    const perfil = perfilGustos();
    const candidatos = Nucleo.datos.peliculas()
      .filter(p => !estadoDe(p).vista && !(Nucleo.datos.marcas()[p.titulo] || {}).descartada && !sesionSugeridas.has(p.titulo) && (!filtro || filtro(p)))
      .map(p => ({ p, s: puntuar(p, perfil) }))
      .sort((a, b) => b.s - a.s);
    if (!candidatos.length) return null;
    const elegidos = candidatos.slice(0, n).map(c => c.p);
    elegidos.forEach(p => sesionSugeridas.add(p.titulo));
    ultimasSugeridas = elegidos;
    const usadas = new Set();
    return elegidos.map(p => "• " + p.titulo + (p["año"] ? " (" + p["año"] + ")" : "") + ": " + razonUnica(p, perfil, razonFija, usadas)).join("\n");
  }

  const animosLocal = [
    { re: /triste|melancolic|deprim|bajon|llorar/, gen: ["animacion", "comedia", "familia", "drama"], intro: "Para ese ánimo, algo que abrace un poco:" },
    { re: /aburrid|flojo|sin ganas/, gen: ["accion", "aventura", "ciencia ficcion", "suspenso"], intro: "Para sacudirte el aburrimiento:" },
    { re: /miedo|susto|escalof/, gen: ["terror", "suspenso"], intro: "Si buscas que se te pare el corazón:" },
    { re: /romant|enamorad|pareja|cita/, gen: ["romance", "comedia romantica", "drama"], intro: "Para una noche romántica:" },
    { re: /relaj|tranquil|cansad|estresad/, gen: ["comedia", "animacion", "familia"], intro: "Para desconectar sin pensar mucho:" },
    { re: /feliz|contento|emocionad|alegr/, gen: ["comedia", "aventura", "musical"], intro: "Para mantener esa energía:" }
  ];

  function respuestaSugerencia(intro, filtro, razon = null) {
    ultimoFiltro = filtro;
    ultimasSeriesSugeridas = [];
    const texto = sugerirLocal(filtro, 2, razon);
    if (!texto) {
      const hayAlgo = Nucleo.datos.peliculas().some(p => !estadoDe(p).vista && !(Nucleo.datos.marcas()[p.titulo] || {}).descartada && (!filtro || filtro(p)));
      return hayAlgo
        ? "Ya te propuse todo lo que encaja con tu lista. Marca algunas películas más como vistas y afino las sugerencias."
        : "Con ese criterio no me sale nada en tu lista ahorita. ¿Probamos con más tiempo, quitando el año o con otro género?";
    }
    return intro + "\n\n" + texto;
  }

  function compararLocal(a, b) {
    const estadoTxt = p => {
      const e = estadoDe(p);
      return e.vista ? "ya la viste" + (e.estrellas ? " y le diste " + e.estrellas + " estrellas" : "") : (e.pendiente ? "está en tus pendientes" : "todavía no la has marcado");
    };
    const comunes = (x, y) => x.filter(v => y.includes(v));
    const genComun = comunes(generosDe(a), generosDe(b));
    const repComun = comunes(listaCampo(a, "reparto"), listaCampo(b, "reparto"));
    const perfil = perfilGustos();
    const sA = puntuar(a, perfil), sB = puntuar(b, perfil);
    const dirA = directoresDe(a).join(" y ") || "un director sin dato", dirB = directoresDe(b).join(" y ") || "un director sin dato";
    let t = "Te cuento las dos. «" + a.titulo + "» es de " + (a["año"] || "año sin dato") + " y dura " + (a.duracion ? String(a.duracion).replace(/\bmin\b\.?/i, "minutos") : "tiempo sin dato") + "; la dirigió " + dirA + ". ";
    t += "«" + b.titulo + "» es de " + (b["año"] || "año sin dato") + " y dura " + (b.duracion ? String(b.duracion).replace(/\bmin\b\.?/i, "minutos") : "tiempo sin dato") + "; la dirigió " + dirB + ".\n\n";
    t += genComun.length ? "En común tienen el género " + genComun.join(" y ").toLowerCase() + ". " : "No comparten género. ";
    t += repComun.length ? "Y en el reparto coinciden " + repComun.slice(0, 3).join(", ") + ".\n\n" : "Tampoco comparten reparto.\n\n";
    t += "En tu caso, «" + a.titulo + "» " + estadoTxt(a) + " y «" + b.titulo + "» " + estadoTxt(b) + ".\n\n";
    t += sA === sB
      ? "Según lo que ya te gusta, las dos te pueden encajar igual."
      : "Según lo que ya te gusta, yo me iría con «" + (sA > sB ? a.titulo : b.titulo) + "».";
    return t;
  }

  let ultimoTitulo = null;

  // Opinión basada en tus gustos, no en una lista genérica
  function opinionLocal(p) {
    const perfil = perfilGustos();
    const ranking = Nucleo.datos.peliculas().map(x => puntuar(x, perfil)).sort((a, b) => a - b);
    const mediana = ranking[Math.floor(ranking.length / 2)] || 0;
    const mi = puntuar(p, perfil);
    const dirs = directoresDe(p).filter(d => perfil.director[d]);
    const gens = generosDe(p).filter(g => perfil.genero[g]);
    if (estadoDe(p).vista && estadoDe(p).estrellas) {
      return "Ya la viste y le diste " + estadoDe(p).estrellas + " estrellas, así que esa es tu opinión. ¿Quieres que te diga algo parecido?";
    }
    if (mi > mediana && (dirs.length || gens.length)) {
      return "Según tus gustos, sí te la recomendaría: " + (dirs.length ? "tiene a " + dirs[0] + ", que ya te gusta" : "es de " + gens[0].toLowerCase() + ", un género que te llena") + ".";
    }
    return "Según lo que has calificado, no me jugaría por ella: encaja menos con tus gustos que otras de tu lista. Si aun así te da curiosidad, adelante.";
  }

  function respuestaLocal(t) {
    const n = expandirChat(normalizarChat(t));
    const refin = refinarUltimo(n);
    if (refin) return refin;
    const pend = pendientesDe();
    const vistas = vistasDe();

    // Conversación: "otra", "no me gustó", ánimo, género
    if (/^(otra|otras|dame otra|y otra|otra mas|mas|siguiente|y de esas)\b/.test(n)) {
      const texto = sugerirLocal(ultimoFiltro);
      if (!texto) return "Esas son todas las que encajan ahorita. ¿Probamos con otro género o un ánimo distinto?";
      return elegir(["Va otra:", "Esta también podría gustarte:", "Otra que encaja:"]) + "\n\n" + texto;
    }
    // Recomendaciones por ocasión
    if (/para ver con (mi|mis|un|una|la|el)|en familia|con ninos|con mis ninos|con mi mama|con mi papa/.test(n)) {
      return respuestaSugerencia("Para ver en familia, te propongo:", p => generosDe(p).some(g => /familia|animacion|comedia|aventura/.test(normalizarChat(g))), "para verla en familia");
    }
    if (/noche de (terror|miedo|sustos)|peli de miedo|algo de miedo/.test(n)) {
      return respuestaSugerencia("Noche de sustos, va:", p => generosDe(p).some(g => /terror|suspenso/.test(normalizarChat(g))), "para pasar miedo");
    }
    if (/noche de (risas|reir|reirme)|para reirme|para reir|algo gracioso/.test(n)) {
      return respuestaSugerencia("Para reírte un rato:", p => generosDe(p).some(g => /comedia/.test(normalizarChat(g))), "para reírte un rato");
    }

    // Estadísticas: género favorito, general o de este año
    if (/genero favorito|mi genero|que genero veo mas|genero que mas/.test(n)) {
      const year = String(new Date().getFullYear());
      const conteo = {};
      const esteAno = /este ano|este año|de este ano|del ano/.test(n);
      const base = esteAno
        ? vistasDe().filter(p => ((Nucleo.datos.marcas()[p.titulo] || {}).historial || []).some(h => h.a === "vista" && String(h.f).startsWith(year)))
        : vistasDe();
      base.forEach(p => generosDe(p).forEach(g => { conteo[g] = (conteo[g] || 0) + 1; }));
      const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 2);
      if (!top.length) return esteAno ? "Este año todavía no marcas películas como vistas, así que no tengo base para decirte tu género de este año." : "Todavía no tengo suficientes películas vistas para decir cuál es tu género favorito.";
      return "Tu género favorito es " + top[0][0].toLowerCase() + (top[1] ? ", seguido de " + top[1][0].toLowerCase() : "") + ", con " + top[0][1] + (top[0][1] === 1 ? " película" : " películas") + (esteAno ? " este año." : " en total.");
    }

    // Seguimiento: por qué, decide por mí
    if (/por que|porque|y eso|razon/.test(n) && ultimasSugeridas.length) {
      return "Te la sugerí " + razonDe(ultimasSugeridas[0], perfilGustos()) + ". ¿Te late esa línea o prefieres otra?";
    }
    if (/decide tu|decides tu|no se|sorprendeme|elige tu|tu eliges/.test(n)) {
      const texto = sugerirLocal(null, 1);
      if (!texto) return "Ya no tengo qué elegir por ti. Marca algunas vistas y lo intento de nuevo.";
      return elegir(["Me arriesgo con esta:", "Mi elección va por aquí:"]) + "\n\n" + texto + "\n\nSi no te convence, dime «otra».";
    }

    // Tiempo disponible: "tengo una hora", "tengo 90 minutos", "poco tiempo", "mucho tiempo"
    let minutosDisponibles = 0;
    const horas = n.match(/(\d+)\s*(horas?|h)\b/);
    const mins = n.match(/(\d+)\s*(minutos?|min)\b/);
    if (/media hora/.test(n)) minutosDisponibles = 30;
    if (/una hora/.test(n)) minutosDisponibles = 60;
    if (horas) minutosDisponibles = Number(horas[1]) * 60;
    if (mins) minutosDisponibles += Number(mins[1]);
    if (minutosDisponibles > 0 && /tengo|tiempo|quedan|disponible|hora|minutos/.test(n)) {
      const etiqueta = minutosDisponibles % 60 === 0
        ? (minutosDisponibles / 60) + (minutosDisponibles === 60 ? " hora" : " horas")
        : minutosDisponibles + " minutos";
      return respuestaSugerencia("Con " + etiqueta + ", te cabe:", p => minutos(p) > 0 && minutos(p) <= minutosDisponibles + 10);
    }
    if (/poco tiempo|rapid[ao]|algo corto/.test(n)) {
      return respuestaSugerencia("Algo corto, de menos de hora y media:", p => minutos(p) > 0 && minutos(p) < 90);
    }
    if (/mucho tiempo|toda la tarde|noche larga|tengo tiempo/.test(n)) {
      return respuestaSugerencia("Tienes tiempo, así que algo para disfrutar sin prisa:", p => minutos(p) > 120);
    }

    // Seguimiento: "y su director", "quién la dirigió" sobre la última película mencionada
    if (ultimoTitulo && /director|quien la dirigio|quien la hizo|quien la dirige/.test(n)) {
      const dirs = directoresDe(ultimoTitulo);
      if (!dirs.length) return "No tengo el director de «" + ultimoTitulo.titulo + "» en tu catálogo.";
      const otras = Nucleo.datos.peliculas().filter(p => p !== ultimoTitulo && directoresDe(p).some(d => dirs.includes(d)));
      return "«" + ultimoTitulo.titulo + "» es de " + dirs.join(" y ") + "." + (otras.length ? " Otras de él en tu catálogo: " + otras.map(p => p.titulo).slice(0, 4).join(", ") + "." : " No tengo más de él en tu catálogo.");
    }

    // Comparar dos películas de tu catálogo
    const encontradas = Nucleo.datos.peliculas()
      .filter(p => String(p.titulo).length > 3 && n.includes(normalizarChat(p.titulo)))
      .map(p => ({ p, i: n.indexOf(normalizarChat(p.titulo)) }))
      .sort((x, y) => x.i - y.i)
      .map(x => x.p);
    if (/compar|\bvs\b|versus|cual es mejor/.test(n) && encontradas.length >= 2) {
      return compararLocal(encontradas[0], encontradas[1]);
    }

    // Conversación natural: películas que menciona, despedidas, clima, planes, respuestas cortas
    const titulo = Nucleo.datos.peliculas().filter(p => String(p.titulo).length > 3).find(p => n.includes(normalizarChat(p.titulo)));
    // Algo parecido a una película de tu catálogo
    if (titulo && /parecid|como la |como el |similar|algo como/.test(n)) {
      const gensT = generosDe(titulo);
      const dirT = directoresDe(titulo), perT = personasDe(titulo);
      return respuestaSugerencia("Si te gustó «" + titulo.titulo + "», va algo en esa línea:", p => p !== titulo && (
        generosDe(p).some(g => gensT.includes(g)) ||
        directoresDe(p).some(d => dirT.includes(d)) ||
        personasDe(p).some(x => perT.includes(x))
      ));
    }
    if (titulo) {
      const est = estadoDe(titulo);
      const gens = generosDe(titulo);
      if (/me gusto|me encanto|me encanta|buenisim|excelente|la ame|me fascin/.test(n)) {
        return respuestaSugerencia("¡Qué bueno que te gustó «" + titulo.titulo + "»! Si quieres más en esa línea:", p => generosDe(p).some(g => gens.includes(g)));
      }
      if (/no me gusto|aburri|no me convenc|mala/.test(n)) {
        return elegir(["Gracias por decírmelo, no todas pegan con todos. ¿Seguimos con algo distinto?", "Va, anotado que no te convenció «" + titulo.titulo + "». ¿Qué te late ahora?"]);
      }
      const estado = est.vista
        ? "la tienes como vista" + (est.estrellas ? " y le diste " + est.estrellas + " estrellas" : "")
        : (est.pendiente ? "la tienes en pendientes" : "todavía no la has marcado");
      ultimoTitulo = titulo;
      if (/opinas|te gusta|vale la pena|buena|recomiendas|me conviene/.test(n)) return opinionLocal(titulo);
      if (/dime mas|cuentame|hablame|platicame|dime de|de que trata|como es|de que va|que tal/.test(n)) {
        const datos = [];
        if (titulo["año"]) datos.push("salió en " + titulo["año"]);
        const gensUnicos = [...new Set(gens)];
        if (gensUnicos.length) datos.push("es de " + gensUnicos.slice(0, 2).join(" y ").toLowerCase());
        if (directoresDe(titulo).length) datos.push("la dirigió " + directoresDe(titulo).join(" y "));
        if (titulo.duracion) datos.push("dura " + titulo.duracion);
        const rep = [...new Set(listaCampo(titulo, "reparto"))].slice(0, 2);
        if (rep.length) datos.push("actúan " + rep.join(" y "));
        return "«" + titulo.titulo + "» " + (datos.length ? datos.join(", ") : "no tengo más datos de ella") + ". Y " + estado + ". ¿La quieres ver o ya la viste?";
      }
      return "«" + titulo.titulo + "»: " + estado + ". ¿Qué quieres saber de ella?";
    }
    if (/adios|bye|nos vemos|hasta luego|me voy|chao/.test(n)) {
      const nom = nombreUsuario();
      return elegir(["¡Nos vemos" + (nom ? ", " + nom : "") + "! Que disfrutes la peli.", "¡Hasta luego" + (nom ? ", " + nom : "") + "! Aquí estaré cuando vuelvas."]);
    }
    if (/llueve|lluvia|frio|fresco/.test(n)) {
      return respuestaSugerencia("Con la lluvia, algo acogedor:", p => generosDe(p).some(g => /comedia|drama|animacion|romance/i.test(g)));
    }
    if (/fin de semana|sabado|domingo|viernes/.test(n)) {
      return respuestaSugerencia("Para el fin de semana, algo que se disfrute con calma:", null);
    }
    if (/palomitas|hambre|comer|antojo/.test(n)) {
      return elegir(["Palomitas listas. ¿Qué tal algo de comedia para acompañarlas?", "Yo la acompaño con palomitas. ¿Qué te antojas ver?"]);
    }
    if (/que opinas|tu opinion|tu favorita|cual es tu favorita/.test(n)) {
      return "Mi favorita cambia según el día, pero me encanta cuando alguien descubre una película que lo sorprende. ¿Cuál es la tuya?";
    }
    if (/^(si|sí|claro|dale|va|ok|orale|simon)\b/.test(n) && ultimasSugeridas.length) {
      return "¡Buena! Cuando la veas, dime y la marco como vista con tu calificación.";
    }
    if (/^(no|nel|nop)\b/.test(n)) {
      return elegir(["Va, sin problema. ¿Buscamos otra cosa?", "Ok, no pasa nada. ¿Qué te late ahora?"]);
    }
    if (/no me (gusto|late|convence|interesa|va)|no quiero esa|otra cosa|paso de esa/.test(n)) {
      if (!ultimasSugeridas.length) return "¿Cuál no te gustó? Dime el título y no la vuelvo a sugerir en esta sesión.";
      const genero0 = generosDe(ultimasSugeridas[0])[0];
      ultimasSugeridas.forEach(p => sesionSugeridas.add(p.titulo));
      if (genero0 && !/^(no me gusta|no quiero)/.test(n)) {
        setTimeout(() => proponerNota("no me gusta el género " + genero0.toLowerCase()), 600);
      }
      const texto = sugerirLocal(ultimoFiltro);
      return "Anotado, no la repito. " + (texto ? "Pruebo con otras:\n\n" + texto : "Ya no tengo más que encajen con eso.");
    }
    const animo = animosLocal.find(a => a.re.test(n));
    if (animo) {
      return respuestaSugerencia(animo.intro, p => generosDe(p).some(g => animo.gen.some(x => normalizarChat(g).includes(x))), "para este momento");
    }
    const generoTexto = [...new Set(Nucleo.datos.peliculas().flatMap(p => generosDe(p)))].find(g => n.includes(normalizarChat(g)));
    if (generoTexto) {
      return respuestaSugerencia(elegir(["Buena elección. De " + generoTexto.toLowerCase() + " te propongo:", "¡Me gusta tu gusto! Va de " + generoTexto.toLowerCase() + ":"]), p => generosDe(p).includes(generoTexto), (p, perfil) => razonGenero(p, generoTexto.toLowerCase(), perfil));
    }
    if (/que veo|sugier|recomie|algo para ver|que pongo|sorprend|algo bueno/.test(n)) {
      const hora = new Date().getHours();
      if (hora >= 6 && hora < 12) return respuestaSugerencia("Para la mañana, algo ligerito:", p => minutos(p) > 0 && minutos(p) <= 100);
      if (hora >= 21 || hora < 5) return respuestaSugerencia("Ya es noche cerrada, algo para disfrutar con calma:", p => minutos(p) >= 100);
      return respuestaSugerencia(elegir(["Te propongo esta:", "Esta me late para ti:", "Va una, según tus gustos:"]), null);
    }

    if (/^buenas noches\b/.test(n)) {
      return elegir(["¡Buenas noches! ¿Buscamos algo para esta noche?", "Buenas noches. ¿Qué te apetece ver antes de dormir?"]);
    }
    if (/^buenas tardes\b/.test(n)) {
      return elegir(["¡Buenas tardes! ¿Qué vemos hoy?", "Buenas tardes. ¿Buscamos algo para esta tarde?"]);
    }
    if (/^buenos dias\b/.test(n)) {
      return elegir(["¡Buenos días! ¿Qué tal si empezamos el día con una peli?", "¡Buenos días! ¿Te propongo algo para esta mañana?"]);
    }
    if (/^(hola|hey|hi|hello|buenas|que onda|que tal)\b/.test(n)) {
      const nom = nombreUsuario();
      const saludo = nom ? "¡Hola, " + nom + "!" : "¡Hola!";
      return elegir([
        saludo + " ¿Qué vemos hoy? Puedo sugerirte algo o revisar tus pendientes.",
        saludo + " Qué gusto verte. " + elegir(PREGUNTAS_SALUDO[franjaDelDia()]),
        saludo + " Aquí estoy. ¿Qué te apetece ver?",
        saludo + " Dime si quieres algo nuevo, algo de tu lista o una sorpresa.",
        saludo + " ¿Ya tienes en mente algo o te ayudo a elegir?"
      ]);
    }
    if (/estoy bien|todo bien|bien gracias|muy bien gracias/.test(n)) {
      return elegir(["¡Qué gusto leer eso! ¿Buscamos algo para acompañar ese buen ánimo?", "Me alegra mucho. ¿Qué te apetece ver para seguir así?"]);
    }
    if (/gracias|thank/.test(n)) {
      return elegir(["¡Con gusto! Me alegra que te sirva.", "¡De nada! Para eso estamos.", "Qué bueno que te sirvió. ¿Seguimos con otra?"]);
    }
    if (/como estas|como vas|que tal tu dia/.test(n)) {
      return elegir(["Muy bien, gracias por preguntar. Me pongo contento cuando hay películas de por medio. ¿Y tú qué tal?", "Bien por aquí. ¿Tú cómo vas? Si quieres, te propongo algo para lo que te quede del día."]);
    }
    if (/eres (humano|una persona|real|de carne)|eres (un )?robot/.test(n)) {
      return "Jaja, algo así: soy una IA, no una persona. Pero lo del cine me encanta, y eso sí lo comparto contigo.";
    }
    if (/como te llamas|cual es tu nombre|tu nombre/.test(n)) {
      return "Me llamo " + NOMBRE_COMPA + ". ¿Y tú? Si me dices tu nombre, lo guardo: escribe «recuerda que me llamo…».";
    }
    if (/quien eres|que eres|de donde eres|que haces|sobre ti/.test(n)) {
      return "Soy " + NOMBRE_COMPA + ", tu compa peliculero. Soy una IA y me encanta platicar de cine. Conozco tu catálogo, tus marcas y tus gustos, y aunque no haya internet, sigo aquí contigo.";
    }
    if (/ayuda|que puedes hacer|que haces|como funciona/.test(n)) {
      return "Puedo hacer varias cosas: sugerirte algo («sugiéreme algo»), mostrarte tus pendientes («qué tengo pendiente»), lo que ya viste («qué he visto»), tus favoritas («mis favoritas»), buscar por género o director («algo de terror», «películas de Nolan») darte números («cuántas tengo»), recomendarte para una ocasión («para ver con mi mamá», «noche de terror») o contarte tu semana («resumen de mi semana»).";
    }
    if (/que veo|sugier|recomie|algo para ver|que pongo|sorprend|algo bueno/.test(n)) {
      if (!vistas.length && !pend.length) return "Todavía no tengo suficientes datos de tus gustos. Marca algunas películas como vistas y te sugiero con gusto.";
      const linea = recomendarSinIA(3).split("\n").filter(l => l.startsWith("•"));
      if (!linea.length) return "Aún no tengo una buena sugerencia. Marca algunas vistas con calificación y lo intento de nuevo.";
      return elegir(["Te propongo esta:", "Esta me late para ti:", "Va una, según tus gustos:"]) + "\n\n" + linea.slice(0, 2).join("\n");
    }
    if (/pendiente|por ver|me falta/.test(n)) {
      if (!pend.length) return "No tienes pendientes. ¿Agregamos alguna a tu lista?";
      return elegir(["Tienes " + pend.length + " en tu lista de pendientes:", "Esto es lo que tienes pendiente (" + pend.length + " en total):"]) + "\n\n" + listaTitulos(pend);
    }
    if (/mejor|favorit|mas me gust|top/.test(n)) {
      const top = vistas.filter(p => estadoDe(p).estrellas).sort((a, b) => estadoDe(b).estrellas - estadoDe(a).estrellas);
      if (!top.length) return "Aún no has calificado películas. Dales estrellas y te cuento cuáles son tus favoritas.";
      return "Tus favoritas hasta ahora:\n\n" + top.slice(0, 4).map(p => "• " + p.titulo + " (" + estadoDe(p).estrellas + "★)").join("\n");
    }
    if (/he visto|ya vi|que vi|vistas/.test(n)) {
      if (!vistas.length) return "Todavía no marcas ninguna como vista. Cuando lo hagas, te puedo decir qué tanto te ha gustado.";
      return "Has visto " + vistas.length + " películas. Las más recientes:\n\n" + listaTitulos(vistas.slice(-5).reverse());
    }
    if (/cuantas|cuantos|total|tengo en total/.test(n)) {
      return "¡Tienes " + Nucleo.datos.peliculas().length + " películas en tu colección! " + vistas.length + " ya vistas y " + pend.length + " esperando por ti.";
    }

    // Género o director mencionados en la pregunta
    const generos = [...new Set(Nucleo.datos.peliculas().flatMap(p => generosDe(p)))];
    const genero = generos.find(g => n.includes(normalizarChat(g)));
    if (genero) {
      const de = Nucleo.datos.peliculas().filter(p => generosDe(p).includes(genero) && !estadoDe(p).vista);
      if (!de.length) return "No tengo películas pendientes de " + genero.toLowerCase() + ". ¿Quieres que busque en lo que ya viste?";
      return elegir(["Buena elección. De " + genero.toLowerCase() + " tienes:", "¡Me gusta tu gusto! Estas son de " + genero.toLowerCase() + ":"]) + "\n\n" + listaTitulos(de);
    }
    const directores = [...new Set(Nucleo.datos.peliculas().flatMap(p => directoresDe(p)))];
    const director = directores.filter(d => d.length > 3).find(d => n.includes(normalizarChat(d)));
    if (director) {
      const de = Nucleo.datos.peliculas().filter(p => directoresDe(p).includes(director));
      return "De " + director + " tienes " + de.length + ":\n\n" + listaTitulos(de);
    }

    return elegir([
      "Eso se me escapa en modo sin IA, pero con tus marcas sí te ayudo. Prueba con «sugiéreme algo», «qué tengo pendiente» o «algo de comedia».",
      "Esa no la capté del todo en modo sin IA. Intenta con «qué he visto», «cuántas tengo» o «algo de terror»."
    ]);
  }

  function ponerChips(opciones) {
    document.querySelectorAll(".chat-chips").forEach(e => e.remove());
    const fila = document.createElement("div");
    fila.className = "chat-acciones chat-chips";
    opciones.forEach(txt => {
      fila.appendChild(crearBoton(txt, true, () => {
        fila.remove();
        burbuja(txt, "yo");
        procesarEntrada(txt);
      }));
    });
    lista.appendChild(fila);
    lista.scrollTop = lista.scrollHeight;
  }

  // ---------- Comprensión flexible (sin internet): entiende frases libres con datos del catálogo ----------
  const SINONIMOS_GENERO = {
    terror: ["terror", "miedo", "susto", "sustos", "horror", "de miedo", "espeluznante"],
    comedia: ["comedia", "risa", "risas", "reir", "reirme", "gracioso", "graciosa", "chistosa", "divertida"],
    romance: ["romance", "romantica", "romantico", "amor", "cita", "enamorar"],
    accion: ["accion", "pelea", "peleas", "explosiones", "adrenalina"],
    animacion: ["animacion", "animada", "animadas", "animado", "infantil", "dibujos"],
    drama: ["drama", "triste", "llorar", "emotiva", "emotivo"],
    suspenso: ["suspenso", "tension", "thriller", "intrigante"],
    ciencia: ["ciencia ficcion", "sci fi", "espacio", "futurista"]
  };

  function generosCatalogo() {
    const set = new Set();
    Nucleo.datos.peliculas().forEach(p => generosDe(p).forEach(g => set.add(g)));
    return [...set];
  }

  function generoPedido(n) {
    const catalogo = generosCatalogo();
    const directo = catalogo.find(g => n.includes(normalizarChat(g)));
    if (directo) return directo;
    for (const clave of Object.keys(SINONIMOS_GENERO)) {
      if (SINONIMOS_GENERO[clave].some(s => n.includes(normalizarChat(s)))) {
        const hallado = catalogo.find(g => normalizarChat(g).includes(clave));
        if (hallado) return hallado;
      }
    }
    return null;
  }

  function anioPedido(n) {
    const a = n.match(/\b(19\d{2}|20\d{2})\b/);
    if (a) return { desde: +a[1], hasta: +a[1] };
    const d = n.match(/\b(?:de los |de )?(\d0)s\b/) || n.match(/\bde los (\d0)\b/);
    if (d) {
      const base = +d[1];
      const siglo = base < 30 ? 2000 : 1900;
      return { desde: siglo + base, hasta: siglo + base + 9 };
    }
    return null;
  }

  function minutosPedidos(n) {
    if (/hora y media/.test(n)) return 90;
    const m = n.match(/(\d+)\s*(?:min|minutos|mins)\b/);
    if (m) return +m[1];
    const h = n.match(/(\d+)\s*(?:h|horas?)\b/);
    if (h) return +h[1] * 60;
    if (/\b(corta|corto|rapida|rapido|ligera|ligero)\b/.test(n)) return 100;
    return null;
  }

  function personaPedida(n) {
    let mejor = null;
    Nucleo.datos.peliculas().forEach(p => personasDe(p).forEach(nombre => {
      const nn = normalizarChat(nombre);
      if (nn.length >= 5 && n.includes(nn) && (!mejor || nn.length > normalizarChat(mejor).length)) mejor = nombre;
    }));
    return mejor;
  }

  function tituloPedido(n) {
    let mejor = null;
    Nucleo.datos.peliculas().forEach(p => {
      const tn = normalizarChat(p.titulo);
      if (tn.length >= 4 && n.includes(tn) && (!mejor || tn.length > normalizarChat(mejor.titulo).length)) mejor = p;
    });
    return mejor;
  }

  // Devuelve una respuesta cuando la frase trae datos concretos (género, año, minutos, persona o título).
  // Si no encuentra nada útil, devuelve null y responde el motor de siempre.
  function respuestaFlexible(t) {
    const n = normalizarChat(t);
    const titulo = tituloPedido(n);
    if (titulo && /(de que trata|sinopsis|de que va|cuentame|que es|quien dirigio|quien actua|quien sale)/.test(n)) {
      const dirige = directoresDe(titulo).join(", ") || "sin dato";
      const sin = String(titulo.sinopsis || "").slice(0, 240);
      return "«" + titulo.titulo + "»" + (titulo["año"] ? " (" + titulo["año"] + ")" : "") +
        "\n\nDirige: " + dirige + ". Duración: " + (titulo.duracion || "sin dato") + ". Géneros: " + (generosDe(titulo).join(", ") || "sin dato") + "." +
        (sin ? "\n\n" + sin + (sin.length >= 240 ? "…" : "") : "");
    }

    const genero = generoPedido(n);
    const anio = anioPedido(n);
    const mins = minutosPedidos(n);
    const persona = personaPedida(n);
    if (!genero && !anio && !mins && !persona) return null;

    const partes = [];
    const filtros = [];
    if (genero) {
      partes.push("de " + genero.toLowerCase());
      filtros.push(p => generosDe(p).includes(genero));
    }
    if (anio) {
      partes.push(anio.desde === anio.hasta ? "de " + anio.desde : "de los " + (anio.desde % 100) + "s");
      filtros.push(p => { const y = Number(p["año"]); return y >= anio.desde && y <= anio.hasta; });
    }
    if (mins) {
      partes.push("de hasta " + mins + " min");
      filtros.push(p => { const m = minutos(p); return m > 0 && m <= mins + 15; });
    }
    if (persona) {
      partes.push("con " + persona);
      filtros.push(p => personasDe(p).includes(persona));
    }
    const intro = elegir(["Va, algo " + partes.join(" ") + ":", "Mira lo que encontré " + partes.join(" ") + ":", "Esto encaja con lo que buscas, " + partes.join(" ") + ":"]);
    const texto = respuestaSugerencia(intro, p => filtros.every(fn => fn(p)), genero ? (p, perfil) => razonGenero(p, genero.toLowerCase(), perfil) : null);
    if (texto.startsWith("Ya te propuse")) {
      return "No encuentro nada " + partes.join(", ") + " que te falte ver. ¿Probamos con algo más amplio? Por ejemplo, quita el año o sube los minutos.";
    }
    return texto;
  }

  // Recuerda la última búsqueda y la refina: «más corta», «más larga», «sin drama»
  function refinarUltimo(n) {
    const previo = ultimoFiltro || (() => true);
    if (/^(mas corto|mas cortas?|algo mas corto|mas cortita|mas corta)\b/.test(n)) {
      return respuestaSugerencia("Con ese mismo gusto, pero más corta:", p => previo(p) && minutos(p) > 0 && minutos(p) <= 100);
    }
    if (/^(mas larg[oa]|algo mas largo|mas larga)\b/.test(n)) {
      return respuestaSugerencia("Con ese mismo gusto, pero más larga:", p => previo(p) && minutos(p) >= 110);
    }
    const sin = n.match(/^(?:sin|nada de|menos)\s+(terror|drama|violencia|sangre|miedo|romance|comedia|animacion|accion)\b/);
    if (sin) {
      const g = sin[1];
      return respuestaSugerencia("Lo que te propongo, sin " + g + ":", p => previo(p) && !generosDe(p).some(x => normalizarChat(x).includes(g)));
    }
    return null;
  }

  async function responderLocal(t) {
    const escribiendo = document.createElement("div");
    escribiendo.className = "chat-pensando";
    escribiendo.textContent = "Escribiendo…";
    lista.appendChild(escribiendo);
    lista.scrollTop = lista.scrollHeight;
    await new Promise(r => setTimeout(r, 450 + Math.random() * 500));
    escribiendo.remove();
    const nEst = expandirChat(normalizarChat(t));
    const texto = refinarUltimo(nEst) || respuestaEmocional(nEst) || respuestaFlexible(t) || (await respuestaConModelo(t, historial)) || respuestaLocal(t);
    burbuja(texto, "ia");
    if (/•/.test(texto)) ponerChips(["Otra", "¿Por qué?", "Decide tú"]);
    else if (/Prueba con «sugiéreme algo»|Intenta con «qué he visto»/.test(texto)) ponerChips(["Sugiéreme algo", "Qué tengo pendiente", "Algo de comedia"]);
    mostrarPosters(texto);
  }

  function modoSinIAActivo() {
    if (!navigator.onLine) return true;
    if (consultasPersonalesHoy() >= LIMITE_IA_PERSONAL_DIA) return true;
    if (usoGrupo && usoGrupo.hoy >= usoGrupo.limite) return true;
    try { return localStorage.getItem("cuota_agotada_" + fechaPacifico()) === "1"; } catch (e) { return false; }
  }

  const respuestasCache = new Map();

  function hashTexto(t) {
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function fechaPacifico() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  }

  function tiempoParaReinicio() {
    const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const medianoche = new Date(ahora);
    medianoche.setHours(24, 0, 0, 0);
    const min = Math.max(0, Math.round((medianoche - ahora) / 60000));
    return Math.floor(min / 60) + " h " + (min % 60) + " min";
  }

  function contarConsultaPersonal() {
    const clave = "chat_consultas_" + fechaPacifico();
    try {
      const n = Number(localStorage.getItem(clave) || 0) + 1;
      localStorage.setItem(clave, String(n));
      return n;
    } catch (e) { return null; }
  }

  function consultasPersonalesHoy() {
    try { return Number(localStorage.getItem("chat_consultas_" + fechaPacifico()) || 0); } catch (e) { return null; }
  }

  function mensajeCuota() {
    const n = consultasPersonalesHoy();
    let t = "Por hoy ya se agotaron las consultas gratuitas de la IA (las comparten todas las cuentas).\n\n";
    if (n !== null) t += "Tus consultas de hoy: " + n + ".\n";
    t += "Se reinicia en " + tiempoParaReinicio() + " (medianoche, hora del Pacífico).\nMientras tanto sigo aquí en modo sin IA: te puedo sugerir, comparar y contarte tus números.";
    return t;
  }

  async function preguntar(texto, oculta = false, yaMostrada = false) {
    if (!accessToken || !Nucleo.datos.peliculas().length) {
      burbuja("Primero necesito que tu catálogo cargue. Intenta en unos segundos.", "error");
      return;
    }
    if (!oculta && !yaMostrada) burbuja(texto, "yo");
    if (!oculta && !yaMostrada && intentoAbrirSugerida(texto)) return;
    if (!oculta && consultasPersonalesHoy() >= LIMITE_IA_PERSONAL_DIA) {
      burbuja("Hoy ya usaste tus " + LIMITE_IA_PERSONAL_DIA + " consultas con IA. Sigo contigo en modo sin IA; la IA vuelve a medianoche (hora del Pacífico).", "ia");
      responderLocal(texto);
      return;
    }
    const pensando = document.createElement("div");
    pensando.className = "chat-pensando";
    pensando.textContent = "Pensando…";
    lista.appendChild(pensando);
    lista.scrollTop = lista.scrollHeight;
    enviar.disabled = true;

    try {
      if (navigator.onLine === false) {
        pensando.remove();
        caeASinIA("Sin conexión: te respondo con lo que tengo guardado en este teléfono.", texto);
        return;
      }
      const catalogo = catalogoParaIA(texto);
      const clave = hashTexto(JSON.stringify({ p: texto, h: historial, c: catalogo }));
      if (respuestasCache.has(clave)) {
        pensando.remove();
        const previa = respuestasCache.get(clave);
        if (!oculta) {
          burbuja(previa, "ia");
          mostrarPosters(previa);
          historial.push({ role: "user", content: texto });
          historial.push({ role: "assistant", content: previa });
          historial = historial.slice(-16);
        }
        return previa;
      }
      const control = new AbortController();
      const tiempo = setTimeout(() => control.abort(), 25000);
      let r;
      try {
        r = await fetch(CHAT_URL, {
          method: "POST",
          signal: control.signal,
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ token: accessToken, pregunta: texto + "\n\n[Perfil de gustos del usuario: " + (chatEnviarPersonal() ? perfilTexto() : "no compartido") + ".]\n[Estilo: " + ESTILO_IA + ". Momento del día: " + momentoDia() + ".]", historial: historial, catalogo: catalogo, gustos: (chatEnviarPersonal() ? perfilGustos() : null) })
        });
      } finally { clearTimeout(tiempo); }
      const j = await r.json();
      pensando.remove();
      if (j.uso) pintarUso(j.uso);
      if (j.error) {
        const cuota = String(j.error).includes("429") || j.codigo === "limite_grupo";
        if (cuota) { try { localStorage.setItem("cuota_agotada_" + fechaPacifico(), "1"); } catch (e) {} }
        const motivo = cuota ? mensajeCuota() : "Ahorita la IA no está disponible.";
        if (oculta) burbuja(motivo, "error");
        else caeASinIA(motivo, texto);
      } else {
        contarConsultaPersonal();
        if (!j.accion) {
          respuestasCache.set(clave, j.respuesta);
          if (respuestasCache.size > 60) respuestasCache.delete(respuestasCache.keys().next().value);
        }
        if (!oculta) {
          burbuja(j.respuesta, "ia");
          const nombradas = titulosEnTexto(j.respuesta);
          if (nombradas.length) ultimasSugeridas = nombradas;
          mostrarPosters(j.respuesta);
          if (j.accion) proponerAccionIA(j.accion);
          historial.push({ role: "user", content: texto });
          historial.push({ role: "assistant", content: j.respuesta });
          historial = historial.slice(-16);
        }
        return j.respuesta;
      }
    } catch (e) {
      pensando.remove();
      const lento = e && e.name === "AbortError";
      if (oculta) burbuja(lento ? "La IA tardó demasiado. Intenta de nuevo." : "No pude conectar con el asistente. Revisa tu conexión.", "error");
      else caeASinIA(lento ? "La IA tardó demasiado en responder." : "No pude conectar con la IA.", texto);
    } finally {
      enviar.disabled = false;
    }
  }

  /* ---------- Preferencias (Drive, carpeta privada de la app) ---------- */
  let notas = [];
  let notasId = null;
  let notasCargadas = false;

  async function notasCargar() {
    if (!accessToken) return;
    try {
      const q = encodeURIComponent("name='chat_notas.json'");
      const r = await driveFetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=" + q + "&fields=files(id)");
      const j = await r.json();
      notasId = (j.files && j.files[0] && j.files[0].id) || null;
      if (notasId) {
        const c = await driveFetch("https://www.googleapis.com/drive/v3/files/" + notasId + "?alt=media");
        const d = await c.json();
        notas = Array.isArray(d) ? d.filter(x => typeof x === "string").slice(0, 20) : [];
      }
      notasCargadas = true;
    } catch (e) { notasCargadas = false; }
  }

  async function notasGuardar() {
    const cuerpo = JSON.stringify(notas);
    if (notasId) {
      await driveFetch("https://www.googleapis.com/upload/drive/v3/files/" + notasId + "?uploadType=media", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: cuerpo
      });
      return;
    }
    const f = "chat_notas_frontera";
    const meta = JSON.stringify({ name: "chat_notas.json", parents: ["appDataFolder"] });
    const partes = "--" + f + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta + "\r\n" +
      "--" + f + "\r\nContent-Type: application/json\r\n\r\n" + cuerpo + "\r\n--" + f + "--";
    const r = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + f }, body: partes
    });
    const j = await r.json();
    notasId = j.id;
  }

  /* ---------- Acciones con confirmación ---------- */
  // Pregunta de sí o no que espera respuesta: escribir «sí» o «no» equivale a tocar el botón
  let confirmacionPendiente = null;
  function preguntarConfirmacion(texto, textoSi, alSi) {
    burbuja(texto, "ia");
    const fila = document.createElement("div");
    fila.className = "chat-acciones";
    const si = document.createElement("button");
    si.type = "button";
    si.textContent = textoSi;
    const no = document.createElement("button");
    no.type = "button";
    no.className = "secundario";
    no.textContent = "Cancelar";
    const pendiente = { fila, alSi };
    confirmacionPendiente = pendiente;
    si.addEventListener("click", () => { if (confirmacionPendiente === pendiente) confirmacionPendiente = null; fila.remove(); alSi(); });
    no.addEventListener("click", () => { if (confirmacionPendiente === pendiente) confirmacionPendiente = null; fila.remove(); burbuja("Cancelado. No cambié nada.", "ia"); });
    fila.append(si, no);
    lista.appendChild(fila);
    lista.scrollTop = lista.scrollHeight;
  }

  function proponerNota(texto) {
    if (!texto || texto.length > 200) {
      burbuja("Escríbelo en menos de 200 caracteres, por favor.", "error");
      return;
    }
    preguntarConfirmacion("¿Lo guardo para tenerlo presente en tus próximas recomendaciones?\n\n«" + texto + "»", "Guardar", async () => {
      notas.push(texto);
      try {
        await notasGuardar();
        burbuja("Listo, quedó guardado. Lo tendré presente en tus recomendaciones.", "ia");
      } catch (e) {
        notas.pop();
        burbuja("No pude guardarlo en tu Drive. Intenta de nuevo más tarde.", "error");
      }
    });
  }

  function crearBoton(texto, secundario, alClick) {
    const b = document.createElement("button");
    b.type = "button";
    if (secundario) b.className = "secundario";
    b.textContent = texto;
    b.addEventListener("click", alClick);
    return b;
  }

  async function guardarMemoria() {
    if (!notasId && !notas.length) return;
    await notasGuardar();
  }

  function mostrarMemoria() {
    const nombre = nombreUsuario();
    if (!nombre && !notas.length) {
      burbuja("Por ahora no tengo nada guardado de ti. Si me dices tu nombre con «recuerda que me llamo…», lo tengo presente.", "ia");
      return;
    }
    let t = nombre ? "Claro, " + nombre + ". Esto es lo que recuerdo de ti." : "Esto es lo que recuerdo de ti. Todavía no me has dicho tu nombre.";
    t += notas.length
      ? (notas.length === 1 ? " Tengo una preferencia guardada:" : " Tengo " + notas.length + " preferencias guardadas:") + "\n\n" + notas.map((n, i) => (i + 1) + ". " + n).join("\n")
      : " Todavía no tienes preferencias guardadas.";
    t += "\n\nTus notas viven en cada ficha de tu catálogo, no aquí.";
    burbuja(t, "ia");

    const fila = document.createElement("div");
    fila.className = "chat-acciones";
    notas.forEach((n, i) => {
      fila.appendChild(crearBoton("Borrar " + (i + 1), true, async () => {
        notas.splice(i, 1);
        fila.remove();
        try { await guardarMemoria(); burbuja("Listo, esa ya no la recuerdo.", "ia"); }
        catch (e) { burbuja("No pude actualizar tu Drive. Intenta más tarde.", "error"); }
      }));
    });
    if (nombre) {
      fila.appendChild(crearBoton("Olvidar mi nombre", true, () => {
        fila.remove();
        preguntarConfirmacion("¿Olvido tu nombre? Ya no te saludaré por él.", "Sí, olvidarlo", async () => {
          notas = notas.filter(x => !/me llamo/i.test(String(x)));
          try { await guardarMemoria(); burbuja("Listo, ya no sé cómo te llamas.", "ia"); }
          catch (e) { burbuja("No pude actualizar tu Drive. Intenta más tarde.", "error"); }
        });
      }));
    }
    if (notas.length) {
      fila.appendChild(crearBoton("Borrar todo", false, () => {
        fila.remove();
        preguntarConfirmacion("¿Borro todo lo que recuerdo de ti? Incluye tu nombre y tus preferencias. Tus marcas y notas de películas no se tocan.", "Sí, borrar todo", async () => {
          notas = [];
          try { await guardarMemoria(); burbuja("Listo, empezamos de cero. Tus marcas siguen como estaban.", "ia"); }
          catch (e) { burbuja("No pude actualizar tu Drive. Intenta más tarde.", "error"); }
        });
      }));
    }
    if (fila.children.length) lista.appendChild(fila);
    lista.scrollTop = lista.scrollHeight;
  }

  // Acción propuesta por la IA: siempre pasa por la confirmación de siempre
  function proponerAccionIA(a) {
    if (!a) return;
    if (a.tipo === "marcar") return proponerMarca(a.titulo, a.estado);
    if (a.tipo === "nota") return proponerNotaPelicula(a.titulo, a.nota);
    if (a.tipo === "maraton") return proponerMaratonIA(a.titulos);
  }

  // La IA arma la noche: se confirma antes de abrir el modo cine
  function proponerMaratonIA(titulos) {
    const films = (titulos || []).map(t => Nucleo.datos.peliculas().find(p => p.titulo === t)).filter(Boolean).slice(0, 5);
    if (!films.length) { burbuja("No encontré esas películas en tu catálogo.", "error"); return; }
    const lista = films.map(f => "• " + f.titulo + " (" + minutos(f) + " min)").join("\n");
    preguntarConfirmacion("Te armé esta noche:\n\n" + lista + "\n\n¿La empezamos en modo cine?", "Empezar", () => {
      if (typeof window.abrirModoCine === "function") window.abrirModoCine(films[0], films);
    });
  }

  function proponerMarca(titulo, estado) {
    const p = Nucleo.datos.peliculas().find(x => String(x.titulo).toLowerCase() === titulo.toLowerCase());
    if (!p) {
      burbuja("No encontré «" + titulo + "» en tu catálogo. Revisa que el título esté escrito igual.", "error");
      return;
    }
    preguntarConfirmacion("¿Marco «" + p.titulo + "» como " + estado + "?", "Sí, marcar", () => {
      if (estado === "vista") cambiarEstado(p.titulo, { vista: true });
      else cambiarEstado(p.titulo, { pendiente: true, vista: false });
      if (typeof refrescarTodo === "function") refrescarTodo();
      burbuja("Listo: «" + p.titulo + "» quedó como " + estado + ".", "ia");
    });
  }

  function proponerNotaPelicula(titulo, texto) {
    const p = Nucleo.datos.peliculas().find(x => String(x.titulo).toLowerCase() === titulo.toLowerCase());
    if (!p) {
      burbuja("No encontré «" + titulo + "» en tu catálogo. Revisa que el título esté escrito igual.", "error");
      return;
    }
    const t = String(texto || "").trim();
    if (!t || t.length > 1000) {
      burbuja("La nota debe tener entre 1 y 1000 caracteres.", "error");
      return;
    }
    const previa = (Nucleo.datos.marcas()[p.titulo] || {}).nota || "";
    const aviso = previa ? "\n\nSe agregará debajo de tu nota actual, sin borrarla." : "";
    preguntarConfirmacion("¿Guardo esta nota en «" + p.titulo + "»?\n\n«" + t + "»" + aviso, "Guardar nota", () => {
      guardarNota(p.titulo, previa ? previa + "\n" + t : t);
      if (typeof refrescarTodo === "function") refrescarTodo();
      burbuja("Nota guardada en «" + p.titulo + "».", "ia");
    });
  }

  async function redactarNotaIA(titulo) {
    const p = Nucleo.datos.peliculas().find(x => String(x.titulo).toLowerCase() === titulo.toLowerCase());
    if (!p) {
      burbuja("No encontré «" + titulo + "» en tu catálogo. Revisa que el título esté escrito igual.", "error");
      return;
    }
    burbuja("Redacta una nota para «" + p.titulo + "»", "yo");
    const instruccion = "Redacta una nota personal breve (máximo 300 caracteres, en español) sobre la película «" + p.titulo +
      "», usando solo los datos de su ficha del catálogo. Responde únicamente con el texto de la nota, sin comillas ni introducción.";
    const texto = await preguntar(instruccion, true);
    if (!texto) return;
    const limpio = texto.replace(/^["«»]+|["«»]+$/g, "").trim().slice(0, 1000);
    burbuja(limpio, "ia");
    preguntarConfirmacion("¿Guardo esta nota en «" + p.titulo + "»?", "Guardar nota", () => {
      const previa = (Nucleo.datos.marcas()[p.titulo] || {}).nota || "";
      guardarNota(p.titulo, previa ? previa + "\n" + limpio : limpio);
      if (typeof refrescarTodo === "function") refrescarTodo();
      burbuja("Nota guardada en «" + p.titulo + "».", "ia");
    });
  }

  // ----- Estadísticas compartibles del año -----
  function estadisticasDeCine() {
    const vistas = vistasDe();
    const year = String(new Date().getFullYear());
    const esteAno = vistas.filter(p => ((Nucleo.datos.marcas()[p.titulo] || {}).historial || []).some(h => h.a === "vista" && String(h.f).startsWith(year)));
    const conteoGeneros = {};
    vistas.forEach(p => generosDe(p).forEach(g => { conteoGeneros[g] = (conteoGeneros[g] || 0) + 1; }));
    const generoFavorito = Object.entries(conteoGeneros).sort((a, b) => b[1] - a[1])[0];
    const calificadas = vistas.filter(p => estadoDe(p).estrellas);
    const promedio = calificadas.length ? calificadas.reduce((acc, p) => acc + estadoDe(p).estrellas, 0) / calificadas.length : null;
    const mejor = calificadas.slice().sort((a, b) => estadoDe(b).estrellas - estadoDe(a).estrellas)[0] || null;
    return {
      year,
      nombre: nombreUsuario(),
      vistas: vistas.length,
      esteAno: esteAno.length,
      generoFavorito: generoFavorito ? generoFavorito[0] : null,
      promedio: promedio === null ? null : Math.round(promedio * 10) / 10,
      mejor: mejor ? mejor.titulo + " (" + estadoDe(mejor).estrellas + "★)" : null
    };
  }

  function textoEstadisticas(e) {
    const lineas = ["Mi cine de " + e.year + (e.nombre ? " · " + e.nombre : "") + " 🎬"];
    lineas.push("• Vistas: " + e.vistas + (e.esteAno ? " (este año: " + e.esteAno + ")" : ""));
    if (e.generoFavorito) lineas.push("• Género favorito: " + e.generoFavorito);
    if (e.promedio !== null) lineas.push("• Calificación promedio: " + e.promedio + "★");
    if (e.mejor) lineas.push("• Mejor calificada: " + e.mejor);
    lineas.push("— " + NOMBRE_COMPA);
    return lineas.join("\n");
  }

  function dibujarImagenEstadisticas(e) {
    const c = document.createElement("canvas");
    c.width = 900; c.height = 500;
    const g = c.getContext("2d");
    const fondo = g.createLinearGradient(0, 0, 900, 500);
    fondo.addColorStop(0, "#0a84ff");
    fondo.addColorStop(1, "#5e5ce6");
    g.fillStyle = fondo;
    g.fillRect(0, 0, 900, 500);
    g.fillStyle = "#ffffff";
    g.font = "bold 46px system-ui, sans-serif";
    g.fillText("Mi cine de " + e.year, 60, 100);
    if (e.nombre) { g.font = "28px system-ui, sans-serif"; g.fillText(e.nombre, 60, 145); }
    const filas = [
      ["Vistas", e.vistas + (e.esteAno ? "  ·  este año: " + e.esteAno : "")],
      ["Género favorito", e.generoFavorito || "—"],
      ["Calificación promedio", e.promedio !== null ? e.promedio + "★" : "—"],
      ["Mejor calificada", e.mejor || "—"]
    ];
    let y = 215;
    filas.forEach(([etq, val]) => {
      g.font = "22px system-ui, sans-serif"; g.globalAlpha = 0.8; g.fillText(etq, 60, y);
      g.globalAlpha = 1; g.font = "bold 30px system-ui, sans-serif"; g.fillText(String(val).slice(0, 48), 60, y + 36);
      y += 80;
    });
    g.globalAlpha = 0.7; g.font = "20px system-ui, sans-serif"; g.fillText("— " + NOMBRE_COMPA, 60, 470); g.globalAlpha = 1;
    return c;
  }

  function mostrarEstadisticas() {
    const e = estadisticasDeCine();
    if (!e.vistas) {
      burbuja("Todavía no tienes películas vistas. Cuando marques algunas, te armo tu resumen del año.", "ia");
      return;
    }
    burbuja("Aquí tienes tu resumen de cine de " + e.year + ". Puedes copiarlo o guardarlo como imagen para compartirlo.", "ia");
    const tarjeta = document.createElement("div");
    tarjeta.className = "chat-stats";
    const titulo = document.createElement("h4");
    titulo.textContent = "Mi cine de " + e.year;
    tarjeta.appendChild(titulo);
    const texto = textoEstadisticas(e);
    texto.split("\n").slice(1, -1).forEach(linea => {
      const p = document.createElement("p");
      p.textContent = linea;
      tarjeta.appendChild(p);
    });
    const fila = document.createElement("div");
    fila.className = "chat-acciones";
    fila.appendChild(crearBoton("Copiar texto", true, async () => {
      try { await navigator.clipboard.writeText(texto); burbuja("Copiado. Ya lo puedes pegar en el grupo.", "ia"); }
      catch (err) { burbuja("No pude copiarlo. Selecciónalo y cópialo a mano.", "error"); }
    }));
    fila.appendChild(crearBoton("Guardar imagen", true, () => {
      dibujarImagenEstadisticas(e).toBlob(blob => {
        if (!blob) { burbuja("No pude crear la imagen en este navegador.", "error"); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "mi-cine-" + e.year + ".png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, "image/png");
    }));
    if (navigator.share) {
      fila.appendChild(crearBoton("Compartir", true, () => {
        navigator.share({ text: texto }).catch(() => {});
      }));
    }
    tarjeta.appendChild(fila);
    lista.appendChild(tarjeta);
    lista.scrollTop = lista.scrollHeight;
  }

  function isoLocal(d) {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }

  // Resumen de la semana: lo que viste, tu mejor calificación y tus pendientes
  function resumenSemana() {
    const hace7 = isoLocal(new Date(Date.now() - 7 * 86400000));
    const vistasSem = Nucleo.datos.peliculas().filter(p => ((Nucleo.datos.marcas()[p.titulo] || {}).historial || []).some(h => h.a === "vista" && String(h.f) >= hace7));
    const pend = pendientesDe();
    const calificadas = vistasSem.filter(p => estadoDe(p).estrellas);
    let t = "Así va tu semana en cine.\n\n";
    if (vistasSem.length) {
      t += "Esta semana viste " + vistasSem.length + (vistasSem.length === 1 ? " película" : " películas") + ": " + vistasSem.slice(0, 4).map(p => p.titulo).join(", ") + (vistasSem.length > 4 ? " y algunas más" : "") + ". ¡Buen ritmo!\n";
    } else {
      t += "Esta semana todavía no marcas ninguna como vista. Sin presión.\n";
    }
    if (calificadas.length) {
      const mejor = calificadas.slice().sort((a, b) => estadoDe(b).estrellas - estadoDe(a).estrellas)[0];
      t += "La que más te gustó fue «" + mejor.titulo + "», con " + estadoDe(mejor).estrellas + " estrellas.\n";
    }
    t += pend.length ? "Tienes " + pend.length + (pend.length === 1 ? " por ver" : " por ver") + ". ¿Te propongo una para el fin de semana?" : "No tienes pendientes. ¿Agregamos alguna a tu lista?";
    return t.trim();
  }

  // Explica en qué se basan las recomendaciones, con los datos que usa
  function explicarPerfil() {
    const vistas = vistasDe();
    if (!vistas.length) return "Todavía no tengo nada en que basarme. Marca algunas películas como vistas y califícalas, y te cuento cómo te recomiendo.";
    const perfil = perfilGustos();
    const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
    const generos = top(perfil.genero).map(g => g.toLowerCase()), directores = top(perfil.director);
    const calificadas = vistas.filter(p => estadoDe(p).estrellas);
    const enLista = arr => arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " y " + arr[arr.length - 1];
    let t = generos.length ? "Lo que más disfrutas es " + enLista(generos) + "." : "Todavía no tengo suficientes datos de géneros.";
    if (directores.length) t += " Los directores que más te llenan son " + enLista(directores) + ".";
    if (calificadas.length) {
      const prom = Math.round(calificadas.reduce((a, p) => a + estadoDe(p).estrellas, 0) / calificadas.length * 10) / 10;
      t += " Tus calificaciones promedian " + prom + " estrellas, en " + calificadas.length + (calificadas.length === 1 ? " película" : " películas") + ".";
    }
    t += "\n\nCada película que viste suma según sus estrellas: un director pesa el doble que un género, y las pendientes reciben un pequeño empujón. Con eso elijo lo que te propongo.";
    return t;
  }

  // ---------- Abrir la película de la que estamos hablando ("veamos esa") ----------
  let ultimasSeriesSugeridas = [];

  function generoSerieDe(n) {
    const S = window.seriesApi;
    if (!S) return null;
    const generos = [...new Set(S.lista().map(s => s.genero_principal).filter(Boolean))];
    const sinon = {
      terror: "terror", miedo: "terror", comedia: "comedia", risa: "comedia", romance: "romance", romantica: "romance",
      drama: "drama", animacion: "animacion", animada: "animacion", documental: "documental", historia: "historica",
      historica: "historica", accion: "accion", aventura: "accion", suspenso: "crimen", crimen: "crimen", misterio: "crimen",
      ciencia: "ciencia", fantasia: "ciencia"
    };
    const directo = generos.find(g => n.includes(normalizarChat(g)));
    if (directo) return directo;
    for (const palabra of Object.keys(sinon)) {
      if (n.includes(palabra)) {
        const g = generos.find(x => normalizarChat(x).includes(sinon[palabra]));
        if (g) return g;
      }
    }
    return null;
  }

  // Respuestas sobre series: capítulo siguiente, una serie concreta o recomendaciones de series
  function respuestaSeriesChat(t) {
    const S = window.seriesApi;
    if (!S) return false;
    const lista = S.lista();
    if (!lista.length) return false;
    const n = normalizarChat(t);

    if (/(que capitulo sigo|capitulo siguiente|siguiente capitulo|que serie sigo|por donde voy|que sigo viendo de series)/.test(n)) {
      const enCurso = lista.map(s => ({ s: s, pr: S.progreso(s) })).filter(x => x.pr.siguiente && x.pr.vistos > 0);
      if (!enCurso.length) {
        burbuja("Aún no tienes series en curso. Marca un capítulo en 📺 Series y te digo por dónde vas.", "ia");
      } else {
        burbuja("Estas son tus series en curso:\n\n" + enCurso.slice(0, 6).map(x =>
          "• " + x.s.titulo + ": T" + x.pr.siguiente.temporada + " · E" + x.pr.siguiente.episodio +
          " (" + x.pr.vistos + "/" + x.pr.total + ")").join("\n"), "ia");
        ponerChips(enCurso.slice(0, 3).map(x => x.s.titulo));
      }
      return true;
    }

    const serie = lista.find(s => { const tn = normalizarChat(s.titulo); return tn.length >= 4 && n.includes(tn); });
    if (serie && !tituloPedido(n)) {
      const pr = S.progreso(serie);
      ultimasSugeridas = [];
      ultimasSeriesSugeridas = [serie];
      burbuja(serie.titulo + (serie.año ? " (" + serie.año + ")" : "") + ". " + (serie.genero || "") +
        ".\n\n" + (serie.sinopsis || "Sin sinopsis.") +
        "\n\nVas " + pr.vistos + " de " + pr.total + " capítulos." +
        (pr.siguiente ? " Sigue T" + pr.siguiente.temporada + " · E" + pr.siguiente.episodio + "." : ""), "ia");
      ponerChips(["Abrir en Series"]);
      return true;
    }

    if (/\bseries?\b/.test(n)) {
      const genero = generoSerieDe(n);
      let pool = lista.filter(s => { const pr = S.progreso(s); return !(pr.total && pr.vistos === pr.total); });
      if (genero) pool = pool.filter(s => normalizarChat(s.genero_principal) === normalizarChat(genero));
      if (!pool.length) {
        burbuja("No encuentro series" + (genero ? " de " + genero.toLowerCase() : "") + " pendientes. ¿Probamos otro género?", "ia");
        return true;
      }
      const elegidas = pool.sort(() => Math.random() - 0.5).slice(0, 3);
      ultimasSugeridas = [];
      ultimasSeriesSugeridas = elegidas;
      burbuja("Te propongo estas series" + (genero ? " de " + genero.toLowerCase() : "") + ":\n\n" +
        elegidas.map(s => "• " + s.titulo + (s.año ? " (" + s.año + ")" : "")).join("\n") +
        "\n\nDime «veamos esa» o «la primera» y la abro en Series.", "ia");
      ponerChips(elegidas.map(s => s.titulo));
      return true;
    }
    return false;
  }

  function titulosDeUltimaRespuesta() {
    const bs = lista.querySelectorAll(".chat-burbuja.ia");
    const ultima = bs.length ? bs[bs.length - 1].textContent : "";
    const txt = normalizarChat(ultima);
    if (!txt) return [];
    return Nucleo.datos.peliculas().filter(p => {
      const tn = normalizarChat(p.titulo);
      return tn.length >= 4 && txt.includes(tn);
    });
  }

  function intentoAbrirSugerida(t) {
    const n = normalizarChat(t);
    if (ultimaEmocion) return false; // un «sí» aquí responde a la charla, no abre una película
    if (!n || n.length > 60) return false;
    const confirma = /^(si|sip|ok|okey|va|dale|claro|veamos|vamos|ver|esa|esa mera|esa misma|la de|abrela|abre la|abrir|muestrame|muestra|quiero verla|quiero ver esa|quiero ver la|vamos con esa|veamos esa|esa peli|esa pelicula)\b/;
    const ordinal = /(primera|primer|segunda|segundo|tercera|tercero)/;
    const S = window.seriesApi;
    const serieExacta = S ? S.lista().find(s => normalizarChat(s.titulo) === n) : null;
    if (serieExacta) {
      burbuja("Abriendo la serie «" + serieExacta.titulo + "» en Series.", "ia");
      S.abrir(serieExacta.titulo);
      return true;
    }
    if (ultimasSeriesSugeridas.length && (confirma.test(n) || ordinal.test(n))) {
      const orden = { primera: 0, primer: 0, segunda: 1, segundo: 1, tercera: 2, tercero: 2 };
      const m = n.match(/(primera|primer|segunda|segundo|tercera|tercero)/);
      let s = ultimasSeriesSugeridas.length === 1 ? ultimasSeriesSugeridas[0] : (m ? ultimasSeriesSugeridas[orden[m[1]]] : null);
      if (!s) {
        burbuja("¿Cuál serie quieres abrir?", "ia");
        ponerChips(ultimasSeriesSugeridas.map(x => x.titulo));
        return true;
      }
      burbuja("Va, abriendo la serie «" + s.titulo + "».", "ia");
      S.abrir(s.titulo);
      return true;
    }
    const quiereVer = n.length <= 30 && !/\b(algo|alguna|algun|una|un|para|que|recomie|sugier|de)\b/.test(n) &&
      /(quiero ver|la quiero ver|lo quiero ver|me late|reproduc|abre|ponla|ponlo|pon la|verla|verlo|dale play|ver esa)/.test(n);
    if (!confirma.test(n) && !quiereVer && !ordinal.test(n)) {
      // Si escriben solo el título (o tocan una opción con el título), también se abre
      const solo = tituloPedido(n);
      if (!(solo && normalizarChat(solo.titulo) === n)) return false;
    }

    const cand = (ultimasSugeridas && ultimasSugeridas.length) ? ultimasSugeridas : titulosDeUltimaRespuesta();
    // 1) Si el mensaje trae el título, esa gana
    let p = tituloPedido(n);
    // 2) Si no, usa lo que acaba de sugerir la IA
    if (!p && cand.length) {
      if (cand.length === 1) p = cand[0];
      else {
        const orden = { primera: 0, primer: 0, segunda: 1, segundo: 1, tercera: 2, tercero: 2 };
        const m = n.match(/(primera|primer|segunda|segundo|tercera|tercero)/);
        if (m && cand[orden[m[1]]]) p = cand[orden[m[1]]];
      }
    }
    if (!p) {
      if (cand.length > 1) {
        burbuja("¿Cuál quieres abrir?", "ia");
        ponerChips(cand.map(x => x.titulo).slice(0, 4));
        return true;
      }
      return false;
    }
    const quiereFicha = /(ficha|detalle|informacion|cuentame|de que trata|sinopsis)/.test(n);
    const tieneTrailer = [p.trailer_es, p.trailer_en].some(x => x && String(x).trim() && String(x).trim() !== "sin tráiler");
    const abrirFicha = () => { try { abrirDetalle(p); } catch (e) { burbuja("No pude abrir la ficha. Intenta tocar el póster.", "error"); } };
    if (quiereFicha || (!urlReproducible(p.link) && !tieneTrailer)) {
      burbuja(quiereFicha ? "Va, abriendo la ficha de «" + p.titulo + "»." : "Esta no tiene tráiler guardado, así que te abro su ficha para que la veas con calma.", "ia");
      abrirFicha();
      return true;
    }
    burbuja("Va, la pongo aquí mismo: «" + p.titulo + "».", "ia");
    try { abrirVerPelicula(p.titulo, p.trailer_es, p.trailer_en, p.link, true); }
    catch (e) { burbuja("No pude abrir el reproductor. Te abro la ficha.", "error"); abrirFicha(); }
    return true;
  }

  function procesarEntrada(t) {
    // Se muestra tu mensaje siempre (también sin IA); preguntar() no lo repite
    burbuja(t, "yo");
    if (CRISIS_RE.test(normalizarChat(t))) { burbuja(textoCrisis(), "ia"); return; }
    // Si hay una pregunta de sí o no en pausa, «sí» la confirma y «no» la cancela (igual que los botones)
    if (confirmacionPendiente) {
      const pend = confirmacionPendiente;
      const cn = normalizarChat(t).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      if (/^(si|si porfa|si por favor|dale|va|claro|ok|okey|de acuerdo|adelante|hazlo|guardalo|guardala|olvidalo|olvidala|borralo|borrala)$/.test(cn)) {
        confirmacionPendiente = null;
        pend.fila.remove();
        pend.alSi();
        return;
      }
      if (/^(no|no gracias|cancela|cancelar|mejor no|nel)$/.test(cn)) {
        confirmacionPendiente = null;
        pend.fila.remove();
        burbuja("Cancelado. No cambié nada.", "ia");
        return;
      }
      confirmacionPendiente = null;
    }
    // Saludos, gracias y despedidas se responden al instante, sin gastar una consulta de IA
    if (/^(hola|hola estela|hey|hi|hello|buenas|buenos dias|buenas tardes|buenas noches|que onda|que tal|gracias|muchas gracias|gracias estela|adios|chao|hasta luego|nos vemos|bye)$/.test(normalizarChat(t).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim())) {
      responderLocal(t);
      return;
    }
    if (intentoAbrirSugerida(t)) return;
    if (respuestaSeriesChat(t)) return;
    const nt = normalizarChat(t);
    if (/curiosidad|dato curioso|algo curioso|sabias que|dato interesante|dime un dato/.test(nt)) {
      if (/otra|mas/.test(nt)) curioOffset++;
      const lista = todasLasCuriosidades();
      const c = lista.length ? lista[(Math.floor(Math.random() * lista.length))] : null;
      burbuja(c ? "¿Sabías esto de «" + c.peli.titulo + "»? " + c.texto : "Todavía no tengo curiosidades cargadas. Puedes agregarlas en la pestaña «curiosidades» de tu hoja.", "ia");
      if (c) { ultimasSugeridas = [c.peli]; ponerChips(["Otra curiosidad", "Ábrela"]); }
      return;
    }
    if (/^(vota|votemos|dos opciones|a o b|cual prefieres|cual te late)/.test(nt)) { votacionAB(); return; }
    if (/^(mi racha|racha|cuantas semanas)/.test(nt)) {
      const r = rachaSemanas();
      burbuja(r.racha ? "Llevas " + r.racha + (r.racha === 1 ? " semana" : " semanas") + " seguidas viendo al menos una película. Esta semana ya llevas " + r.vistasSemana + "." : "Todavía no empiezas la racha. Marca una película como vista esta semana y arrancamos.", "ia");
      return;
    }
    if (/^(resumen|resumen de (mi|la) semana|mi semana|como va mi semana)/.test(nt)) { burbuja(resumenSemana(), "ia"); return; }
    if (/(que sabes de mi|como me conoces|por que me recomiendas|por que me sugieres|en que te basas)/.test(nt)) { burbuja(explicarPerfil(), "ia"); return; }
    if (/maraton/.test(nt)) {
      const h = nt.match(/(\d+)\s*(horas?|h)\b/), mi = nt.match(/(\d+)\s*(minutos?|min)\b/);
      let mins = 0;
      if (h) mins += Number(h[1]) * 60;
      if (mi) mins += Number(mi[1]);
      if (!mins) mins = 180;
      const tema = /terror|miedo|suspenso/.test(nt) ? "terror" : /animacion|animada/.test(nt) ? "animacion" : /comedia|reir|risas/.test(nt) ? "comedia" : "libre";
      const plan = planearNoche(mins, tema, "");
      if (plan.error) { burbuja(plan.error, "ia"); return; }
      const ahora = new Date();
      ahora.setMinutes(Math.ceil(ahora.getMinutes() / 5) * 5, 0, 0);
      const cursor = new Date(ahora.getTime());
      const lineas = plan.secuencia.map(x => {
        const ini = new Date(cursor.getTime());
        cursor.setMinutes(cursor.getMinutes() + x.m + plan.GAP);
        return horaTexto(ini) + " · " + x.p.titulo + " (" + x.m + " min)";
      });
      burbuja("Te armé una noche de " + plan.secuencia.length + (plan.secuencia.length === 1 ? " película" : " películas") +
        (tema !== "libre" ? " de " + tema : "") + ", empezando a las " + horaTexto(ahora) + ":\n\n" + lineas.join("\n") +
        "\n\nPara verla con pantalla completa, abre Maratón y toca Empezar.", "ia");
      return;
    }
    if (/como me llamo|cual es mi nombre|sabes mi nombre|sabes como me llamo/.test(nt)) {
      const nom = nombreUsuario();
      burbuja(nom ? "Te llamas " + nom + ", ¿verdad? Lo tengo presente." : "Todavía no me has dicho tu nombre. Si quieres, escribe «recuerda que me llamo…» y lo guardo.", "ia");
      return;
    }
    if (/registro de errores|mis errores|ver errores/.test(nt)) {
      const reg = window.obtenerRegistro ? window.obtenerRegistro() : [];
      burbuja(reg.length
        ? "Estos son los últimos errores que registré:\n\n" + reg.slice(-5).map(x => "• " + x.f.slice(0, 16).replace("T", " ") + " · " + x.msg).join("\n") + "\n\nPuedes verlo completo en Datos → Registro de errores."
        : "No hay errores registrados. Todo va bien por aquí.", "ia");
      return;
    }
    if (/^(mis estadisticas|mi ano|mis numeros|resumen de mi ano|estadisticas)\b/.test(normalizarChat(t))) return mostrarEstadisticas();
    let m;
    if ((m = t.match(/^recuerda que\s+(.+)$/i))) return proponerNota(m[1].trim());
    if (/^(mi memoria|mis preferencias|que recuerdas|qué recuerdas|lo que recuerdas)\??$/i.test(t)) return mostrarMemoria();
    if ((m = t.match(/^marca\s+(.+?)\s+como\s+(vista|pendiente)\.?$/i))) return proponerMarca(m[1].trim(), m[2].toLowerCase());
    if ((m = t.match(/^(?:agrega|añade|pon)?\s*(?:una\s+)?nota\s+(?:a|en|para|sobre|de)\s+(.+?)\s*:\s*([\s\S]+)$/i))) return proponerNotaPelicula(m[1].trim(), m[2]);
    if ((m = t.match(/^(?:redacta|escribe|sugiere)\s+(?:una\s+)?nota\s+(?:sobre|para|de|en)\s+(.+?)\.?$/i))) return redactarNotaIA(m[1].trim());
    if (modoSinIAActivo()) {
      if (!navigator.onLine && !avisoOffline) {
        avisoOffline = true;
        burbuja("Sin conexión: sigo contigo en modo sin IA. Puedo sugerirte, comparar, contarte tus números y más.", "ia");
      }
      responderLocal(t);
      return;
    }
    return preguntar(t, false, true);
  }

  document.getElementById("chatAbrir").addEventListener("click", () => {
    // Tocar el mismo botón con el panel abierto lo cierra
    if (panel.classList.contains("abierto")) {
      document.getElementById("chatCerrar").click();
      return;
    }
    panel.classList.add("abierto");
    fondoChat.classList.add("visible");
    pintarTablero();
    if (!notasCargadas) notasCargar();
    consultarUso();
    saludar();
    input.focus();
    reiniciarCierreAuto();
  });
  document.getElementById("chatCerrar").addEventListener("click", () => {
    panel.classList.remove("abierto");
    fondoChat.classList.remove("visible");
    if (vozSoportada) speechSynthesis.cancel();
    detenerEscuchaConv();
    clearTimeout(temporizadorCierre);
  });

  /* ---------- Cierre automático por inactividad ---------- */
  // Se cierra solo si el usuario no interactúa durante CIERRE_AUTO_MS, sin conversación continua,
  // sin que el asistente esté hablando o escuchando y sin texto escrito a medias.
  const CIERRE_AUTO_MS = 60000;
  let temporizadorCierre = null;
  function reiniciarCierreAuto() {
    clearTimeout(temporizadorCierre);
    if (!panel.classList.contains("abierto")) return;
    temporizadorCierre = setTimeout(() => {
      if (!panel.classList.contains("abierto")) return;
      const ocupado = conversacionActiva || escuchandoConv || asistenteHablando() || input.value.trim() !== "";
      if (ocupado) { reiniciarCierreAuto(); return; }
      document.getElementById("chatCerrar").click();
    }, CIERRE_AUTO_MS);
  }
  ["pointerdown", "keydown", "input", "submit"].forEach(ev => panel.addEventListener(ev, reiniciarCierreAuto));

  /* ---------- Estela dentro del buscador principal ---------- */
  // Enter busca en el catálogo; si lo escrito es una pregunta (¿…? o termina en ?), o se toca 🍿, se envía a Estela.
  const buscarPrincipal = document.getElementById("buscar");
  function preguntarAEstela(texto) {
    const t = String(texto || "").trim();
    if (!t) {
      if (!panel.classList.contains("abierto")) document.getElementById("chatAbrir").click();
      input.focus();
      return;
    }
    buscarPrincipal.value = "";
    buscarPrincipal.dispatchEvent(new Event("input", { bubbles: true }));
    if (!panel.classList.contains("abierto")) document.getElementById("chatAbrir").click();
    input.value = t;
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  }
  buscarPrincipal.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const t = buscarPrincipal.value.trim();
    if (t.startsWith("¿") || t.endsWith("?")) {
      e.preventDefault();
      preguntarAEstela(t);
    }
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t || enviar.disabled) return;
    input.value = "";
    procesarEntrada(t);
  });

  document.querySelectorAll("#chatSugerencias button[data-q]").forEach(b => {
    b.addEventListener("click", () => preguntar(b.dataset.q));
  });
  /* ---------- Conversación continua: escucha, responde y vuelve a escuchar ---------- */
  const RecConv = window.SpeechRecognition || window.webkitSpeechRecognition;
  const botonContinuo = document.getElementById("chatContinuo");
  let conversacionActiva = false;
  let escuchandoConv = false;
  let recConv = null;

  function conversacionGuardada() {
    try { return localStorage.getItem("chat_conversacion") === "1"; } catch (e) { return false; }
  }
  function pintarContinuo() {
    const orbe = document.getElementById("chatAbrir");
    if (orbe) orbe.classList.toggle("escuchando", escuchandoConv);
    if (!botonContinuo) return;
    botonContinuo.classList.toggle("activo", conversacionActiva);
    botonContinuo.classList.toggle("escuchando", escuchandoConv);
    botonContinuo.setAttribute("aria-pressed", conversacionActiva ? "true" : "false");
  }
  function asistenteHablando() {
    return vozSoportada && (speechSynthesis.speaking || speechSynthesis.pending);
  }
  function crearRecConv() {
    const r = new RecConv();
    r.lang = "es-MX";
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = e => {
      const t = ((e.results[0] && e.results[0][0] && e.results[0][0].transcript) || "").trim();
      escuchandoConv = false;
      pintarContinuo();
      if (t) {
        input.value = t;
        form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    };
    r.onerror = e => {
      escuchandoConv = false;
      pintarContinuo();
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        conversacionActiva = false;
        pintarContinuo();
        burbuja("No tengo permiso para usar el micrófono. Revisa el permiso del navegador y vuelve a activar la conversación.", "error");
      }
    };
    r.onend = () => {
      escuchandoConv = false;
      pintarContinuo();
      // Vuelve a escuchar si la conversación sigue activa y el asistente ya no está hablando
      setTimeout(() => {
        if (conversacionActiva && panel.classList.contains("abierto") && !asistenteHablando()) escucharConv();
      }, 500);
    };
    return r;
  }
  function escucharConv() {
    if (!RecConv || !conversacionActiva || escuchandoConv || asistenteHablando()) return;
    if (!recConv) recConv = crearRecConv();
    try {
      recConv.start();
      escuchandoConv = true;
      pintarContinuo();
    } catch (e) { /* ya estaba escuchando */ }
  }
  function detenerEscuchaConv() {
    escuchandoConv = false;
    pintarContinuo();
    if (recConv) { try { recConv.abort(); } catch (e) {} }
  }

  if (botonContinuo) {
    if (RecConv && vozSoportada) botonContinuo.hidden = false;
    conversacionActiva = RecConv && conversacionGuardada();
    pintarContinuo();
    botonContinuo.addEventListener("click", () => {
      if (conversacionActiva) {
        conversacionActiva = false;
        try { localStorage.setItem("chat_conversacion", "0"); } catch (e) {}
        detenerEscuchaConv();
        return;
      }
      conversacionActiva = true;
      try { localStorage.setItem("chat_conversacion", "1"); } catch (e) {}
      // La conversación continua necesita la voz encendida para no escucharse a sí misma
      if (!vozActiva()) { try { localStorage.setItem("chat_voz", "1"); } catch (e) {} actualizarIconoVoz(); }
      escucharConv();
      pintarContinuo();
    });
  }

  document.getElementById("chatNumeros").addEventListener("click", () => {
    burbuja("Mis números", "yo");
    mostrarEstadisticas();
  });
  document.getElementById("chatMemoria").addEventListener("click", () => {
    burbuja("Mi memoria", "yo");
    mostrarMemoria();
  });
  document.getElementById("chatSinIA").addEventListener("click", () => {
    burbuja("Recomiéndame (sin IA)", "yo");
    responderLocal("sugiéreme algo");
  });
})();

if (window.Nucleo) { Nucleo.registrar("asistente", { version: "1.0", emite: [], escucha: [] }); }

/* Interruptor de Ajustes (modulo_asistente). Al apagarlo se oculta el botón de Estela y, si estaba abierta, se cierra.
   Estela es solo el asistente visible; el resto de la app no depende de ella. */
if (window.Nucleo) {
  const aplicarEstela = () => document.body.classList.toggle("sin-estela", !Nucleo.activo("asistente"));
  const interruptorEst = document.getElementById("moduloEstelaOn");
  if (interruptorEst) {
    interruptorEst.checked = Nucleo.activo("asistente");
    interruptorEst.addEventListener("change", () => {
      Nucleo.activar("asistente", interruptorEst.checked);
      aplicarEstela();
      if (!interruptorEst.checked) { const cerrar = document.getElementById("chatCerrar"); if (cerrar) cerrar.click(); }
    });
  }
  aplicarEstela();
}
