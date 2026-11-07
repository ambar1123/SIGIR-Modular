(function () {
  if (typeof google !== "undefined" && google.script && google.script.run) return;
  // tipos: "alumno" y "administrativo" reportan; "academico" = Servicios Generales / CTA (atiende)
  var USUARIOS = [
    { usuario: "220621311",    contrasena: "sigir2026", tipo: "alumno", nombre: "Saul Alejandro Angel Garcia", correo: "saul.angel2131@alumnos.udg.mx", programa: "Ingeniería en Computación" },
    { usuario: "2950123",      contrasena: "sigir2026", tipo: "administrativo", nombre: "Administrativo de Prueba", correo: "administrativo.prueba@academicos.udg.mx", programa: "Secretaría Administrativa" },
    { usuario: "coordinacion", contrasena: "sigir2026", tipo: "academico", nombre: "Servicios Generales y CTA", correo: "coordinacion@cucei.udg.mx", programa: "Servicios Generales / CTA" }
  ];
  var K = "sigir_reportes", sesiones = {};
  function leer() { try { return JSON.parse(localStorage.getItem(K) || "[]"); } catch (e) { return []; } }
  function guardar(l) {
    try { localStorage.setItem(K, JSON.stringify(l)); }
    catch (e) { throw new Error("Almacenamiento local lleno. Usa menos fotos."); }
  }
  function quitarDemo() {   // elimina los reportes de ejemplo de versiones anteriores
    var l = leer(), limpio = l.filter(function (r) { return !/^d[123]$/.test(r.id); });
    if (limpio.length != l.length) guardar(limpio);
  }
  var KC = "sigir_cuentas";   // cuentas creadas desde "Crear cuenta" (solo modo local de prueba)
  function cuentas() { try { return JSON.parse(localStorage.getItem(KC) || "[]"); } catch (e) { return []; } }
  async function hash(u, p) {   // SOLO DEMO: en producción el servidor guarda el hash con sal
    var txt = "sigir:" + u + ":" + p;
    try { var b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)); return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
    catch (e) { return "b64:" + btoa(unescape(encodeURIComponent(txt))); }
  }
  function buscar(u) { return USUARIOS.filter(function (a) { return a.usuario == u; })[0] || cuentas().filter(function (a) { return a.usuario == u; })[0]; }
  function ses(t) { if (!sesiones[t]) throw new Error("Tu sesión expiró. Vuelve a ingresar."); return sesiones[t]; }
  var api = {
    login: async function (u, c) {
      var x = USUARIOS.filter(function (a) { return a.usuario == u && a.contrasena == c; })[0];
      if (!x) { var h = await hash(u, c); x = cuentas().filter(function (a) { return a.usuario == u && a.hash == h; })[0]; }
      if (!x) return null;
      var t = Date.now() + "-" + Math.random().toString(36).slice(2);
      sesiones[t] = { usuario: x.usuario, tipo: x.tipo };
      return { token: t, usuario: x.usuario, tipo: x.tipo };
    },
    listar: function (t) {
      ses(t); quitarDemo(); var l = leer();
      return l.sort(function (a, b) { return b.fecha - a.fecha; });
    },
    crearReporte: function (t, d) {
      var s = ses(t);
      if (s.tipo == "academico") throw new Error("Servicios Generales / CTA atiende los reportes, no los crea.");
      var mm = moderarTexto(d.lugar + " " + d.descripcion); if (mm) throw new Error(mm);
      var l = leer();
      l.push({ id: "r" + Date.now(), fecha: Date.now(), codigo: s.usuario, rol: s.tipo, edificio: d.edificio, lugar: d.lugar,
               categoria: d.categoria, descripcion: d.descripcion, fotos: d.fotos.slice(0, 4), estado: "pendiente", nota: "", revision: !!d.revision, vistos: [], comentarios: [] });
            var nuevo = l[l.length - 1];
      if (s.tipo == "administrativo") {
        var u = buscar(s.usuario);
        nuevo.folio = "SG-" + new Date().getFullYear() + "-" + ("000" + (l.filter(function (x) { return x.folio; }).length + 1)).slice(-4);
        nuevo.solicitante = { nombre: u.nombre, area: u.programa, telefono: d.telefono || "" };
        nuevo.tipoMant = d.tipoMant || "Correctivo";
        try { localStorage.setItem("tel_" + s.usuario, d.telefono); } catch (e) {}
      }
      guardar(l); return nuevo;
    },
    registrar: async function (d) {
      var e = validarRegistro(d, d.pass, true); if (e) throw new Error(e);
      if (buscar(d.codigo)) throw new Error("Ese código ya tiene una cuenta. Inicia sesión.");
      var l = cuentas();
      if (l.some(function (c) { return c.correo == d.correo; }) || USUARIOS.some(function (c) { return c.correo == d.correo; })) throw new Error("Ese correo ya está registrado.");
      var tipo = d.tipo == "administrativo" ? "administrativo" : "alumno";   // nunca se puede crear una cuenta de Servicios Generales desde aquí
      l.push({ usuario: d.codigo, hash: await hash(d.codigo, d.pass), tipo: tipo, nombre: d.nombre, correo: d.correo, programa: d.programa, fecha: Date.now() });
      try { localStorage.setItem(KC, JSON.stringify(l)); } catch (x) { throw new Error("No se pudo guardar la cuenta."); }
      if (d.telefono) { try { localStorage.setItem("tel_" + d.codigo, d.telefono); } catch (x) {} }
      return true;
    },
    perfil: function (t) {   // datos institucionales (solo lectura) + foto
      var s = ses(t), u = buscar(s.usuario), f = "";
      try { f = (JSON.parse(localStorage.getItem("sigir_fotos") || "{}"))[s.usuario] || ""; } catch (e) {}
      return { usuario: u.usuario, tipo: u.tipo, nombre: u.nombre, correo: u.correo, programa: u.programa, foto: f };
    },
    guardarFoto: function (t, d) {
      var s = ses(t); if (d && d.indexOf("data:image/") != 0) throw new Error("Imagen no válida.");
      var m = {}; try { m = JSON.parse(localStorage.getItem("sigir_fotos") || "{}"); } catch (e) {}
      if (d) m[s.usuario] = d; else delete m[s.usuario];
      try { localStorage.setItem("sigir_fotos", JSON.stringify(m)); } catch (e) { throw new Error("No se pudo guardar la foto."); }
      return true;
    },
    guardarTelefono: function (u, tel) {
      if (!/^\d{10}$/.test(tel)) throw new Error("Teléfono inválido.");
      try { localStorage.setItem("tel_" + u, tel); } catch (e) {}
      return true;
    },
    comentar: function (t, id, txt) {
      var s = ses(t), mm = moderarTexto(txt); if (mm) throw new Error(mm);
      var l = leer(), r = l.filter(function (x) { return x.id == id; })[0]; if (!r) throw new Error("Reporte no encontrado.");
      (r.comentarios = r.comentarios || []).push({ codigo: s.usuario, rol: s.tipo, texto: String(txt).trim(), fecha: Date.now() });
      guardar(l); return true;
    },
    alternarVisto: function (t, id) {
      var s = ses(t), l = leer(), r = l.filter(function (x) { return x.id == id; })[0]; if (!r) throw new Error("Reporte no encontrado.");
      r.vistos = r.vistos || []; var i = r.vistos.indexOf(s.usuario);
      if (i >= 0) r.vistos.splice(i, 1); else r.vistos.push(s.usuario);
      guardar(l); return true;
    },
    aprobarFoto: function (t, id) {
      var s = ses(t); if (s.tipo != "academico") throw new Error("Sin permiso.");
      var l = leer(); l.forEach(function (r) { if (r.id == id) r.revision = false; }); guardar(l); return true;
    },
    actualizar: function (t, id, estado, nota) {
      var s = ses(t);
      if (s.tipo != "academico") throw new Error("Sin permiso.");
      var l = leer();
            var quien = buscar(s.usuario);
      l.forEach(function (r) { if (r.id == id) { r.estado = estado; r.nota = nota || ""; r.revisor = s.usuario; if (r.folio && !r.recibe) { r.recibe = quien.nombre; r.fechaRecepcion = Date.now(); } } });
      guardar(l); return true;
    }
  };
  function crear(ok, fail) {
    var o = {
      withSuccessHandler: function (f) { return crear(f, fail); },
      withFailureHandler: function (f) { return crear(ok, f); }
    };
    Object.keys(api).forEach(function (n) {
      o[n] = function () {
        var a = arguments;
        setTimeout(function () {
          Promise.resolve().then(function () { return api[n].apply(null, a); }).then(function (r) { if (ok) ok(r); }, function (e) { if (fail) fail(e); });
        }, 120);
      };
    });
    return o;
  }
  window.google = { script: { run: crear() } };
})();

