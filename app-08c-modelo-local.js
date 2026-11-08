/* ===== Fase 0 · Módulo «modelo-local» (bloque 24): modelo local opcional que entiende frases libres sin internet. Migrado sin cambios de comportamiento. ===== */
/* ---------- Modelo local opcional: entiende frases libres sin internet (se descarga una sola vez) ---------- */
const MODELO_LOCAL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const MODELO_LOCAL_LIB = "https://esm.sh/@mlc-ai/web-llm@0.2.79";
let motorLocal = null;
let motorLocalCargando = null;

function resumenCatalogoParaModelo() {
  const mk = p => Nucleo.datos.marcas()[p.titulo] || {};
  const linea = p => "- " + p.titulo + " (" + (p["año"] || "s/a") + ", " + (generosDe(p).join("/") || "s/g") + ", " + (minutos(p) || "?") + " min)";
  const pend = Nucleo.datos.peliculas().filter(p => mk(p).pendiente && !mk(p).vista).slice(0, 25);
  const vist = Nucleo.datos.peliculas().filter(p => mk(p).vista).slice(-12);
  return "Pendientes:\n" + pend.map(linea).join("\n") + "\nYa vistas:\n" + vist.map(linea).join("\n");
}

async function cargarModeloLocal(onProgreso) {
  if (motorLocal) return motorLocal;
  if (!navigator.gpu) throw new Error("sin-webgpu");
  if (!motorLocalCargando) {
    motorLocalCargando = (async () => {
      const webllm = await import(MODELO_LOCAL_LIB);
      motorLocal = await webllm.CreateMLCEngine(MODELO_LOCAL_ID, {
        initProgressCallback: r => { if (onProgreso) onProgreso(r); }
      });
      return motorLocal;
    })().finally(() => { motorLocalCargando = null; });
  }
  return motorLocalCargando;
}

async function respuestaConModelo(t, hist = []) {
  if (leerLS("modelo_local_modo") !== "si" || !motorLocal) return null;
  const PROMPT = "Eres Estela, una amiga cinéfila que platica en español de México. Eres cálida, cercana y natural, como en una charla, no como un robot. Tutea a la persona. Responde con frases cortas y fluidas, sin listas, asteriscos ni encabezados. Si la persona cuenta cómo se siente, responde primero con empatía. Recomienda solo películas de la lista que te doy y no inventes títulos. Si la pregunta no es de cine ni de su lista, responde con amabilidad y vuelve al cine. Máximo cuatro frases.";
  try {
    const previos = (hist || []).slice(-6).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 400) }));
    const r = await motorLocal.chat.completions.create({
      messages: [{ role: "system", content: PROMPT + "\n\n" + resumenCatalogoParaModelo() }, ...previos, { role: "user", content: String(t).slice(0, 500) }],
      max_tokens: 200,
      temperature: 0.75,
      top_p: 0.9
    });
    const txt = r && r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content;
    return txt ? txt.trim() : null;
  } catch (e) { return null; }
}

const btnModelo = $("modeloDescargar");
const estadoModelo = $("modeloEstado");
const selModelo = $("modelo-local-modo");
selModelo.value = leerLS("modelo_local_modo") || "no";

function pintarEstadoModelo(texto) {
  if (texto) { estadoModelo.textContent = texto; return; }
  if (motorLocal) estadoModelo.textContent = "Listo: Estela entiende frases libres sin internet.";
  else if (!navigator.gpu) estadoModelo.textContent = "Este navegador no puede ejecutar el modelo local. Sigue funcionando el modo sin IA.";
  else estadoModelo.textContent = "Sin descargar. Conviene hacerlo con Wi-Fi.";
}

let descargaEnCurso = false;

async function descargarModelo() {
  if (descargaEnCurso || motorLocal) { pintarEstadoModelo(); return; }
  if (!navigator.gpu) { pintarEstadoModelo(); return; }
  descargaEnCurso = true;
  btnModelo.disabled = true;
  pintarEstadoModelo("Preparando la descarga…");
  // Si tarda demasiado, lo dice en vez de quedarse en silencio. Lo ya descargado se conserva.
  const vigilante = setTimeout(() => {
    if (!motorLocal) pintarEstadoModelo("Tarda más de lo normal. Revisa tu conexión y que tu navegador tenga WebGPU. Puedes dejarlo y volver después.");
  }, 45000);
  try {
    await cargarModeloLocal(r => pintarEstadoModelo("Descargando… " + Math.round((r.progress || 0) * 100) + "%"));
    escribirLS("modelo_local_modo", "si");
    selModelo.value = "si";
    pintarEstadoModelo("Listo: Estela entiende frases libres sin internet.");
  } catch (e) {
    const detalle = e && e.message ? " (" + String(e.message).slice(0, 80) + ")" : "";
    pintarEstadoModelo("No se pudo descargar el modelo" + detalle + ". Revisa tu conexión y vuelve a intentarlo.");
  } finally {
    clearTimeout(vigilante);
    descargaEnCurso = false;
    btnModelo.disabled = false;
  }
}

btnModelo.addEventListener("click", () => descargarModelo());
selModelo.addEventListener("change", () => escribirLS("modelo_local_modo", selModelo.value));
pintarEstadoModelo();

// Si ya se descargó antes, lo carga solo en segundo plano (la caché del navegador lo hace rápido)
if (leerLS("modelo_local_modo") === "si" && navigator.gpu) {
  setTimeout(() => { cargarModeloLocal().then(() => pintarEstadoModelo()).catch(() => pintarEstadoModelo()); }, 4000);
}


if (window.Nucleo) { Nucleo.registrar("modelo-local", { version: "1.0", emite: [], escucha: [] }); }
