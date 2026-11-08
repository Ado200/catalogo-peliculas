/* ===== Fase 0 · Módulo «adornos» (bloque 14-21): deslizadores, menú ⋯, orbe de la barra y pastillas de selección. Migrado sin cambios de comportamiento. ===== */
/* --- bloque 14 --- */
/* Pinta la parte llena de cada deslizador */
document.querySelectorAll("input[type=range]").forEach(r => {
  const pintar = () => r.style.setProperty("--pct", ((r.value - r.min) / (r.max - r.min) * 100) + "%");
  r.addEventListener("input", pintar);
  pintar();
});

/* --- bloque 15 --- */
/* El menú ⋯ se saca del encabezado para que flote sobre la barra inferior */
(function () {
  const menu = document.getElementById("panelMas");
  if (menu) document.body.appendChild(menu);
  const tab = document.getElementById("tabMas");
  if (tab) tab.addEventListener("click", () => {
    if (typeof alternarPanel === "function") alternarPanel("panelMas");
  });
})();

/* --- bloque 16 --- */
/* El orbe se coloca justo en el centro de la barra, encima de su hueco */
(function () {
  const slot = document.getElementById("tabEstela");
  const orbe = document.getElementById("chatAbrir");
  if (!slot || !orbe) return;
  const colocar = () => {
    const r = slot.getBoundingClientRect();
    if (!r.width) return;
    const t = 58;
    orbe.style.left = (r.left + (r.width - t) / 2) + "px"; orbe.style.setProperty("left", (r.left + (r.width - t) / 2) + "px", "important");
    orbe.style.top = (r.top + (r.height - t) / 2) + "px"; orbe.style.setProperty("top", (r.top + (r.height - t) / 2) + "px", "important");
  };
  colocar();
  window.addEventListener("resize", colocar);
  if (window.ResizeObserver) new ResizeObserver(colocar).observe(slot);
  new MutationObserver(colocar).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", colocar);
})();

/* --- bloque 17 --- */
(function(){
  const mas = document.getElementById("panelMas");
  const av = document.getElementById("panelAvanzados");
  if (mas && av) { while (mas.firstChild) av.appendChild(mas.firstChild); }
})();

/* --- bloque 18 --- */
document.addEventListener("DOMContentLoaded", () => {
  const re = /^(\p{Extended_Pictographic}\uFE0F?)\s*/u;
  document.querySelectorAll("#panelMas button.pildora, #panelMas .pildora").forEach(b => {
    if (b.querySelector(".ico")) return;
    const m = b.textContent.match(re);
    if (!m) return;
    const resto = b.textContent.slice(m[0].length);
    b.textContent = "";
    const ico = document.createElement("span");
    ico.className = "ico"; ico.setAttribute("aria-hidden", "true"); ico.textContent = m[1];
    b.appendChild(ico);
    b.appendChild(document.createTextNode(resto));
  });
});

/* --- bloque 19 --- */
(function () {
  // Brillo que sigue al dedo o al cursor
  document.addEventListener("pointermove", e => {
    const el = e.target.closest && e.target.closest(".pildora, #tabbar button, .explorar-item, .explorar-tile, .actor-card, .tarjeta");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (e.clientX - r.left) + "px");
    el.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });
  document.addEventListener("pointerdown", e => {
    const el = e.target.closest && e.target.closest(".pildora, #tabbar button, .explorar-item, .explorar-tile, .actor-card, .tarjeta");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (e.clientX - r.left) + "px");
    el.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });

  // Indicador deslizante de la barra inferior: se estira como una gota al ir a otra pestaña y al regresar
  const barra = document.getElementById("tabbar");
  if (!barra) return;
  const ind = document.createElement("span");
  ind.className = "lg-indicador";
  barra.insertBefore(ind, barra.firstChild);
  let ultimo = null;
  const medir = b => ({ x: b.offsetLeft, w: b.offsetWidth });
  const colocar = (animar) => {
    const act = barra.querySelector("button.activa");
    if (!act || !act.offsetWidth) { ind.style.width = "0px"; ultimo = null; return; }
    const a = medir(act);
    ind.style.left = a.x + "px";
    ind.style.width = a.w + "px";
    if (false && animar && ultimo && (ultimo.x !== a.x || ultimo.w !== a.w) && ind.animate) {
      const de = ultimo;
      const izq = Math.min(de.x, a.x);
      const ancho = Math.abs(a.x - de.x) + Math.min(de.w, a.w);
      ind.animate([
        { left: de.x + "px", width: de.w + "px", offset: 0 },
        { left: izq + "px", width: ancho + "px", offset: 0.55 },
        { left: a.x + "px", width: a.w + "px", offset: 1 }
      ], { duration: 560, easing: "cubic-bezier(.22,.9,.3,1)" });
    }
    ultimo = a;
  };
  new MutationObserver(() => colocar(true)).observe(barra, { attributes: true, subtree: true, attributeFilter: ["class"] });
  if (window.ResizeObserver) new ResizeObserver(() => colocar(false)).observe(barra);
  window.addEventListener("resize", () => colocar(false));
  // Cuando la barra aparece (al entrar), se coloca sin animar
  new MutationObserver(() => { if (document.body.classList.contains("con-sesion")) setTimeout(() => colocar(false), 60); })
    .observe(document.body, { attributes: true, attributeFilter: ["class"] });
  colocar(false);
})();