var $ = function (id) { return document.getElementById(id); };
  var EDIFICIOS = ["Edificio A","Edificio B","Edificio C","Edificio D","Edificio E","Edificio F","Edificio G","Edificio H","Edificio I","Edificio J","Edificio K","Edificio L","Edificio L2","Edificio M","Edificio N","Edificio O","Edificio P","Edificio Q","Edificio R","Edificio S","Edificio S2","Edificio T","Edificio U","Edificio V","Edificio V2","Edificio Y","Edificio X","Edificio Z","Edificio Z2","Lonaria","Biblioteca CID","Cafetería","Estacionamiento","CTA","Laboratorio de Ingenierías","Otro"];
  var ETIQUETA = { pendiente: "Pendiente", visto: "Visto", resuelto: "Resuelto" };
  var sesion = null, reportes = [], evidencias = [], hayRevision = false;

  // Roles: alumno y administrativo reportan; academico = Servicios Generales / CTA (atiende)
  function atiende() { return sesion && sesion.tipo == "academico"; }

  EDIFICIOS.forEach(function (e) {
    ["edificio", "fEdificio"].forEach(function (id) {
      var o = document.createElement("option"); o.textContent = e; $(id).appendChild(o);
    });
  });

  function esc(s) { var d = document.createElement("div"); d.textContent = (s == null ? "" : s); return d.innerHTML; }
  function falla(e) { alert((e && e.message) ? e.message.replace(/^Error: /, "") : "Ocurrió un error. Intenta de nuevo."); }

  // ===== LOGIN =====
  function iniciarSesion() {
    var u = $("usuario").value.trim();
    var c = $("contrasena").value;
    var error = $("mensajeError");
    error.style.color = "red";

    if (u == "" || c == "") { error.innerHTML = "Llena los dos campos."; return; }

    var btn = $("btnIngresar");
    btn.disabled = true; error.innerHTML = "";
    google.script.run
      .withSuccessHandler(function (r) {
        btn.disabled = false;
        if (!r) { error.innerHTML = "Usuario o contraseña incorrectos."; return; }
        sesion = r; abrirInicio();
      })
      .withFailureHandler(function (e) { btn.disabled = false; error.innerHTML = "No se pudo conectar. Intenta de nuevo."; })
      .login(u, c);
  }

  $("contrasena").addEventListener("keydown", function (e) { if (e.key == "Enter") iniciarSesion(); });

  function verContrasena() {
    var campo = $("contrasena"), boton = $("ojo");
    if (campo.type == "password") { campo.type = "text"; boton.innerHTML = "Ocultar contraseña"; }
    else { campo.type = "password"; boton.innerHTML = "Mostrar contraseña"; }
  }

  function olvideContrasena() {
    var error = $("mensajeError");
    error.style.color = "#1c4c96";
    error.innerHTML = "Para recuperar tu contraseña, acude a la Coordinación o escribe a soporte de SIGIR.";
  }

  // ===== INICIO SEGÚN TIPO DE USUARIO =====
  function abrirInicio() {
    $("vistaLogin").classList.add("oculto");
    $("sesion").classList.remove("oculto");
    $("quien").textContent = sesion.usuario; cargarPerfil();
    if (!atiende()) {   // alumno o administrativo
      $("nombreAlumno").textContent = sesion.usuario;
      $("vistaAlumno").classList.remove("oculto"); irA("feed");
      $("extraAdmin").classList.toggle("oculto", sesion.tipo != "administrativo");
      try { $("telSolicitante").value = telOf(localStorage.getItem("tel_" + sesion.usuario) || ""); } catch (e) {}
    } else {            // Servicios Generales / CTA
      $("vistaAdmin").classList.remove("oculto");
    }
    cargar();
  }

  function salir() { location.reload(); }

  function cargar() {
    google.script.run
      .withSuccessHandler(function (l) { reportes = l; pintar(); })
      .withFailureHandler(falla)
      .listar(sesion.token);
  }

  function contar(lista, pref) {
    var c = { pendiente: 0, visto: 0, resuelto: 0 };
    lista.forEach(function (r) { c[r.estado] = (c[r.estado] || 0) + 1; });
    $(pref + "_total").textContent = lista.length;
    ["pendiente", "visto", "resuelto"].forEach(function (k) { $(pref + "_" + k).textContent = c[k]; });
  }

  function tarjeta(r, admin) {
    var f = new Date(Number(r.fecha)).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
    var h = '<div class="tarjeta ' + esc(r.estado) + '"><div class="arriba"><h3>' + esc(r.edificio) + " · " + esc(r.lugar) + '</h3><span class="chip ' + esc(r.estado) + '">' + ETIQUETA[r.estado] + "</span></div>";
    var quien = (r.rol == "administrativo") ? " · Administrativo · Núm. " : " · Alumno · Código ";
    h += '<div class="meta">' + esc(r.categoria) + " · " + f + (admin ? quien + esc(r.codigo) : "") + "</div>";
    h += "<p>" + esc(r.descripcion) + "</p>";
    h += '<div class="evid' + (r.revision && !admin ? " revision" : "") + '">' + r.fotos.map(function (u) { return '<img src="' + esc(u) + '" onclick="window.open(this.src)" alt="Evidencia">'; }).join("") + "</div>";
    if (admin && r.revision) h += '<div class="aviso"><span>Foto marcada para revisión por el filtro automático.</span><button class="claro" onclick="aprobar(\'' + r.id + '\')">Aprobar foto</button></div>';
    if (!admin && r.nota) h += '<p class="meta"><b>Nota de Servicios Generales:</b> ' + esc(r.nota) + "</p>";
    if (admin) {
      h += '<input type="text" id="n' + r.id + '" placeholder="Nota (opcional)" value="' + esc(r.nota) + '" style="margin-top:10px">';
      h += '<div class="acciones"><button class="claro" onclick="cambiar(\'' + r.id + "','visto')\">Marcar visto</button>";
      h += "<button onclick=\"cambiar('" + r.id + "','resuelto')\">Marcar resuelto</button>";
      h += '<button class="claro" onclick="cambiar(\'' + r.id + "','pendiente')\">Reabrir</button></div>";
    }
    if (r.folio) h += '<div class="aviso"><span>Oficio <b>' + esc(r.folio) + "</b>" + (r.recibe ? " · Recibido por " + esc(r.recibe) : " · Sin recibir") + '</span><button class="claro" onclick="verOficioId(\'' + r.id + '\')">Ver oficio</button></div>';
    return h + "</div>";
  }

  function pintar() {
    if (!sesion) return;
    if (!atiende()) {
      var mios = reportes.filter(function (r) { return r.codigo == sesion.usuario; });
      contar(mios, "a");
      $("listaAlumno").innerHTML = mios.length ? mios.map(function (r) { return tarjeta(r, false); }).join("") : '<p class="meta">Aún no has enviado reportes.</p>';
      $("feed").innerHTML = reportes.length ? reportes.map(post).join("") : '<p class="meta">Todavía no hay reportes. ¡Sé el primero en reportar!</p>';
    } else {
      contar(reportes, "m");
      var fe = $("fEstado").value, fd = $("fEdificio").value, fr = $("fRol").value;
      var l = reportes.filter(function (r) { return (!fe || r.estado == fe) && (!fd || r.edificio == fd) && (!fr || (r.rol || "alumno") == fr); });
      $("listaAdmin").innerHTML = l.length ? l.map(function (r) { return tarjeta(r, true); }).join("") : '<p class="meta">No hay reportes con esos filtros.</p>';
    }
  }

  // ===== SERVICIOS GENERALES: cambiar estado =====
  function cambiar(id, estado) {
    var nota = $("n" + id).value.trim();
    google.script.run
      .withSuccessHandler(function () { cargar(); })
      .withFailureHandler(falla)
      .actualizar(sesion.token, id, estado, nota);
  }

  // ===== NUEVO REPORTE CON FOTOS =====
  function comprimir(archivo) {
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1100 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = img.width * k; c.height = img.height * k;
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL("image/jpeg", 0.75));
      };
      img.src = URL.createObjectURL(archivo);
    });
  }

  $("archivos").onchange = async function (e) {
    evidencias = []; hayRevision = false; $("previa").innerHTML = ""; var av = $("msgFotos"); av.className = "msg"; av.textContent = "";
    var lista = Array.prototype.slice.call(e.target.files, 0, 4), descartadas = 0;
    if (lista.length) av.textContent = "Analizando imágenes…";
    for (var i = 0; i < lista.length; i++) {
      var d = await comprimir(lista[i]);
      var img = await new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.src = d; });
      var nivel = await analizarImagen(img);
      if (nivel == "bloqueada") { descartadas++; continue; }
      if (nivel == "revision") hayRevision = true;
      evidencias.push(d); $("previa").appendChild(img);
    }
    if (descartadas) { av.className = "msg mal"; av.textContent = descartadas + " foto(s) se descartaron por contenido inapropiado."; }
    else if (hayRevision) av.textContent = "Una foto será revisada por Servicios Generales antes de mostrarse a los demás.";
    else av.textContent = "";
  };

  function enviarReporte() {
    var m = $("msgReporte"); m.className = "msg mal";
    var d = { edificio: $("edificio").value, lugar: $("lugar").value.trim(), categoria: $("categoria").value, descripcion: $("descripcion").value.trim(), fotos: evidencias, revision: hayRevision };
    if (!d.lugar || !d.descripcion) { m.textContent = "Escribe el lugar y la descripción."; return; }
    var mm = moderarTexto(d.lugar + " " + d.descripcion); if (mm) { m.textContent = "Tu reporte no se envió. " + mm; return; }
    if (!evidencias.length) { m.textContent = "Agrega al menos una foto de evidencia."; return; }
        if (sesion.tipo == "administrativo") {
      d.tipoMant = $("tipoMant").value; d.telefono = $("telSolicitante").value.replace(/\D/g, "");
      if (d.telefono.length != 10) { m.textContent = "Escribe tu teléfono de contacto (10 dígitos) para el oficio."; return; }
    }
    var b = $("btnEnviar"); b.disabled = true; m.className = "msg"; m.textContent = "Enviando…";
    google.script.run
      .withSuccessHandler(function (nuevo) {
        b.disabled = false; m.textContent = "✓ Reporte enviado.";
        $("lugar").value = ""; $("descripcion").value = ""; $("archivos").value = ""; evidencias = []; hayRevision = false; $("msgFotos").textContent = ""; irA("mios"); $("previa").innerHTML = "";
        cargar();
        if (nuevo && nuevo.folio) verOficio(nuevo);
      })
      .withFailureHandler(function (e) { b.disabled = false; m.className = "msg mal"; m.textContent = (e && e.message) ? e.message.replace(/^Error: /, "") : "No se pudo enviar."; })
      .crearReporte(sesion.token, d);
  }

