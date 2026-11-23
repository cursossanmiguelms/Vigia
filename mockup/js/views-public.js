(function () {
  window.AUTEC = window.AUTEC || {};

  var U = AUTEC.utils;
  var C = AUTEC.components;
  var I = AUTEC.icon;
  var V = AUTEC.views = AUTEC.views || {};

  function tag(text) {
    return '<span class="tag">' + U.escapeHtml(text) + '</span>';
  }

  function reidStep(time, label, active) {
    return '<div class="reid-step ' + (active ? 'is-active' : '') + '"><span class="step-dot"></span><span>' + label + '</span><span class="mono">' + time + '</span></div>';
  }

  function featureItem(icon, text) {
    return '<div class="feature-list-item">' + I(icon, 15) + '<span>' + text + '</span></div>';
  }

  function companyLine(short, name, plan, color) {
    return '<div class="feature-company"><span class="avatar avatar--sm avatar--company" style="--avatar-color:' + color + '">' + short + '</span><strong>' + name + '</strong><span class="badge badge--neutral">' + plan + '</span></div>';
  }

  function landingNav() {
    return '<header class="landing-nav">'
      + C.brand({ href: '#/' })
      + '<nav class="landing-nav-links" aria-label="Secciones">'
      + '<a href="#/" data-action="scroll-to" data-target="plataforma">Plataforma</a>'
      + '<a href="#/" data-action="scroll-to" data-target="skills">Skills</a>'
      + '<a href="#/" data-action="scroll-to" data-target="roles">Roles</a>'
      + '<a href="#/" data-action="scroll-to" data-target="como-funciona">Cómo funciona</a>'
      + '</nav>'
      + '<div class="landing-nav-actions">'
      + '<a class="btn btn-ghost btn-sm" href="#/login">Iniciar sesión</a>'
      + '<a class="btn btn-primary btn-sm" href="#/solicitar-acceso">Solicitar acceso</a>'
      + '</div>'
      + '</header>';
  }

  function hero() {
    return '<section class="landing-hero"><div class="landing-hero-inner">'
      + '<div class="hero">'
      + '<span class="hero-eyebrow">Plataforma local de visión artificial</span>'
      + '<h1>La vigilancia que <span class="accent">entiende</span> lo que ve.</h1>'
      + '<p class="hero-sub">VigIA convierte una cámara común en un puesto de monitoreo asistido. Detecta personas, mantiene su identidad y suma skills a medida que tu operación las necesita. Todo local, liviano y bajo tu control.</p>'
      + '<div class="hero-actions">'
      + '<a class="btn btn-primary btn-lg" href="#/solicitar-acceso">Solicitar acceso ' + I('arrow-right', 16) + '</a>'
      + '<a class="btn btn-ghost btn-lg" href="#/login">Ver la demo</a>'
      + '</div>'
      + '<div class="hero-proof">'
      + '<span>' + I('check-circle', 14) + ' Procesamiento local</span>'
      + '<span>' + I('check-circle', 14) + ' EPP en piloto</span>'
      + '<span>' + I('check-circle', 14) + ' Sin cuotas por cámara</span>'
      + '<span>' + I('check-circle', 14) + ' DroidCam como cliente</span>'
      + '</div>'
      + '</div>'
      + '<div class="hero-visual"><div class="hero-product">'
      + '<div class="hero-product-bar"><span class="window-dots"><i></i><i></i><i></i></span><span>VigIA / monitoreo</span>' + C.badge('En vivo', 'success', { dot: true }) + '</div>'
      + C.videoFrame({ compact: true, monitorFrame: false })
      + '<div class="hero-product-foot">'
      + '<div><span>Personas</span><strong>3</strong></div>'
      + '<div><span>ReID</span><strong>1</strong></div>'
      + '<div><span>Latencia</span><strong>38 ms</strong></div>'
      + '</div>'
      + '</div></div>'
      + '</div></section>';
  }

  function features() {
    var bars = [22, 38, 30, 52, 44, 68, 58, 76, 64, 82].map(function (height, index) {
      return '<span class="' + (index > 5 ? 'is-on' : '') + '" style="height:' + height + '%"></span>';
    }).join('');

    return '<section class="section" id="plataforma">'
      + '<div class="section-head">'
      + '<span class="eyebrow">Una plataforma, varias capas</span>'
      + '<h2>De la cámara al dato útil, sin infraestructura pesada.</h2>'
      + '<p>VigIA corre en tu equipo, toma video de DroidCam y transforma detecciones en información operativa. Cada skill se entrena y valida antes de activarse.</p>'
      + '</div>'
      + '<div class="feature-grid">'
      + '<article class="feature-card">'
      + '<div class="feature-visual">'
      + '<div class="feature-visual-label"><span>Personas en cámara</span><span>14:32:08</span></div>'
      + '<div class="feature-count">3 <small>personas detectadas</small></div>'
      + '<div class="feature-bars">' + bars + '</div>'
      + '</div>'
      + '<div><h3>Conteo de personas en tiempo real</h3><p>Cajas azules, confianza por detección y contador actualizado. La base de todas las skills de VigIA.</p></div>'
      + '</article>'
      + '<article class="feature-card">'
      + '<div class="feature-visual">'
      + '<div class="feature-visual-label"><span>ReID · persona #2</span><span>94%</span></div>'
      + '<div class="reid-timeline">'
      + reidStep('14:31:40', 'Sale de cámara', false)
      + reidStep('14:31:52', 'Coincidencia candidata', false)
      + reidStep('14:32:08', 'ID recuperado', true)
      + '</div>'
      + '</div>'
      + '<div><h3>ReID que mantiene la identidad</h3><p>La misma persona conserva su ID cuando sale y vuelve a entrar. Etiquetas claras, sin biometría y con límites explícitos.</p></div>'
      + '</article>'
      + '<article class="feature-card">'
      + '<div class="feature-visual">'
      + '<div class="feature-visual-label"><span>Infraestructura</span><span>LOCAL</span></div>'
      + '<div class="feature-list">'
      + featureItem('check-circle', 'Procesamiento en tu equipo')
      + featureItem('wifi', 'DroidCam como única cámara')
      + featureItem('database', 'Datos guardados localmente')
      + featureItem('zap', 'Sin cuotas por cámara')
      + '</div>'
      + '</div>'
      + '<div><h3>Local y liviano</h3><p>Sin nube obligatoria ni hardware dedicado. VigIA se instala, se conecta a la cámara y empieza a medir.</p></div>'
      + '</article>'
      + '<article class="feature-card">'
      + '<div class="feature-visual">'
      + '<div class="feature-visual-label"><span>Panel del creador</span><span>8 EMPRESAS</span></div>'
      + '<div class="feature-companies">'
      + companyLine('CIM', 'CIM Seguridad', 'Profesional', '#F5A524')
      + companyLine('PS', 'Planta Sur', 'Profesional', '#60A5FA')
      + companyLine('CA', 'Constructora Andes', 'Corporativo', '#34D399')
      + companyLine('RC', 'Retail Centro', 'Demo', '#22D3EE')
      + '</div>'
      + '</div>'
      + '<div><h3>Una app, varias empresas</h3><p>El creador administra empresas, planes, asientos y skills. Cada empresa ve solo su operación, su equipo y su plan.</p></div>'
      + '</article>'
      + '</div>'
      + '</section>';
  }

  function skillsSection() {
    var featured = AUTEC.store.skills.filter(function (skill) { return skill.featured; });
    var rows = featured.map(function (skill) {
      var action;
      if (skill.status === 'available') {
        action = '<a class="btn btn-ghost btn-sm" href="#/login">Probar</a>';
      } else if (skill.status === 'training') {
        action = '<span class="badge badge--warning">' + skill.progress + '%</span>';
      } else {
        action = '<span class="muted small">En investigación</span>';
      }
      return '<div class="skill-row">'
        + '<div class="skill-row-name"><span class="skill-row-icon">' + I(skill.icon || 'layers', 16) + '</span><div><strong>' + U.escapeHtml(skill.name) + '</strong><span>' + U.escapeHtml(skill.description) + '</span></div></div>'
        + '<div class="skill-row-industries">' + skill.industries.map(tag).join('') + '</div>'
        + C.skillStatusBadge(skill.status)
        + (skill.pilot ? C.badge('Piloto', 'warning') : '')
        + action
        + '</div>';
    }).join('');

    return '<section class="section" id="skills">'
      + '<div class="section-head">'
      + '<span class="eyebrow">Roadmap de skills</span>'
      + '<h2>Skills que se entrenan, no que se prometen.</h2>'
      + '<p>Las skills operativas ya cubren personas, reidentificación, zonas, merodeo, aforo por línea, colas, mapa de calor, puestos desatendidos, control de rondas, mesas y clientes y detección de caídas. EPP entra como piloto para casco y chaleco, con simulación marcada hasta instalar el modelo entrenado. El catálogo completo suma ' + AUTEC.store.skills.length + ' skills para ' + AUTEC.store.industries.length + ' industrias y drones, con validación en campo por etapas.</p>'
      + '</div>'
      + '<div class="skill-matrix">' + rows + '</div>'
      + '</section>';
  }

  function rolesSection() {
    return '<section class="section" id="roles">'
      + '<div class="section-head">'
      + '<span class="eyebrow">Roles claros</span>'
      + '<h2>Cada persona ve lo que necesita ver.</h2>'
      + '<p>El creador administra la plataforma. La empresa administra su operación. Supervisores y operadores trabajan con permisos acotados.</p>'
      + '</div>'
      + '<div class="roles-grid">'
      + '<article class="role-card"><span class="role-icon">' + I('shield', 18) + '</span><h3>Creador</h3><p>Control total de la plataforma y de las empresas registradas.</p><ul>'
      + '<li>' + I('check', 14) + ' Empresas y solicitudes</li>'
      + '<li>' + I('check', 14) + ' Planes, asientos y vencimientos</li>'
      + '<li>' + I('check', 14) + ' Skills globales y auditoría</li>'
      + '</ul></article>'
      + '<article class="role-card"><span class="role-icon">' + I('building', 18) + '</span><h3>Administrador de empresa</h3><p>Gestiona el equipo, el plan y las skills contratadas.</p><ul>'
      + '<li>' + I('check', 14) + ' Usuarios y roles</li>'
      + '<li>' + I('check', 14) + ' Skills incluidas en el plan</li>'
      + '<li>' + I('check', 14) + ' Consumo y facturación</li>'
      + '</ul></article>'
      + '<article class="role-card"><span class="role-icon">' + I('users', 18) + '</span><h3>Supervisor y operador</h3><p>Acceso a la operación diaria, sin configuración crítica.</p><ul>'
      + '<li>' + I('check', 14) + ' Monitoreo en vivo</li>'
      + '<li>' + I('check', 14) + ' Eventos y detecciones</li>'
      + '<li>' + I('check', 14) + ' Permisos según rol</li>'
      + '</ul></article>'
      + '</div>'
      + '</section>';
  }

  function stepsSection() {
    return '<section class="section" id="como-funciona">'
      + '<div class="section-head">'
      + '<span class="eyebrow">Puesta en marcha</span>'
      + '<h2>Tres pasos para abrir tu panel.</h2>'
      + '<p>La maqueta ya incluye datos de prueba para recorrer el flujo completo sin configurar nada.</p>'
      + '</div>'
      + '<div class="steps">'
      + '<article class="step-card"><span class="step-number">01 / SOLICITUD</span><h3>Solicitá acceso</h3><p>Contanos qué empresa representás, cuántos usuarios estimás y qué skills te interesan. El creador revisa la solicitud.</p></article>'
      + '<article class="step-card"><span class="step-number">02 / CÁMARA</span><h3>Conectá DroidCam</h3><p>Usá tu teléfono como cámara. VigIA procesa el video localmente y muestra personas y ReID en vivo.</p></article>'
      + '<article class="step-card"><span class="step-number">03 / SKILLS</span><h3>Activá skills</h3><p>El plan define qué skills están incluidas. El administrador las activa o desactiva por empresa en cualquier momento.</p></article>'
      + '</div>'
      + '</section>';
  }

  function ctaBand() {
    return '<section class="section"><div class="cta-band">'
      + '<div><h2>¿Listo para verlo con tus propios datos?</h2><p>La demo es local, gratuita y no requiere tarjeta. Los datos se reinician al recargar.</p></div>'
      + '<div class="inline-actions"><a class="btn btn-primary" href="#/solicitar-acceso">Solicitar acceso</a><a class="btn btn-ghost" href="#/login">Entrar a la demo</a></div>'
      + '</div></section>';
  }

  function footer() {
    return '<footer class="landing-footer">'
      + C.brand({ href: '#/' })
      + '<span>VigIA · Maqueta visual · Sin backend ni autenticación real</span>'
      + '<div class="landing-footer-links"><a href="mailto:hola@vigia.local">Contacto</a><a href="#/">Privacidad</a><a href="#/">Términos</a></div>'
      + '</footer>';
  }

  V.landing = function () {
    return '<div class="landing">' + landingNav() + hero() + features() + skillsSection() + rolesSection() + stepsSection() + ctaBand() + footer() + '</div>';
  };

  V.login = function () {
    var state = AUTEC.app.state;
    var tab = state.loginTab || 'creator';
    var companyId = state.loginCompanyId || 'cim';
    var company = AUTEC.store.companies.find(function (item) { return item.id === companyId; }) || AUTEC.store.companies[0];
    var admin = AUTEC.store.users.find(function (user) {
      return user.companyId === company.id && user.role === 'company_admin' && user.status === 'active';
    }) || AUTEC.store.users.find(function (user) { return user.companyId === company.id; });
    var email = tab === 'creator' ? 'admin@vigia.local' : (admin ? admin.email : 'demo@empresa.com');
    var companyOptions = AUTEC.store.companies.filter(function (item) {
      return item.status !== 'suspended';
    }).map(function (item) {
      return '<option value="' + item.id + '"' + (item.id === company.id ? ' selected' : '') + '>' + U.escapeHtml(item.name) + '</option>';
    }).join('');

    return '<div class="login-page">'
      + '<aside class="login-brand">'
      + C.brand({ href: '#/' })
      + '<div class="login-brand-copy">'
      + '<span class="hero-eyebrow">Acceso de demostración</span>'
      + '<h1>Tu operación,<br>bajo control.</h1>'
      + '<p>Entrá como creador para administrar la plataforma, o como empresa para recorrer el panel operativo. No hay contraseña real ni backend.</p>'
      + '<div class="login-status">'
      + '<div class="login-status-row"><span class="status-dot status-dot--success"></span> Servidor local en línea</div>'
      + '<div class="login-status-row"><span class="status-dot status-dot--success"></span> Cámara DroidCam conectada</div>'
      + '<div class="login-status-row"><span class="status-dot status-dot--success"></span> Datos de demo cargados</div>'
      + '</div>'
      + '</div>'
      + '<div class="login-brand-foot">' + I('shield-check', 14) + ' VigIA · MAQUETA V0.1 · SIN BACKEND</div>'
      + '</aside>'
      + '<main class="login-panel"><div class="login-card">'
      + '<a class="login-back" href="#/">' + I('arrow-left', 14) + ' Volver al inicio</a>'
      + '<h2>Entrar a VigIA</h2>'
      + '<p>Elegí un perfil. La maqueta no valida credenciales.</p>'
      + '<div class="segmented" role="tablist">'
      + '<button type="button" class="' + (tab === 'creator' ? 'is-active' : '') + '" data-action="login-tab" data-tab="creator" role="tab" aria-selected="' + (tab === 'creator' ? 'true' : 'false') + '">Creador</button>'
      + '<button type="button" class="' + (tab === 'company' ? 'is-active' : '') + '" data-action="login-tab" data-tab="company" role="tab" aria-selected="' + (tab === 'company' ? 'true' : 'false') + '">Empresa</button>'
      + '</div>'
      + '<form class="login-form" data-form="login">'
      + '<div class="field"><label for="login-email">Email</label><input class="input" id="login-email" name="email" type="email" value="' + U.escapeHtml(email) + '" autocomplete="username"></div>'
      + '<div class="field"><label for="login-password">Contraseña</label><input class="input" id="login-password" name="password" type="password" value="demo" autocomplete="current-password"></div>'
      + (tab === 'company' ? '<div class="field"><label for="login-company">Empresa</label><select class="select" id="login-company" name="companyId" data-login-company>' + companyOptions + '</select></div>' : '')
      + '<button class="btn btn-primary btn-lg btn-block" type="submit">Entrar</button>'
      + '</form>'
      + '<div class="login-demo">'
      + '<div class="login-demo-label">Acceso rápido de demo</div>'
      + '<div class="login-demo-actions">'
      + '<button class="btn btn-secondary" data-action="quick-login" data-role="creator">' + I('shield', 15) + ' Creador</button>'
      + '<button class="btn btn-secondary" data-action="quick-login" data-role="company_admin">' + I('building', 15) + ' Empresa</button>'
      + '</div>'
      + '</div>'
      + '<div class="login-note">' + I('info', 14) + '<span>Los datos son ficticios y viven en memoria. Recargar la página restaura el estado inicial.</span></div>'
      + '</div></main>'
      + '</div>';
  };

  V.requestAccess = function () {
    var state = AUTEC.app.state;
    var planOptions = AUTEC.store.plans.map(function (plan) {
      return '<option value="' + plan.id + '"' + (plan.id === 'pro' ? ' selected' : '') + '>' + U.escapeHtml(plan.name) + ' · ' + (plan.price ? U.currency(plan.price) + '/' + plan.period : 'Gratis') + '</option>';
    }).join('');
    var sectorOptions = AUTEC.store.industries.map(function (industry) {
      return '<option>' + U.escapeHtml(industry.name) + '</option>';
    }).join('') + '<option>Drones</option><option>Otro</option>';

    if (state.requestSubmitted) {
      return '<div class="request-page">'
        + '<div class="request-top">' + C.brand({ href: '#/' }) + '<a class="btn btn-ghost btn-sm" href="#/login">Iniciar sesión</a></div>'
        + '<main class="request-main"><div class="request-card"><div class="request-success">'
        + '<span class="request-success-icon">' + I('check-circle', 26) + '</span>'
        + '<h2>Solicitud enviada</h2>'
        + '<p>Recibimos los datos de <strong>' + U.escapeHtml(state.requestCompany || 'tu empresa') + '</strong>. En esta maqueta la solicitud queda registrada en el panel del creador y no se envía ningún correo real.</p>'
        + '<div class="inline-actions"><button class="btn btn-primary" data-action="reset-request">Volver al inicio</button><a class="btn btn-ghost" href="#/login">Entrar a la demo</a></div>'
        + '</div></div></main></div>';
    }

    return '<div class="request-page">'
      + '<div class="request-top">' + C.brand({ href: '#/' }) + '<a class="btn btn-ghost btn-sm" href="#/login">Iniciar sesión</a></div>'
      + '<main class="request-main"><div class="request-card">'
      + '<div class="request-card-head">'
      + '<span class="eyebrow">Solicitud de acceso</span>'
      + '<h1>Contanos sobre tu operación.</h1>'
      + '<p>El creador de VigIA revisa cada solicitud y define el plan y los asientos iniciales. No se solicita tarjeta ni pago.</p>'
      + '</div>'
      + '<form class="request-form" data-form="access-request">'
      + '<div class="field-row">'
      + '<div class="field"><label for="req-company">Empresa</label><input class="input" id="req-company" name="company" placeholder="Nombre de la empresa" required></div>'
      + '<div class="field"><label for="req-contact">Contacto</label><input class="input" id="req-contact" name="contact" placeholder="Nombre y apellido" required></div>'
      + '</div>'
      + '<div class="field-row">'
      + '<div class="field"><label for="req-email">Email laboral</label><input class="input" id="req-email" name="email" type="email" placeholder="nombre@empresa.com" required></div>'
      + '<div class="field"><label for="req-phone">Teléfono</label><input class="input" id="req-phone" name="phone" placeholder="+54 11 5555-0000"></div>'
      + '</div>'
      + '<div class="field-row">'
      + '<div class="field"><label for="req-sector">Sector</label><select class="select" id="req-sector" name="sector">' + sectorOptions + '</select></div>'
      + '<div class="field"><label for="req-seats">Usuarios estimados</label><input class="input" id="req-seats" name="seats" type="number" min="1" value="5"></div>'
      + '</div>'
      + '<div class="field"><label for="req-plan">Plan de interés</label><select class="select" id="req-plan" name="planId">' + planOptions + '</select></div>'
      + '<div class="field"><label for="req-message">¿Qué querés monitorear?</label><textarea class="textarea" id="req-message" name="message" placeholder="Cámaras, sedes, horarios, skills de interés..."></textarea></div>'
      + '<div class="form-note">' + I('info', 14) + '<span>Al enviar, la solicitud aparece en el panel del creador como pendiente. En esta maqueta no se envía ningún email.</span></div>'
      + '<div class="inline-actions"><button class="btn btn-primary" type="submit">Enviar solicitud ' + I('arrow-right', 15) + '</button><a class="btn btn-ghost" href="#/login">Ya tengo acceso</a></div>'
      + '</form>'
      + '</div></main></div>';
  };
})();
