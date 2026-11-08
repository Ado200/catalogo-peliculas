/* ===== Fase 0 · Módulo «clasificador»: tarjetas para decidir y gestos de la lista ===== */
/* Migrado de app-04 sin cambiar el comportamiento. Mantiene los mismos nombres globales.
   Se registra en el núcleo (app-00-nucleo.js). Aún sin interruptor en Ajustes. */
let cls = { cola: [], pila: [], x: 0, dx: 0, activo: false };

function candidatasClasificar() {
  return peliculas.filter(p => {
    const o = marcas[p.titulo] || {};
    if (o.vista || o.pendiente || o.descartada) return false;
    if (sel.genero.value && !generosDe(p).includes(sel.genero.value)) return false;
    return true;
  });
}

function clasActual() { return cls.cola[0]; }

function pintarClasificador() {
  const p = clasActual();
  const zona = $("clasZona");
  $("clasContador").textContent = cls.cola.length
    ? cls.cola.length + " por clasificar"
    : "Listo";
  $("clasIzq").disabled = !p;
  $("clasDer").disabled = !p;
  $("clasDeshacer").disabled = !cls.pila.length;

  if (!p) {
    zona.innerHTML = '<p class="vacio">Ya no quedan películas por clasificar. ¡Buen trabajo!</p>';
    return;
  }

  zona.innerHTML =
    '<div class="clas-card" id="clasCard">' +
      '<div class="clas-sello izq">DESCARTAR</div>' +
      '<div class="clas-sello der">PENDIENTE</div>' +
      (p.portada && !datosLimitados() ? '<img src="' + esc(p.portada) + '" alt="">' : '<div class="sinportada">🎬</div>') +
      '<h2>' + esc(p.titulo) + '</h2>' +
      '<div class="meta">' + esc(p.tipo) + ' · ' + esc(p["año"]) + ' · ' + esc(p.duracion) + ' · ' + esc(p.pais) + '</div>' +
      '<div class="meta">' + esc(p.genero) + '</div>' +
      '<p class="sinopsis">' + esc(p.sinopsis) + '</p>' +
    '</div>';
}

function clasAccion(dir) {
  const p = clasActual();
  if (!p) return;
  const prev = marcas[p.titulo] ? Object.assign({}, marcas[p.titulo]) : null;
  cls.pila.push({ p, prev });

  if (dir === "der") cambiarEstado(p.titulo, { pendiente: true, vista: false, descartada: false });
  else cambiarEstado(p.titulo, { descartada: true, pendiente: false, vista: false });

  cls.cola.shift();
  pintarClasificador();
  refrescarTodo();
}

function clasDeshacer() {
  const ult = cls.pila.pop();
  if (!ult) return;
  if (ult.prev) marcas[ult.p.titulo] = ult.prev;
  else delete marcas[ult.p.titulo];
  programarGuardado();
  cls.cola.unshift(ult.p);
  pintarClasificador();
  refrescarTodo();
}

function abrirClasificador() {
  cls.cola = candidatasClasificar();
  cls.pila = [];
  $("clasificador").classList.add("abierto");
  pintarClasificador();
}

function cerrarClasificador() {
  $("clasificador").classList.remove("abierto");
  refrescarTodo();
}

function moverSellos(dx) {
  const card = $("clasCard");
  if (!card) return;
  const fuerza = Math.min(Math.abs(dx) / 110, 1);
  card.querySelector(".clas-sello.der").style.opacity = dx > 0 ? fuerza : 0;
  card.querySelector(".clas-sello.izq").style.opacity = dx < 0 ? fuerza : 0;
}

let swipe = null;

// Gesto a la izquierda: marca como vista. Nunca desmarca; se puede deshacer con el aviso.
function marcarVistaGesto(p) {
  if (estadoDe(p).vista) {
    setEstado("Ya está en tus vistas.");
    refrescarTodo();
    return;
  }
  const previo = marcas[p.titulo] ? Object.assign({}, marcas[p.titulo]) : null;
  cambiarEstado(p.titulo, { vista: true, pendiente: false, vistaDesde: hoyLocalISO() });
  mostrarDeshacer("«" + p.titulo + "» marcada como vista.", [{ titulo: p.titulo, previo }]);
  refrescarTodo();
}

function reiniciarTarjeta(el) {
  if (!el) return;
  el.style.transition = "transform .25s var(--ease)";
  el.style.transform = "";
}

lista.addEventListener("touchstart", e => {
  const card = e.target.closest("[data-i]");
  if (!card || e.target.closest("a, button, select, input")) { swipe = null; return; }
  const t = e.touches[0];
  swipe = { el: card, i: Number(card.dataset.i), x: t.clientX, y: t.clientY, dx: 0, activo: false, lp: false, timer: null };
  swipe.timer = setTimeout(() => {
    if (!swipe) return;
    swipe.lp = true;
    abrirRapida(card);
  }, 500);
}, { passive: true });