// ===== MODERACIÓN DE TEXTO (comentarios y descripciones) =====
var PROHIBIDAS = "puto puta putos putas putazo verga vergas pendejo pendeja chinga chingar chingada chingado chingadera cabron cabrona culero culera mierda idiota imbecil estupido estupida maricon marica joto zorra hdp hijueputa ptm ctm mamon mamona pinche pinches naco naca tonto tonta inutil retrasado retrasada lacra asqueroso asquerosa fuck shit bitch asshole dick pussy cunt fucker".split(" ");
function colapsar(t) { return t.replace(/(.)\1+/g, "$1"); }
var SET_PROHIBIDAS = {};
PROHIBIDAS.forEach(function (p) { SET_PROHIBIDAS[colapsar(p)] = 1; });

function normalizar(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[@4]/g, "a").replace(/3/g, "e").replace(/[1!|]/g, "i").replace(/0/g, "o").replace(/[5$]/g, "s").replace(/7/g, "t");
}

// Devuelve "" si el texto es válido, o el motivo por el que se bloquea
function moderarTexto(texto) {
  texto = String(texto || "");
  if (/(https?:\/\/|www\.|\.com\b|@\w+|\d{8,})/i.test(texto)) return "No se permiten enlaces ni datos de contacto.";
  if (texto.length > 200) return "El comentario es muy largo (máximo 200 caracteres).";
  var n = normalizar(texto).replace(/[^a-z\s]/g, " ");
  if (/\b(te voy a (matar|golpear|partir)|muerete|ojala te mueras|mamate)\b/.test(n)) return "Los mensajes con amenazas no están permitidos.";
  var toks = n.split(/\s+/).filter(Boolean), unidos = [], junto = "";
  toks.forEach(function (t) {                       // "p u t o" -> "puto"
    if (t.length == 1) junto += t; else { if (junto) unidos.push(junto); junto = ""; unidos.push(t); }
  });
  if (junto) unidos.push(junto);
  for (var i = 0; i < unidos.length; i++) {
    var w = colapsar(unidos[i]);
    if (SET_PROHIBIDAS[w] || SET_PROHIBIDAS[w.replace(/s$/, "")]) return "Usa un lenguaje respetuoso: los insultos y groserías se bloquean.";
  }
  return "";
}

