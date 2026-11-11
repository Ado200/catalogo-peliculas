/* ===== Estela · voz: onda solo al hablar y palabras marcadas ===== */
(function () {
  if (!("speechSynthesis" in window)) return;
  const ss = window.speechSynthesis;
  const speakOriginal = ss.speak.bind(ss);
  const pill = document.getElementById("estelaMini");
  let pendientes = 0;
  let burbuja = null;   // burbuja de Estela que se está leyendo
  let texto = "";       // texto plano de esa burbuja
  let busqueda = 0;     // posición donde buscar el siguiente fragmento

  function ultimaBurbuja() {
    const todas = document.querySelectorAll(".chat-burbuja.ia");
    return todas[todas.length - 1] || null;
  }

  function prepararBurbuja() {
    burbuja = ultimaBurbuja();
    texto = burbuja ? burbuja.textContent : "";
    busqueda = 0;
  }

  // Muestra el texto con cada palabra en su propio elemento, y marca la que se dice ahora
  function marcarPalabra(pos) {
    if (!burbuja || !texto) return;
    const frag = document.createDocumentFragment();
    let cursor = 0;
    texto.split(/(\s+)/).forEach(parte => {
      if (!parte) return;
      const ini = cursor;
      cursor += parte.length;
      if (/^\s+$/.test(parte)) {
        frag.appendChild(document.createTextNode(parte));
      } else {
        const s = document.createElement("span");
        s.className = "estela-palabra" + (pos >= ini && pos < cursor ? " actual" : "");
        s.textContent = parte;
        frag.appendChild(s);
      }
    });
    burbuja.textContent = "";
    burbuja.appendChild(frag);
  }

  function dejarTextoPlano() {
    if (burbuja && texto) burbuja.textContent = texto;
    burbuja = null;
    texto = "";
    busqueda = 0;
  }

  function terminoUno() {
    pendientes = Math.max(0, pendientes - 1);
    if (pendientes === 0) {
      dejarTextoPlano();
      if (pill) pill.classList.remove("hablando");
    }
  }

  ss.speak = function (u) {
    pendientes++;
    if (pendientes === 1) {
      prepararBurbuja();
      if (pill) pill.classList.add("hablando");
    }
    const fragmento = String(u.text || "").trim();
    let inicio = texto ? texto.indexOf(fragmento, busqueda) : -1;
    if (inicio < 0 && texto) inicio = texto.indexOf(fragmento);

    const prevStart = u.onstart, prevEnd = u.onend, prevError = u.onerror;
    u.onstart = function (e) {
      if (inicio >= 0) busqueda = inicio;
      if (prevStart) prevStart.call(this, e);
    };
    u.onboundary = function (e) {
      if (e && e.name && e.name !== "word") return;
      if (inicio >= 0) marcarPalabra(inicio + (e && e.charIndex ? e.charIndex : 0));
    };
    u.onend = function (e) {
      terminoUno();
      if (prevEnd) prevEnd.call(this, e);
    };
    u.onerror = function (e) {
      terminoUno();
      if (prevError) prevError.call(this, e);
    };
    return speakOriginal(u);
  };

  // Respaldo: la onda sigue el estado real de la voz, aunque algún evento se pierda
  setInterval(() => {
    if (!pill) return;
    const hablandoAhora = ss.speaking;
    if (hablandoAhora !== pill.classList.contains("hablando")) pill.classList.toggle("hablando", hablandoAhora);
  }, 200);
})();
