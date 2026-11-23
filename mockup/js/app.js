(function () {
  window.AUTEC = window.AUTEC || {};

  var U = AUTEC.utils;
  var C = AUTEC.components;
  var I = AUTEC.icon;
  var V = AUTEC.views;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function esc(value) {
    return U.escapeHtml(value);
  }

  function defaultFilters() {
    return {
      companies: { q: '', status: 'all', plan: 'all' },
      users: { q: '', role: 'all', status: 'all' },
      requests: { q: '', type: 'all', status: 'all' },
      audit: { q: '', type: 'all', company: 'all' },
      sessions: { q: '', company: 'all' },
      skills: { q: '', group: 'all', status: 'all' }
    };
  }

  function defaultSettings() {
    return {
      mfa: false,
      idleLogout: true,
      loginAlerts: true,
      requestAlerts: true,
      expiryAlerts: true,
      paymentAlerts: false,
      emailDigest: true
    };
  }

  AUTEC.store = clone(AUTEC.data);

  var state = {
    auth: null,
    sidebarOpen: false,
    impersonating: false,
    returnTo: null,
    modal: null,
    toast: null,
    demoOpen: false,
    accent: 'cyan',
    density: 'compact',
    loginTab: 'creator',
    loginCompanyId: 'cim',
    requestSubmitted: false,
    requestCompany: '',
    reidEnabled: true,
    monitorPaused: false,
    settings: defaultSettings(),
    filters: defaultFilters()
  };

  var toastTimer = null;
  var modalSeq = 0;
  var PALETTE = ['#F5A524', '#22D3EE', '#34D399', '#60A5FA', '#F97316', '#FB7185', '#94A3B8'];

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function isoDate(date) {
    var d = date || U.DEMO_TODAY;
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function addDaysISO(days) {
    var d = new Date(U.DEMO_TODAY.getTime() + Number(days || 0) * 86400000);
    return isoDate(d);
  }

  function timeLabel() {
    var now = new Date();
    return pad(now.getHours()) + ':' + pad(now.getMinutes());
  }

  function dateLabel() {
    var now = new Date();
    return now.getDate() + ' ' + U.MONTHS[now.getMonth()] + ' ' + now.getFullYear() + ' · ' + timeLabel();
  }

  function getPath() {
    return (location.hash || '#/').replace(/^#/, '') || '/';
  }

  function navigate(path) {
    var target = '#' + path;
    if (location.hash === target) {
      renderRoute();
      window.scrollTo(0, 0);
    } else {
      location.hash = target;
    }
  }

  function isPublicPath(path) {
    var current = path || getPath();
    return current === '/' || current === '/login' || current === '/solicitar-acceso';
  }

  function isAuthed() {
    return !!state.auth;
  }

  function companyById(id) {
    return AUTEC.store.companies.find(function (company) { return company.id === id; });
  }

  function planById(id) {
    return AUTEC.store.plans.find(function (plan) { return plan.id === id; });
  }

  function currentCompany() {
    var id = state.auth ? state.auth.companyId : null;
    return companyById(id) || AUTEC.store.companies[0];
  }

  function currentUser() {
    if (!state.auth) return { id: 'guest', name: 'Visitante', email: '—', role: 'operator' };
    if (state.auth.role === 'creator') return AUTEC.store.creator;
    var company = currentCompany();
    var user = AUTEC.store.users.find(function (item) {
      return item.companyId === company.id && item.role === state.auth.role && item.status === 'active';
    }) || AUTEC.store.users.find(function (item) {
      return item.companyId === company.id && item.role === state.auth.role;
    });
    if (user) return user;
    return { id: 'demo', name: U.roleLabel(state.auth.role), email: 'demo@vigia.local', role: state.auth.role };
  }

  function planFor(company) {
    var entity = company || currentCompany();
    return planById(entity.planId) || AUTEC.store.plans[0];
  }

  function homePath() {
    if (!state.auth) return '/';
    return state.auth.role === 'creator' ? '/admin' : '/app';
  }

  function pageTitle(path) {
    var match = path.match(/^\/admin\/empresas\/([^/]+)$/);
    if (match) {
      var company = companyById(match[1]);
      return company ? company.name : 'Empresa';
    }
    return {
      '/admin': 'Resumen',
      '/admin/empresas': 'Empresas',
      '/admin/planes': 'Planes',
      '/admin/skills': 'Skills',
      '/admin/solicitudes': 'Solicitudes',
      '/admin/sesiones': 'Sesiones',
      '/admin/auditoria': 'Auditoría',
      '/admin/ajustes': 'Ajustes',
      '/app': 'Resumen',
      '/app/monitoreo': 'Monitoreo',
      '/app/usuarios': 'Usuarios',
      '/app/skills': 'Skills',
      '/app/plan': 'Plan',
      '/app/ajustes': 'Ajustes'
    }[path] || 'VigIA';
  }

  function roleCan(role, path) {
    if (path.indexOf('/admin') === 0) return role === 'creator';
    if (path.indexOf('/app') === 0) {
      if (role === 'company_admin') return true;
      if (role === 'supervisor') return path === '/app' || path === '/app/monitoreo' || path === '/app/usuarios';
      if (role === 'operator') return path === '/app' || path === '/app/monitoreo';
      return false;
    }
    return false;
  }

  function resolveContent(path) {
    if (path === '/admin') return V.adminOverview();
    if (path === '/admin/empresas') return V.adminCompanies();
    var match = path.match(/^\/admin\/empresas\/([^/]+)$/);
    if (match) return V.adminCompanyDetail(match[1]);
    if (path === '/admin/planes') return V.adminPlans();
    if (path === '/admin/skills') return V.adminSkills();
    if (path === '/admin/solicitudes') return V.adminRequests();
    if (path === '/admin/sesiones') return V.adminSessions();
    if (path === '/admin/auditoria') return V.adminAudit();
    if (path === '/admin/ajustes') return V.adminSettings();
    if (path === '/app') return V.companyOverview();
    if (path === '/app/monitoreo') return V.companyMonitoring();
    if (path === '/app/usuarios') return V.companyUsers();
    if (path === '/app/skills') return V.companySkills();
    if (path === '/app/plan') return V.companyPlan();
    if (path === '/app/ajustes') return V.companySettings();
    return V.noAccess();
  }

  function captureFocus() {
    var el = document.activeElement;
    if (!el || el === document.body || !el.id) return null;
    var app = document.getElementById('app');
    if (!app || !app.contains(el)) return null;
    var info = { id: el.id };
    try {
      info.start = el.selectionStart;
      info.end = el.selectionEnd;
    } catch (error) {
      info.start = null;
      info.end = null;
    }
    return info;
  }

  function restoreFocus(info) {
    if (!info) return;
    var el = document.getElementById(info.id);
    if (!el) return;
    try {
      el.focus();
      if (info.start !== null && info.end !== null && typeof el.setSelectionRange === 'function') {
        el.setSelectionRange(info.start, info.end);
      }
    } catch (error) {
      /* algunos inputs no soportan selección */
    }
  }

  function renderModal() {
    var root = document.getElementById('modal-root');
    if (!root) return;
    var key = state.modal ? String(state.modal._key || '') : '';
    // No reconstruir un modal ya montado cuando la vista se refresca en
    // segundo plano: perderia el foco y los valores que el usuario escribio.
    if (key && root.getAttribute('data-modal-key') === key && root.querySelector('.modal')) return;
    root.innerHTML = C.modal();
    root.setAttribute('data-modal-key', key);
    document.body.classList.toggle('modal-open', !!state.modal);
  }

  function renderToast() {
    var root = document.getElementById('toast-root');
    if (root) root.innerHTML = C.toast();
  }

  function renderDemo() {
    var root = document.getElementById('demo-root');
    if (root) root.innerHTML = C.demoPanel();
  }

  function renderRoute(opts) {
    opts = opts || {};
    var path = getPath();
    var app = document.getElementById('app');
    if (!app) return;

    if (path !== '/solicitar-acceso' && state.requestSubmitted) {
      state.requestSubmitted = false;
      state.requestCompany = '';
    }

    var focus = opts.preserveFocus ? captureFocus() : null;
    var scroll = opts.preserveScroll ? window.scrollY : null;

    if (isPublicPath(path)) {
      if (path === '/login') app.innerHTML = V.login();
      else if (path === '/solicitar-acceso') app.innerHTML = V.requestAccess();
      else app.innerHTML = V.landing();
    } else if (!isAuthed()) {
      app.innerHTML = V.login();
      renderModal();
      renderToast();
      renderDemo();
      return;
    } else {
      var content = roleCan(state.auth.role, path) ? resolveContent(path) : V.noAccess();
      app.innerHTML = C.shell(content);
    }

    renderModal();
    renderToast();
    renderDemo();
    document.documentElement.setAttribute('data-accent', state.accent);
    document.documentElement.setAttribute('data-density', state.density);

    if (AUTEC.monitor) {
      AUTEC.monitor.attach();
      state.monitorPaused = AUTEC.monitor.isPaused();
    }

    if (AUTEC.epp && isAuthed() && !isPublicPath(path) && (!AUTEC.monitor || !AUTEC.monitor.isConnected())) {
      AUTEC.epp.attachDemoBadges();
    }

    var landing = app.querySelector('.landing');
    if (landing) {
      var enterLanding = function () {
        landing.classList.add('is-entering');
      };
      if (document.body.classList.contains('is-splashing')) {
        window.addEventListener('autec:splash-done', function onSplashDone() {
          window.removeEventListener('autec:splash-done', onSplashDone);
          window.requestAnimationFrame(enterLanding);
        });
      } else {
        window.requestAnimationFrame(enterLanding);
      }
    }

    if (focus) restoreFocus(focus);
    if (scroll !== null) window.scrollTo(0, scroll);
  }

  function toast(message, type) {
    state.toast = { message: message, type: type || 'info' };
    renderToast();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      state.toast = null;
      renderToast();
    }, 3400);
  }

  function openModal(config) {
    if (config) config._key = ++modalSeq;
    state.modal = config;
    renderModal();
    var root = document.getElementById('modal-root');
    var modal = root ? (root.querySelector('.modal') || root) : null;
    if (config && typeof config.onMount === 'function' && modal) {
      try {
        config.onMount(modal);
      } catch (error) {
        if (window.console && console.error) console.error('No se pudo inicializar el modal', error);
      }
    }
    setTimeout(function () {
      var focusRoot = document.getElementById('modal-root');
      if (!focusRoot) return;
      var first = focusRoot.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
      if (first) first.focus();
    }, 40);
  }

  function closeModal() {
    state.modal = null;
    renderModal();
  }

  function addAudit(action, target, companyId, companyName, actionType) {
    var actor = state.auth ? currentUser().name : 'Visitante';
    AUTEC.store.audit.unshift({
      id: U.uid('a'),
      date: dateLabel(),
      actor: actor,
      action: action,
      actionType: actionType || 'update',
      target: target,
      companyId: companyId || null,
      companyName: companyName || '—',
      ip: state.auth ? '127.0.0.1' : '—'
    });
  }

  function pickColor() {
    return PALETTE[AUTEC.store.companies.length % PALETTE.length];
  }

  function domainFromEmail(email) {
    var parts = String(email || '').split('@');
    return parts.length > 1 ? parts[1] : '';
  }

  function createCompany(data) {
    var plan = planById(data.planId) || AUTEC.store.plans[0];
    var base = U.slugify(data.name) || U.uid('company');
    var id = base;
    var counter = 2;
    while (companyById(id)) {
      id = base + '-' + counter;
      counter += 1;
    }
    var company = {
      id: id,
      name: data.name,
      short: U.initials(data.name),
      sector: data.sector || 'Sin definir',
      status: data.status || 'trial',
      planId: plan.id,
      seats: Number(data.seats) || plan.seats,
      usersCount: 0,
      expiresAt: data.expiresAt || addDaysISO(plan.durationDays || 14),
      createdAt: isoDate(U.DEMO_TODAY),
      contact: data.contact || '—',
      email: data.email || '—',
      phone: data.phone || '—',
      skills: plan.skills.slice(),
      lastActivity: 'Ahora',
      mrr: data.status === 'active' ? plan.price : 0,
      color: pickColor(),
      domain: domainFromEmail(data.email) || base + '.com',
      payments: []
    };
    AUTEC.store.companies.push(company);
    return company;
  }

  function loginAs(role, companyId) {
    if (role === 'creator') {
      state.auth = { role: 'creator', companyId: companyId || (state.auth && state.auth.companyId) || 'cim' };
      state.impersonating = false;
      state.demoOpen = false;
      navigate('/admin');
      return;
    }
    var id = companyId || (state.auth && state.auth.companyId) || 'cim';
    var company = companyById(id) || AUTEC.store.companies[0];
    state.auth = { role: role, companyId: company.id };
    state.impersonating = false;
    state.demoOpen = false;
    navigate('/app');
  }

  function resetDemo() {
    AUTEC.store = clone(AUTEC.data);
    state.filters = defaultFilters();
    state.settings = defaultSettings();
    state.reidEnabled = true;
    state.monitorPaused = false;
    state.requestSubmitted = false;
    state.requestCompany = '';
    state.modal = null;
    state.toast = null;
    if (state.auth && state.auth.role !== 'creator' && !companyById(state.auth.companyId)) {
      state.auth.companyId = AUTEC.store.companies[0].id;
    }
    toast('Datos de demo restablecidos', 'success');
    renderRoute({ preserveScroll: true });
  }

  function optionList(items, selected) {
    return items.map(function (item) {
      return '<option value="' + item.value + '"' + (String(selected) === String(item.value) ? ' selected' : '') + '>' + esc(item.label) + '</option>';
    }).join('');
  }

  function planOptions() {
    return AUTEC.store.plans.map(function (plan) {
      return { value: plan.id, label: plan.name + ' · ' + plan.seats + ' usuarios' };
    });
  }

  function statusOptions() {
    return [
      { value: 'active', label: 'Activa' },
      { value: 'trial', label: 'Prueba' },
      { value: 'expired', label: 'Vencida' },
      { value: 'suspended', label: 'Suspendida' }
    ];
  }

  function roleOptions() {
    return [
      { value: 'company_admin', label: 'Admin empresa' },
      { value: 'supervisor', label: 'Supervisor' },
      { value: 'operator', label: 'Operador' }
    ];
  }

  function userStatusOptions() {
    return [
      { value: 'active', label: 'Activo' },
      { value: 'inactive', label: 'Inactivo' }
    ];
  }

  function sectorOptions() {
    var sectors = AUTEC.store.industries.map(function (industry) { return industry.name; });
    sectors.push('Drones');
    sectors.push('Otro');
    return sectors.map(function (sector) {
      return { value: sector, label: sector };
    });
  }

  function colorOptions() {
    return [
      { value: '#F5A524', label: 'Ámbar' },
      { value: '#22D3EE', label: 'Cian' },
      { value: '#34D399', label: 'Verde' },
      { value: '#60A5FA', label: 'Azul' },
      { value: '#F97316', label: 'Naranja' },
      { value: '#FB7185', label: 'Rosa' },
      { value: '#94A3B8', label: 'Gris' }
    ];
  }

  function field(label, name, value, opts) {
    opts = opts || {};
    return '<div class="field"><label for="modal-' + name + '">' + label + '</label><input class="input" id="modal-' + name + '" name="' + name + '" type="' + (opts.type || 'text') + '" value="' + esc(value) + '" ' + (opts.attrs || '') + '></div>';
  }

  function selectField(label, name, options, selected, opts) {
    opts = opts || {};
    return '<div class="field"><label for="modal-' + name + '">' + label + '</label><select class="select" id="modal-' + name + '" name="' + name + '" ' + (opts.attrs || '') + '>' + optionList(options, selected) + '</select></div>';
  }

  function textareaField(label, name, value, opts) {
    opts = opts || {};
    return '<div class="field"><label for="modal-' + name + '">' + label + '</label><textarea class="textarea" id="modal-' + name + '" name="' + name + '" ' + (opts.attrs || '') + '>' + esc(value) + '</textarea></div>';
  }

  function hidden(name, value) {
    return '<input type="hidden" name="' + name + '" value="' + esc(value) + '">';
  }

  function fieldRow() {
    return '<div class="field-row">' + Array.prototype.slice.call(arguments).join('') + '</div>';
  }

  function skillChecks(selected) {
    var available = AUTEC.store.skills.filter(function (skill) { return skill.status === 'available'; });
    return '<div class="field"><span class="field-label">Skills incluidas</span><div class="check-grid">'
      + available.map(function (skill) {
        return '<label class="check-item"><input type="checkbox" name="skills" value="' + skill.id + '"' + (selected.indexOf(skill.id) !== -1 ? ' checked' : '') + '><span>' + esc(skill.name) + '</span></label>';
      }).join('')
      + '</div></div>';
  }

  function openNewCompany() {
    openModal({
      title: 'Nueva empresa',
      subtitle: 'Alta manual con plan y asientos iniciales',
      wide: true,
      form: 'new-company',
      submitLabel: 'Crear empresa',
      body: '<div class="form-grid">'
        + field('Nombre de la empresa', 'name', '', { attrs: 'required' })
        + fieldRow(field('Sector', 'sector', 'Seguridad privada'), field('Contacto', 'contact', ''))
        + fieldRow(field('Email', 'email', '', { type: 'email' }), field('Teléfono', 'phone', ''))
        + fieldRow(selectField('Plan', 'planId', planOptions(), 'pro'), field('Asientos', 'seats', '15', { type: 'number', attrs: 'min="1"' }))
        + fieldRow(selectField('Estado', 'status', statusOptions(), 'trial'), field('Vencimiento', 'expiresAt', addDaysISO(30), { type: 'date' }))
        + '<div class="form-note">' + I('info', 14) + '<span>La empresa se crea sin usuarios. Después podés invitar al administrador desde el detalle.</span></div>'
        + '</div>'
    });
  }

  function openEditCompany(id) {
    var company = companyById(id);
    if (!company) return;
    openModal({
      title: 'Editar empresa',
      subtitle: company.name,
      wide: true,
      form: 'edit-company',
      submitLabel: 'Guardar cambios',
      body: hidden('id', company.id) + '<div class="form-grid">'
        + field('Nombre de la empresa', 'name', company.name, { attrs: 'required' })
        + fieldRow(field('Sector', 'sector', company.sector), field('Contacto', 'contact', company.contact))
        + fieldRow(field('Email', 'email', company.email, { type: 'email' }), field('Teléfono', 'phone', company.phone))
        + fieldRow(selectField('Plan', 'planId', planOptions(), company.planId), field('Asientos', 'seats', company.seats, { type: 'number', attrs: 'min="1"' }))
        + fieldRow(selectField('Estado', 'status', statusOptions(), company.status), field('Vencimiento', 'expiresAt', company.expiresAt, { type: 'date' }))
        + '<div class="form-note">' + I('info', 14) + '<span>Cambiar de plan no elimina usuarios. Los asientos se pueden ajustar por fuera del plan.</span></div>'
        + '</div>'
    });
  }

  function openCompanyStatus(id) {
    var company = companyById(id);
    if (!company) return;
    var suspending = company.status !== 'suspended';
    openModal({
      title: suspending ? 'Suspender empresa' : 'Reactivar empresa',
      subtitle: company.name,
      form: 'company-status',
      submitLabel: suspending ? 'Suspender' : 'Reactivar',
      danger: suspending,
      body: hidden('id', company.id)
        + '<p class="muted small">' + (suspending
          ? 'La empresa dejará de aparecer como activa y sus usuarios no podrán iniciar sesión. Los datos se conservan.'
          : 'La empresa volverá al estado activo. Si el plan estaba vencido, se extenderá 30 días en esta maqueta.') + '</p>'
    });
  }

  function openNewPlan() {
    openModal({
      title: 'Nuevo plan',
      subtitle: 'Definí límites y skills incluidas',
      wide: true,
      form: 'plan',
      submitLabel: 'Crear plan',
      body: hidden('id', '') + '<div class="form-grid">'
        + fieldRow(field('Nombre', 'name', '', { attrs: 'required' }), field('Precio mensual', 'price', '0', { type: 'number', attrs: 'min="0"' }))
        + textareaField('Descripción', 'description', '', { attrs: 'rows="3"' })
        + fieldRow(field('Asientos', 'seats', '5', { type: 'number', attrs: 'min="1"' }), field('Duración (días)', 'durationDays', '30', { type: 'number', attrs: 'min="1"' }))
        + fieldRow(field('Período', 'period', 'mes'), field('Facturación', 'billing', 'mensual'))
        + selectField('Color', 'color', colorOptions(), '#F5A524')
        + skillChecks(['personas'])
        + '</div>'
    });
  }

  function openEditPlan(id) {
    var plan = planById(id);
    if (!plan) return;
    openModal({
      title: 'Editar plan',
      subtitle: plan.name,
      wide: true,
      form: 'plan',
      submitLabel: 'Guardar cambios',
      body: hidden('id', plan.id) + '<div class="form-grid">'
        + fieldRow(field('Nombre', 'name', plan.name, { attrs: 'required' }), field('Precio mensual', 'price', plan.price, { type: 'number', attrs: 'min="0"' }))
        + textareaField('Descripción', 'description', plan.description, { attrs: 'rows="3"' })
        + fieldRow(field('Asientos', 'seats', plan.seats, { type: 'number', attrs: 'min="1"' }), field('Duración (días)', 'durationDays', plan.durationDays, { type: 'number', attrs: 'min="1"' }))
        + fieldRow(field('Período', 'period', plan.period), field('Facturación', 'billing', plan.billing))
        + selectField('Color', 'color', colorOptions(), plan.color)
        + skillChecks(plan.skills)
        + '</div>'
    });
  }

  function openNewUser(companyId) {
    var company = companyById(companyId) || currentCompany();
    openModal({
      title: 'Nuevo usuario',
      subtitle: company.name + ' · ' + company.usersCount + ' de ' + company.seats + ' asientos',
      form: 'user',
      submitLabel: 'Crear usuario',
      body: hidden('id', '') + hidden('companyId', company.id) + '<div class="form-grid">'
        + field('Nombre y apellido', 'name', '', { attrs: 'required' })
        + field('Email', 'email', '', { type: 'email', attrs: 'required' })
        + fieldRow(selectField('Rol', 'role', roleOptions(), 'operator'), selectField('Estado', 'status', userStatusOptions(), 'active'))
        + '<div class="form-note">' + I('info', 14) + '<span>Quedan ' + Math.max(0, company.seats - company.usersCount) + ' asientos disponibles. Si el límite está lleno, la creación se bloquea.</span></div>'
        + '</div>'
    });
  }

  function openEditUser(id) {
    var user = AUTEC.store.users.find(function (item) { return item.id === id; });
    if (!user) return;
    var company = companyById(user.companyId);
    openModal({
      title: 'Editar usuario',
      subtitle: company ? company.name : '',
      form: 'user',
      submitLabel: 'Guardar cambios',
      body: hidden('id', user.id) + hidden('companyId', user.companyId) + '<div class="form-grid">'
        + field('Nombre y apellido', 'name', user.name, { attrs: 'required' })
        + field('Email', 'email', user.email, { type: 'email', attrs: 'required' })
        + fieldRow(selectField('Rol', 'role', roleOptions(), user.role), selectField('Estado', 'status', userStatusOptions(), user.status))
        + '</div>'
    });
  }

  function openResetPassword(id) {
    var user = AUTEC.store.users.find(function (item) { return item.id === id; });
    if (!user) return;
    openModal({
      title: 'Restablecer contraseña',
      subtitle: user.name,
      form: 'reset-password',
      submitLabel: 'Generar enlace',
      body: hidden('id', user.id) + '<p class="muted small">Se generará un enlace de restablecimiento para <strong>' + esc(user.email) + '</strong>. En esta maqueta no se envía ningún correo.</p>'
    });
  }

  function openUserStatus(id) {
    var user = AUTEC.store.users.find(function (item) { return item.id === id; });
    if (!user) return;
    var deactivating = user.status === 'active';
    openModal({
      title: deactivating ? 'Desactivar usuario' : 'Activar usuario',
      subtitle: user.name,
      form: 'user-status',
      submitLabel: deactivating ? 'Desactivar' : 'Activar',
      danger: deactivating,
      body: hidden('id', user.id) + '<p class="muted small">' + (deactivating
        ? 'El usuario no podrá iniciar sesión, pero conservará su asiento asignado y su historial.'
        : 'El usuario podrá volver a iniciar sesión con su rol actual.') + '</p>'
    });
  }

  function openApproveRequest(id) {
    var request = AUTEC.store.requests.find(function (item) { return item.id === id; });
    if (!request) return;
    var company = request.companyId ? companyById(request.companyId) : null;

    if (request.type === 'company') {
      openModal({
        title: 'Aprobar nueva empresa',
        subtitle: request.companyName,
        wide: true,
        form: 'approve-request',
        submitLabel: 'Crear empresa y aprobar',
        body: hidden('id', request.id) + hidden('type', request.type) + '<div class="form-grid">'
          + field('Nombre de la empresa', 'name', request.companyName, { attrs: 'required' })
          + fieldRow(selectField('Plan', 'planId', planOptions(), request.planId || 'pro'), field('Asientos', 'seats', String(request.seats || 5), { type: 'number', attrs: 'min="1"' }))
          + fieldRow(field('Contacto', 'contact', request.contact || ''), field('Email', 'email', request.email || '', { type: 'email' }))
          + fieldRow(field('Teléfono', 'phone', request.phone || ''), selectField('Sector', 'sector', sectorOptions(), request.sector || 'Seguridad privada'))
          + '<div class="form-note">' + I('info', 14) + '<span>Se crea la empresa en estado de prueba, sin usuarios. Después podés invitar al administrador.</span></div>'
          + '</div>'
      });
      return;
    }

    if (request.type === 'skill') {
      openModal({
        title: 'Aprobar solicitud de skill',
        subtitle: request.companyName,
        form: 'approve-request',
        submitLabel: 'Aprobar solicitud',
        body: hidden('id', request.id) + hidden('type', request.type)
          + '<p class="muted small">' + esc(request.detail) + '</p>'
          + '<div class="form-note">' + I('info', 14) + '<span>Si la skill ya está disponible y el plan la incluye, se activa para la empresa. Si está en entrenamiento, la solicitud queda aprobada y se avisará al liberarse.</span></div>'
      });
      return;
    }

    if (request.type === 'seats') {
      openModal({
        title: 'Aprobar ampliación de asientos',
        subtitle: request.companyName,
        form: 'approve-request',
        submitLabel: 'Ampliar asientos',
        body: hidden('id', request.id) + hidden('type', request.type) + '<div class="form-grid">'
          + '<p class="muted small">' + esc(request.detail) + '</p>'
          + field('Asientos adicionales', 'additional', '2', { type: 'number', attrs: 'min="1"' })
          + '</div>'
      });
      return;
    }

    var currentPlanId = company ? company.planId : 'pro';
    openModal({
      title: request.type === 'renewal' ? 'Aprobar renovación' : 'Aprobar cambio de plan',
      subtitle: request.companyName,
      form: 'approve-request',
      submitLabel: 'Aprobar y actualizar',
      body: hidden('id', request.id) + hidden('type', request.type) + '<div class="form-grid">'
        + '<p class="muted small">' + esc(request.detail) + '</p>'
        + fieldRow(selectField('Plan', 'planId', planOptions(), currentPlanId), request.type === 'renewal' ? field('Meses', 'months', '12', { type: 'number', attrs: 'min="1"' }) : field('Asientos', 'seats', company ? String(company.seats) : '15', { type: 'number', attrs: 'min="1"' }))
        + '<div class="form-note">' + I('info', 14) + '<span>Se registra un pago manual y se actualiza el vencimiento. En la maqueta no se procesa dinero real.</span></div>'
        + '</div>'
    });
  }

  function openRejectRequest(id) {
    var request = AUTEC.store.requests.find(function (item) { return item.id === id; });
    if (!request) return;
    openModal({
      title: 'Rechazar solicitud',
      subtitle: request.companyName,
      form: 'reject-request',
      submitLabel: 'Rechazar solicitud',
      danger: true,
      body: hidden('id', request.id) + '<p class="muted small">' + esc(request.detail) + '</p>'
        + textareaField('Motivo (opcional)', 'reason', '', { attrs: 'rows="3" placeholder="Contale a la empresa por qué se rechaza..."' })
    });
  }

  function openRequestSkill(companyId, skillId) {
    var company = companyById(companyId) || currentCompany();
    var skill = AUTEC.store.skills.find(function (item) { return item.id === skillId; }) || AUTEC.store.skills[0];
    openModal({
      title: 'Solicitar skill',
      subtitle: company.name,
      form: 'request-skill',
      submitLabel: 'Enviar solicitud',
      body: hidden('companyId', company.id) + hidden('skillId', skill.id) + '<div class="form-grid">'
        + '<div class="form-note">' + I('layers', 14) + '<span>' + esc(skill.name) + ' · ' + U.skillStatusLabel(skill.status) + '</span></div>'
        + textareaField('¿Qué necesitás medir?', 'message', '', { attrs: 'rows="4" placeholder="Contanos el caso de uso, la sede y el horario..."' })
        + '</div>'
    });
  }

  function openRequestSeats(companyId) {
    var company = companyById(companyId) || currentCompany();
    openModal({
      title: 'Solicitar más asientos',
      subtitle: company.name + ' · ' + company.usersCount + ' de ' + company.seats + ' usados',
      form: 'request-seats',
      submitLabel: 'Enviar solicitud',
      body: hidden('companyId', company.id) + '<div class="form-grid">'
        + field('Asientos adicionales', 'additional', '2', { type: 'number', attrs: 'min="1"' })
        + textareaField('Motivo (opcional)', 'message', '', { attrs: 'rows="3" placeholder="Nuevo turno, más supervisores..."' })
        + '</div>'
    });
  }

  function openRequestPlan(companyId, planId) {
    var company = companyById(companyId) || currentCompany();
    var targetPlanId = planId || company.planId;
    if (targetPlanId === company.planId) {
      var planIndex = AUTEC.store.plans.findIndex(function (plan) { return plan.id === company.planId; });
      var nextPlan = AUTEC.store.plans[planIndex + 1] || AUTEC.store.plans[planIndex - 1] || AUTEC.store.plans[0];
      targetPlanId = nextPlan.id;
    }
    openModal({
      title: 'Solicitar cambio de plan',
      subtitle: company.name + ' · plan actual ' + planFor(company).name,
      form: 'request-plan',
      submitLabel: 'Enviar solicitud',
      body: hidden('companyId', company.id) + '<div class="form-grid">'
        + selectField('Plan de interés', 'planId', planOptions(), targetPlanId)
        + textareaField('Comentario (opcional)', 'message', '', { attrs: 'rows="3" placeholder="Contanos por qué necesitás el cambio..."' })
        + '<div class="form-note">' + I('info', 14) + '<span>El creador revisa la solicitud y confirma el nuevo plan y los asientos.</span></div>'
        + '</div>'
    });
  }

  function openCloseSession(id) {
    var session = AUTEC.store.sessions.find(function (item) { return item.id === id; });
    if (!session) return;
    openModal({
      title: 'Cerrar sesión',
      subtitle: session.userName,
      form: 'close-session',
      submitLabel: 'Cerrar sesión',
      danger: true,
      body: hidden('id', session.id) + '<p class="muted small">Se cerrará la sesión de <strong>' + esc(session.userName) + '</strong> en <strong>' + esc(session.companyName) + '</strong>. En la maqueta la sesión desaparece del listado.</p>'
    });
  }

  function openNotifications() {
    openModal({
      title: 'Notificaciones',
      subtitle: 'Actividad reciente de la plataforma',
      body: C.notificationsModalBody(),
      foot: '<button class="btn btn-ghost" data-action="close-modal">Cerrar</button><button class="btn btn-primary" data-action="mark-notifications-read">Marcar como leídas</button>'
    });
  }

  function openAccount() {
    var user = currentUser();
    var company = currentCompany();
    var role = state.auth.role;
    openModal({
      title: 'Tu cuenta',
      subtitle: 'Sesión de demostración',
      noFoot: true,
      body: '<div class="account-card"><div class="account-head">' + C.avatar(user.name) + '<div><strong>' + esc(user.name) + '</strong><span class="muted small">' + esc(user.email || 'demo@vigia.local') + '</span></div></div>'
        + '<div class="inline-actions" style="margin-top:12px">' + C.roleBadge(role) + (role === 'creator' ? C.badge('Administración global', 'accent') : C.badge(company.name, 'neutral')) + '</div></div>'
        + '<div class="status-list">'
        + '<div class="status-row"><span class="status-icon">' + I('user', 16) + '</span><div><strong>Perfil</strong><span class="muted small">' + U.roleLabel(role) + '</span></div></div>'
        + '<div class="status-row"><span class="status-icon">' + I('building', 16) + '</span><div><strong>Contexto</strong><span class="muted small">' + (role === 'creator' ? 'Todas las empresas' : esc(company.name)) + '</span></div></div>'
        + '<div class="status-row"><span class="status-icon">' + I('clock', 16) + '</span><div><strong>Sesión</strong><span class="muted small">Iniciada en esta pestaña · demo</span></div></div>'
        + '</div>'
        + '<div class="inline-actions"><button class="btn btn-ghost" data-action="open-demo">Cambiar de rol</button><button class="btn btn-danger" data-action="logout">Cerrar sesión</button></div>'
    });
  }

  function openCameraConfig() {
    var config = AUTEC.monitor ? AUTEC.monitor.config() : {
      host: '', port: '4747', resolution: '1280x720', cameraName: 'Entrada principal', lens: 'unknown'
    };
    var options = ['1280x720', '1920x1080', '640x480'].map(function (value) {
      return '<option value="' + value + '"' + (config.resolution === value ? ' selected' : '') + '>' + value.replace('x', ' × ') + '</option>';
    }).join('');
    var lensOptions = [
      { id: 'unknown', label: 'Sin especificar' },
      { id: 'back', label: 'Trasera' },
      { id: 'front', label: 'Frontal' },
      { id: 'external', label: 'Externa / USB' }
    ].map(function (item) {
      return '<option value="' + item.id + '"' + ((config.lens || 'unknown') === item.id ? ' selected' : '') + '>' + item.label + '</option>';
    }).join('');

    openModal({
      title: 'Conectar cámara',
      subtitle: 'DroidCam por red local',
      form: 'camera-config',
      submitLabel: 'Guardar y conectar',
      body: '<div class="form-grid">'
        + '<div class="field"><label for="config-camera-name">Nombre de la cámara</label><input class="input" id="config-camera-name" name="cameraName" value="' + esc(config.cameraName) + '" autocomplete="off"></div>'
        + '<div class="field-row"><div class="field"><label for="config-camera-host">IP o URL de DroidCam</label><input class="input" id="config-camera-host" name="host" value="' + esc(config.host) + '" placeholder="192.168.1.42" autocomplete="off"></div><div class="field"><label for="config-camera-port">Puerto</label><input class="input" id="config-camera-port" name="port" value="' + esc(config.port) + '" placeholder="4747" autocomplete="off"></div></div>'
        + '<div class="field-row"><div class="field"><label for="config-camera-resolution">Resolución</label><select class="select" id="config-camera-resolution" name="resolution">' + options + '</select></div><div class="field"><label for="config-camera-lens">Lente</label><select class="select" id="config-camera-lens" name="lens">' + lensOptions + '</select></div></div>'
        + '<div class="field"><label>Estado</label><div class="camera-state">' + (monitorConnected() ? C.badge('Conectada', 'success', { dot: true }) : C.badge('Sin conexión', 'neutral', { dot: true })) + '</div></div>'
        + '<div class="form-note">' + I('info', 14) + '<span>La IP y el puerto se muestran en la app de DroidCam del teléfono. El cliente de escritorio de DroidCam debe estar cerrado para liberar la cámara. El lente es informativo: DroidCam transmite el que esté activo en el teléfono.</span></div>'
        + '<div class="inline-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="camera-swap-help">' + I('help', 14) + ' ¿Cómo cambiar de lente?</button><button type="button" class="btn btn-ghost btn-sm" data-action="open-camera-manager">' + I('camera', 14) + ' Gestionar cámaras</button></div>'
        + '</div>'
    });
  }

  function openEppConfig() {
    if (!AUTEC.epp) return;
    var company = currentCompany();
    var config = AUTEC.epp.config(company.id);
    var profiles = AUTEC.epp.profiles();
    var profileOptions = profiles.map(function (profile) {
      return '<option value="' + profile.id + '"' + (config.profile === profile.id ? ' selected' : '') + '>'
        + esc(profile.name) + ' — ' + esc(profile.description) + '</option>';
    }).join('');

    openModal({
      title: 'Configurar EPP',
      subtitle: company.name + ' · regla de cumplimiento por empresa',
      form: 'epp-config',
      submitLabel: 'Guardar regla',
      body: '<div class="form-grid">'
        + '<div class="field"><label for="epp-profile">Perfil de operación</label><select class="select" id="epp-profile" name="profile">' + profileOptions + '</select></div>'
        + '<div class="field"><label>EPP requerido</label><div class="epp-check-row">'
        + '<label class="check-item"><input type="checkbox" name="helmet"' + (config.required.helmet ? ' checked' : '') + '> Casco</label>'
        + '<label class="check-item"><input type="checkbox" name="vest"' + (config.required.vest ? ' checked' : '') + '> Chaleco</label>'
        + '</div><span class="muted small">Elegí al menos un elemento. La detección puede informar ambos, pero la alerta solo evalúa lo exigido.</span></div>'
        + '<div class="field-row">'
        + '<div class="field"><label for="epp-grace">Gracia antes de alertar (s)</label><input class="input" id="epp-grace" name="graceSeconds" type="number" min="1" max="60" value="' + config.graceSeconds + '"></div>'
        + '<div class="field"><label for="epp-cooldown">Enfriamiento entre alertas (s)</label><input class="input" id="epp-cooldown" name="cooldownSeconds" type="number" min="10" max="600" value="' + config.cooldownSeconds + '"></div>'
        + '</div>'
        + '<div class="field"><label>Opciones de la demo</label><div class="epp-check-row">'
        + '<label class="check-item"><input type="checkbox" name="alertSound"' + (config.alertSound ? ' checked' : '') + '> Sonido de alerta</label>'
        + '<label class="check-item"><input type="checkbox" name="evidence"' + (config.evidence ? ' checked' : '') + '> Guardar evidencia</label>'
        + '<label class="check-item"><input type="checkbox" name="showBoxes"' + (config.showBoxes ? ' checked' : '') + '> Mostrar sub-cajas</label>'
        + '</div></div>'
        + '<div class="form-note">' + I('info', 14) + '<span>La regla se guarda en este navegador por empresa. CIM puede alternar entre sitio industrial (casco + chaleco) y sede corporativa (solo chaleco). Sin modelo EPP instalado, la vista usa simulación marcada y no representa detección real.</span></div>'
        + '</div>'
    });
  }

  function monitorConnected() {
    return !!(AUTEC.monitor && AUTEC.monitor.isConnected());
  }

  function openFallsConfig() {
    if (!AUTEC.falls) return;
    var company = currentCompany();
    var config = AUTEC.falls.config(company.id);
    var options = AUTEC.falls.sensitivities().map(function (item) {
      return '<option value="' + item.id + '"' + (config.sensitivity === item.id ? ' selected' : '') + '>'
        + esc(item.name) + ' — ' + esc(item.description) + '</option>';
    }).join('');

    openModal({
      title: 'Configurar caídas',
      subtitle: company.name + ' · heurística local de caja',
      form: 'falls-config',
      submitLabel: 'Guardar regla',
      body: '<div class="form-grid">'
        + '<div class="field"><label for="falls-sensitivity">Sensibilidad</label><select class="select" id="falls-sensitivity" name="sensitivity">' + options + '</select></div>'
        + '<div class="field-row">'
        + '<div class="field"><label for="falls-grace">Gracia antes de alertar (s)</label><input class="input" id="falls-grace" name="graceSeconds" type="number" min="1" max="30" value="' + config.graceSeconds + '"></div>'
        + '<div class="field"><label for="falls-cooldown">Enfriamiento entre alertas (s)</label><input class="input" id="falls-cooldown" name="cooldownSeconds" type="number" min="10" max="600" value="' + config.cooldownSeconds + '"></div>'
        + '</div>'
        + '<div class="field"><label>Opciones</label><div class="epp-check-row">'
        + '<label class="check-item"><input type="checkbox" name="alertSound"' + (config.alertSound ? ' checked' : '') + '> Sonido de alerta</label>'
        + '<label class="check-item"><input type="checkbox" name="evidence"' + (config.evidence ? ' checked' : '') + '> Guardar evidencia</label>'
        + '<label class="check-item"><input type="checkbox" name="showBoxes"' + (config.showBoxes ? ' checked' : '') + '> Resaltar cajas en riesgo</label>'
        + '</div></div>'
        + '<div class="form-note">' + I('info', 14) + '<span>Sin modelo de pose: se evalúa la relación ancho/alto de la caja de persona. Cuanto más baja la sensibilidad, más horizontal debe estar la caja para generar una alerta. Todo el procesamiento queda en este equipo.</span></div>'
        + '</div>'
    });
  }

  function handleAction(el) {
    var action = el.getAttribute('data-action');
    var companyId = el.getAttribute('data-company');
    var company;
    var skill;

    switch (action) {
      case 'scroll-to': {
        var target = document.getElementById(el.getAttribute('data-target'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'toggle-sidebar':
        state.sidebarOpen = !state.sidebarOpen;
        renderRoute({ preserveScroll: true });
        break;
      case 'logout':
        closeModal();
        state.auth = null;
        state.impersonating = false;
        state.sidebarOpen = false;
        state.demoOpen = false;
        navigate('/');
        break;
      case 'open-notifications':
        openNotifications();
        break;
      case 'open-account':
        openAccount();
        break;
      case 'demo-toggle':
        state.demoOpen = !state.demoOpen;
        renderDemo();
        break;
      case 'demo-role': {
        var role = el.getAttribute('data-role');
        var currentId = state.auth && companyById(state.auth.companyId) ? state.auth.companyId : 'cim';
        state.auth = { role: role, companyId: currentId };
        state.impersonating = false;
        state.demoOpen = false;
        navigate(homePath());
        break;
      }
      case 'demo-accent':
        state.accent = el.getAttribute('data-accent');
        renderRoute({ preserveScroll: true });
        break;
      case 'demo-density':
        state.density = el.getAttribute('data-density');
        renderRoute({ preserveScroll: true });
        break;
      case 'demo-reset':
        resetDemo();
        break;
      case 'back-to-admin':
        state.impersonating = false;
        state.auth = { role: 'creator', companyId: state.auth.companyId };
        var returnTo = state.returnTo || '/admin';
        state.returnTo = null;
        navigate(returnTo);
        break;
      case 'login-tab':
        state.loginTab = el.getAttribute('data-tab');
        renderRoute({ preserveScroll: true });
        break;
      case 'quick-login': {
        var quickRole = el.getAttribute('data-role');
        loginAs(quickRole, quickRole === 'creator' ? null : state.loginCompanyId);
        break;
      }
      case 'open-new-company':
        openNewCompany();
        break;
      case 'open-edit-company':
        openEditCompany(companyId);
        break;
      case 'open-company-status':
        openCompanyStatus(companyId);
        break;
      case 'open-new-plan':
        openNewPlan();
        break;
      case 'open-edit-plan':
        openEditPlan(el.getAttribute('data-plan'));
        break;
      case 'open-new-user':
        openNewUser(companyId);
        break;
      case 'open-edit-user':
        openEditUser(el.getAttribute('data-user'));
        break;
      case 'open-reset-password':
        openResetPassword(el.getAttribute('data-user'));
        break;
      case 'open-user-status':
        openUserStatus(el.getAttribute('data-user'));
        break;
      case 'open-approve-request':
        openApproveRequest(el.getAttribute('data-request'));
        break;
      case 'open-reject-request':
        openRejectRequest(el.getAttribute('data-request'));
        break;
      case 'open-request-skill':
        openRequestSkill(companyId, el.getAttribute('data-skill'));
        break;
      case 'open-request-seats':
        openRequestSeats(companyId);
        break;
      case 'open-request-plan':
        openRequestPlan(companyId, el.getAttribute('data-plan'));
        break;
      case 'open-close-session':
        openCloseSession(el.getAttribute('data-session'));
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'dismiss-toast':
        state.toast = null;
        renderToast();
        break;
      case 'toggle-skill-global':
        skill = AUTEC.store.skills.find(function (item) { return item.id === el.getAttribute('data-skill'); });
        if (skill) {
          skill.globalActive = !skill.globalActive;
          addAudit('Actualizó skill global', skill.name, null, null, 'update');
          toast(skill.name + (skill.globalActive ? ' activada globalmente' : ' desactivada globalmente'), 'success');
          renderRoute({ preserveScroll: true });
        }
        break;
      case 'toggle-skill':
        company = companyById(companyId);
        skill = AUTEC.store.skills.find(function (item) { return item.id === el.getAttribute('data-skill'); });
        if (company && skill) {
          var index = company.skills.indexOf(skill.id);
          if (index === -1) {
            company.skills.push(skill.id);
            if (skill.id === 'reid' && company.skills.indexOf('personas') === -1) company.skills.push('personas');
          } else {
            company.skills.splice(index, 1);
            if (skill.id === 'personas') {
              company.skills = company.skills.filter(function (id) { return id !== 'reid'; });
            }
          }
          company.skills.sort(function (a, b) {
            return AUTEC.store.skills.findIndex(function (item) { return item.id === a; })
              - AUTEC.store.skills.findIndex(function (item) { return item.id === b; });
          });
          addAudit(index === -1 ? 'Activó skill' : 'Desactivó skill', skill.name + ' · ' + company.name, company.id, company.name, 'update');
          toast(skill.name + (index === -1 ? ' activada' : ' desactivada') + ' para ' + company.name, 'success');
          renderRoute({ preserveScroll: true });
        }
        break;
      case 'toggle-reid':
        state.reidEnabled = !state.reidEnabled;
        toast('ReID ' + (state.reidEnabled ? 'activado' : 'desactivado'), 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'toggle-monitor':
        if (AUTEC.monitor && AUTEC.monitor.isConnected()) {
          AUTEC.monitor.togglePause();
          state.monitorPaused = AUTEC.monitor.isPaused();
        } else {
          state.monitorPaused = !state.monitorPaused;
        }
        renderRoute({ preserveScroll: true });
        break;
      case 'monitor-connect':
        if (!AUTEC.monitor) break;
        if (!AUTEC.monitor.hasHost()) {
          toast('Configurá la IP de DroidCam para conectar', 'warning');
          openCameraConfig();
          break;
        }
        AUTEC.monitor.connect();
        renderRoute({ preserveScroll: true });
        break;
      case 'monitor-disconnect':
        if (!AUTEC.monitor) break;
        AUTEC.monitor.disconnect();
        toast('Cámara desconectada', 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'open-camera-config':
        openCameraConfig();
        break;
      case 'open-camera-manager':
        if (AUTEC.cameras) AUTEC.cameras.openManager();
        break;
      case 'open-camera-form':
        if (AUTEC.cameras) AUTEC.cameras.openForm(el.getAttribute('data-camera'));
        break;
      case 'activate-camera':
        if (AUTEC.cameras) AUTEC.cameras.activate(el.getAttribute('data-camera'));
        break;
      case 'remove-camera':
        if (AUTEC.cameras) AUTEC.cameras.remove(el.getAttribute('data-camera'));
        break;
      case 'confirm-remove-camera':
        if (AUTEC.cameras) AUTEC.cameras.confirmRemove(el.getAttribute('data-camera'));
        break;
      case 'probe-camera':
        if (AUTEC.cameras) AUTEC.cameras.probe(el.getAttribute('data-camera'));
        break;
      case 'apply-camera-lens':
        if (AUTEC.cameras) AUTEC.cameras.applyLens(el.getAttribute('data-camera'));
        break;
      case 'camera-swap-help':
        if (AUTEC.cameras) AUTEC.cameras.openLensHelp();
        break;
      case 'open-zone-config':
        if (AUTEC.zones) AUTEC.zones.openEditor();
        break;
      case 'toggle-zones':
        if (!AUTEC.zones) break;
        AUTEC.zones.setEnabled(!AUTEC.zones.config().enabled);
        toast('Zonas ' + (AUTEC.zones.config().enabled ? 'activadas' : 'desactivadas'), 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'toggle-merodeo':
        if (!AUTEC.zones) break;
        AUTEC.zones.setMerodeoEnabled(!AUTEC.zones.config().merodeoEnabled);
        toast('Merodeo ' + (AUTEC.zones.config().merodeoEnabled ? 'activado' : 'desactivado'), 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'toggle-alert-sound':
        if (!AUTEC.monitor || !AUTEC.monitor.toggleAlertSound) break;
        toast('Sonido de alertas ' + (AUTEC.monitor.toggleAlertSound() ? 'activado' : 'desactivado'), 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'open-epp-config':
        openEppConfig();
        break;
      case 'toggle-epp':
        if (!AUTEC.epp) break;
        var eppEnabled = AUTEC.epp.setEnabled(null, !AUTEC.epp.config().enabled).enabled;
        toast('EPP ' + (eppEnabled ? 'activado' : 'desactivado'), 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'epp-profile':
        if (!AUTEC.epp) break;
        var eppProfileId = el.getAttribute('data-profile');
        var eppProfile = AUTEC.epp.setProfile(null, eppProfileId);
        toast('Perfil EPP: ' + eppProfile.profileName, 'success');
        renderRoute({ preserveScroll: true });
        break;
      case 'test-epp-alert':
        if (AUTEC.monitor && AUTEC.monitor.testEppAlert) AUTEC.monitor.testEppAlert();
        break;
      case 'open-tables-config':
        if (AUTEC.tables) AUTEC.tables.openEditor();
        break;
      case 'save-tables':
        if (!AUTEC.tables || !AUTEC.tables.saveEditor()) break;
        closeModal();
        toast('Mesas y clientes guardados', 'success');
        renderRoute({ preserveScroll: true });
        break;
      case 'toggle-tables':
        if (!AUTEC.tables) break;
        var tablesEnabled = AUTEC.tables.setEnabled(null, !AUTEC.tables.config().enabled).enabled;
        toast('Mesas ' + (tablesEnabled ? 'activadas' : 'desactivadas'), 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'test-tables-alert':
        if (AUTEC.monitor && AUTEC.monitor.testTablesAlert) AUTEC.monitor.testTablesAlert();
        break;
      case 'open-falls-config':
        openFallsConfig();
        break;
      case 'toggle-falls':
        if (!AUTEC.falls) break;
        var fallsEnabled = AUTEC.falls.setEnabled(null, !AUTEC.falls.config().enabled).enabled;
        toast('Detección de caídas ' + (fallsEnabled ? 'activada' : 'desactivada'), 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'test-falls-alert':
        if (AUTEC.monitor && AUTEC.monitor.testFallsAlert) AUTEC.monitor.testFallsAlert();
        break;
      case 'open-areas-config':
        if (AUTEC.areas) AUTEC.areas.openEditor(el.getAttribute('data-skill'));
        break;
      case 'save-areas': {
        if (!AUTEC.areas) break;
        var savedArea = AUTEC.areas.saveEditor();
        if (!savedArea) break;
        closeModal();
        toast('Configuración de ' + savedArea.name.toLowerCase() + ' guardada', 'success');
        renderRoute({ preserveScroll: true });
        break;
      }
      case 'toggle-areas': {
        if (!AUTEC.areas) break;
        var areaSkillId = el.getAttribute('data-skill');
        var areaDef = AUTEC.areas.definition(areaSkillId);
        if (!areaDef) break;
        var areaEnabled = AUTEC.areas.setEnabled(areaSkillId, null, !AUTEC.areas.config(areaSkillId).enabled).enabled;
        toast(areaDef.name + ' ' + (areaEnabled ? 'activada' : 'desactivada'), 'info');
        renderRoute({ preserveScroll: true });
        break;
      }
      case 'test-areas-alert':
        if (AUTEC.monitor && AUTEC.monitor.testAreasAlert) {
          AUTEC.monitor.testAreasAlert(el.getAttribute('data-skill'));
        }
        break;
      case 'test-zone-alert':
        if (!AUTEC.monitor || !AUTEC.monitor.testZoneAlert) break;
        AUTEC.monitor.testZoneAlert(el.getAttribute('data-zone-id') || undefined);
        break;
      case 'save-zones':
        if (!AUTEC.zones || !AUTEC.zones.saveEditor()) break;
        closeModal();
        toast('Zonas y merodeo guardados', 'success');
        renderRoute({ preserveScroll: true });
        break;
      case 'open-line-config':
        if (AUTEC.lines) AUTEC.lines.openEditor();
        break;
      case 'save-line':
        if (!AUTEC.lines || !AUTEC.lines.saveEditor()) break;
        closeModal();
        toast('Línea de aforo guardada', 'success');
        renderRoute({ preserveScroll: true });
        break;
      case 'toggle-line':
        if (!AUTEC.lines) break;
        AUTEC.lines.setEnabled(!AUTEC.lines.config().enabled);
        toast('Aforo por línea ' + (AUTEC.lines.config().enabled ? 'activado' : 'desactivado'), 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'reset-line':
        if (!AUTEC.lines) break;
        AUTEC.lines.reset();
        toast('Contadores de aforo reiniciados', 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'test-line-alert':
        if (AUTEC.monitor && AUTEC.monitor.testLineAlert) AUTEC.monitor.testLineAlert();
        break;
      case 'test-queue-alert':
        if (AUTEC.monitor && AUTEC.monitor.testQueueAlert) {
          AUTEC.monitor.testQueueAlert(el.getAttribute('data-zone-id'));
        }
        break;
      case 'test-unattended-alert':
        if (AUTEC.monitor && AUTEC.monitor.testUnattendedAlert) {
          AUTEC.monitor.testUnattendedAlert(el.getAttribute('data-zone-id'));
        }
        break;
      case 'test-patrol-alert':
        if (AUTEC.monitor && AUTEC.monitor.testPatrolAlert) {
          AUTEC.monitor.testPatrolAlert(el.getAttribute('data-zone-id'));
        }
        break;
      case 'reset-patrol':
        if (!AUTEC.monitor || !AUTEC.monitor.resetPatrol) break;
        AUTEC.monitor.resetPatrol();
        toast('Control de rondas reiniciado', 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'toggle-heatmap':
        if (!AUTEC.heatmap) break;
        AUTEC.heatmap.setEnabled(!AUTEC.heatmap.config().enabled);
        toast('Mapa de calor ' + (AUTEC.heatmap.config().enabled ? 'activado' : 'desactivado'), 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'reset-heatmap':
        if (!AUTEC.heatmap) break;
        AUTEC.heatmap.reset();
        toast('Mapa de calor reiniciado', 'info');
        renderRoute({ preserveScroll: true });
        break;
      case 'snapshot': {
        if (AUTEC.monitor && AUTEC.monitor.isConnected()) {
          AUTEC.monitor.snapshot();
          break;
        }
        var frame = document.querySelector('.video-frame');
        if (frame) {
          frame.classList.add('is-flashing');
          setTimeout(function () { frame.classList.remove('is-flashing'); }, 420);
        }
        toast('Captura guardada (demo)', 'success');
        break;
      }
      case 'toggle-fullscreen': {
        var video = el.closest('.video-frame')
          || document.querySelector('.video-frame[data-monitor-frame]')
          || document.querySelector('.video-frame');
        if (!video) break;
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (video.requestFullscreen) {
          video.requestFullscreen().catch(function () { toast('Pantalla completa no disponible', 'warning'); });
        } else {
          toast('Pantalla completa no disponible', 'warning');
        }
        break;
      }
      case 'toggle-setting':
        var key = el.getAttribute('data-key');
        state.settings[key] = !state.settings[key];
        renderRoute({ preserveScroll: true });
        break;
      case 'mark-notifications-read':
        AUTEC.store.notifications.forEach(function (notification) { notification.unread = false; });
        closeModal();
        renderRoute({ preserveScroll: true });
        toast('Notificaciones marcadas como leídas', 'success');
        break;
      case 'filter-company-audit':
        state.filters.audit.company = companyId;
        state.filters.audit.q = '';
        state.filters.audit.type = 'all';
        navigate('/admin/auditoria');
        break;
      case 'impersonate-company':
        state.returnTo = '/admin/empresas/' + companyId;
        state.impersonating = true;
        state.auth = { role: 'company_admin', companyId: companyId };
        navigate('/app');
        toast('Modo soporte activo · viendo como empresa', 'info');
        break;
      case 'reset-request':
        state.requestSubmitted = false;
        state.requestCompany = '';
        renderRoute();
        break;
      case 'export':
        toast('Exportación generada (demo)', 'success');
        break;
      case 'save-settings':
        toast('Ajustes guardados (demo)', 'success');
        break;
      case 'clear-filters':
        var scope = el.getAttribute('data-scope');
        if (scope && state.filters[scope]) state.filters[scope] = defaultFilters()[scope];
        renderRoute({ preserveScroll: true });
        break;
      case 'open-demo':
        closeModal();
        state.demoOpen = true;
        renderDemo();
        break;
      default:
        break;
    }
  }

  function fdValue(fd, key) {
    return String(fd.get(key) || '').trim();
  }

  function fdNumber(fd, key, fallback) {
    var value = Number(fd.get(key));
    return isNaN(value) ? fallback : value;
  }

  function handleForm(name, form, fd) {
    var company;

    if (name === 'camera-profile') {
      if (AUTEC.cameras) AUTEC.cameras.saveProfile(fd);
      return;
    }

    if (name === 'login') {
      var role = state.loginTab === 'company' ? 'company_admin' : 'creator';
      loginAs(role, role === 'creator' ? null : (fdValue(fd, 'companyId') || state.loginCompanyId));
      return;
    }

    if (name === 'access-request') {
      var requestName = fdValue(fd, 'company');
      if (!requestName) {
        toast('Ingresá el nombre de la empresa', 'danger');
        return;
      }
      var requestPlan = planById(fdValue(fd, 'planId')) || AUTEC.store.plans[0];
      var requestSeats = fdNumber(fd, 'seats', 5);
      AUTEC.store.requests.unshift({
        id: U.uid('req'),
        type: 'company',
        companyId: null,
        companyName: requestName,
        detail: 'Solicita acceso para ' + requestSeats + ' usuarios · Plan ' + requestPlan.name,
        date: 'Hoy ' + timeLabel(),
        status: 'pending',
        contact: fdValue(fd, 'contact'),
        email: fdValue(fd, 'email'),
        phone: fdValue(fd, 'phone'),
        sector: fdValue(fd, 'sector'),
        seats: requestSeats,
        planId: requestPlan.id,
        message: fdValue(fd, 'message')
      });
      addAudit('Nueva solicitud', 'Solicitud de acceso · ' + requestName, null, requestName, 'request');
      state.requestSubmitted = true;
      state.requestCompany = requestName;
      renderRoute();
      toast('Solicitud registrada (demo)', 'success');
      return;
    }

    if (name === 'new-company') {
      var newName = fdValue(fd, 'name');
      if (!newName) {
        toast('El nombre de la empresa es obligatorio', 'danger');
        return;
      }
      var created = createCompany({
        name: newName,
        sector: fdValue(fd, 'sector'),
        contact: fdValue(fd, 'contact'),
        email: fdValue(fd, 'email'),
        phone: fdValue(fd, 'phone'),
        planId: fdValue(fd, 'planId'),
        seats: fdNumber(fd, 'seats', 5),
        status: fdValue(fd, 'status') || 'trial',
        expiresAt: fdValue(fd, 'expiresAt') || addDaysISO(30)
      });
      addAudit('Creó empresa', created.name, created.id, created.name, 'create');
      closeModal();
      toast('Empresa creada', 'success');
      navigate('/admin/empresas/' + created.id);
      return;
    }

    if (name === 'edit-company') {
      company = companyById(fdValue(fd, 'id'));
      if (!company) return;
      var previousPlan = company.planId;
      company.name = fdValue(fd, 'name') || company.name;
      company.sector = fdValue(fd, 'sector') || company.sector;
      company.contact = fdValue(fd, 'contact') || company.contact;
      company.email = fdValue(fd, 'email') || company.email;
      company.phone = fdValue(fd, 'phone') || company.phone;
      company.planId = fdValue(fd, 'planId') || company.planId;
      company.seats = fdNumber(fd, 'seats', company.seats);
      company.status = fdValue(fd, 'status') || company.status;
      company.expiresAt = fdValue(fd, 'expiresAt') || company.expiresAt;
      var companyPlan = planById(company.planId) || AUTEC.store.plans[0];
      company.mrr = company.status === 'active' ? companyPlan.price : 0;
      if (previousPlan !== company.planId) {
        company.skills = company.skills.filter(function (id) { return companyPlan.skills.indexOf(id) !== -1; });
      }
      AUTEC.store.users.forEach(function (user) {
        if (user.companyId === company.id) user.companyName = company.name;
      });
      addAudit('Editó empresa', company.name, company.id, company.name, 'update');
      closeModal();
      toast('Empresa actualizada', 'success');
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'company-status') {
      company = companyById(fdValue(fd, 'id'));
      if (!company) return;
      if (company.status === 'suspended') {
        company.status = 'active';
        company.mrr = (planById(company.planId) || AUTEC.store.plans[0]).price;
        if (U.daysUntil(company.expiresAt) < 0) company.expiresAt = addDaysISO(30);
        addAudit('Reactivó empresa', company.name, company.id, company.name, 'update');
        toast('Empresa reactivada', 'success');
      } else {
        company.status = 'suspended';
        company.mrr = 0;
        addAudit('Suspendió empresa', company.name, company.id, company.name, 'delete');
        toast('Empresa suspendida', 'warning');
      }
      closeModal();
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'plan') {
      var planName = fdValue(fd, 'name');
      if (!planName) {
        toast('El nombre del plan es obligatorio', 'danger');
        return;
      }
      var planId = fdValue(fd, 'id');
      var planSkills = fd.getAll('skills').map(String);
      if (!planSkills.length) planSkills = ['personas'];
      var planData = {
        name: planName,
        price: fdNumber(fd, 'price', 0),
        period: fdValue(fd, 'period') || 'mes',
        billing: fdValue(fd, 'billing') || 'mensual',
        seats: fdNumber(fd, 'seats', 5),
        durationDays: fdNumber(fd, 'durationDays', 30),
        description: fdValue(fd, 'description') || 'Plan de VigIA.',
        color: fdValue(fd, 'color') || '#F5A524',
        skills: planSkills
      };
      var existingPlan = planId ? planById(planId) : null;
      if (existingPlan) {
        Object.keys(planData).forEach(function (key) { existingPlan[key] = planData[key]; });
        AUTEC.store.companies.forEach(function (company) {
          if (company.planId !== existingPlan.id) return;
          company.mrr = company.status === 'active' ? planData.price : 0;
          company.skills = company.skills.filter(function (id) { return planData.skills.indexOf(id) !== -1; });
        });
        addAudit('Editó plan', existingPlan.name, null, null, 'update');
        toast('Plan actualizado', 'success');
      } else {
        var planBase = U.slugify(planName) || U.uid('plan');
        var newPlanId = planBase;
        var planCounter = 2;
        while (planById(newPlanId)) {
          newPlanId = planBase + '-' + planCounter;
          planCounter += 1;
        }
        planData.id = newPlanId;
        AUTEC.store.plans.push(planData);
        addAudit('Creó plan', planName, null, null, 'create');
        toast('Plan creado', 'success');
      }
      closeModal();
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'user') {
      company = companyById(fdValue(fd, 'companyId'));
      if (!company) {
        toast('Empresa no válida', 'danger');
        return;
      }
      var userId = fdValue(fd, 'id');
      var userName = fdValue(fd, 'name');
      var userEmail = fdValue(fd, 'email');
      if (!userName || !userEmail) {
        toast('Nombre y email son obligatorios', 'danger');
        return;
      }
      if (userId) {
        var existingUser = AUTEC.store.users.find(function (item) { return item.id === userId; });
        if (!existingUser) return;
        existingUser.name = userName;
        existingUser.email = userEmail;
        existingUser.role = fdValue(fd, 'role') || existingUser.role;
        existingUser.status = fdValue(fd, 'status') || existingUser.status;
        addAudit('Editó usuario', existingUser.name + ' · ' + company.name, company.id, company.name, 'update');
        toast('Usuario actualizado', 'success');
      } else {
        if (company.usersCount >= company.seats) {
          toast('Límite de asientos alcanzado. Solicitá una ampliación.', 'danger');
          return;
        }
        var newUser = {
          id: U.uid('u'),
          companyId: company.id,
          companyName: company.name,
          name: userName,
          email: userEmail,
          role: fdValue(fd, 'role') || 'operator',
          status: fdValue(fd, 'status') || 'active',
          lastAccess: 'Nunca'
        };
        AUTEC.store.users.push(newUser);
        company.usersCount += 1;
        addAudit('Creó usuario', newUser.name + ' · ' + company.name, company.id, company.name, 'create');
        toast('Usuario creado', 'success');
      }
      closeModal();
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'reset-password') {
      var resetUser = AUTEC.store.users.find(function (item) { return item.id === fdValue(fd, 'id'); });
      closeModal();
      toast(resetUser ? 'Enlace generado para ' + resetUser.name + ' (demo)' : 'Enlace generado (demo)', 'success');
      return;
    }

    if (name === 'user-status') {
      var statusUser = AUTEC.store.users.find(function (item) { return item.id === fdValue(fd, 'id'); });
      if (!statusUser) return;
      statusUser.status = statusUser.status === 'active' ? 'inactive' : 'active';
      company = companyById(statusUser.companyId);
      addAudit(statusUser.status === 'active' ? 'Activó usuario' : 'Desactivó usuario', statusUser.name + ' · ' + (company ? company.name : ''), statusUser.companyId, company ? company.name : '', 'update');
      closeModal();
      toast(statusUser.status === 'active' ? 'Usuario activado' : 'Usuario desactivado', 'success');
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'approve-request') {
      var request = AUTEC.store.requests.find(function (item) { return item.id === fdValue(fd, 'id'); });
      if (!request || request.status !== 'pending') {
        closeModal();
        toast('La solicitud ya fue resuelta', 'warning');
        return;
      }
      var requestType = fdValue(fd, 'type') || request.type;

      if (requestType === 'company') {
        var approvedName = fdValue(fd, 'name') || request.companyName;
        var approved = createCompany({
          name: approvedName,
          sector: fdValue(fd, 'sector'),
          contact: fdValue(fd, 'contact'),
          email: fdValue(fd, 'email'),
          phone: fdValue(fd, 'phone'),
          planId: fdValue(fd, 'planId'),
          seats: fdNumber(fd, 'seats', 5),
          status: 'trial',
          expiresAt: addDaysISO(14)
        });
        request.status = 'approved';
        request.companyId = approved.id;
        addAudit('Aprobó solicitud', 'Alta de ' + approved.name, approved.id, approved.name, 'create');
        closeModal();
        toast('Empresa creada y solicitud aprobada', 'success');
        navigate('/admin/empresas/' + approved.id);
        return;
      }

      company = request.companyId ? companyById(request.companyId) : null;

      if (requestType === 'skill') {
        request.status = 'approved';
        var requestedSkill = request.skillId
          ? AUTEC.store.skills.find(function (item) { return item.id === request.skillId; })
          : null;
        var companyPlan = company ? planFor(company) : null;
        var canActivate = requestedSkill && company && companyPlan
          && requestedSkill.status === 'available'
          && companyPlan.skills.indexOf(requestedSkill.id) !== -1;
        if (canActivate && company.skills.indexOf(requestedSkill.id) === -1) {
          company.skills.push(requestedSkill.id);
          company.skills.sort(function (a, b) {
            return AUTEC.store.skills.findIndex(function (item) { return item.id === a; })
              - AUTEC.store.skills.findIndex(function (item) { return item.id === b; });
          });
        }
        addAudit('Aprobó solicitud', 'Skill · ' + request.companyName, request.companyId, request.companyName, 'update');
        closeModal();
        toast(canActivate ? 'Skill activada para ' + request.companyName : 'Solicitud de skill aprobada', 'success');
      } else if (requestType === 'seats') {
        var additional = fdNumber(fd, 'additional', 2);
        if (company) company.seats += additional;
        request.status = 'approved';
        addAudit('Aprobó solicitud', '+' + additional + ' asientos · ' + request.companyName, request.companyId, request.companyName, 'update');
        closeModal();
        toast('Asientos ampliados', 'success');
      } else {
        var selectedPlan = planById(fdValue(fd, 'planId')) || planById(request.planId) || AUTEC.store.plans[0];
        var months = fdNumber(fd, 'months', 12);
        if (company) {
          company.planId = selectedPlan.id;
          if (requestType === 'plan') company.seats = fdNumber(fd, 'seats', company.seats);
          company.expiresAt = addDaysISO(requestType === 'renewal' ? months * 30 : selectedPlan.durationDays);
          company.status = 'active';
          company.mrr = selectedPlan.price;
          company.skills = company.skills.filter(function (id) { return selectedPlan.skills.indexOf(id) !== -1; });
          company.payments = company.payments || [];
          company.payments.unshift({
            date: U.formatDate(isoDate(U.DEMO_TODAY)),
            concept: selectedPlan.name + ' · activación',
            amount: selectedPlan.price,
            method: 'Transferencia',
            status: 'Pagado'
          });
        }
        request.status = 'approved';
        addAudit('Aprobó solicitud', selectedPlan.name + ' · ' + request.companyName, request.companyId, request.companyName, 'update');
        closeModal();
        toast('Plan actualizado', 'success');
      }
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'reject-request') {
      var rejected = AUTEC.store.requests.find(function (item) { return item.id === fdValue(fd, 'id'); });
      if (!rejected) return;
      rejected.status = 'rejected';
      rejected.reason = fdValue(fd, 'reason');
      addAudit('Rechazó solicitud', rejected.companyName + ' · ' + rejected.detail, rejected.companyId, rejected.companyName, 'delete');
      closeModal();
      toast('Solicitud rechazada', 'warning');
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'request-skill') {
      company = companyById(fdValue(fd, 'companyId')) || currentCompany();
      skill = AUTEC.store.skills.find(function (item) { return item.id === fdValue(fd, 'skillId'); }) || AUTEC.store.skills[0];
      var skillMessage = fdValue(fd, 'message');
      AUTEC.store.requests.unshift({
        id: U.uid('req'),
        type: 'skill',
        companyId: company.id,
        companyName: company.name,
        skillId: skill.id,
        detail: 'Solicita activar ' + skill.name + (skillMessage ? ' · ' + skillMessage : ''),
        date: 'Hoy ' + timeLabel(),
        status: 'pending'
      });
      addAudit('Nueva solicitud', 'Skill · ' + skill.name + ' · ' + company.name, company.id, company.name, 'request');
      closeModal();
      toast('Solicitud enviada al creador', 'success');
      return;
    }

    if (name === 'request-seats') {
      company = companyById(fdValue(fd, 'companyId')) || currentCompany();
      var requestedSeats = fdNumber(fd, 'additional', 2);
      AUTEC.store.requests.unshift({
        id: U.uid('req'),
        type: 'seats',
        companyId: company.id,
        companyName: company.name,
        detail: 'Solicita ' + requestedSeats + ' usuarios adicionales · ' + company.usersCount + '/' + company.seats + ' usados',
        date: 'Hoy ' + timeLabel(),
        status: 'pending'
      });
      addAudit('Nueva solicitud', requestedSeats + ' asientos · ' + company.name, company.id, company.name, 'request');
      closeModal();
      toast('Solicitud de asientos enviada', 'success');
      return;
    }

    if (name === 'request-plan') {
      company = companyById(fdValue(fd, 'companyId')) || currentCompany();
      var targetPlan = planById(fdValue(fd, 'planId')) || planFor(company);
      var planMessage = fdValue(fd, 'message');
      AUTEC.store.requests.unshift({
        id: U.uid('req'),
        type: 'plan',
        companyId: company.id,
        companyName: company.name,
        detail: 'Solicita cambiar a Plan ' + targetPlan.name + (planMessage ? ' · ' + planMessage : ''),
        date: 'Hoy ' + timeLabel(),
        status: 'pending'
      });
      addAudit('Nueva solicitud', 'Cambio de plan · ' + company.name, company.id, company.name, 'request');
      closeModal();
      toast('Solicitud de cambio de plan enviada', 'success');
      return;
    }

    if (name === 'close-session') {
      var session = AUTEC.store.sessions.find(function (item) { return item.id === fdValue(fd, 'id'); });
      if (!session) return;
      AUTEC.store.sessions = AUTEC.store.sessions.filter(function (item) { return item.id !== session.id; });
      addAudit('Cerró sesión', session.userName + ' · ' + session.companyName, session.companyId, session.companyName, 'delete');
      closeModal();
      toast('Sesión cerrada', 'success');
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'admin-settings' || name === 'security-settings') {
      toast('Ajustes de la plataforma guardados (demo)', 'success');
      return;
    }

    if (name === 'notification-settings') {
      toast('Preferencias de notificaciones guardadas (demo)', 'success');
      return;
    }

    if (name === 'epp-config') {
      if (!AUTEC.epp) return;
      company = currentCompany();
      var eppRequired = {
        helmet: fd.get('helmet') !== null,
        vest: fd.get('vest') !== null
      };
      if (!eppRequired.helmet && !eppRequired.vest) {
        toast('Seleccioná casco, chaleco o ambos', 'danger');
        return;
      }
      var updatedEpp = AUTEC.epp.update(company.id, {
        profile: fdValue(fd, 'profile'),
        required: eppRequired,
        graceSeconds: fdNumber(fd, 'graceSeconds', 5),
        cooldownSeconds: fdNumber(fd, 'cooldownSeconds', 60),
        alertSound: fd.get('alertSound') !== null,
        evidence: fd.get('evidence') !== null,
        showBoxes: fd.get('showBoxes') !== null
      });
      addAudit('Configuró regla EPP', company.name + ' · ' + updatedEpp.profileName + ' · ' + updatedEpp.requiredLabel, company.id, company.name, 'update');
      closeModal();
      toast('Regla EPP guardada', 'success');
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'falls-config') {
      if (!AUTEC.falls) return;
      company = currentCompany();
      var updatedFalls = AUTEC.falls.update(company.id, {
        sensitivity: fdValue(fd, 'sensitivity'),
        graceSeconds: fdNumber(fd, 'graceSeconds', 3),
        cooldownSeconds: fdNumber(fd, 'cooldownSeconds', 120),
        alertSound: fd.get('alertSound') !== null,
        evidence: fd.get('evidence') !== null,
        showBoxes: fd.get('showBoxes') !== null
      });
      addAudit('Configuró caídas', company.name + ' · ' + updatedFalls.sensitivityName + ' · ' + updatedFalls.graceSeconds + ' s', company.id, company.name, 'update');
      closeModal();
      toast('Regla de caídas guardada', 'success');
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'company-profile') {
      company = currentCompany();
      company.name = fdValue(fd, 'name') || company.name;
      company.sector = fdValue(fd, 'sector') || company.sector;
      company.contact = fdValue(fd, 'contact') || company.contact;
      company.email = fdValue(fd, 'email') || company.email;
      company.phone = fdValue(fd, 'phone') || company.phone;
      AUTEC.store.users.forEach(function (user) {
        if (user.companyId === company.id) user.companyName = company.name;
      });
      addAudit('Editó perfil de empresa', company.name, company.id, company.name, 'update');
      toast('Perfil de la empresa actualizado', 'success');
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'camera-settings' || name === 'camera-config') {
      var cameraName = fdValue(fd, 'cameraName') || 'Entrada principal';
      var cameraHost = fdValue(fd, 'host');
      var cameraPort = fdValue(fd, 'port') || '4747';
      var cameraResolution = fdValue(fd, 'resolution') || '1280x720';
      var cameraLens = fdValue(fd, 'lens') || 'unknown';
      var previousCamera = AUTEC.monitor ? AUTEC.monitor.config() : null;
      var cameraSourceChanged = !!previousCamera && (
        previousCamera.host !== cameraHost
        || previousCamera.port !== cameraPort
        || previousCamera.resolution !== cameraResolution
      );

      if (AUTEC.monitor) {
        AUTEC.monitor.saveConfig({
          host: cameraHost,
          port: cameraPort,
          resolution: cameraResolution,
          cameraName: cameraName,
          lens: cameraLens
        });
      }
      AUTEC.store.monitoring.camera = 'DroidCam · ' + cameraName;
      AUTEC.store.monitoring.resolution = cameraResolution.replace('x', ' × ');

      if (name === 'camera-config') {
        closeModal();
        if (cameraHost && AUTEC.monitor) {
          AUTEC.monitor.connect();
          toast('Cámara configurada · conectando…', 'info');
        } else {
          toast('Configuración de cámara guardada', 'success');
        }
        renderRoute({ preserveScroll: true });
        return;
      }

      if (AUTEC.monitor && cameraSourceChanged) {
        AUTEC.monitor.disconnect();
        if (cameraHost) AUTEC.monitor.connect();
      }
      toast('Configuración de cámara guardada', 'success');
      renderRoute({ preserveScroll: true });
      return;
    }

    if (name === 'global-search') {
      var query = fdValue(fd, 'q');
      if (state.auth && state.auth.role === 'creator') {
        state.filters.companies.q = query;
        navigate('/admin/empresas');
      } else if (state.auth && (state.auth.role === 'company_admin' || state.auth.role === 'supervisor')) {
        state.filters.users.q = query;
        navigate('/app/usuarios');
      } else {
        toast('La búsqueda de usuarios no está disponible para tu rol', 'info');
      }
    }
  }

  function handleFilter(el) {
    var path = el.getAttribute('data-filter');
    var parts = path.split('.');
    if (!state.filters[parts[0]]) return;
    state.filters[parts[0]][parts[1]] = el.value;
    renderRoute({ preserveFocus: true, preserveScroll: true });
  }

  document.addEventListener('click', function (event) {
    var actionEl = event.target.closest('[data-action]');

    if (!event.target.closest('.row-menu')) {
      document.querySelectorAll('.row-menu[open]').forEach(function (menu) {
        menu.removeAttribute('open');
      });
    }

    if (!actionEl) return;

    if (actionEl.getAttribute('data-action') === 'close-modal'
      && actionEl.classList.contains('modal-backdrop')
      && event.target.closest('.modal')) {
      return;
    }

    if (actionEl.tagName === 'A') event.preventDefault();
    handleAction(actionEl);
  });

  document.addEventListener('submit', function (event) {
    var form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    handleForm(form.getAttribute('data-form'), form, new FormData(form));
    if (AUTEC.supabase && AUTEC.supabase.persistStore) AUTEC.supabase.persistStore();
  });

  document.addEventListener('input', function (event) {
    if (event.target.matches('input[data-filter]')) handleFilter(event.target);
  });

  document.addEventListener('change', function (event) {
    if (event.target.matches('select[data-filter]')) handleFilter(event.target);
    if (event.target.matches('[data-camera-switch]') && AUTEC.cameras) {
      AUTEC.cameras.activate(event.target.value);
    }
    if (event.target.matches('[data-login-company]')) {
      state.loginCompanyId = event.target.value;
      renderRoute({ preserveScroll: true });
    }
    if (event.target.matches('[data-demo-company]')) {
      state.auth.companyId = event.target.value;
      renderRoute({ preserveScroll: true });
    }
  });

  document.addEventListener('fullscreenchange', function () {
    var button = document.querySelector('.video-fullscreen');
    if (!button || !AUTEC.icon) return;
    var isFullscreen = !!document.fullscreenElement;
    button.innerHTML = AUTEC.icon(isFullscreen ? 'minimize' : 'maximize', 16);
    button.setAttribute('title', isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa');
    button.setAttribute('aria-label', isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa');
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (state.modal) {
      closeModal();
    } else if (state.demoOpen) {
      state.demoOpen = false;
      renderDemo();
    }
  });

  window.addEventListener('hashchange', function () {
    window.scrollTo(0, 0);
    renderRoute();
  });

  AUTEC.app = {
    state: state,
    getPath: getPath,
    navigate: navigate,
    isAuthed: isAuthed,
    isPublicPath: isPublicPath,
    currentCompany: currentCompany,
    currentUser: currentUser,
    planFor: planFor,
    pageTitle: pageTitle,
    homePath: homePath,
    render: renderRoute,
    openModal: openModal,
    closeModal: closeModal,
    toast: toast
  };

  if (!location.hash) history.replaceState(null, '', '#/');
  renderRoute();
})();