// ===== MODERACIÓN DE IMÁGENES =====
// 1) Modelo NSFWJS (se descarga una vez); si no carga, 2) heurística de piel -> "en revisión".
var TF_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js";
var NSFW_URL = "https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js";
var modeloNSFW = null, cargandoNSFW = null;
function cargarScript(u) { return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = u; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
function conModelo() {
  if (!cargandoNSFW) cargandoNSFW = cargarScript(TF_URL).then(function () { return cargarScript(NSFW_URL); })
    .then(function () { return window.nsfwjs.load(); }).then(function (m) { modeloNSFW = m; return m; }).catch(function () { return null; });
  return Promise.race([cargandoNSFW, new Promise(function (r) { setTimeout(function () { r(null); }, 9000); })]);
}
function proporcionPiel(img) {
  var c = document.createElement("canvas"); c.width = c.height = 48;
  var x = c.getContext("2d"); x.drawImage(img, 0, 0, 48, 48);
  var d = x.getImageData(0, 0, 48, 48).data, piel = 0;
  for (var i = 0; i < d.length; i += 4) {
    var r = d[i], g = d[i + 1], b = d[i + 2];
    if (r > 95 && g > 40 && b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15 && Math.abs(r - g) > 15 && r > g && r > b) piel++;
  }
  return piel / (d.length / 4);
}
// Devuelve "ok", "revision" o "bloqueada"
async function analizarImagen(img) {
  var m = modeloNSFW || await conModelo();
  if (m) {
    try {
      var p = {}; (await m.classify(img)).forEach(function (x) { p[x.className] = x.probability; });
      if ((p.Porn || 0) + (p.Hentai || 0) > 0.6 || (p.Sexy || 0) > 0.85) return "bloqueada";
      if ((p.Porn || 0) + (p.Hentai || 0) + (p.Sexy || 0) > 0.35) return "revision";
      return "ok";
    } catch (e) {}
  }
  return proporcionPiel(img) > 0.55 ? "revision" : "ok";
}

// ===== FEED SOCIAL =====
var ICO_OJO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
var ICO_COM = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
var QUIEN = { alumno: "Alumno", administrativo: "Administrativo" };
function autor(c, rol) {
  if (rol == "academico") return "Servicios Generales";
  return (QUIEN[rol] || "Alumno") + " ···" + String(c).slice(-3);
}
function colorAv(c) { var p = ["#062863", "#1c4c96", "#607ec9"], h = 0; String(c).split("").forEach(function (x) { h += x.charCodeAt(0); }); return p[h % 3]; }
function hace(ms) {
  var m = Math.floor((Date.now() - Number(ms)) / 60000);
  if (m < 1) return "ahora"; if (m < 60) return "hace " + m + " min";
  var h = Math.floor(m / 60); if (h < 24) return "hace " + h + " h";
  var d = Math.floor(h / 24); return "hace " + d + (d == 1 ? " día" : " días");
}
var RAPIDOS = ["Yo también lo vi", "Sigue igual hoy", "Ya funciona"];

function post(r) {
  var yo = sesion.usuario, vistos = r.vistos || [], cs = r.comentarios || [], vio = vistos.indexOf(yo) >= 0;
  var h = '<article class="post"><div class="post-top"><div class="av" style="background:' + colorAv(r.codigo) + '">' + esc(String(r.edificio).replace("Edificio ", "").charAt(0)) + "</div>";
  h += '<div class="post-quien"><b>' + autor(r.codigo, r.rol) + (r.codigo == yo ? ' <em class="tu">tú</em>' : "") + "</b><small>" + esc(r.edificio) + " · " + esc(r.lugar) + " · " + hace(r.fecha) + "</small></div>";
  h += '<span class="chip ' + esc(r.estado) + '">' + ETIQUETA[r.estado] + "</span></div>";
  h += '<div class="media' + (r.revision ? " revision" : "") + '">' + r.fotos.map(function (u) { return '<img src="' + esc(u) + '" alt="Evidencia" onclick="window.open(this.src)">'; }).join("");
  if (r.revision) h += '<div class="vela">Foto en revisión por Servicios Generales</div>';
  h += '</div><div class="post-acc"><button class="reac' + (vio ? " on" : "") + '" onclick="alternarVisto(\'' + r.id + "')\">" + ICO_OJO + " Yo también lo vi · " + vistos.length + "</button>";
  h += '<span class="cuenta">' + ICO_COM + " " + cs.length + "</span></div>";
  h += '<div class="post-cuerpo"><span class="cat">' + esc(r.categoria) + "</span> " + esc(r.descripcion) + "</div>";
  if (r.nota) h += '<div class="post-nota"><b>Servicios Generales:</b> ' + esc(r.nota) + "</div>";
  h += '<div class="coms">' + cs.map(function (c) { return '<div class="com"><b>' + autor(c.codigo, c.rol) + "</b> " + esc(c.texto) + " <small>" + hace(c.fecha) + "</small></div>"; }).join("") + "</div>";
  h += '<div class="rapidos">' + RAPIDOS.map(function (t) { return '<button class="rap" onclick="comentar(\'' + r.id + "','" + t + "')\">" + t + "</button>"; }).join("") + "</div>";
  h += '<div class="escribir"><input type="text" id="c' + r.id + '" maxlength="200" placeholder="Escribe un comentario respetuoso…" onkeydown="if(event.key==\'Enter\')comentar(\'' + r.id + "')\">";
  h += '<button class="pub" onclick="comentar(\'' + r.id + "')\">Publicar</button></div>";
  return h + '<p class="msg mal" id="m' + r.id + '"></p></article>';
}

function irA(p) {
  [["feed", "pFeed", "tabFeed"], ["nuevo", "pNuevo", "tabNuevo"], ["mios", "pMios", "tabMios"]].forEach(function (x) {
    $(x[1]).classList.toggle("oculto", x[0] != p); $(x[2]).classList.toggle("on", x[0] == p);
  });
}
function alternarVisto(id) {
  google.script.run.withSuccessHandler(cargar).withFailureHandler(falla).alternarVisto(sesion.token, id);
}
function comentar(id, rapido) {
  var campo = $("c" + id), m = $("m" + id), t = (rapido || campo.value).trim();
  if (!t) return;
  var motivo = moderarTexto(t);
  if (motivo) { m.textContent = "Tu comentario no se publicó. " + motivo; campo.classList.add("rechazado"); return; }
  m.textContent = ""; campo.classList.remove("rechazado");
  google.script.run.withSuccessHandler(cargar)
    .withFailureHandler(function (e) { m.textContent = (e && e.message) ? e.message.replace(/^Error: /, "") : "No se pudo publicar."; })
    .comentar(sesion.token, id, t);
}
function aprobar(id) { google.script.run.withSuccessHandler(cargar).withFailureHandler(falla).aprobarFoto(sesion.token, id); }

// ===== PERFIL (todos los roles) =====
// Foto y teléfono se pueden cambiar; los datos institucionales son de solo lectura.
var yo = null;
var ROLES = { alumno: "Alumno", administrativo: "Personal administrativo", academico: "Servicios Generales · CTA" };
var ET_USUARIO = { alumno: "Código de estudiante", administrativo: "Número de trabajador", academico: "Usuario" };
var ET_PROGRAMA = { alumno: "Programa educativo", administrativo: "Área o dependencia", academico: "Área" };
function pintarAvatar(el, foto, nombre) {
  el.style.backgroundImage = foto ? 'url("' + foto + '")' : "none";
  el.textContent = foto ? "" : String(nombre || "?").trim().charAt(0).toUpperCase();
}
function cargarPerfil() {
  google.script.run.withSuccessHandler(function (p) { yo = p; pintarPerfil(); telCargar(); }).withFailureHandler(falla).perfil(sesion.token);
}
function pintarPerfil() {
  if (!yo) return;
  var corto = String(yo.nombre).split(" ")[0];
  $("quien").textContent = corto; $("nombreAlumno").textContent = corto;
  $("menuNombre").textContent = yo.nombre; $("menuRol").textContent = ROLES[yo.tipo] || "";
  pintarAvatar($("miniFoto"), yo.foto, yo.nombre); pintarAvatar($("fotoGrande"), yo.foto, yo.nombre);
  $("pf_nombre").textContent = yo.nombre; $("pf_usuario").textContent = yo.usuario;
  $("pf_correo").textContent = yo.correo; $("pf_programa").textContent = yo.programa; $("pf_tipo").textContent = ROLES[yo.tipo] || "";
  $("pf_programa_et").textContent = ET_PROGRAMA[yo.tipo] || "Área";
  $("pf_usuario_et").textContent = ET_USUARIO[yo.tipo] || "Usuario";
  $("quitarFoto").classList.toggle("oculto", !yo.foto);
}
function menuPerfil(e) { e.stopPropagation(); $("menu").classList.toggle("oculto"); }
document.addEventListener("click", function () { $("menu").classList.add("oculto"); });
document.addEventListener("keydown", function (e) { if (e.key == "Escape") $("menu").classList.add("oculto"); });
function abrirPerfil() {
  $("menu").classList.add("oculto");
  $("vistaAlumno").classList.add("oculto"); $("vistaAdmin").classList.add("oculto");
  $("vistaPerfil").classList.remove("oculto"); $("msgPerfil").textContent = ""; window.scrollTo(0, 0);
}
function cerrarPerfil() {
  $("vistaPerfil").classList.add("oculto");
  $(atiende() ? "vistaAdmin" : "vistaAlumno").classList.remove("oculto");
}
function recortarCuadrado(file) {
  return new Promise(function (ok) {
    var i = new Image();
    i.onload = function () {
      var l = Math.min(i.width, i.height), c = document.createElement("canvas"); c.width = c.height = 256;
      c.getContext("2d").drawImage(i, (i.width - l) / 2, (i.height - l) / 2, l, l, 0, 0, 256, 256);
      ok(c.toDataURL("image/jpeg", 0.82));
    };
    i.src = URL.createObjectURL(file);
  });
}
function guardarFotoPerfil(d, texto) {
  google.script.run.withSuccessHandler(function () {
    yo.foto = d; pintarPerfil(); var m = $("msgPerfil"); m.className = "msg"; m.textContent = texto;
  }).withFailureHandler(falla).guardarFoto(sesion.token, d);
}
function quitarFotoPerfil() { guardarFotoPerfil("", "✓ Foto eliminada."); }
$("fotoPerfil").onchange = async function (e) {
  var f = e.target.files[0]; if (!f) return;
  var m = $("msgPerfil"); m.className = "msg"; m.textContent = "Analizando imagen…";
  var d = await recortarCuadrado(f);
  var img = await new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.src = d; });
  var nivel = await analizarImagen(img);
  e.target.value = "";
  if (nivel == "bloqueada") { m.className = "msg mal"; m.textContent = "Esa imagen no está permitida como foto de perfil."; return; }
  guardarFotoPerfil(d, "✓ Foto actualizada.");
};

