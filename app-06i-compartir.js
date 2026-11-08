/* ===== Fase 5 · Módulo «compartir» (compartir una recomendación con su razón) =====
   Usa la hoja de compartir del teléfono si existe; si no, copia el texto al portapapeles.
   El texto dice la película, el año y por qué se recomienda. No incluye enlaces: la app no tiene
   páginas públicas por película. ===== */
(function () {
  function textoRecomendacion(titulo, anio, razon) {
    const cuerpo = "Te recomiendo «" + titulo + "»" + (anio ? " (" + anio + ")" : "") + ".";
    return razon ? cuerpo + " " + razon.charAt(0).toUpperCase() + razon.slice(1) + "." : cuerpo;
  }

  async function compartir(texto, titulo) {
    if (navigator.share) {
      try { await navigator.share({ title: titulo, text: texto }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }            // la persona cerró la hoja: no hacer nada más
    }
    try {
      await navigator.clipboard.writeText(texto);
      if (typeof avisar === "function") avisar("Recomendación copiada. Pégala donde quieras.");
    } catch (e) {
      if (typeof avisar === "function") avisar("No pude compartir ni copiar el texto en este navegador.");
    }
  }

  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-compartir-titulo]");
    if (!b) return;
    const titulo = b.dataset.compartirTitulo;
    const texto = textoRecomendacion(titulo, b.dataset.compartirAnio, b.dataset.compartirRazon);
    compartir(texto, titulo);
  });

  if (window.Nucleo) {
    Nucleo.compartir = { texto: textoRecomendacion };
    Nucleo.registrar("compartir", { version: "1.0", emite: [], escucha: [] });
  }
})();