/* --- bloque 20 --- */
// Ligeras primero, después las intensas y al final las tranquilas
function intensidadMaraton(p) {
  const g = String(p.genero || "").toLowerCase();
  if (/animaci|familia|comedia|aventura/.test(g)) return 1;
  if (/terror|suspenso|crimen|accion|acción|thriller/.test(g)) return 3;
  return 2;
}

function horaTexto(d) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// Arma la noche (sin pintar nada): la usan la ventana del maratón y el chat
function planearNoche(minutosPedidos, tema, dir) {
  let base = pendientesNoVistas();
  let aviso = "";
  if (!base.length) {
    base = Nucleo.datos.peliculas().filter(p => !estadoDe(p).vista && !(Nucleo.datos.marcas()[p.titulo] || {}).descartada);
    aviso = "No tienes pendientes, así que armo con películas que no has visto.";
  }
  base = base.filter(p => {
    const g = String(p.genero || "");
    if (tema === "terror") return /terror|suspenso/i.test(g);
    if (tema === "animacion") return /animaci/i.test(g);
    if (tema === "comedia") return /comedia/i.test(g);
    if (tema === "director") return !!dir && String(p.director || "").toLowerCase().includes(dir.toLowerCase());
    return true;
  });
  if (!base.length) return { error: tema === "libre" ? "No tienes películas sin ver en tu catálogo. Agrega algunas o marca pendientes." : "Ya no te quedan películas sin ver de ese tema. ¿Probamos con otro género?" };
  const pool = base.map(p => ({ p, m: minutos(p) })).filter(x => x.m > 0);
  if (!pool.length) return { error: "Ninguna de estas películas tiene duración escrita. Revisa la columna «duracion» de la hoja, por ejemplo «1 h 45 min»." };

  const GAP = 10, MAX = 5;
  const { elegidas, total: usados } = armarLista({ pool, minutosMax: minutosPedidos, maximo: MAX, separacion: GAP });
  if (!elegidas.length) return { error: "Ninguna película cabe en " + minutosPedidos + " minutos. ¿Le subimos un poco al tiempo?" };
  const grupo = n => elegidas.filter(x => intensidadMaraton(x.p) === n);
  const secuencia = [...grupo(1), ...grupo(3), ...grupo(2)];
  return { aviso, elegidas, secuencia, usados, sobra: minutosPedidos - usados, GAP };
}

/* --- bloque 21 --- */
/* Coloca la pastilla sobre la opción activa de cada selector y de la barra inferior */
(function () {
  function asegurar(cont) {
    if (!cont.querySelector(":scope > .indicador")) {
      const ind = document.createElement("span");
      ind.className = "indicador";
      cont.insertBefore(ind, cont.firstChild);
    }
    return cont.querySelector(":scope > .indicador");
  }
  function mover(cont) {
    const ind = asegurar(cont);
    const act = cont.querySelector(".activa");
    if (!act || !act.offsetWidth) { ind.style.opacity = 0; return; }
    ind.style.opacity = 1;
    ind.style.width = act.offsetWidth + "px";
    ind.style.height = act.offsetHeight + "px";
    ind.style.transform = "translate(" + act.offsetLeft + "px," + act.offsetTop + "px)";
  }
  function todos() {
    document.querySelectorAll(".segmentado, #tabbar").forEach(mover);
  }
  todos();
  window.addEventListener("resize", todos);
  // Solo se recalcula cuando cambia algo: clases (cambio de pestaña) o tamaño
  new MutationObserver(todos).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  if (window.ResizeObserver) new ResizeObserver(todos).observe(document.body);
})();


if (window.Nucleo) { Nucleo.registrar("adornos", { version: "1.0", emite: [], escucha: [] }); }