// ===== CREAR CUENTA (alumno o administrativo) =====
var PROGRAMAS = ["Ingeniería en Computación","Ingeniería Informática","Licenciatura en Informática","Ingeniería en Comunicaciones y Electrónica","Ingeniería Civil","Ingeniería Industrial","Ingeniería Mecánica Eléctrica","Ingeniería Mecatrónica","Ingeniería Química","Ingeniería Biomédica","Ingeniería Robótica","Ingeniería en Alimentos y Biotecnología","Ingeniería en Logística y Transporte","Licenciatura en Matemáticas","Licenciatura en Física","Licenciatura en Química","Químico Farmacobiólogo","Otro"];
var AREAS = ["Rectoría","Secretaría Académica","Secretaría Administrativa","Coordinación de Programas Docentes","Coordinación de Control Escolar","Coordinación de Personal","Coordinación de Finanzas","Coordinación de Extensión","Coordinación de Investigación y Posgrado","Coordinación de Tecnologías para el Aprendizaje","Biblioteca (CID)","División de Ciencias Básicas","División de Ingenierías","División de Electrónica y Computación","Coordinación de carrera","Departamento académico","Otra"];
var tipoReg = "alumno";

function llenarSelect(lista, primero) {
  var s = $("r_programa"); s.innerHTML = "";
  var o0 = document.createElement("option"); o0.value = ""; o0.textContent = primero; s.appendChild(o0);
  lista.forEach(function (p) { var o = document.createElement("option"); o.textContent = p; s.appendChild(o); });
}
function tipoRegistro(t) {
  tipoReg = t; var adm = t == "administrativo";
  $("tAlumno").classList.toggle("on", !adm); $("tAdmin").classList.toggle("on", adm);
  $("r_codigo_et").textContent = adm ? "Número de trabajador" : "Código de estudiante";
  $("r_codigo").placeholder = adm ? "Ej. 2950123" : "9 dígitos";
  $("r_correo").placeholder = adm ? "nombre.apellido@academicos.udg.mx" : "usuario@alumnos.udg.mx";
  $("r_programa_et").textContent = adm ? "Área o dependencia" : "Programa educativo";
  llenarSelect(adm ? AREAS : PROGRAMAS, adm ? "Selecciona tu área…" : "Selecciona tu programa…");
  $("msgRegistro").textContent = "";
}
tipoRegistro("alumno");

