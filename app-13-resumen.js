/* ===== Fase H · Resumen: números, gustos y año con reto, en un solo panel ===== */
(function () {
  const modal = document.getElementById("statsModal");
  const body = document.getElementById("statsBody");
  if (!modal || !body) return;

  const barra = document.createElement("div");
  barra.className = "fichas-tabs resumen-tabs";
  barra.setAttribute("role", "tablist");
  barra.innerHTML =
    '<button type="button" role="tab" data-r="numeros" class="activa">Números</button>' +
    '<button type="button" role="tab" data-r="gustos">Gustos</button>' +
    '<button type="button" role="tab" data-r="ano">Año y reto</button>';
  const pNum = document.createElement("div"); pNum.className = "rp rp-numeros";
  const pGus = document.createElement("div"); pGus.className = "rp rp-gustos"; pGus.hidden = true;
  const pAno = document.createElement("div"); pAno.className = "rp rp-ano"; pAno.hidden = true;

  // Mueve los elementos (sin copiarlos) para que sus gráficas y eventos sigan vivos
  function mover(desde, hasta) { while (desde && desde.firstChild) hasta.appendChild(desde.firstChild); }

  function pintarGustos() {
    pGus.innerHTML = "";
    const sec = document.getElementById("mapaGustos");
    if (sec) { renderMapaGustos(); mover(sec, pGus); }
    if (!pGus.childNodes.length) pGus.innerHTML = '<p class="stats-vacio">Aún no hay datos de gustos. Califica algunas películas.</p>';
  }
  function pintarAno() {
    pAno.innerHTML = "";
    const sec = document.getElementById("retoMes");
    if (sec) { renderRetoMes(); mover(sec, pAno); }
    if (!pAno.childNodes.length) pAno.innerHTML = '<p class="stats-vacio">Aún no hay reto para este mes.</p>';
  }

  function montar() {
    pNum.innerHTML = "";              // evita duplicar los números al volver a abrir
    mover(body, pNum);
    body.append(barra, pNum, pGus, pAno);
  }
  function mostrar(cual) {
    pNum.hidden = cual !== "numeros";
    pGus.hidden = cual !== "gustos";
    pAno.hidden = cual !== "ano";
    if (cual === "gustos") pintarGustos();     // se dibuja al abrir la pestaña, no en cada cambio
    if (cual === "ano") pintarAno();
    barra.querySelectorAll("[data-r]").forEach(b => {
      const on = b.dataset.r === cual;
      b.classList.toggle("activa", on);
      b.setAttribute("aria-selected", String(on));
    });
  }
  barra.addEventListener("click", e => {
    const b = e.target.closest("[data-r]");
    if (b) mostrar(b.dataset.r);
  });

  const original = abrirEstadisticas;
  abrirEstadisticas = function () {
    original();
    montar();
    mostrar("numeros");
  };
})();

/* Fase 0 · Registro del módulo «resumen» en el núcleo (el código de arriba no cambia) */
if (window.Nucleo) {
  Nucleo.registrar("resumen", { version: "1.0", emite: [], escucha: [] });
}
