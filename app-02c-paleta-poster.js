/* ===== Fase 0 · Módulo «paleta-poster»: paleta de 3 colores tomada del póster de cada película. Migrado de app-02 sin cambios de comportamiento. ===== */
/* ---------- Paleta de 3 colores del póster ---------- */
function distancia(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function paletaDePoster(url) {
  if (paletaCache.has(url)) return Promise.resolve(paletaCache.get(url));
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = 64;
        const h = Math.max(1, Math.round(w * img.height / img.width));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const datos = ctx.getImageData(0, 0, w, h).data;

        const cubos = {};
        let total = 0;
        for (let i = 0; i < datos.length; i += 4) {
          const r = datos[i], g = datos[i + 1], b = datos[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max < 15 || min > 240) continue;
          if (max - min < 10) continue;
          total++;
          const clave = (r >> 4) + "," + (g >> 4) + "," + (b >> 4);
          const cubo = cubos[clave] || (cubos[clave] = { n: 0, r: 0, g: 0, b: 0 });
          cubo.n++; cubo.r += r; cubo.g += g; cubo.b += b;
        }

        const grupos = Object.values(cubos)
          .filter(c => total && c.n / total >= 0.01)
          .map(c => ({ n: c.n, rgb: [Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)] }))
          .sort((a, b) => b.n - a.n);

        const elegidos = [];
        for (const g of grupos) {
          if (elegidos.length >= 3) break;
          if (elegidos.every(e => distancia(e, g.rgb) > 40)) elegidos.push(g.rgb);
        }

        if (elegidos.length === 0) elegidos.push([100, 100, 100], [60, 60, 60], [30, 30, 30]);

        paletaCache.set(url, elegidos);
        resolve(elegidos);
      } catch (e) {
        paletaCache.set(url, []);
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = "https://tmdb-proxy.240300696.workers.dev/?url=" + encodeURIComponent(String(url));
  });
}

function rgbAHex(rgb) {
  return "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("");
}

function hexARgb(hex) {
  const m = String(hex).trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function paletaDeTexto(texto) {
  return String(texto || "").split(",").map(hexARgb).filter(Boolean).slice(0, 3);
}

function fondoDesde(paleta) {
  const [a, b, c] = paleta.length >= 3 ? paleta : (paleta.length ? [paleta[0], paleta[0], paleta[0]] : [[0,0,0],[0,0,0],[0,0,0]]);
  return `radial-gradient(circle at 0% 0%, rgba(${a.join(",")}, 0.2) 0%, transparent 50%), ` +
         `radial-gradient(circle at 100% 0%, rgba(${b.join(",")}, 0.2) 0%, transparent 50%), ` +
         `radial-gradient(circle at 50% -20%, rgba(${c.join(",")}, 0.25) 0%, transparent 60%), ` +
         `var(--tarjeta)`;
}

const PALETA_RESPALDO = [[140, 150, 170], [100, 110, 130], [60, 66, 84]];

function aplicarFondoModal(caja, posterModal, paleta) {
  caja.style.background = fondoDesde(paleta);
  if (posterModal) {
    posterModal.style.boxShadow = `0 12px 32px rgba(${paleta[0].join(",")}, 0.5)`;
  }
}

function aplicarPaleta(p) {
  const caja = document.querySelector("#modal .ventana");
  if (!caja) return;

  const paletaHoja = paletaDeTexto(p[NOMBRE_PALETA]);
  if (paletaHoja.length) {
    aplicarFondoModal(caja, caja.querySelector(".portada"), paletaHoja);
    return;
  }

  aplicarFondoModal(caja, caja.querySelector(".portada"), PALETA_RESPALDO);
  if (!p.portada || datosLimitados()) return;

  paletaDePoster(p.portada).then(calc => {
    if (calc.length && detalleActual === p) {
      aplicarFondoModal(caja, caja.querySelector(".portada"), calc);
    }
  });
}

function letraColumna(n) {
  let s = "";
  n = n + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function sheetsFetch(path, metodo, cuerpo) {
  const r = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + HOJA_ID + "/" + path, {
    method: metodo || "GET",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  if (!r.ok) throw new Error("Sheets respondió " + r.status);
  return r.json();
}

if (window.Nucleo) { Nucleo.registrar("paleta-poster", { version: "1.0", emite: [], escucha: [] }); }