// Reglas de registro (el servidor debe repetirlas). Devuelve "" si todo está bien.
function validarRegistro(d, pass2, acepto) {
  var adm = d.tipo == "administrativo";
  if (adm) { if (!/^\d{6,9}$/.test(d.codigo || "")) return "El número de trabajador debe tener entre 6 y 9 dígitos."; }
  else if (!/^\d{9}$/.test(d.codigo || "")) return "El código de estudiante debe tener 9 dígitos.";
  var nom = String(d.nombre || "").trim();
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{6,80}$/.test(nom) || nom.split(/\s+/).length < 2) return "Escribe tu nombre completo (nombre y apellidos).";
  if (moderarTexto(nom)) return "El nombre contiene lenguaje no permitido.";
  var correo = String(d.correo || "");
  if (adm) {
    if (!/^[a-z0-9._-]+@([a-z0-9-]+\.)*udg\.mx$/.test(correo) || /@alumnos\.udg\.mx$/.test(correo)) return "Usa tu correo institucional de personal (por ejemplo @academicos.udg.mx o @cucei.udg.mx).";
  } else if (!/^[a-z0-9._-]+@alumnos\.udg\.mx$/.test(correo)) return "Usa tu correo institucional (termina en @alumnos.udg.mx).";
  if (!d.programa) return adm ? "Elige tu área o dependencia." : "Elige tu programa educativo.";
  if (d.telefono && String(d.telefono).length != 10) return "El teléfono debe tener 10 dígitos.";
  var p = String(d.pass || "");
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) return "La contraseña debe tener mínimo 8 caracteres, con letras y números.";
  if (p == d.codigo) return adm ? "La contraseña no puede ser tu número de trabajador." : "La contraseña no puede ser tu código de estudiante.";
  if (p != pass2) return "Las contraseñas no coinciden.";
  if (!acepto) return "Debes aceptar el aviso de privacidad.";
  return "";
}
function mostrarRegistro() {
  $("formLogin").classList.add("oculto"); $("formRegistro").classList.remove("oculto");
  $("msgRegistro").textContent = ""; $("r_codigo").focus();
}
function mostrarLogin() {
  $("formRegistro").classList.add("oculto"); $("formLogin").classList.remove("oculto"); $("mensajeError").textContent = "";
}
function verContrasenaR() {
  var ver = $("r_pass").type == "password";
  $("r_pass").type = $("r_pass2").type = ver ? "text" : "password";
  $("ojoR").textContent = ver ? "Ocultar contraseñas" : "Mostrar contraseñas";
}
function fuerzaPass() {
  var p = $("r_pass").value, n = 0;
  if (p.length >= 8) n++; if (p.length >= 12) n++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) n++; if (/\d/.test(p)) n++; if (/[^A-Za-z0-9]/.test(p)) n++;
  if (!p) n = 0;
  var b = $("barraFuerza"), t = $("txtFuerza");
  b.style.width = (n * 20) + "%"; b.style.background = n <= 2 ? "red" : (n == 3 ? "#efb810" : "#1a7f37");
  t.textContent = !p ? "Mínimo 8 caracteres, con letras y números." : (n <= 2 ? "Contraseña débil" : (n == 3 ? "Contraseña media" : "Contraseña fuerte"));
}
$("r_tel").addEventListener("input", function () {
  var t = this.value.replace(/\D/g, "").slice(0, 10);
  this.value = t.replace(/^(\d{2})(\d{0,4})(\d{0,4}).*/, function (_, a, b, c) { return a + (b ? " " + b : "") + (c ? " " + c : ""); });
});
$("r_pass2").addEventListener("keydown", function (e) { if (e.key == "Enter") crearCuenta(); });
function crearCuenta() {
  var m = $("msgRegistro"); m.style.color = "red"; m.textContent = "";
  var d = { tipo: tipoReg, codigo: $("r_codigo").value.trim(), nombre: $("r_nombre").value.trim().replace(/\s+/g, " "), correo: $("r_correo").value.trim().toLowerCase(),
            programa: $("r_programa").value, telefono: $("r_tel").value.replace(/\D/g, ""), pass: $("r_pass").value };
  var err = validarRegistro(d, $("r_pass2").value, $("r_acepto").checked);
  if (err) { m.textContent = err; return; }
  var b = $("btnRegistro"); b.disabled = true;
  google.script.run
    .withSuccessHandler(function () {
      b.disabled = false;
      ["r_codigo", "r_nombre", "r_correo", "r_tel", "r_pass", "r_pass2"].forEach(function (i) { $(i).value = ""; });
      $("r_acepto").checked = false; fuerzaPass(); tipoRegistro("alumno");
      mostrarLogin(); $("usuario").value = d.codigo; $("contrasena").value = ""; $("contrasena").focus();
      var e = $("mensajeError"); e.style.color = "#1a7f37"; e.textContent = "✓ Cuenta creada. Ya puedes iniciar sesión.";
    })
    .withFailureHandler(function (e) { b.disabled = false; m.textContent = (e && e.message) ? e.message.replace(/^Error: /, "") : "No se pudo crear la cuenta."; })
    .registrar(d);
}

  // ===== Carrusel: cambia de imagen cada 5 segundos =====
  var fotos = document.querySelectorAll(".foto");
  var actual = 0;

  setInterval(function () {
    fotos[actual].classList.remove("activa");
    actual = actual + 1;
    if (actual == fotos.length) { actual = 0; }
    fotos[actual].classList.add("activa");
  }, 5000);