lista.addEventListener("touchmove", e => {
  if (!swipe) return;
  const t = e.touches[0];
  const dx = t.clientX - swipe.x;
  const dy = t.clientY - swipe.y;
  if (Math.abs(dx) > 12 || Math.abs(dy) > 12) clearTimeout(swipe.timer);
  if (swipe.lp) return;
  if (!swipe.activo) {
    if (Math.abs(dy) > Math.abs(dx)) { reiniciarTarjeta(swipe.el); swipe = null; return; }
    if (Math.abs(dx) < 12) return;
    swipe.activo = true;
  }
  swipe.dx = dx;
  swipe.el.style.transition = "none";
  swipe.el.style.transform = "translateX(" + Math.max(-120, Math.min(120, dx)) + "px)";
  swipe.el.dataset.swipe = dx <= -30 ? "vista" : (dx >= 30 ? "pendiente" : "");
}, { passive: true });

lista.addEventListener("touchend", () => {
  if (!swipe) return;
  const s = swipe;
  swipe = null;
  reiniciarTarjeta(s.el);
  delete s.el.dataset.swipe;
  clearTimeout(s.timer);
  if (s.lp) {
    suprimirClic = true;
    setTimeout(() => { suprimirClic = false; }, 400);
    return;
  }
  if (!s.activo) return;
  const p = visibles[s.i];
  if (!p) return;
  if (s.dx <= -90) { marcarVistaGesto(p); return; }
  if (s.dx >= 90) {
    const pendienteActual = estadoDe(p).pendiente;
    const previo = marcas[p.titulo] ? Object.assign({}, marcas[p.titulo]) : null;
    cambiarEstado(p.titulo, { pendiente: !pendienteActual, vista: false });
    mostrarDeshacer(pendienteActual
      ? "«" + p.titulo + "» quitada de pendientes."
      : "«" + p.titulo + "» puesta en pendientes.", [{ titulo: p.titulo, previo }]);
    refrescarTodo();
  }
});

lista.addEventListener("touchcancel", () => {
  if (swipe) { clearTimeout(swipe.timer); reiniciarTarjeta(swipe.el); delete swipe.el.dataset.swipe; }
  swipe = null;
});

const zonaClas = $("clasZona");

zonaClas.addEventListener("touchstart", e => {
  if (!clasActual()) return;
  cls.x = e.touches[0].clientX;
  cls.dx = 0;
  cls.activo = true;
  const card = $("clasCard");
  if (card) card.style.transition = "none";
}, { passive: true });

zonaClas.addEventListener("touchmove", e => {
  if (!cls.activo) return;
  const card = $("clasCard");
  if (!card) return;
  cls.dx = e.touches[0].clientX - cls.x;
  card.style.transform = "translateX(" + cls.dx + "px) rotate(" + (cls.dx / 25) + "deg)";
  moverSellos(cls.dx);
}, { passive: true });

zonaClas.addEventListener("touchend", () => {
  if (!cls.activo) return;
  cls.activo = false;
  const card = $("clasCard");
  if (!card) return;
  const dx = cls.dx;
  cls.dx = 0;
  if (Math.abs(dx) >= 110) {
    const dir = dx > 0 ? "der" : "izq";
    const salida = dx > 0 ? window.innerWidth : -window.innerWidth;
    card.style.transition = "transform .25s ease";
    card.style.transform = "translateX(" + salida + "px) rotate(" + (dx > 0 ? 20 : -20) + "deg)";
    setTimeout(() => clasAccion(dir), 220);
  } else {
    card.style.transition = "transform .25s var(--ease)";
    card.style.transform = "";
    moverSellos(0);
  }
});

zonaClas.addEventListener("touchcancel", () => {
  cls.activo = false;
  cls.dx = 0;
  const card = $("clasCard");
  if (card) { card.style.transition = "transform .25s var(--ease)"; card.style.transform = ""; }
  moverSellos(0);
});


if (window.Nucleo) {
  Nucleo.registrar("clasificador", { version: "1.0", emite: [], escucha: [] });
}

/* Interruptor de Ajustes (modulo_clasificador). Al apagarlo se oculta el botón «Clasificar» y su panel.
   Los gestos de deslizar en la lista (marcar como vista) siguen funcionando: no dependen del botón. */
if (window.Nucleo) {
  const aplicarClasificador = () => document.body.classList.toggle("sin-clasificador", !Nucleo.activo("clasificador"));
  const interruptorClas = document.getElementById("moduloClasificadorOn");
  if (interruptorClas) {
    interruptorClas.checked = Nucleo.activo("clasificador");
    interruptorClas.addEventListener("change", () => {
      Nucleo.activar("clasificador", interruptorClas.checked);
      aplicarClasificador();
    });
  }
  aplicarClasificador();
}
