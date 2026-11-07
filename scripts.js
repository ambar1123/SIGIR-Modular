(function () {
  if (typeof google !== "undefined" && google.script && google.script.run) return;
  var USUARIOS = [
    { usuario: "220621311",    contrasena: "sigir2026", tipo: "alumno", nombre: "Saul Alejandro Angel Garcia", correo: "saul.angel2131@alumnos.udg.mx", programa: "Ingeniería en Computación" },
    { usuario: "coordinacion", contrasena: "sigir2026", tipo: "academico", nombre: "Coordinación de Infraestructura", correo: "coordinacion@cucei.udg.mx", programa: "Coordinación de Infraestructura" }
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
  function ses(t) { if (!sesiones[t]) throw new Error("Tu sesión expiró. Vuelve a ingresar."); return sesiones[t]; }
  var api = {
    login: function (u, c) {
      var x = USUARIOS.filter(function (a) { return a.usuario == u && a.contrasena == c; })[0];
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
      if (s.tipo != "alumno") throw new Error("Solo los alumnos pueden crear reportes.");
      var mm = moderarTexto(d.lugar + " " + d.descripcion); if (mm) throw new Error(mm);
      var l = leer();
      l.push({ id: "r" + Date.now(), fecha: Date.now(), codigo: s.usuario, edificio: d.edificio, lugar: d.lugar,
               categoria: d.categoria, descripcion: d.descripcion, fotos: d.fotos.slice(0, 4), estado: "pendiente", nota: "", revision: !!d.revision, vistos: [], comentarios: [] });
      guardar(l); return true;
    },
    perfil: function (t) {   // datos institucionales (solo lectura) + foto
      var s = ses(t), u = USUARIOS.filter(function (a) { return a.usuario == s.usuario; })[0], f = "";
      try { f = (JSON.parse(localStorage.getItem("sigir_fotos") || "{}"))[s.usuario] || ""; } catch (e) {}
      return { usuario: u.usuario, tipo: u.tipo, nombre: u.nombre, correo: u.correo, programa: u.programa, foto: f };
    },
    guardarFoto: function (t, d) {   // lo único editable del perfil
      var s = ses(t); if (d && d.indexOf("data:image/") != 0) throw new Error("Imagen no válida.");
      var m = {}; try { m = JSON.parse(localStorage.getItem("sigir_fotos") || "{}"); } catch (e) {}
      if (d) m[s.usuario] = d; else delete m[s.usuario];
      try { localStorage.setItem("sigir_fotos", JSON.stringify(m)); } catch (e) { throw new Error("No se pudo guardar la foto."); }
      return true;
    },
    comentar: function (t, id, txt) {
      var s = ses(t), mm = moderarTexto(txt); if (mm) throw new Error(mm);
      var l = leer(), r = l.filter(function (x) { return x.id == id; })[0]; if (!r) throw new Error("Reporte no encontrado.");
      (r.comentarios = r.comentarios || []).push({ codigo: s.usuario, texto: String(txt).trim(), fecha: Date.now() });
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
      l.forEach(function (r) { if (r.id == id) { r.estado = estado; r.nota = nota || ""; r.revisor = s.usuario; } });
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
          try { var r = api[n].apply(null, a); if (ok) ok(r); } catch (e) { if (fail) fail(e); }
        }, 120);
      };
    });
    return o;
  }
  window.google = { script: { run: crear() } };
})();