// ===== TELÉFONO =====
function telModo(bloqueado) {
  $("pf_telefono").readOnly = bloqueado;
  $("btnTelefono").style.display = bloqueado ? "none" : "inline-block";
  $("btnEditarTel").style.display = bloqueado ? "inline-block" : "none";
}
function telEditar() { $("msgTelefono").textContent = ""; telModo(false); $("pf_telefono").focus(); }
function telGuardar() {
  var campo = $("pf_telefono"), msg = $("msgTelefono"), tel = campo.value.replace(/\D/g, "");
  if (tel.length != 10) { msg.style.color = "red"; msg.textContent = "Escribe un número de 10 dígitos."; return; }
  campo.value = tel.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3");
  telModo(true); msg.style.color = "green"; msg.textContent = "Teléfono guardado.";
  var usuario = $("pf_usuario").textContent.trim();
  try { localStorage.setItem("tel_" + usuario, tel); } catch (e) {}
  try { google.script.run.guardarTelefono(usuario, tel); } catch (e) {}
}
function telCargar() {
  var usuario = $("pf_usuario").textContent.trim(), tel = "";
  try { tel = localStorage.getItem("tel_" + usuario) || ""; } catch (e) {}
  $("pf_telefono").value = tel ? tel.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3") : "";
  $("msgTelefono").textContent = ""; telModo(tel != "");
}

