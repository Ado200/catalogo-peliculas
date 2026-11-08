/* ===== Fase 5 · Módulo «calendario-google» (sincronización en dos sentidos con Google Calendar) =====
   - Tus cambios en la app se envían a Google: crear, cambiar la fecha o borrar el evento.
   - Tus cambios en Google se traen a la app: si cambias la fecha de un evento, la app la actualiza;
     si borras un evento en Google, se quita el plan de esa película en la app.
   Viene APAGADA. Se enciende desde Yo → Sincronizar con Google Calendar. Necesita el permiso de calendario.
   Seguridad: cada evento se consulta por su identificador. Si hay un error de red o de permisos, no se
   cambia nada en la app. ===== */
(function () {
  const BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const CLAVE_ON = "cal_google_on";
  const CLAVE_MAP = "cal_google_map";
  const FECHA_OK = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ""));

  const activo = () => { try { return localStorage.getItem(CLAVE_ON) === "si"; } catch (e) { return false; } };
  const mapa = () => { try { return JSON.parse(localStorage.getItem(CLAVE_MAP) || "{}"); } catch (e) { return {}; } };
  const guardarMapa = m => { try { localStorage.setItem(CLAVE_MAP, JSON.stringify(m)); } catch (e) {} };
  const token = () => (typeof accessToken !== "undefined" ? accessToken : null);

  function cuerpo(p) {
    const [y, m, d] = p.fecha.split("-").map(Number);
    const f = x => x.toISOString().slice(0, 10);
    return {
      summary: "Ver: " + p.titulo,
      start: { date: f(new Date(Date.UTC(y, m - 1, d))) },
      end: { date: f(new Date(Date.UTC(y, m - 1, d + 1))) },
      transparency: "transparent",
      extendedProperties: { private: { catalogo: "plan", titulo: p.titulo } }
    };
  }

  async function llamar(metodo, url, body) {
    return fetch(url, {
      method: metodo,
      headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
  }

  function avisarFallo(status) {
    if (typeof avisar === "function") avisar("Google Calendar no permitió el cambio (" + status + "). Vuelve a conectar tu cuenta.");
  }

  // Fija o quita la fecha de plan de una película, igual que en la app. No pregunta nada.
  function fijarFechaDesdeGoogle(titulo, fecha) {
    const nuevo = Object.assign({}, Nucleo.datos.marcas()[titulo] || {});
    if (fecha) nuevo.conFecha = fecha; else delete nuevo.conFecha;
    Nucleo.datos.marcas()[titulo] = nuevo;
    programarGuardado();
  }

  // 1) Traer desde Google lo que cambió allí
  async function traerDeGoogle(m) {
    let cambios = 0;
    for (const titulo of Object.keys(m)) {
      const r = await llamar("GET", BASE + "/" + encodeURIComponent(m[titulo].id));
      if (r.status === 401 || r.status === 403) { avisarFallo(r.status); return { cambios, cortar: true }; }
      if (r.status === 404 || r.status === 410) {                       // borrado en Google
        delete m[titulo];
        fijarFechaDesdeGoogle(titulo, "");
        cambios++;
        continue;
      }
      if (!r.ok) continue;                                               // error puntual: no tocar nada
      const ev = await r.json();
      if (ev.status === "cancelled") {
        delete m[titulo];
        fijarFechaDesdeGoogle(titulo, "");
        cambios++;
        continue;
      }
      const nueva = ev.start && ev.start.date;
      if (FECHA_OK(nueva) && nueva !== m[titulo].fecha) {                // fecha cambiada en Google
        m[titulo].fecha = nueva;
        fijarFechaDesdeGoogle(titulo, nueva);
        cambios++;
      }
    }
    return { cambios, cortar: false };
  }

  // 2) Enviar a Google lo que cambió en la app
  async function enviarAGoogle(m) {
    const plan = Nucleo.calendario.planes();
    const planeados = new Set(plan.map(p => p.titulo));
    let cambios = 0;
    for (const p of plan) {
      const previo = m[p.titulo];
      if (!previo) {
        const r = await llamar("POST", BASE, cuerpo(p));
        if (r.status === 401 || r.status === 403) { avisarFallo(r.status); return { cambios, cortar: true }; }
        if (r.ok) { const j = await r.json(); m[p.titulo] = { id: j.id, fecha: p.fecha }; cambios++; }
      } else if (previo.fecha !== p.fecha) {
        const r = await llamar("PATCH", BASE + "/" + encodeURIComponent(previo.id), cuerpo(p));
        if (r.status === 401 || r.status === 403) { avisarFallo(r.status); return { cambios, cortar: true }; }
        if (r.ok) { m[p.titulo].fecha = p.fecha; cambios++; }
        else if (r.status === 404 || r.status === 410) delete m[p.titulo];
      }
    }
    for (const t of Object.keys(m)) {
      if (planeados.has(t)) continue;
      const r = await llamar("DELETE", BASE + "/" + encodeURIComponent(m[t].id));
      if (r.status === 401 || r.status === 403) { avisarFallo(r.status); return { cambios, cortar: true }; }
      if (r.ok || r.status === 404 || r.status === 410) { delete m[t]; cambios++; }
    }
    return { cambios, cortar: false };
  }

  let sincronizando = false;
  async function sincronizar() {
    if (sincronizando) return;
    if (!activo() || !token() || !navigator.onLine || !window.Nucleo || !Nucleo.calendario) return;
    sincronizando = true;
    const m = mapa();
    try {
      const bajada = await traerDeGoogle(m);
      if (!bajada.cortar) {
        const subida = await enviarAGoogle(m);
        const total = bajada.cambios + subida.cambios;
        if (total && typeof avisar === "function") {
          avisar("Google Calendar al día: " + total + " cambio" + (total === 1 ? "" : "s") +
            (bajada.cambios ? " (" + bajada.cambios + " traídos desde Google)" : "") + ".");
        }
      }
    } catch (e) {
      // error de red: no se cambia nada en la app
    } finally {
      guardarMapa(m);
      sincronizando = false;
    }
  }

  let turno = null;
  const programar = () => { clearTimeout(turno); turno = setTimeout(sincronizar, 3000); };

  function alternar() {
    const encender = !activo();
    try { localStorage.setItem(CLAVE_ON, encender ? "si" : "no"); } catch (e) {}
    if (encender) {
      if (typeof avisar === "function") avisar("Sincronización con Google Calendar activada.");
      sincronizar();
    } else if (typeof avisar === "function") {
      avisar("Sincronización desactivada. Los eventos que ya están en Google no se borran.");
    }
    return encender;
  }

  if (window.Nucleo) {
    Nucleo.calendarioGoogle = { alternar: alternar, sincronizar: sincronizar, activo: activo };
    Nucleo.on("marcas:cambiadas", programar, "calendario-google");
    Nucleo.registrar("calendario-google", { version: "1.1", emite: [], escucha: ["marcas:cambiadas"] });
  }
  setTimeout(() => { if (activo()) sincronizar(); }, 9000);
})();