var $ = function (id) { return document.getElementById(id); };
  var EDIFICIOS = ["Edificio A","Edificio B","Edificio C","Edificio D","Edificio E","Edificio F","Edificio G","Edificio H","Edificio I","Edificio J","Edificio K","Edificio L","Edificio M","Edificio N","Edificio O","Edificio P","Edificio Q","Edificio R","Edificio S","Edificio T","Edificio U","Edificio V","Biblioteca","Cafetería","Estacionamiento","Otro"];
  var ETIQUETA = { pendiente: "Pendiente", visto: "Visto", resuelto: "Resuelto" };
  var sesion = null, reportes = [], evidencias = [], hayRevision = false;

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
    if (sesion.tipo == "alumno") {
      $("nombreAlumno").textContent = sesion.usuario;
      $("vistaAlumno").classList.remove("oculto"); irA("feed");
    } else {
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
    h += '<div class="meta">' + esc(r.categoria) + " · " + f + (admin ? " · Código " + esc(r.codigo) : "") + "</div>";
    h += "<p>" + esc(r.descripcion) + "</p>";
    h += '<div class="evid' + (r.revision && !admin ? " revision" : "") + '">' + r.fotos.map(function (u) { return '<img src="' + esc(u) + '" onclick="window.open(this.src)" alt="Evidencia">'; }).join("") + "</div>";
    if (admin && r.revision) h += '<div class="aviso"><span>Foto marcada para revisión por el filtro automático.</span><button class="claro" onclick="aprobar(\'' + r.id + '\')">Aprobar foto</button></div>';
    if (!admin && r.nota) h += '<p class="meta"><b>Nota de coordinación:</b> ' + esc(r.nota) + "</p>";
    if (admin) {
      h += '<input type="text" id="n' + r.id + '" placeholder="Nota (opcional)" value="' + esc(r.nota) + '" style="margin-top:10px">';
      h += '<div class="acciones"><button class="claro" onclick="cambiar(\'' + r.id + "','visto')\">Marcar visto</button>";
      h += "<button onclick=\"cambiar('" + r.id + "','resuelto')\">Marcar resuelto</button>";
      h += '<button class="claro" onclick="cambiar(\'' + r.id + "','pendiente')\">Reabrir</button></div>";
    }
    return h + "</div>";
  }

  function pintar() {
    if (!sesion) return;
    if (sesion.tipo == "alumno") {
      var mios = reportes.filter(function (r) { return r.codigo == sesion.usuario; });
      contar(mios, "a");
      $("listaAlumno").innerHTML = mios.length ? mios.map(function (r) { return tarjeta(r, false); }).join("") : '<p class="meta">Aún no has enviado reportes.</p>';
      $("feed").innerHTML = reportes.length ? reportes.map(post).join("") : '<p class="meta">Todavía no hay reportes. ¡Sé el primero en reportar!</p>';
    } else {
      contar(reportes, "m");
      var fe = $("fEstado").value, fd = $("fEdificio").value;
      var l = reportes.filter(function (r) { return (!fe || r.estado == fe) && (!fd || r.edificio == fd); });
      $("listaAdmin").innerHTML = l.length ? l.map(function (r) { return tarjeta(r, true); }).join("") : '<p class="meta">No hay reportes con esos filtros.</p>';
    }
  }

  // ===== ADMIN: cambiar estado =====
  function cambiar(id, estado) {
    var nota = $("n" + id).value.trim();
    google.script.run
      .withSuccessHandler(function () { cargar(); })
      .withFailureHandler(falla)
      .actualizar(sesion.token, id, estado, nota);
  }

  // ===== ALUMNO: nuevo reporte con fotos =====
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
    else if (hayRevision) av.textContent = "Una foto será revisada por coordinación antes de mostrarse a otros alumnos.";
    else av.textContent = "";
  };

  function enviarReporte() {
    var m = $("msgReporte"); m.className = "msg mal";
    var d = { edificio: $("edificio").value, lugar: $("lugar").value.trim(), categoria: $("categoria").value, descripcion: $("descripcion").value.trim(), fotos: evidencias, revision: hayRevision };
    if (!d.lugar || !d.descripcion) { m.textContent = "Escribe el lugar y la descripción."; return; }
    var mm = moderarTexto(d.lugar + " " + d.descripcion); if (mm) { m.textContent = "Tu reporte no se envió. " + mm; return; }
    if (!evidencias.length) { m.textContent = "Agrega al menos una foto de evidencia."; return; }
    var b = $("btnEnviar"); b.disabled = true; m.className = "msg"; m.textContent = "Enviando…";
    google.script.run
      .withSuccessHandler(function () {
        b.disabled = false; m.textContent = "✓ Reporte enviado.";
        $("lugar").value = ""; $("descripcion").value = ""; $("archivos").value = ""; evidencias = []; hayRevision = false; $("msgFotos").textContent = ""; irA("mios"); $("previa").innerHTML = "";
        cargar();
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
function autor(c) { return "Alumno ···" + String(c).slice(-3); }
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
  h += '<div class="post-quien"><b>' + autor(r.codigo) + (r.codigo == yo ? ' <em class="tu">tú</em>' : "") + "</b><small>" + esc(r.edificio) + " · " + esc(r.lugar) + " · " + hace(r.fecha) + "</small></div>";
  h += '<span class="chip ' + esc(r.estado) + '">' + ETIQUETA[r.estado] + "</span></div>";
  h += '<div class="media' + (r.revision ? " revision" : "") + '">' + r.fotos.map(function (u) { return '<img src="' + esc(u) + '" alt="Evidencia" onclick="window.open(this.src)">'; }).join("");
  if (r.revision) h += '<div class="vela">Foto en revisión por coordinación</div>';
  h += '</div><div class="post-acc"><button class="reac' + (vio ? " on" : "") + '" onclick="alternarVisto(\'' + r.id + "')\">" + ICO_OJO + " Yo también lo vi · " + vistos.length + "</button>";
  h += '<span class="cuenta">' + ICO_COM + " " + cs.length + "</span></div>";
  h += '<div class="post-cuerpo"><span class="cat">' + esc(r.categoria) + "</span> " + esc(r.descripcion) + "</div>";
  if (r.nota) h += '<div class="post-nota"><b>Coordinación:</b> ' + esc(r.nota) + "</div>";
  h += '<div class="coms">' + cs.map(function (c) { return '<div class="com"><b>' + autor(c.codigo) + "</b> " + esc(c.texto) + " <small>" + hace(c.fecha) + "</small></div>"; }).join("") + "</div>";
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

// ===== PERFIL (alumno y administrador) =====
var yo = null;
var ROLES = { alumno: "Alumno", academico: "Coordinación · Administrador" };
function pintarAvatar(el, foto, nombre) {
  el.style.backgroundImage = foto ? 'url("' + foto + '")' : "none";
  el.textContent = foto ? "" : String(nombre || "?").trim().charAt(0).toUpperCase();
}
function cargarPerfil() {
  google.script.run.withSuccessHandler(function (p) { yo = p; pintarPerfil(); }).withFailureHandler(falla).perfil(sesion.token);
}
function pintarPerfil() {
  if (!yo) return;
  var corto = String(yo.nombre).split(" ")[0];
  $("quien").textContent = corto; $("nombreAlumno").textContent = corto;
  $("menuNombre").textContent = yo.nombre; $("menuRol").textContent = ROLES[yo.tipo] || "";
  pintarAvatar($("miniFoto"), yo.foto, yo.nombre); pintarAvatar($("fotoGrande"), yo.foto, yo.nombre);
  $("pf_nombre").textContent = yo.nombre; $("pf_usuario").textContent = yo.usuario;
  $("pf_correo").textContent = yo.correo; $("pf_programa").textContent = yo.programa; $("pf_tipo").textContent = ROLES[yo.tipo] || "";
  $("pf_programa_et").textContent = yo.tipo == "alumno" ? "Programa educativo" : "Área";
  $("pf_usuario_et").textContent = yo.tipo == "alumno" ? "Código de estudiante" : "Usuario";
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
  $(sesion.tipo == "alumno" ? "vistaAlumno" : "vistaAdmin").classList.remove("oculto");
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
  document.getElementById("pf_telefono").readOnly = bloqueado;
  document.getElementById("btnTelefono").style.display  = bloqueado ? "none" : "inline-block";
  document.getElementById("btnEditarTel").style.display = bloqueado ? "inline-block" : "none";
}

function telEditar() {
  document.getElementById("msgTelefono").textContent = "";
  telModo(false);
  document.getElementById("pf_telefono").focus();
}

function telGuardar() {
  var campo = document.getElementById("pf_telefono");
  var msg = document.getElementById("msgTelefono");
  var tel = campo.value.replace(/\D/g, "");

  if (tel.length != 10) {
    msg.style.color = "red";
    msg.textContent = "Escribe un número de 10 dígitos.";
    return;
  }

  campo.value = tel.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3");
  telModo(true);
  msg.style.color = "green";
  msg.textContent = "Teléfono guardado.";

  var usuario = document.getElementById("pf_usuario").textContent.trim();
  try { localStorage.setItem("tel_" + usuario, tel); } catch (e) {}
  try { google.script.run.guardarTelefono(usuario, tel); } catch (e) {}
}

// Llama esto al abrir el perfil (después de llenar pf_usuario)
function telCargar() {
  var usuario = document.getElementById("pf_usuario").textContent.trim();
  var tel = "";
  try { tel = localStorage.getItem("tel_" + usuario) || ""; } catch (e) {}
  document.getElementById("pf_telefono").value = tel ? tel.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3") : "";
  document.getElementById("msgTelefono").textContent = "";
  telModo(tel != "");   // si ya tiene número, entra bloqueado con Editar
}