// ===== OFICIO: SOLICITUD DE MANTENIMIENTO (administrativo → Servicios Generales) =====
var LOGO_OFICIO = "";   // opcional: pega aquí la URL del logo de CUCEI
var SERVICIOS = [
  ["Aire Acondicionado", "", "Aire acondicionado"],
  ["Carpintería", "(cajoneras, puertas, escritorio)", "Carpintería"],
  ["Cristales, estructuras aluminio y/o plafones", "", "Cristales / aluminio / plafones"],
  ["Eléctrico", "", "Eléctrico"],
  ["Herrería", "(protecciones, puertas, etc)", "Herrería"],
  ["Hidráulico", "(fugas, baños, etc)", "Plomería / agua"],
  ["Infraestructura", "(Filtración techos, daño en muros, etc)", "Techo / paredes"],
  ["Jardinería", "", "Jardinería"],
  ["Limpieza", "", "Limpieza"],
  ["Pintura", "", "Pintura"],
  ["Cerrajería", "", "Cerrajería"],
  ["Otro", "", "Otro"]
];
function fechaOf(ms) {
  if (!ms) return "____ / ____ / ______";
  var d = new Date(Number(ms));
  return ("0" + d.getDate()).slice(-2) + " / " + ("0" + (d.getMonth() + 1)).slice(-2) + " / " + d.getFullYear();
}
function telOf(t) { return String(t || "").replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3"); }
function verOficioId(id) { var r = reportes.filter(function (x) { return x.id == id; })[0]; if (r) verOficio(r); }
function verOficio(r) {
  var s = r.solicitante || {};
  var existe = SERVICIOS.some(function (x) { return x[2] == r.categoria; });
  var radio = function (on) { return '<i class="' + (on ? "on" : "") + '"></i>'; };
  var h = '<div class="of-cab">' + (LOGO_OFICIO ? '<img src="' + esc(LOGO_OFICIO) + '" alt="CUCEI">' : '<b class="of-logo">CUCEI</b>') + "COORDINACIÓN DE SERVICIOS GENERALES / UNIDAD DE MANTENIMIENTO</div>";
  h += '<h2 class="of-tit">SOLICITUD MANTENIMIENTO PREVENTIVO/CORRECTIVO</h2>';
  h += '<div class="of-tipo"><span>' + radio(r.tipoMant == "Preventivo") + "Preventivo</span><span>" + radio(r.tipoMant != "Preventivo") + "Correctivo</span></div>";
  h += '<div class="of-fila"><span><b>Fecha de Elaboración:</b> ' + fechaOf(r.fecha) + '</span><span><b>Folio:</b> <u>' + esc(r.folio || "") + "</u></span></div>";
  h += '<div class="of-fila"><span><b>Recibe:</b> <u class="linea">' + esc(r.recibe || "") + '</u></span><span><b>Fecha de Recepción:</b> ' + fechaOf(r.fechaRecepcion) + "</span></div>";
  h += '<span class="of-et">Nombre, Firma y Teléfono de contacto del Solicitante:</span><div class="of-caja of-firma"><span>' + esc(s.nombre || "") + (s.telefono ? " · Tel. " + esc(telOf(s.telefono)) : "") + '</span><span class="firma">Firma</span></div>';
  h += '<span class="of-et">Área Solicitante:</span><div class="of-caja">' + esc(s.area || "") + "</div>";
  h += '<span class="of-et">Ubicación del Servicio:</span><div class="of-caja">' + esc(r.edificio) + " · " + esc(r.lugar) + "</div>";
  h += '<span class="of-et">Descripción del servicio solicitado o falla a reparar:</span><div class="of-ops">';
  h += SERVICIOS.map(function (x) {
    var on = existe ? x[2] == r.categoria : x[2] == "Otro";
    return '<span class="of-op">' + radio(on) + "<span>" + x[0] + (x[1] ? " <small>" + x[1] + "</small>" : "") + "</span></span>";
  }).join("");
  h += '</div><div class="of-caja of-desc">' + (existe ? "" : "<b>" + esc(r.categoria) + ":</b> ") + esc(r.descripcion);
  if (r.fotos && r.fotos.length) h += '<div class="of-fotos">' + r.fotos.map(function (u) { return '<img src="' + esc(u) + '" alt="Evidencia">'; }).join("") + "</div>";
  h += '</div><div class="of-pie">Generado por SIGIR · ' + fechaOf(Date.now()) + "</div>";
  $("hoja").innerHTML = h;
  $("oficio").classList.remove("oculto");
  $("oficio").scrollTop = 0;
}
function cerrarOficio() { $("oficio").classList.add("oculto"); }