/* SaveAnimals web: catálogo público + panel de protectoras. Misma base de datos que la app (Supabase, UE). */
(function () {
  'use strict';
  var SB = 'https://fzvmqelihrfflrnwjgal.supabase.co';
  var KEY = 'sb_publishable_g0bCY8xNsRYv8Yn58f4TfA_1f742706';
  var PLAY = 'https://play.google.com/apps/testing/com.saveanimals.app';
  var app = document.getElementById('app'), navEl = document.getElementById('nav');
  var session = null;

  // ---------------------------------------------------------------- utilidades
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function toast(t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3200); }
  function safeImg(u) {
    if (typeof u !== 'string') return '';
    if (u.indexOf(SB + '/storage/v1/object/public/') === 0) return u;
    if (/^asset:[a-z_]+$/.test(u)) return 'i-' + u.slice(6) + '.jpg';   // fotos de ejemplo incluidas en la web
    return '';
  }
  var B = window.SA_PAGE ? 'index.html' : '';   // en animal.html los enlaces vuelven a index.html
  function setMeta(title, desc, img) {
    document.title = title;
    var d = document.querySelector('meta[name=description]'); if (d) d.content = desc;
    [['og:title', title], ['og:description', desc], ['og:image', img || '']].forEach(function (x) { var m = document.querySelector('meta[property="' + x[0] + '"]'); if (m && x[1]) m.content = x[1]; });
  }
  function ageText(m) { m = m || 0; if (m < 12) return m + (m === 1 ? ' mes' : ' meses'); var y = Math.floor(m / 12), r = m % 12; return y + (y === 1 ? ' año' : ' años') + (r ? ' y ' + r + ' m' : ''); }
  var SIZES = ['Pequeño', 'Mediano', 'Grande'], ENERGY = ['', 'Tranquilo', 'Moderado', 'Muy activo'];
  var SEEK = {adopt: 'Adopción', foster_temp: 'Acogida temporal', foster_long: 'Acogida indefinida'};

  function loadSession() { try { session = JSON.parse(localStorage.getItem('sa_session') || 'null'); } catch (e) { session = null; } }
  function saveSession(s) {
    if (s && s.access_token) { s.expires_at = s.expires_at || (Math.floor(Date.now() / 1000) + (s.expires_in || 3600)); session = s; try { localStorage.setItem('sa_session', JSON.stringify(s)); } catch (e) {} }
    else { session = null; try { localStorage.removeItem('sa_session'); } catch (e) {} }
  }
  function sb(method, path, body, opts) {
    opts = opts || {};
    return ensureFresh().then(function () {
      var h = {apikey: KEY, Authorization: 'Bearer ' + ((session && session.access_token) || KEY)};
      if (body !== undefined && !opts.raw) h['Content-Type'] = 'application/json';
      if (opts.prefer) h.Prefer = opts.prefer;
      if (opts.type) h['Content-Type'] = opts.type;
      return fetch(SB + path, {method: method, headers: h, body: opts.raw ? body : (body === undefined ? undefined : JSON.stringify(body))});
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) { var m = (j && (j.message || j.msg || j.error_description || j.error)) || ('Error ' + r.status); var err = new Error(m); err.status = r.status; throw err; }
        return j;
      });
    });
  }
  function ensureFresh() {
    if (!session || !session.refresh_token || session.expires_at - 60 > Date.now() / 1000) return Promise.resolve();
    return fetch(SB + '/auth/v1/token?grant_type=refresh_token', {method: 'POST', headers: {apikey: KEY, 'Content-Type': 'application/json'}, body: JSON.stringify({refresh_token: session.refresh_token})})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { saveSession(j); });
  }

  // ---------------------------------------------------------------- navegación
  var me = null;
  function ensureMe() {
    if (!session) { me = null; return Promise.resolve(); }
    if (me && me.id === session.user.id) return Promise.resolve();
    return sb('GET', '/rest/v1/profiles?select=*&id=eq.' + encodeURIComponent(session.user.id)).then(function (r) { me = (r && r[0]) || {role: 'user'}; me.id = session.user.id; }).catch(function () { me = {role: 'user', id: session.user.id}; });
  }
  function isAdmin() { return !!(me && me.role === 'admin'); }
  function renderNav() {
    var h = location.hash || '#/';
    function a(href, txt, cls) { return '<a href="' + B + href + '" class="' + (cls || '') + (!window.SA_PAGE && (h === href || (href !== '#/' && h.indexOf(href) === 0)) ? ' on' : '') + '">' + txt + '</a>'; }
    var br = $('.brand'); if (br) br.href = B + '#/';
    navEl.innerHTML = a('#/', 'Animales') + a('#/protectoras', 'Protectoras') +
      (session ? (isAdmin() ? a('#/admin', 'Administración') : '') + a('#/panel', 'Mi panel', 'cta') + '<a href="' + B + '#/salir">Salir</a>' : a('#/entrar', 'Soy protectora', 'cta'));
  }
  function route() { ensureMe().then(route2); }
  function route2() {
    renderNav();
    window.scrollTo(0, 0);
    var h = (location.hash || '#/').slice(1), p = h.split('/').filter(Boolean);
    if (p[0] === 'admin') { if (!isAdmin()) { location.hash = '#/'; return; } return viewAdmin(p[1] || 'protectoras'); }
    if (p[0] === 'panel' && p[1] === 'perfil' && session) return viewProfile();
    if (window.SA_PAGE === 'animal') { var qa = (new URLSearchParams(location.search).get('a') || '').replace(/[^0-9a-fA-F-]/g, '').slice(0, 36); return viewPet(qa); }
    if (p[0] === 'animal' && p[1]) { location.replace('animal.html?a=' + encodeURIComponent(p[1])); return; }
    if (p[0] === 'creditos') return viewCredits();
    if (p[0] === 'protectoras') return viewShelters();
    if (p[0] === 'protectora' && p[1]) return viewShelter(p[1]);
    if (p[0] === 'entrar') return viewLogin();
    if (p[0] === 'salir') { saveSession(null); location.hash = '#/'; return; }
    if (p[0] === 'panel') {
      if (!session) { location.hash = '#/entrar'; return; }
      if (p[1] === 'nuevo') return viewForm(null);
      if (p[1] === 'editar' && p[2]) return viewForm(p[2]);
      return viewPanel();
    }
    return viewHome();
  }
  window.addEventListener('hashchange', route);

  // ---------------------------------------------------------------- catálogo
  var filt = {species: '', size: '', q: ''};
  function petCard(p) {
    var img = safeImg((p.photos || [])[0]);
    var sh = p.shelters || {};
    return '<a class="pet" href="animal.html?a=' + esc(p.id) + '"><div class="ph" style="' + (img ? 'background-image:url(' + esc(img) + ')' : '') + '">' +
      (img ? '' : '<div class="emo">' + (p.species === 1 ? '🐱' : '🐶') + '</div>') +
      (p.urgent ? '<span class="tag">Urgente</span>' : p.status === 'reserved' ? '<span class="tag r">Reservado</span>' : '') + '</div>' +
      '<div class="b"><div class="n">' + esc(p.name) + '</div><div class="m">' + (p.species === 1 ? 'Gato' : 'Perro') + ' · ' + esc(p.breed) + ' · ' + ageText(p.age_months) + '</div>' +
      '<div class="m">📍 ' + esc(sh.city || '') + (sh.name ? ' · ' + esc(sh.name) : '') + '</div></div></a>';
  }
  function viewHome() {
    setMeta('SaveAnimals · Adopta y acoge perros y gatos de protectoras verificadas', 'Perros y gatos de protectoras verificadas de toda España. Gratis, sin comisiones y sin anuncios. Adopta o acoge con SaveAnimals.');
    app.innerHTML = '<section class="hero2"><div class="copy"><span class="eyebrow">🐾 Gratis · Sin ánimo de lucro</span>' +
      '<h1>Cada animal merece <em>un hogar</em></h1>' +
      '<p>Perros y gatos de protectoras verificadas de toda España. Sin comisiones, sin anuncios y con todo el cariño del mundo.</p>' +
      '<div class="cta"><button class="btn pr" data-go="catalogo">Ver animales</button><a class="btn" href="' + PLAY + '">Descargar la app</a></div>' +
      '<div class="trust"><div><b id="s1">–</b><span>animales buscan hogar</span></div><div><b id="s2">–</b><span>protectoras verificadas</span></div><div><b id="s3">–</b><span>ya encontraron familia</span></div></div></div>' +
      '<div class="heroimg"><img src="i-hero.jpg" alt="Un perro y un gato descansando juntos en el sofá"><div class="float f1">✅ Protectoras verificadas</div><div class="float f2">💛 0 € de comisión</div></div></section>' +
      '<section class="how"><h2 class="sec">Así de fácil</h2><div class="steps">' +
      '<div class="step"><i>1</i><b>Encuentra</b><p>Filtra por especie, tamaño o ciudad y conoce su historia.</p></div>' +
      '<div class="step"><i>2</i><b>Solicita</b><p>Rellena el cuestionario de la protectora desde la app.</p></div>' +
      '<div class="step"><i>3</i><b>Habla con ella</b><p>Chat directo y seguro con la protectora, sin intermediarios.</p></div>' +
      '<div class="step"><i>4</i><b>Dale un hogar</b><p>Adopta o acoge. Tu nuevo mejor amigo te espera.</p></div></div></section>' +
      '<section id="catalogo"><h2 class="sec">Animales que buscan hogar</h2>' +
      '<div class="chips" id="fs">' + chip('species', '', 'Todos') + chip('species', '0', '🐶 Perros') + chip('species', '1', '🐱 Gatos') + '</div>' +
      '<div class="chips" id="fz">' + chip('size', '', 'Cualquier tamaño') + chip('size', '0', 'Pequeño') + chip('size', '1', 'Mediano') + chip('size', '2', 'Grande') + '</div>' +
      '<div class="field" style="max-width:420px;margin:0 auto"><input type="text" id="q" placeholder="Buscar por nombre, raza o ciudad" value="' + esc(filt.q) + '"></div>' +
      '<div class="grid" id="grid"><div class="spin">Cargando animales…</div></div></section>' +
      '<section class="band"><div><h2>¿Eres una protectora?</h2><p>Publica a tus animales gratis, con fotos, desde la web o la app. Lo que subas aparece al instante en los dos sitios. Chat y solicitudes de adopción, en la app.</p></div><div class="cta"><a class="btn pr" href="#/entrar">Entrar a mi panel</a><a class="btn" href="#/protectoras">Ver protectoras</a></div></section>';
    $$('[data-go]', app).forEach(function (b) { b.onclick = function () { document.getElementById(b.dataset.go).scrollIntoView({behavior: 'smooth'}); }; });
    $$('.chip', app).forEach(function (c) { c.onclick = function () { filt[c.dataset.k] = c.dataset.v; var y = window.scrollY; viewHome(); window.scrollTo(0, y); }; });
    $('#q').oninput = function (e) { filt.q = e.target.value; draw(); };
    Promise.all([count('pets', 'status=neq.adopted'), count('shelters', 'status=eq.approved'), count('pets', 'status=eq.adopted')]).then(function (c) { ['s1', 's2', 's3'].forEach(function (id, i) { var el = document.getElementById(id); if (el) el.textContent = c[i]; }); }).catch(function () {});
    var all = null;
    function draw() {
      var q = filt.q.trim().toLowerCase();
      var l = all.filter(function (p) {
        return (filt.species === '' || String(p.species) === filt.species) && (filt.size === '' || String(p.size) === filt.size) &&
          (!q || (p.name + ' ' + p.breed + ' ' + ((p.shelters || {}).city || '')).toLowerCase().indexOf(q) >= 0);
      });
      $('#grid').innerHTML = l.length ? l.map(petCard).join('') : '<div class="spin">No hay animales con esos filtros.</div>';
    }
    sb('GET', '/rest/v1/pets?select=*,shelters(name,city)&status=neq.adopted&order=urgent.desc,created_at.desc&limit=200').then(function (r) { all = r || []; draw(); })
      .catch(function (e) { $('#grid').innerHTML = '<div class="spin">No se pudo cargar: ' + esc(e.message) + '</div>'; });
  }
  function chip(k, v, t) { return '<button class="chip' + (filt[k] === v ? ' on' : '') + '" data-k="' + k + '" data-v="' + v + '">' + t + '</button>'; }

  function viewPet(id) {
    app.innerHTML = '<div class="spin">Cargando…</div>';
    sb('GET', '/rest/v1/pets?select=*,shelters(*)&id=eq.' + encodeURIComponent(id)).then(function (r) {
      var p = r && r[0]; if (!p) { app.innerHTML = '<div class="spin">No encontramos este animal. <a href="' + (B || 'index.html') + '#/">Ver todos</a></div>'; return; }
      var sh = p.shelters || {}, imgs = (p.photos || []).map(safeImg).filter(Boolean);
      var kind = p.species === 1 ? 'Gato' : 'Perro';
      setMeta(p.name + ' · ' + kind + ' en adopción en ' + (sh.city || 'España') + ' | SaveAnimals', (p.story || (p.name + ' busca hogar.')).slice(0, 155), imgs[0] ? new URL(imgs[0], location.href).href : '');
      var intent = 'intent://animal/' + encodeURIComponent(p.id) + '#Intent;scheme=saveanimals;package=com.saveanimals.app;S.browser_fallback_url=' + encodeURIComponent(PLAY) + ';end';
      var android = /android/i.test(navigator.userAgent);
      var pills = [];
      if (p.vaccinated) pills.push('<span class="pill g">Vacunado</span>'); if (p.sterilized) pills.push('<span class="pill g">Esterilizado</span>');
      if (p.microchip) pills.push('<span class="pill g">Con chip</span>'); if (p.dewormed) pills.push('<span class="pill g">Desparasitado</span>');
      if (p.kids) pills.push('<span class="pill b">Bien con niños</span>'); if (p.dogs) pills.push('<span class="pill b">Bien con perros</span>'); if (p.cats) pills.push('<span class="pill b">Bien con gatos</span>');
      (p.traits || []).forEach(function (t) { pills.push('<span class="pill o">' + esc(t) + '</span>'); });
      var seek = (p.seeking || ['adopt']).map(function (s) { return '<span class="pill p">' + esc(SEEK[s] || s) + '</span>'; }).join('');
      function fact(k, v) { return '<div class="fact"><span>' + k + '</span><b>' + esc(v) + '</b></div>'; }
      var main = imgs.length ? '<img id="mainph" class="mainph" src="' + esc(imgs[0]) + '" alt="' + esc(p.name) + ', ' + kind.toLowerCase() + ' en adopción">' : '<div class="mainph emoph">' + (p.species === 1 ? '🐱' : '🐶') + '</div>';
      var thumbs = imgs.length > 1 ? '<div class="thumbs">' + imgs.map(function (u, i) { return '<img src="' + esc(u) + '" data-u="' + esc(u) + '" class="' + (i ? '' : 'on') + '" alt="Foto ' + (i + 1) + '">'; }).join('') + '</div>' : '';
      app.innerHTML = '<p><a href="' + B + '#/" class="muted">← Todos los animales</a></p><div class="two"><div class="galw">' + main + thumbs + '</div><div class="info"><h1>' + esc(p.name) + '</h1>' +
        '<p class="muted lead">' + kind + ' · ' + esc(p.breed) + ' · ' + (p.female ? 'Hembra' : 'Macho') + '</p>' +
        '<div>' + seek + (p.urgent ? '<span class="pill p">Urgente</span>' : '') + (p.status === 'reserved' ? '<span class="pill y">Reservado</span>' : '') + '</div>' +
        '<div class="facts">' + fact('Edad', ageText(p.age_months)) + fact('Tamaño', SIZES[p.size] || '') + fact('Peso', p.weight_kg ? p.weight_kg + ' kg' : '—') + fact('Energía', ENERGY[p.energy] || '') + (p.fee ? fact('Aportación', p.fee + ' €') : '') + '</div>' +
        '<h3 style="margin-top:20px">Su historia</h3><p>' + esc(p.story).replace(/\n/g, '<br>') + '</p><div>' + pills.join('') + '</div>' +
        '<a class="card shl" href="' + B + '#/protectora/' + esc(p.shelter_id) + '"><span class="ic">🏠</span><div><b>' + esc(sh.name || '') + '</b><div class="muted">📍 ' + esc(sh.city || '') + ' · Ver perfil de la protectora</div></div></a>' +
        '<div class="cta2"><a class="btn pr" href="' + (android ? intent : PLAY) + '">Solicitar en la app</a><button class="btn" id="share">Compartir</button></div>' +
        '<p class="muted sm">La app está en fase de pruebas en Google Play: si el enlace no abre, aún no estás en la lista de probadores (pídenos acceso en saveanimals.app@gmail.com). Adoptar o acoger, el cuestionario y el chat con la protectora se hacen en la app, de forma segura.</p>' +
        '</div></div>';
      $$('.thumbs img', app).forEach(function (t) { t.onclick = function () { $('#mainph').src = t.dataset.u; $$('.thumbs img', app).forEach(function (x) { x.classList.remove('on'); }); t.classList.add('on'); }; });
      $('#share').onclick = function () { var u = location.href; if (navigator.share) navigator.share({title: p.name + ' busca hogar', url: u}).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { toast('Enlace copiado'); }); };
    }).catch(function (e) { app.innerHTML = '<div class="spin">Error: ' + esc(e.message) + '</div>'; });
  }

  function viewCredits() {
    app.innerHTML = '<section class="hero" style="padding-top:8px"><h1>Créditos de las fotos</h1><p>Las fotos de ejemplo proceden de Wikimedia Commons y se usan bajo sus licencias.</p></section><div class="card" style="margin-bottom:40px"><table class="list" id="cr"><tr><td class="spin">Cargando…</td></tr></table></div>';
    fetch('credits.json').then(function (r) { return r.json(); }).then(function (l) {
      $('#cr').innerHTML = l.map(function (c) { return '<tr><td><b>' + esc(c.title) + '</b><div class="muted">' + esc(c.artist) + ' · ' + esc(c.license) + '</div></td><td style="text-align:right"><a href="' + esc(/^https:\/\/commons\.wikimedia\.org\//.test(c.page) ? c.page : '#') + '" target="_blank" rel="noopener">Origen</a></td></tr>'; }).join('');
    }).catch(function () { $('#cr').innerHTML = '<tr><td class="muted">No se pudieron cargar.</td></tr>'; });
  }

  function viewShelters() {
    app.innerHTML = '<section class="hero"><h1>Protectoras verificadas</h1><p>Revisamos cada protectora antes de que pueda publicar.</p></section><div class="grid" id="g"><div class="spin">Cargando…</div></div>';
    sb('GET', '/rest/v1/shelters?select=id,name,city,about,logo_url,website&status=eq.approved&order=name').then(function (r) {
      $('#g').innerHTML = (r || []).map(function (s) {
        return '<a class="card" style="text-decoration:none;display:block" href="#/protectora/' + esc(s.id) + '"><h3>' + esc(s.name) + '</h3><div class="muted">📍 ' + esc(s.city) + '</div><p class="muted">' + esc((s.about || '').slice(0, 160)) + '</p></a>';
      }).join('') || '<div class="spin">Aún no hay protectoras.</div>';
    }).catch(function (e) { $('#g').innerHTML = '<div class="spin">' + esc(e.message) + '</div>'; });
  }

  function viewShelter(id) {
    app.innerHTML = '<div class="spin">Cargando…</div>';
    Promise.all([sb('GET', '/rest/v1/shelters?select=*&id=eq.' + encodeURIComponent(id) + '&status=eq.approved'), sb('GET', '/rest/v1/pets?select=*,shelters(name,city)&status=neq.adopted&shelter_id=eq.' + encodeURIComponent(id) + '&order=created_at.desc')]).then(function (r) {
      var s = r[0] && r[0][0]; if (!s) { app.innerHTML = '<div class="spin">No encontramos esta protectora.</div>'; return; }
      var logo = safeImg(s.logo_url), site = /^https?:\/\//i.test(s.website || '') ? '<a href="' + esc(s.website) + '" rel="noopener nofollow" target="_blank">' + esc(s.website) + '</a>' : '';
      var pay = [s.bizum ? 'Bizum: <b>' + esc(s.bizum) + '</b>' : '', s.paypal ? 'PayPal: <b>' + esc(s.paypal) + '</b>' : '', s.iban ? 'IBAN: <b>' + esc(s.iban) + '</b>' : ''].filter(Boolean);
      app.innerHTML = '<p><a href="#/protectoras" class="muted">← Protectoras</a></p><section class="hero" style="padding-top:8px"><div style="display:flex;gap:16px;align-items:center">' +
        (logo ? '<div class="thumb" style="width:84px;height:84px;border-radius:22px;background-image:url(' + esc(logo) + ')"></div>' : '') + '<div><h1>' + esc(s.name) + '</h1><div class="muted">📍 ' + esc(s.city) + (s.since ? ' · ' + esc(/^\d{4}$/.test(s.since) ? 'Desde ' + s.since : s.since) : '') + '</div></div></div>' +
        '<p>' + esc(s.about || '').replace(/\n/g, '<br>') + '</p></section>' +
        '<div class="card" style="max-width:640px;margin-bottom:20px">' + (s.address ? '<div>📍 ' + esc(s.address) + '</div>' : '') + (s.phone ? '<div>📞 ' + esc(s.phone) + '</div>' : '') + (s.email ? '<div>✉️ ' + esc(s.email) + '</div>' : '') + (site ? '<div>🌐 ' + site + '</div>' : '') +
        (pay.length ? '<div style="margin-top:10px"><b>Donaciones directas</b> (sin comisiones, van íntegras a la protectora)<br>' + pay.join('<br>') + '</div>' : '') + '</div>' +
        '<h2>Sus animales</h2><div class="grid">' + (r[1] || []).map(petCard).join('') + ((r[1] || []).length ? '' : '<div class="spin">Ahora mismo no tiene animales publicados.</div>') + '</div>';
    }).catch(function (e) { app.innerHTML = '<div class="spin">Error: ' + esc(e.message) + '</div>'; });
  }

  // ---------------------------------------------------------------- acceso
  function viewLogin() {
    if (session) { location.hash = '#/panel'; return; }
    app.innerHTML = '<div style="max-width:440px;margin:30px auto"><h1>Acceso para protectoras</h1><p class="muted">Entra con la misma cuenta que usas en la app. Lo que hagas aquí aparece en la app y al revés.</p>' +
      '<div class="card"><div class="field"><label>Email</label><input type="email" id="em" autocomplete="username"></div>' +
      '<div class="field"><label>Contraseña</label><input type="password" id="pw" autocomplete="current-password"></div>' +
      '<button class="btn pr" id="go" style="width:100%">Entrar</button><p id="msg" class="muted"></p></div>' +
      '<p class="muted center">¿Aún no tienes cuenta o tu protectora no está registrada? Créala en la app SaveAnimals: allí verificamos tu móvil y revisamos a cada protectora.<br><a href="' + PLAY + '">Descargar la app</a></p></div>';
    function go() {
      var b = $('#go'); b.disabled = true; $('#msg').textContent = '';
      fetch(SB + '/auth/v1/token?grant_type=password', {method: 'POST', headers: {apikey: KEY, 'Content-Type': 'application/json'}, body: JSON.stringify({email: $('#em').value.trim(), password: $('#pw').value})})
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error_description || j.msg || 'No se pudo entrar'); return j; }); })
        .then(function (j) { saveSession(j); location.hash = '#/panel'; })
        .catch(function (e) { $('#msg').textContent = /invalid/i.test(e.message) ? 'Email o contraseña incorrectos.' : e.message; b.disabled = false; });
    }
    $('#go').onclick = go; $('#pw').onkeydown = function (e) { if (e.key === 'Enter') go(); };
  }

  // ---------------------------------------------------------------- panel
  var myShelter = null;
  function getShelter() {
    return sb('GET', '/rest/v1/shelters?select=*&owner=eq.' + encodeURIComponent(session.user.id) + '&order=created_at').then(function (r) { myShelter = (r || [])[0] || null; return myShelter; });
  }
  function viewPanel() {
    app.innerHTML = '<div class="spin">Cargando tu panel…</div>';
    getShelter().then(function (s) {
      if (!s && isAdmin()) { location.hash = '#/admin'; return; }
      if (!s) { app.innerHTML = '<section class="hero"><h1>Tu cuenta no tiene protectora</h1><p>Registra tu protectora en la app SaveAnimals (necesita verificación). Cuando la aprobemos, podrás gestionarla también aquí.</p></section><a class="btn pr" href="' + PLAY + '">Abrir la app</a>'; return; }
      if (s.status !== 'approved') { app.innerHTML = '<section class="hero"><h1>' + esc(s.name) + '</h1><p>' + (s.status === 'pending' ? 'Tu protectora está pendiente de verificación. Te avisaremos en cuanto esté aprobada.' : 'Tu protectora no ha sido aprobada. Escríbenos a saveanimals.app@gmail.com.') + '</p></section>'; return; }
      return sb('GET', '/rest/v1/pets?select=*&shelter_id=eq.' + s.id + '&order=created_at.desc').then(function (pets) {
        app.innerHTML = '<section class="hero"><h1>' + esc(s.name) + '</h1><p>Gestiona tus animales. Los cambios se ven al momento en la app y en la web.</p></section>' +
          '<p><a class="btn pr" href="#/panel/nuevo">+ Añadir animal</a> <a class="btn" href="#/panel/perfil">Perfil de la protectora</a></p>' +
          '<div class="card" style="margin:18px 0 30px"><table class="list">' + (pets || []).map(function (p) {
            var img = safeImg((p.photos || [])[0]);
            return '<tr><td style="width:70px"><div class="thumb" style="background-image:url(' + esc(img) + ')"></div></td><td><b>' + esc(p.name) + '</b><div class="muted">' + (p.species === 1 ? 'Gato' : 'Perro') + ' · ' + ageText(p.age_months) + ' · ' + (p.status === 'adopted' ? 'Adoptado' : p.status === 'reserved' ? 'Reservado' : 'Disponible') + '</div></td>' +
              '<td style="text-align:right;white-space:nowrap"><a class="btn sm" href="#/panel/editar/' + esc(p.id) + '">Editar</a></td></tr>';
          }).join('') + (pets && pets.length ? '' : '<tr><td class="muted">Aún no has publicado animales.</td></tr>') + '</table></div>' +
          '<div class="note">💬 Solicitudes de adopción, cuestionarios y chat con adoptantes se gestionan en la app SaveAnimals.</div><p></p>';
      });
    }).catch(function (e) { if (e.status === 401) { saveSession(null); location.hash = '#/entrar'; } else app.innerHTML = '<div class="spin">Error: ' + esc(e.message) + '</div>'; });
  }

  function chk(id, label, on) { return '<label><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; }
  function viewForm(id) {
    app.innerHTML = '<div class="spin">Cargando…</div>';
    var adm = isAdmin(), back = adm ? '#/admin/animales' : '#/panel';
    getShelter().then(function (s) {
      if (!adm && (!s || s.status !== 'approved')) { location.hash = '#/panel'; return; }
      var shelters = adm && !id ? sb('GET', '/rest/v1/shelters?select=id,name&status=eq.approved&order=name') : Promise.resolve(null);
      return shelters.then(function (shl) {
      return (id ? sb('GET', '/rest/v1/pets?select=*&id=eq.' + encodeURIComponent(id) + (adm ? '' : '&shelter_id=eq.' + s.id)) : Promise.resolve([{}])).then(function (r) {
        var p = (r || [])[0]; if (!p) { location.hash = back; return; }
        if (adm && id) s = {id: p.shelter_id};
        var isNew = !id; var photos = (p.photos || []).slice(); var months = p.age_months || 12;
        if (isNew) p = {species: 0, size: 1, energy: 2, vaccinated: true, sterilized: true, microchip: true, dewormed: true, kids: true, dogs: true, cats: false, fee: 150, status: 'available', seeking: ['adopt'], traits: []};
        function sel(idn, opts, cur) { return '<select id="' + idn + '">' + opts.map(function (o, i) { return '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>'; }
        var seeking = p.seeking || ['adopt'];
        app.innerHTML = '<p><a href="' + back + '" class="muted">← Volver</a></p><h1>' + (isNew ? 'Nuevo animal' : 'Editar ' + esc(p.name)) + '</h1>' +
          '<div class="card" style="margin:18px 0 40px;max-width:760px">' +
          (shl ? '<div class="field"><label>Protectora</label><select id="shsel">' + shl.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('') + '</select></div>' : '') +
          '<div class="field"><label>Fotos (la primera es la principal)</label><div class="photos" id="ph"></div><input type="file" id="file" accept="image/*" multiple hidden></div>' +
          '<div class="row"><div class="field"><label>Nombre</label><input type="text" id="name" maxlength="40" value="' + esc(p.name) + '"></div>' +
          '<div class="field"><label>Raza</label><input type="text" id="breed" maxlength="40" placeholder="Mestizo" value="' + esc(p.breed === 'Mestizo' ? '' : p.breed) + '"></div></div>' +
          '<div class="row"><div class="field"><label>Especie</label>' + sel('species', ['Perro', 'Gato'], p.species | 0) + '</div><div class="field"><label>Sexo</label>' + sel('sex', ['Macho', 'Hembra'], p.female ? 1 : 0) + '</div>' +
          '<div class="field"><label>Tamaño</label>' + sel('size', SIZES, p.size | 0) + '</div></div>' +
          '<div class="row"><div class="field"><label>Años</label><input type="number" id="years" min="0" max="30" value="' + Math.floor(months / 12) + '"></div><div class="field"><label>Meses</label><input type="number" id="months" min="0" max="11" value="' + (months % 12) + '"></div>' +
          '<div class="field"><label>Peso (kg)</label><input type="number" id="weight" min="0" step="0.1" value="' + (p.weight_kg || '') + '"></div></div>' +
          '<div class="field"><label>Su historia</label><textarea id="story" maxlength="2000">' + esc(p.story) + '</textarea></div>' +
          '<div class="field"><label>Carácter (separado por comas)</label><input type="text" id="traits" placeholder="Cariñoso, juguetón" value="' + esc((p.traits || []).join(', ')) + '"></div>' +
          '<div class="field"><label>Energía</label>' + sel('energy', ['Tranquilo', 'Moderado', 'Muy activo'], Math.max(0, (p.energy || 2) - 1)) + '</div>' +
          '<div class="field"><label>Salud</label><div class="checks">' + chk('vac', 'Vacunado', p.vaccinated) + chk('ster', 'Esterilizado', p.sterilized) + chk('chip', 'Con chip', p.microchip) + chk('dew', 'Desparasitado', p.dewormed) + '</div></div>' +
          '<div class="field"><label>Convive bien con</label><div class="checks">' + chk('kids', 'Niños', p.kids) + chk('dogs', 'Perros', p.dogs) + chk('cats', 'Gatos', p.cats) + '</div></div>' +
          '<div class="field"><label>Qué busca</label><div class="checks">' + chk('s_adopt', 'Adopción', seeking.indexOf('adopt') >= 0) + chk('s_ft', 'Acogida temporal', seeking.indexOf('foster_temp') >= 0) + chk('s_fl', 'Acogida indefinida', seeking.indexOf('foster_long') >= 0) + chk('fnow', 'Acogida inmediata', p.foster_now) + '</div></div>' +
          '<div class="row"><div class="field"><label>Aportación para gastos (€)</label><input type="number" id="fee" min="0" value="' + (p.fee == null ? 150 : p.fee) + '"></div>' +
          '<div class="field"><label>Estado</label>' + sel('status', ['Disponible', 'Reservado', 'Adoptado'], p.status === 'adopted' ? 2 : p.status === 'reserved' ? 1 : 0) + '</div></div>' +
          '<div class="field" id="hw" style="display:none"><label>Historia feliz (opcional)</label><textarea id="happy" maxlength="1000">' + esc(p.adopted_story) + '</textarea></div>' +
          '<div class="checks field">' + chk('urgent', 'Marcar como urgente', p.urgent) + '</div>' +
          '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px"><button class="btn pr" id="save">' + (isNew ? 'Publicar' : 'Guardar cambios') + '</button>' + (isNew ? '' : '<button class="btn danger" id="del">Eliminar ficha</button>') + '</div></div>';

        function drawPhotos() {
          $('#ph').innerHTML = photos.map(function (u, i) { return '<div class="p" style="background-image:url(' + esc(safeImg(u)) + ')">' + (i === 0 ? '<span>Principal</span>' : '') + '<button data-i="' + i + '" title="Quitar">×</button></div>'; }).join('') + '<div class="add" id="add">+ Añadir fotos</div>';
          $$('#ph button').forEach(function (b) { b.onclick = function () { photos.splice(+b.dataset.i, 1); drawPhotos(); }; });
          $('#add').onclick = function () { $('#file').click(); };
        }
        drawPhotos();
        $('#file').onchange = function (e) {
          var files = Array.prototype.slice.call(e.target.files); e.target.value = '';
          if (photos.length + files.length > 8) { toast('Máximo 8 fotos'); files = files.slice(0, 8 - photos.length); }
          var add = $('#add'); add.textContent = 'Subiendo…';
          files.reduce(function (pr, f) { return pr.then(function () { return resize(f).then(upload).then(function (u) { photos.push(u); }); }); }, Promise.resolve())
            .catch(function (er) { toast('No se pudo subir: ' + er.message); }).then(drawPhotos);
        };
        function status() { $('#hw').style.display = $('#status').value === '2' ? '' : 'none'; } $('#status').onchange = status; status();
        $('#save').onclick = function () { save(id, s, photos); };
        if (!isNew) $('#del').onclick = function () {
          if (!confirm('¿Eliminar esta ficha? Esta acción no se puede deshacer.')) return;
          sb('DELETE', '/rest/v1/pets?id=eq.' + encodeURIComponent(id)).then(function () { toast('Ficha eliminada'); location.hash = back; }).catch(function (e) { toast(e.message); });
        };
      });
      });
    }).catch(function (e) { app.innerHTML = '<div class="spin">Error: ' + esc(e.message) + '</div>'; });
  }
  function save(id, s, photos) {
    var name = $('#name').value.trim();
    if (!name) { toast('Escribe el nombre del animal'); return; }
    if (!photos.length) { toast('Añade al menos una foto'); return; }
    var seeking = []; if ($('#s_adopt').checked) seeking.push('adopt'); if ($('#s_ft').checked) seeking.push('foster_temp'); if ($('#s_fl').checked) seeking.push('foster_long');
    if (!seeking.length) seeking = ['adopt'];
    var st = +$('#status').value, happy = $('#happy').value.trim();
    var o = {
      shelter_id: ($('#shsel') ? $('#shsel').value : s.id), name: name, species: +$('#species').value, breed: $('#breed').value.trim() || 'Mestizo', female: $('#sex').value === '1',
      age_months: Math.max(1, (+$('#years').value || 0) * 12 + (+$('#months').value || 0)), size: +$('#size').value, weight_kg: parseFloat($('#weight').value) || 0,
      story: $('#story').value.trim(), traits: $('#traits').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      photos: photos, vaccinated: $('#vac').checked, sterilized: $('#ster').checked, microchip: $('#chip').checked, dewormed: $('#dew').checked,
      kids: $('#kids').checked, dogs: $('#dogs').checked, cats: $('#cats').checked, energy: +$('#energy').value + 1, urgent: $('#urgent').checked,
      fee: Math.max(0, parseInt($('#fee').value, 10) || 0), status: st === 2 ? 'adopted' : st === 1 ? 'reserved' : 'available',
      adopted_story: st === 2 && happy ? happy : null, seeking: seeking, foster_now: $('#fnow').checked, updated_at: new Date().toISOString()
    };
    var b = $('#save'); b.disabled = true;
    (id ? sb('PATCH', '/rest/v1/pets?id=eq.' + encodeURIComponent(id), o, {prefer: 'return=minimal'}) : sb('POST', '/rest/v1/pets', o, {prefer: 'return=minimal'}))
      .then(function () { toast(id ? 'Cambios guardados' : 'Animal publicado'); location.hash = isAdmin() ? '#/admin/animales' : '#/panel'; })
      .catch(function (e) { toast(e.message); b.disabled = false; });
  }

  // fotos: se reducen en el navegador (máx. 1600 px, JPEG) igual que en la app
  function resize(file) {
    return new Promise(function (res, rej) {
      if (!/^image\//.test(file.type)) return rej(new Error('No es una imagen'));
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var m = 1600, w = img.width, h = img.height, k = Math.min(1, m / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('No se pudo procesar la foto')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { rej(new Error('Foto no válida')); }; img.src = url;
    });
  }
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); }
  function upload(blob) {
    var path = session.user.id + '/' + uuid() + '.jpg';
    return sb('POST', '/storage/v1/object/photos/' + path, blob, {raw: true, type: 'image/jpeg'}).then(function () { return SB + '/storage/v1/object/public/photos/' + path; });
  }

  // ---------------------------------------------------------------- perfil de la protectora
  function viewProfile() {
    app.innerHTML = '<div class="spin">Cargando…</div>';
    getShelter().then(function (s) {
      if (!s) { location.hash = '#/panel'; return; }
      var logo = safeImg(s.logo_url);
      function f(id, label, v, extra) { return '<div class="field"><label>' + label + '</label><input type="text" id="' + id + '" value="' + esc(v) + '" ' + (extra || '') + '></div>'; }
      app.innerHTML = '<p><a href="#/panel" class="muted">← Mi panel</a></p><h1>Perfil de la protectora</h1>' +
        '<div class="note" style="margin:14px 0;max-width:760px">Los cambios de nombre, teléfono, email, web y datos de donación los revisa el administrador antes de publicarse (como en la app).</div>' +
        '<div class="card" style="margin-bottom:40px;max-width:760px"><div class="field"><label>Logo</label><div class="photos"><div class="p" id="lg" style="background-image:url(' + esc(logo) + ')"></div><div class="add" id="lgadd">Cambiar logo</div></div><input type="file" id="lgf" accept="image/*" hidden></div>' +
        f('name', 'Nombre', s.name) + f('city', 'Ciudad', s.city) + f('address', 'Dirección', s.address || '') +
        '<div class="field"><label>Sobre nosotros</label><textarea id="about" maxlength="2000">' + esc(s.about) + '</textarea></div>' +
        '<div class="row">' + f('phone', 'Teléfono', s.phone || '') + f('email', 'Email', s.email || '') + '</div>' +
        f('website', 'Web', s.website || '', 'placeholder="https://"') + f('since', 'Desde (año)', s.since || '') + f('resp', 'Tiempo de respuesta', s.response_time || '') +
        '<div class="row">' + f('bizum', 'Bizum', s.bizum || '') + f('paypal', 'PayPal', s.paypal || '') + '</div>' + f('iban', 'IBAN', s.iban || '') +
        '<button class="btn pr" id="sv">Guardar</button></div>';
      var logoUrl = s.logo_url;
      $('#lgadd').onclick = function () { $('#lgf').click(); };
      $('#lgf').onchange = function (e) {
        var file = e.target.files[0]; if (!file) return;
        resize(file).then(upload).then(function (u) { logoUrl = u; $('#lg').style.backgroundImage = 'url(' + safeImg(u) + ')'; }).catch(function (er) { toast(er.message); });
      };
      $('#sv').onclick = function () {
        var site = $('#website').value.trim();
        if (site && !/^https?:\/\//i.test(site)) { toast('La web debe empezar por https://'); return; }
        var o = {name: $('#name').value.trim(), city: $('#city').value.trim(), address: $('#address').value.trim() || null, about: $('#about').value.trim(), phone: $('#phone').value.trim() || null,
          email: $('#email').value.trim() || null, website: site || null, since: $('#since').value.trim() || null, response_time: $('#resp').value.trim() || null,
          bizum: $('#bizum').value.trim() || null, paypal: $('#paypal').value.trim() || null, iban: $('#iban').value.trim() || null, logo_url: logoUrl};
        if (!o.name || !o.city) { toast('Nombre y ciudad son obligatorios'); return; }
        this.disabled = true; var b = this;
        sb('PATCH', '/rest/v1/shelters?id=eq.' + s.id, o, {prefer: 'return=minimal'}).then(function () { toast('Guardado'); location.hash = '#/panel'; }).catch(function (e) { toast(e.message); b.disabled = false; });
      };
    }).catch(function (e) { app.innerHTML = '<div class="spin">Error: ' + esc(e.message) + '</div>'; });
  }

  // ---------------------------------------------------------------- administración
  function count(table, filter) {
    return ensureFresh().then(function () {
      return fetch(SB + '/rest/v1/' + table + '?select=*' + (filter ? '&' + filter : ''), {method: 'HEAD', headers: {apikey: KEY, Authorization: 'Bearer ' + ((session && session.access_token) || KEY), Prefer: 'count=exact'}});
    }).then(function (r) { var c = r.headers.get('content-range') || ''; return parseInt(c.split('/')[1], 10) || 0; });
  }
  var ADM_TABS = [['protectoras', 'Protectoras'], ['animales', 'Animales'], ['usuarios', 'Usuarios'], ['sugerencias', 'Sugerencias'], ['perdidos', 'Perdidos'], ['ajustes', 'Ajustes'], ['resumen', 'Resumen']];
  function viewAdmin(tab) {
    app.innerHTML = '<section class="hero"><h1>Administración</h1></section><div class="chips" style="justify-content:flex-start">' +
      ADM_TABS.map(function (t) { return '<a class="chip' + (t[0] === tab ? ' on' : '') + '" href="#/admin/' + t[0] + '" style="text-decoration:none">' + t[1] + '</a>'; }).join('') + '</div><div id="adm"><div class="spin">Cargando…</div></div>';
    var box = $('#adm');
    function fail(e) { box.innerHTML = '<div class="spin">Error: ' + esc(e.message) + '</div>'; }
    function reload() { viewAdmin(tab); }
    function date(t) { return t ? new Date(t).toLocaleDateString('es-ES') : ''; }
    if (tab === 'resumen') {
      Promise.all([count('profiles'), count('shelters', 'status=eq.approved'), count('shelters', 'status=eq.pending'), count('pets', 'status=eq.available'), count('pets', 'status=eq.adopted'), count('applications'), count('lost_found'), count('suggestions', 'status=eq.new')]).then(function (c) {
        var items = [['Usuarios', c[0]], ['Protectoras aprobadas', c[1]], ['Protectoras pendientes', c[2]], ['Animales disponibles', c[3]], ['Animales adoptados', c[4]], ['Solicitudes', c[5]], ['Avisos de perdidos', c[6]], ['Sugerencias nuevas', c[7]]];
        box.innerHTML = '<div class="grid">' + items.map(function (i) { return '<div class="card"><div class="muted">' + i[0] + '</div><div style="font-size:34px;font-weight:800">' + i[1] + '</div></div>'; }).join('') + '</div>';
      }).catch(fail);
    } else if (tab === 'protectoras') {
      Promise.all([sb('GET', '/rest/v1/shelters?select=*&order=created_at.desc'), sb('GET', '/rest/v1/shelter_verification?select=*')]).then(function (r) {
        var ver = {}; (r[1] || []).forEach(function (v) { ver[v.shelter_id] = v; });
        var order = {pending: 0, approved: 1, rejected: 2};
        var list = (r[0] || []).sort(function (a, b) { return order[a.status] - order[b.status]; });
        box.innerHTML = list.map(function (s) {
          var v = ver[s.id] || {}, pend = v.pending_changes;
          var cls = s.status === 'approved' ? 'g' : s.status === 'pending' ? 'y' : 'p';
          return '<div class="card" style="margin-bottom:14px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><h3 style="flex:1">' + esc(s.name) + '</h3><span class="pill ' + cls + '">' + (s.status === 'approved' ? 'Aprobada' : s.status === 'pending' ? 'Pendiente' : 'Rechazada') + '</span></div>' +
            '<div class="muted">📍 ' + esc(s.city) + ' · CIF ' + esc(s.cif || '—') + ' · ' + esc(s.email || '') + ' ' + esc(s.phone || '') + '</div>' +
            (v.responsible ? '<div class="muted">Responsable: ' + esc(v.responsible) + (v.registry ? ' · Registro: ' + esc(v.registry) : '') + '</div>' : '') +
            (pend ? '<div class="note" style="margin:10px 0"><b>Cambios pendientes:</b> ' + esc(JSON.stringify(pend)) + '<div style="margin-top:8px"><button class="btn sm pr" data-a="acc" data-id="' + s.id + '">Aceptar</button> <button class="btn sm" data-a="rej" data-id="' + s.id + '">Rechazar</button></div></div>' : '') +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
            (v.doc_path ? '<button class="btn sm" data-a="doc" data-p="' + esc(v.doc_path) + '">Ver documento</button>' : '') +
            (s.status !== 'approved' ? '<button class="btn sm pr" data-a="ok" data-id="' + s.id + '">Aprobar</button>' : '<button class="btn sm" data-a="sus" data-id="' + s.id + '">Suspender</button>') +
            (s.status === 'pending' ? '<button class="btn sm" data-a="no" data-id="' + s.id + '">Rechazar</button>' : '') +
            '<button class="btn sm danger" data-a="del" data-id="' + s.id + '">Eliminar</button></div></div>';
        }).join('') || '<div class="spin">No hay protectoras.</div>';
        $$('button[data-a]', box).forEach(function (b) {
          b.onclick = function () {
            var a = b.dataset.a, id = b.dataset.id, p;
            if (a === 'doc') { sb('POST', '/storage/v1/object/sign/verificacion/' + b.dataset.p, {expiresIn: 600}).then(function (j) { var u = j.signedURL || j.signedUrl; window.open(/^http/.test(u) ? u : SB + '/storage/v1' + u, '_blank', 'noopener'); }).catch(function (e) { toast(e.message); }); return; }
            if (a === 'acc' || a === 'rej') p = sb('POST', '/rest/v1/rpc/review_shelter_changes', {sid: id, accept: a === 'acc'});
            else if (a === 'ok') p = sb('PATCH', '/rest/v1/shelters?id=eq.' + id, {status: 'approved'}, {prefer: 'return=minimal'});
            else if (a === 'sus') { if (!confirm('¿Suspender esta protectora?')) return; p = sb('PATCH', '/rest/v1/shelters?id=eq.' + id, {status: 'rejected'}, {prefer: 'return=minimal'}); }
            else if (a === 'no') {
              var note = prompt('Motivo del rechazo (lo verá la protectora):', ''); if (note === null) return;
              p = sb('PATCH', '/rest/v1/shelters?id=eq.' + id, {status: 'rejected'}, {prefer: 'return=minimal'}).then(function () { return sb('POST', '/rest/v1/shelter_verification', {shelter_id: id, review_note: note || null}, {prefer: 'resolution=merge-duplicates,return=minimal'}); });
            } else if (a === 'del') { if (!confirm('¿Eliminar la protectora y todos sus animales? No se puede deshacer.')) return; p = sb('DELETE', '/rest/v1/shelters?id=eq.' + id); }
            p.then(function () { toast('Hecho'); reload(); }).catch(function (e) { toast(e.message); });
          };
        });
      }).catch(fail);
    } else if (tab === 'animales') {
      sb('GET', '/rest/v1/pets?select=*,shelters(name)&order=created_at.desc&limit=500').then(function (r) {
        box.innerHTML = '<p><a class="btn pr" href="#/panel/nuevo">+ Añadir animal</a></p><div class="card"><table class="list">' + (r || []).map(function (p) {
          return '<tr><td style="width:70px"><div class="thumb" style="background-image:url(' + esc(safeImg((p.photos || [])[0])) + ')"></div></td><td><b>' + esc(p.name) + '</b><div class="muted">' + esc((p.shelters || {}).name || '') + ' · ' + (p.status === 'adopted' ? 'Adoptado' : p.status === 'reserved' ? 'Reservado' : 'Disponible') + '</div></td><td style="text-align:right"><a class="btn sm" href="#/panel/editar/' + esc(p.id) + '">Editar</a></td></tr>';
        }).join('') + '</table></div>';
      }).catch(fail);
    } else if (tab === 'usuarios') {
      sb('GET', '/rest/v1/profiles?select=id,email,full_name,city,role,created_at&order=created_at.desc&limit=500').then(function (r) {
        box.innerHTML = '<p class="muted">' + (r || []).length + ' usuarios</p><div class="card"><table class="list">' + (r || []).map(function (u) {
          return '<tr><td><b>' + esc(u.full_name || '(sin nombre)') + '</b><div class="muted">' + esc(u.email || '') + ' · ' + esc(u.city || '') + ' · desde ' + date(u.created_at) + '</div></td><td style="text-align:right"><span class="pill ' + (u.role === 'admin' ? 'p' : u.role === 'shelter' ? 'g' : 'b') + '">' + (u.role === 'admin' ? 'Admin' : u.role === 'shelter' ? 'Protectora' : 'Usuario') + '</span></td></tr>';
        }).join('') + '</table></div>';
      }).catch(fail);
    } else if (tab === 'sugerencias') {
      sb('GET', '/rest/v1/suggestions?select=*&order=created_at.desc&limit=200').then(function (r) {
        box.innerHTML = (r || []).map(function (s) {
          return '<div class="card" style="margin-bottom:12px"><div class="muted">' + esc(s.author_name || '') + ' · ' + esc(s.kind) + ' · ' + date(s.created_at) + ' · v' + esc(s.app_version || '?') + '</div><p>' + esc(s.body).replace(/\n/g, '<br>') + '</p>' +
            '<div class="field"><input type="text" placeholder="Respuesta (opcional)" data-r="' + s.id + '" value="' + esc(s.reply || '') + '"></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm' + (s.status === 'new' ? ' pr' : '') + '" data-id="' + s.id + '" data-s="read">Leída</button><button class="btn sm" data-id="' + s.id + '" data-s="done">Hecha</button><span class="pill ' + (s.status === 'done' ? 'g' : s.status === 'read' ? 'b' : 'y') + '">' + (s.status === 'done' ? 'Hecha' : s.status === 'read' ? 'Leída' : 'Nueva') + '</span></div></div>';
        }).join('') || '<div class="spin">No hay sugerencias.</div>';
        $$('button[data-s]', box).forEach(function (b) { b.onclick = function () {
          var rep = $('input[data-r="' + b.dataset.id + '"]').value.trim();
          sb('PATCH', '/rest/v1/suggestions?id=eq.' + b.dataset.id, {status: b.dataset.s, reply: rep || null}, {prefer: 'return=minimal'}).then(function () { toast('Guardado'); reload(); }).catch(function (e) { toast(e.message); });
        }; });
      }).catch(fail);
    } else if (tab === 'perdidos') {
      sb('GET', '/rest/v1/lost_found?select=*&order=created_at.desc&limit=200').then(function (r) {
        box.innerHTML = (r || []).map(function (l) {
          return '<div class="card" style="margin-bottom:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1"><b>' + (l.kind === 'lost' ? 'Perdido' : 'Encontrado') + ' · ' + esc(l.name || (l.species === 1 ? 'Gato' : 'Perro')) + ' · ' + esc(l.zone || '') + '</b><div class="muted">' + esc(l.author_name || '') + ' · ' + date(l.created_at) + '</div><div>' + esc(String(l.description || l.body || '').slice(0, 200)) + '</div></div><button class="btn sm danger" data-id="' + l.id + '">Eliminar</button></div>';
        }).join('') || '<div class="spin">No hay avisos.</div>';
        $$('button[data-id]', box).forEach(function (b) { b.onclick = function () { if (!confirm('¿Eliminar este aviso?')) return; sb('DELETE', '/rest/v1/lost_found?id=eq.' + b.dataset.id).then(reload).catch(function (e) { toast(e.message); }); }; });
      }).catch(fail);
    } else if (tab === 'ajustes') {
      sb('GET', '/rest/v1/app_config?select=*&order=key').then(function (r) {
        box.innerHTML = '<p class="muted">Ajustes globales de la app. Los booleanos se cambian con un clic; el resto se edita como JSON.</p><div class="card"><table class="list">' + (r || []).map(function (c) {
          var bool = typeof c.value === 'boolean';
          return '<tr><td><b>' + esc(c.key) + '</b></td><td>' + (bool ? '<button class="btn sm' + (c.value ? ' pr' : '') + '" data-k="' + esc(c.key) + '" data-b="' + (c.value ? 0 : 1) + '">' + (c.value ? 'Activado' : 'Desactivado') + '</button>'
            : '<input type="text" data-k="' + esc(c.key) + '" value="' + esc(JSON.stringify(c.value)) + '"> <button class="btn sm" data-k="' + esc(c.key) + '" data-t="1">Guardar</button>') + '</td></tr>';
        }).join('') + '</table></div>';
        $$('button[data-b]', box).forEach(function (b) { b.onclick = function () { sb('PATCH', '/rest/v1/app_config?key=eq.' + encodeURIComponent(b.dataset.k), {value: b.dataset.b === '1'}, {prefer: 'return=minimal'}).then(reload).catch(function (e) { toast(e.message); }); }; });
        $$('button[data-t]', box).forEach(function (b) { b.onclick = function () {
          var v; try { v = JSON.parse($('input[data-k="' + b.dataset.k + '"]').value); } catch (e) { toast('JSON no válido'); return; }
          sb('PATCH', '/rest/v1/app_config?key=eq.' + encodeURIComponent(b.dataset.k), {value: v}, {prefer: 'return=minimal'}).then(function () { toast('Guardado'); }).catch(function (e) { toast(e.message); });
        }; });
      }).catch(fail);
    }
  }

  loadSession();
  route();
})();
