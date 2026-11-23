(function () {
  window.AUTEC = window.AUTEC || {};

  var C = {};
  var U = AUTEC.utils;
  var I = AUTEC.icon;

  C.brand = function (opts) {
    opts = opts || {};
    return '<a class="brand ' + (opts.compact ? 'brand--compact' : '') + '" href="' + (opts.href || '#/') + '" aria-label="VigIA">'
      + '<span class="brand-mark">' + I('scan', 19) + '</span>'
      + '<span class="brand-word">VIG<span>IA</span></span>'
      + '</a>';
  };

  C.avatar = function (name, opts) {
    opts = opts || {};
    return '<span class="avatar ' + (opts.className || '') + '"' + (opts.color ? ' style="--avatar-color:' + opts.color + '"' : '') + ' aria-hidden="true">' + U.initials(name) + '</span>';
  };

  C.companyAvatar = function (company, opts) {
    opts = opts || {};
    return '<span class="avatar avatar--company ' + (opts.className || '') + '" style="--avatar-color:' + (company.color || 'var(--accent)') + '" aria-hidden="true">' + U.escapeHtml(company.short || U.initials(company.name)) + '</span>';
  };

  C.badge = function (text, tone, opts) {
    opts = opts || {};
    return '<span class="badge badge--' + (tone || 'neutral') + ' ' + (opts.className || '') + '">' + (opts.dot ? '<span class="badge-dot"></span>' : '') + U.escapeHtml(text) + '</span>';
  };

  C.statusBadge = function (status) {
    return C.badge(U.statusLabel(status), U.statusTone(status), { dot: true });
  };

  C.roleBadge = function (role) {
    var tone = { creator: 'accent', company_admin: 'info', supervisor: 'warning', operator: 'neutral' }[role] || 'neutral';
    return C.badge(U.roleLabel(role), tone);
  };

  C.planBadge = function (planId) {
    var plan = AUTEC.store.plans.find(function (item) { return item.id === planId; });
    if (!plan) return '';
    return '<span class="badge badge--plan" style="--plan-color:' + plan.color + '">' + U.escapeHtml(plan.name) + '</span>';
  };

  C.skillStatusBadge = function (status) {
    return C.badge(U.skillStatusLabel(status), U.skillStatusTone(status), { dot: true });
  };

  C.industryCard = function (industry, stats) {
    stats = stats || {};
    var isSoon = industry.status !== 'available';
    var statusBadge = industry.status === 'soon'
      ? C.badge('En roadmap', 'neutral', { dot: true })
      : C.skillStatusBadge(industry.status);
    return '<article class="industry-card ' + (isSoon ? 'is-soon' : '') + '">'
      + '<div class="industry-card-top"><span class="industry-icon">' + I(industry.icon || 'building', 18) + '</span>' + statusBadge + '</div>'
      + '<h3>' + U.escapeHtml(industry.name) + '</h3>'
      + '<p>' + U.escapeHtml(industry.description || '') + '</p>'
      + '<div class="industry-foot"><span class="mono">' + (stats.skills || 0) + ' skills</span><span class="muted small">' + (stats.available || 0) + ' disponibles</span></div>'
      + '</article>';
  };

  C.pageHead = function (opts) {
    opts = opts || {};
    return '<div class="page-head">'
      + '<div class="page-head-copy">'
      + (opts.eyebrow ? '<div class="eyebrow">' + opts.eyebrow + '</div>' : '')
      + '<h1>' + opts.title + '</h1>'
      + (opts.subtitle ? '<p>' + opts.subtitle + '</p>' : '')
      + '</div>'
      + (opts.actions ? '<div class="page-head-actions">' + opts.actions + '</div>' : '')
      + '</div>';
  };

  C.card = function (opts) {
    opts = opts || {};
    var head = '';
    if (opts.title || opts.action) {
      head = '<div class="card-head">'
        + '<div class="card-head-copy">'
        + (opts.eyebrow ? '<div class="eyebrow">' + opts.eyebrow + '</div>' : '')
        + (opts.title ? '<h2 class="card-title">' + opts.title + '</h2>' : '')
        + (opts.subtitle ? '<p class="card-sub">' + opts.subtitle + '</p>' : '')
        + '</div>'
        + (opts.action ? '<div class="card-action">' + opts.action + '</div>' : '')
        + '</div>';
    }
    return '<section class="card ' + (opts.className || '') + '">' + head
      + '<div class="card-body ' + (opts.flush ? 'card-body--flush' : '') + '">' + (opts.body || '') + '</div></section>';
  };

  C.kpi = function (opts) {
    opts = opts || {};
    return '<div class="kpi card ' + (opts.className || '') + '">'
      + '<div class="kpi-top"><span class="kpi-label">' + opts.label + '</span>'
      + (opts.icon ? '<span class="kpi-icon">' + I(opts.icon, 16) + '</span>' : '') + '</div>'
      + '<div class="kpi-value">' + opts.value + '</div>'
      + '<div class="kpi-foot">' + (opts.meta || '') + (opts.spark ? '<span class="kpi-spark">' + opts.spark + '</span>' : '') + '</div>'
      + '</div>';
  };

  C.progress = function (value, max, tone) {
    var pct = Math.min(100, Math.round((Number(value) / Math.max(1, Number(max))) * 100));
    return '<div class="progress"><span class="progress-fill progress-fill--' + (tone || 'accent') + '" style="width:' + pct + '%"></span></div>';
  };

  C.seatUsage = function (company, opts) {
    opts = opts || {};
    var pct = Math.round(company.usersCount / Math.max(1, company.seats) * 100);
    var tone = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'accent';
    return '<div class="seat-usage ' + (opts.className || '') + '">'
      + '<div class="seat-usage-top"><span>' + company.usersCount + ' / ' + company.seats + ' usuarios</span><span class="muted">' + pct + '%</span></div>'
      + C.progress(company.usersCount, company.seats, tone)
      + '</div>';
  };

  C.emptyState = function (opts) {
    opts = opts || {};
    return '<div class="empty-state">'
      + '<span class="empty-icon">' + I(opts.icon || 'inbox', 24) + '</span>'
      + '<h3>' + opts.title + '</h3>'
      + '<p>' + (opts.text || '') + '</p>'
      + (opts.action || '')
      + '</div>';
  };

  C.barChart = function (values, labels, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, values) || 1;
    var color = opts.color || 'var(--accent)';
    var html = '<div class="bar-chart ' + (opts.className || '') + '">';
    values.forEach(function (value, index) {
      var height = Math.max(4, Math.round(value / max * 100));
      html += '<div class="bar-col" title="' + (labels[index] || '') + ': ' + (opts.money ? U.currency(value) : value) + '">'
        + (opts.showValues ? '<div class="bar-value">' + (opts.money ? U.currency(value) : value) + '</div>' : '')
        + '<div class="bar-track"><span class="bar-fill" style="height:' + height + '%;background:' + color + '"></span></div>'
        + '<div class="bar-label">' + (labels[index] || '') + '</div>'
        + '</div>';
    });
    return html + '</div>';
  };

  C.sparkline = function (values, color) {
    var width = 120;
    var height = 32;
    var pad = 2;
    var max = Math.max.apply(null, values);
    var min = Math.min.apply(null, values);
    var span = max - min || 1;
    var points = values.map(function (value, index) {
      var x = pad + index * (width - pad * 2) / Math.max(1, values.length - 1);
      var y = height - pad - ((value - min) / span) * (height - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="sparkline" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + points + '" fill="none" stroke="' + (color || 'var(--accent)') + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };

  C.detBox = function (person, showReid) {
    var isReid = showReid && person.reid;
    return '<div class="det-box ' + (isReid ? 'is-reid' : '') + '" data-person="' + person.id + '" style="left:' + person.box.x + '%;top:' + person.box.y + '%;width:' + person.box.w + '%;height:' + person.box.h + '%">'
      + '<span class="det-label">' + (isReid ? I('scan', 12) : '') + 'persona #' + person.id + ' · ' + person.confidence + '%' + (isReid ? '<em>REID</em>' : '') + '</span>'
      + '</div>';
  };

  C.videoFrame = function (opts) {
    opts = opts || {};
    var monitoring = (AUTEC.store && AUTEC.store.monitoring) || AUTEC.data.monitoring;
    var monitor = AUTEC.monitor;
    var monitorFrame = opts.monitorFrame !== false;
    var live = monitorFrame && !!(monitor && monitor.isConnected());
    var connecting = monitorFrame && !!(monitor && monitor.state && monitor.state().connecting);
    var showReid = opts.reidEnabled !== false;
    var paused = monitorFrame && (!!opts.paused || !!(monitor && monitor.isPaused()));
    var compact = !!opts.compact;
    var people = monitoring.people.map(function (person) {
      return C.detBox(person, showReid).replace('class="det-box ', 'class="det-box det-box--demo ');
    }).join('');

    return '<div class="video-frame ' + (compact ? 'video-frame--compact ' : '') + (paused ? 'is-paused ' : '') + (live ? 'is-live ' : '') + (connecting ? 'is-connecting ' : '') + '"' + (opts.monitorFrame === false ? '' : ' data-monitor-frame') + '>'
      + '<img class="video-image" src="assets/camera-frame.jpg" alt="Vista de cámara DroidCam con tres personas">'
      + '<div class="video-scrim"></div>'
      + '<div class="video-overlay"></div>'
      + '<div class="video-top">'
      + '<span class="live-pill ' + (paused || (!live && monitorFrame) ? 'live-pill--paused' : '') + '" data-monitor-live-pill><span class="live-dot"></span>' + (monitorFrame ? (paused ? 'PAUSADO' : live ? 'EN VIVO' : 'SIN SEÑAL') : 'EN VIVO') + '</span>'
      + '<span class="video-cam" data-monitor-camera>' + monitoring.camera + '</span>'
      + '</div>'
      + (showReid ? '<span class="reid-chip" data-monitor-reid-chip>' + I('scan', 13) + ' ReID: <span data-monitor-reid-count>' + monitoring.reidMatches + '</span> ' + (monitoring.reidMatches === 1 ? 'recuperación' : 'recuperaciones') + '</span>' : '')
      + (monitorFrame ? '<button type="button" class="video-fullscreen" data-action="toggle-fullscreen" title="Pantalla completa" aria-label="Pantalla completa">' + I('maximize', 16) + '</button>' : '')
      + people
      + '<div class="video-connecting"><span class="monitor-spinner"></span><span>Conectando cámara…</span></div>'
      + (paused ? '<div class="video-paused"><button class="btn btn-primary" data-action="toggle-monitor">' + I('play', 16) + ' Reanudar</button></div>' : '')
      + '<div class="video-bottom"><span class="mono" data-monitor-timestamp>' + monitoring.timestamp + '</span><span class="mono" data-monitor-fpsline><span data-monitor-fps>' + monitoring.fps + '</span> FPS · <span data-monitor-latency>' + monitoring.latency + ' ms</span></span></div>'
      + '</div>';
  };

  function navSections(role) {
    if (role === 'creator') {
      return [
        { label: 'General', items: [{ path: '/admin', label: 'Resumen', icon: 'grid' }] },
        {
          label: 'Gestión', items: [
            { path: '/admin/empresas', label: 'Empresas', icon: 'building' },
            { path: '/admin/solicitudes', label: 'Solicitudes', icon: 'inbox', badge: AUTEC.store.requests.filter(function (r) { return r.status === 'pending'; }).length },
            { path: '/admin/planes', label: 'Planes', icon: 'credit-card' },
            { path: '/admin/skills', label: 'Skills', icon: 'layers' }
          ]
        },
        {
          label: 'Sistema', items: [
            { path: '/admin/sesiones', label: 'Sesiones', icon: 'activity' },
            { path: '/admin/auditoria', label: 'Auditoría', icon: 'file' },
            { path: '/admin/ajustes', label: 'Ajustes', icon: 'settings' }
          ]
        }
      ];
    }

    if (role === 'company_admin') {
      return [
        {
          label: 'Operación', items: [
            { path: '/app', label: 'Resumen', icon: 'grid' },
            { path: '/app/monitoreo', label: 'Monitoreo', icon: 'video' }
          ]
        },
        {
          label: 'Gestión', items: [
            { path: '/app/usuarios', label: 'Usuarios', icon: 'users' },
            { path: '/app/skills', label: 'Skills', icon: 'layers' },
            { path: '/app/plan', label: 'Plan', icon: 'credit-card' }
          ]
        },
        { label: 'Sistema', items: [{ path: '/app/ajustes', label: 'Ajustes', icon: 'settings' }] }
      ];
    }

    if (role === 'supervisor') {
      return [
        {
          label: 'Operación', items: [
            { path: '/app', label: 'Resumen', icon: 'grid' },
            { path: '/app/monitoreo', label: 'Monitoreo', icon: 'video' }
          ]
        },
        { label: 'Equipo', items: [{ path: '/app/usuarios', label: 'Usuarios', icon: 'users' }] }
      ];
    }

    return [
      {
        label: 'Operación', items: [
          { path: '/app', label: 'Resumen', icon: 'grid' },
          { path: '/app/monitoreo', label: 'Monitoreo', icon: 'video' }
        ]
      }
    ];
  }

  function isActive(path, currentPath) {
    if (path === '/admin' || path === '/app') return currentPath === path;
    return currentPath === path || currentPath.indexOf(path + '/') === 0;
  }

  C.sidebar = function () {
    var state = AUTEC.app.state;
    var role = state.auth.role;
    var currentPath = AUTEC.app.getPath();
    var user = AUTEC.app.currentUser();
    var company = AUTEC.app.currentCompany();
    var home = role === 'creator' ? '#/admin' : '#/app';
    var sections = navSections(role);

    var nav = sections.map(function (section) {
      return '<div class="nav-section">'
        + '<div class="nav-label">' + section.label + '</div>'
        + section.items.map(function (item) {
          var active = isActive(item.path, currentPath);
          return '<a class="nav-item ' + (active ? 'is-active' : '') + '" href="#' + item.path + '"' + (active ? ' aria-current="page"' : '') + '>'
            + '<span class="nav-icon">' + I(item.icon, 17) + '</span>'
            + '<span class="nav-text">' + item.label + '</span>'
            + (item.badge ? '<span class="nav-badge">' + item.badge + '</span>' : '')
            + '</a>';
        }).join('')
        + '</div>';
    }).join('');

    var context = role === 'creator'
      ? '<span class="sidebar-context-label">ADMINISTRACIÓN GLOBAL</span>'
      : '<span class="sidebar-context-label">' + U.escapeHtml(company.name) + '</span>';

    return '<aside class="sidebar" aria-label="Navegación principal">'
      + '<div class="sidebar-head">'
      + C.brand({ href: home })
      + '<button class="icon-btn sidebar-close" data-action="toggle-sidebar" aria-label="Cerrar menú">' + I('x', 18) + '</button>'
      + '</div>'
      + '<div class="sidebar-context">' + context + '</div>'
      + '<nav class="sidebar-nav">' + nav + '</nav>'
      + '<div class="sidebar-foot">'
      + '<div class="user-card">'
      + C.avatar(user.name, { className: 'avatar--sm' })
      + '<div class="user-card-copy"><strong>' + U.escapeHtml(user.name) + '</strong><span>' + U.roleLabel(role) + '</span></div>'
      + '<button class="icon-btn" data-action="logout" aria-label="Cerrar sesión" title="Cerrar sesión">' + I('logout', 16) + '</button>'
      + '</div>'
      + '<div class="sidebar-foot-note">' + I('shield-check', 13) + ' VigIA · Demo</div>'
      + '</div>'
      + '</aside>';
  };

  C.topbar = function () {
    var state = AUTEC.app.state;
    var role = state.auth.role;
    var company = AUTEC.app.currentCompany();
    var path = AUTEC.app.getPath();
    var title = AUTEC.app.pageTitle(path);
    var unread = AUTEC.store.notifications.filter(function (n) { return n.unread; }).length;
    var contextLabel = role === 'creator' ? 'Administración' : company.name;

    return '<header class="topbar">'
      + '<div class="topbar-left">'
      + '<button class="icon-btn topbar-menu" data-action="toggle-sidebar" aria-label="Abrir menú">' + I('menu', 20) + '</button>'
      + '<div class="topbar-crumb"><span>' + U.escapeHtml(contextLabel) + '</span><span class="crumb-sep">/</span><strong>' + title + '</strong></div>'
      + '</div>'
      + '<form class="topbar-search" data-form="global-search" role="search">'
      + '<span class="search-icon">' + I('search', 15) + '</span>'
      + '<input name="q" id="global-search" autocomplete="off" placeholder="' + (role === 'creator' ? 'Buscar empresa, plan...' : 'Buscar usuario...') + '">'
      + '</form>'
      + '<div class="topbar-right">'
      + '<span class="system-live"><span class="status-dot status-dot--success"></span><span>Sistema operativo</span></span>'
      + (role === 'creator' ? '<span class="badge badge--accent">GLOBAL</span>' : C.planBadge(company.planId))
      + '<button class="icon-btn topbar-icon" data-action="open-notifications" aria-label="Notificaciones" title="Notificaciones">' + I('bell', 18) + (unread ? '<span class="notif-dot"></span>' : '') + '</button>'
      + '<button class="account-btn" data-action="open-account" aria-label="Cuenta">'
      + C.avatar(AUTEC.app.currentUser().name, { className: 'avatar--sm' })
      + '<span class="account-name">' + U.escapeHtml(AUTEC.app.currentUser().name) + '</span>'
      + I('chevron-down', 14)
      + '</button>'
      + '</div>'
      + '</header>';
  };

  C.impersonationBanner = function () {
    var company = AUTEC.app.currentCompany();
    return '<div class="impersonation-banner">'
      + '<span>' + I('eye', 15) + ' Viendo como <strong>' + U.escapeHtml(company.name) + '</strong> · Modo soporte</span>'
      + '<button class="btn btn-ghost btn-sm" data-action="back-to-admin">' + I('arrow-left', 14) + ' Volver al admin</button>'
      + '</div>';
  };

  C.shell = function (content) {
    return '<div class="app-shell ' + (AUTEC.app.state.sidebarOpen ? 'sidebar-open' : '') + '">'
      + C.sidebar()
      + '<div class="sidebar-backdrop" data-action="toggle-sidebar"></div>'
      + '<div class="main">'
      + C.topbar()
      + (AUTEC.app.state.impersonating ? C.impersonationBanner() : '')
      + '<main class="content" id="main-content">' + content + '</main>'
      + '</div>'
      + '</div>';
  };

  C.modal = function () {
    var modal = AUTEC.app.state.modal;
    if (!modal) return '';

    var body = modal.body || '';
    var foot = modal.foot || (
      '<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button>'
      + '<button type="submit" class="btn ' + (modal.danger ? 'btn-danger' : 'btn-primary') + '">' + (modal.submitLabel || 'Guardar') + '</button>'
    );
    var content = '<div class="modal-body">' + body + '</div>' + (modal.noFoot ? '' : '<div class="modal-foot">' + foot + '</div>');
    var inner = modal.form ? '<form data-form="' + modal.form + '">' + content + '</form>' : content;

    return '<div class="modal-backdrop" data-action="close-modal">'
      + '<div class="modal ' + (modal.wide ? 'modal--wide ' : '') + (modal.className || '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">'
      + '<div class="modal-head"><div><h2 id="modal-title">' + modal.title + '</h2>' + (modal.subtitle ? '<p>' + modal.subtitle + '</p>' : '') + '</div>'
      + '<button class="icon-btn modal-close" data-action="close-modal" aria-label="Cerrar">' + I('x', 18) + '</button></div>'
      + inner
      + '</div></div>';
  };

  C.toast = function () {
    var toast = AUTEC.app.state.toast;
    if (!toast) return '';
    var iconName = toast.type === 'success' ? 'check-circle' : toast.type === 'danger' ? 'x-circle' : toast.type === 'warning' ? 'alert' : 'info';
    return '<div class="toast toast--' + (toast.type || 'info') + '">'
      + I(iconName, 18)
      + '<span>' + U.escapeHtml(toast.message) + '</span>'
      + '<button class="toast-close" data-action="dismiss-toast" aria-label="Cerrar">' + I('x', 14) + '</button>'
      + '</div>';
  };

  C.demoPanel = function () {
    var state = AUTEC.app.state;
    if (!AUTEC.app.isAuthed() || AUTEC.app.isPublicPath()) return '';

    var company = AUTEC.app.currentCompany();
    var roles = [
      { id: 'creator', label: 'Creador' },
      { id: 'company_admin', label: 'Admin empresa' },
      { id: 'supervisor', label: 'Supervisor' },
      { id: 'operator', label: 'Operador' }
    ];
    var roleButtons = roles.map(function (role) {
      return '<button class="demo-role ' + (state.auth.role === role.id ? 'is-active' : '') + '" data-action="demo-role" data-role="' + role.id + '">' + role.label + '</button>';
    }).join('');
    var companyOptions = AUTEC.store.companies.map(function (item) {
      return '<option value="' + item.id + '"' + (company.id === item.id ? ' selected' : '') + '>' + U.escapeHtml(item.name) + '</option>';
    }).join('');
    var accentButtons = ['amber', 'cyan'].map(function (accent) {
      return '<button class="demo-swatch demo-swatch--' + accent + ' ' + (state.accent === accent ? 'is-active' : '') + '" data-action="demo-accent" data-accent="' + accent + '" aria-label="Acento ' + accent + '"></button>';
    }).join('');
    var densityButtons = ['comfortable', 'compact'].map(function (density) {
      return '<button class="demo-seg ' + (state.density === density ? 'is-active' : '') + '" data-action="demo-density" data-density="' + density + '">' + (density === 'comfortable' ? 'Cómoda' : 'Compacta') + '</button>';
    }).join('');

    var panel = state.demoOpen ? '<div class="demo-panel">'
      + '<div class="demo-panel-head"><div><span class="demo-kicker">MODO DEMO</span><strong>Probar la maqueta</strong></div><button class="icon-btn" data-action="demo-toggle" aria-label="Cerrar panel demo">' + I('x', 16) + '</button></div>'
      + '<div class="demo-field"><label>Rol</label><div class="demo-roles">' + roleButtons + '</div></div>'
      + (state.auth.role === 'creator' ? '' : '<div class="demo-field"><label for="demo-company">Empresa</label><select id="demo-company" data-demo-company>' + companyOptions + '</select></div>')
      + '<div class="demo-row">'
      + '<div class="demo-field"><label>Acento</label><div class="demo-swatches">' + accentButtons + '</div></div>'
      + '<div class="demo-field"><label>Densidad</label><div class="demo-seg-group">' + densityButtons + '</div></div>'
      + '</div>'
      + '<div class="demo-note">' + I('info', 14) + ' Datos ficticios fuera del monitoreo. La cámara y las detecciones del panel son reales.</div>'
      + '<div class="demo-actions"><button class="btn btn-ghost btn-sm" data-action="demo-reset">' + I('refresh', 14) + ' Reiniciar datos</button><a class="btn btn-ghost btn-sm" href="#/">' + I('arrow-left', 14) + ' Ver inicio</a></div>'
      + '</div>' : '';

    return '<div class="demo-root ' + (state.demoOpen ? 'is-open' : '') + '">'
      + panel
      + '<button class="demo-trigger" data-action="demo-toggle" aria-expanded="' + (state.demoOpen ? 'true' : 'false') + '">' + I('sliders', 16) + '<span>Demo</span></button>'
      + '</div>';
  };

  C.skillCard = function (skill, opts) {
    opts = opts || {};
    var mode = opts.mode || 'catalog';
    var company = opts.company;
    var enabled = company ? company.skills.indexOf(skill.id) !== -1 : false;
    var included = company ? AUTEC.app.planFor(company).skills.indexOf(skill.id) !== -1 : false;
    var industries = skill.industries.map(function (industry) { return '<span class="tag">' + U.escapeHtml(industry) + '</span>'; }).join('');
    var footer = '';

    if (mode === 'catalog') {
      var globalToggle = skill.status === 'available'
        ? '<button class="switch ' + (skill.globalActive ? 'is-on' : '') + '" role="switch" aria-checked="' + (skill.globalActive ? 'true' : 'false') + '" data-action="toggle-skill-global" data-skill="' + skill.id + '" aria-label="Activar ' + skill.name + ' globalmente"><span></span></button>'
        : '<span class="muted small">' + (skill.status === 'training' ? 'En validación' : 'En investigación') + '</span>';
      footer = '<div class="skill-foot"><span class="muted small">' + skill.companiesUsing + (skill.companiesUsing === 1 ? ' empresa' : ' empresas') + '</span>' + globalToggle + '</div>';
    } else if (mode === 'admin-company') {
      var adminControl = skill.status === 'available'
        ? '<button class="switch ' + (enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (enabled ? 'true' : 'false') + '" data-action="toggle-skill" data-skill="' + skill.id + '" data-company="' + company.id + '" aria-label="' + (enabled ? 'Desactivar' : 'Activar') + ' ' + skill.name + '"><span></span></button>'
        : '<button class="btn btn-ghost btn-sm" data-action="open-request-skill" data-skill="' + skill.id + '" data-company="' + company.id + '">Solicitar</button>';
      footer = '<div class="skill-foot"><span class="muted small">' + (included ? 'Incluida en el plan' : 'No incluida en el plan') + '</span>' + adminControl + '</div>';
    } else {
      var companyControl;
      if (skill.status === 'available' && included) {
        companyControl = '<button class="switch ' + (enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (enabled ? 'true' : 'false') + '" data-action="toggle-skill" data-skill="' + skill.id + '" data-company="' + company.id + '" aria-label="' + (enabled ? 'Desactivar' : 'Activar') + ' ' + skill.name + '"><span></span></button>';
      } else if (skill.status === 'available' && !included) {
        companyControl = '<button class="btn btn-ghost btn-sm" data-action="open-request-skill" data-skill="' + skill.id + '" data-company="' + company.id + '">Mejorar plan</button>';
      } else {
        companyControl = '<button class="btn btn-ghost btn-sm" data-action="open-request-skill" data-skill="' + skill.id + '" data-company="' + company.id + '">Solicitar</button>';
      }
      footer = '<div class="skill-foot"><span class="muted small">' + (included ? 'Incluida en tu plan' : 'No incluida en tu plan') + '</span>' + companyControl + '</div>';
    }

    var progress = skill.status === 'training'
      ? '<div class="skill-progress">' + C.progress(skill.progress, 100, 'warning') + '<span class="muted small">' + skill.progress + '% del entrenamiento</span></div>'
      : '';

    var statusBadges = C.skillStatusBadge(skill.status)
      + (skill.pilot ? C.badge('Piloto', 'warning') : '');

    return '<article class="skill-card ' + (enabled ? 'is-enabled' : '') + '">'
      + '<div class="skill-card-top"><span class="skill-icon">' + I(skill.icon || 'layers', 20) + '</span><span class="skill-badges">' + statusBadges + '</span></div>'
      + '<h3>' + U.escapeHtml(skill.name) + '</h3>'
      + '<p>' + U.escapeHtml(skill.description) + '</p>'
      + '<div class="tag-row">' + industries + '</div>'
      + progress
      + footer
      + '</article>';
  };

  C.planCard = function (plan, opts) {
    opts = opts || {};
    var companiesUsing = AUTEC.store.companies.filter(function (company) { return company.planId === plan.id; }).length;
    var skills = plan.skills.map(function (id) {
      var skill = AUTEC.store.skills.find(function (item) { return item.id === id; });
      return skill ? skill.short : id;
    }).join(' + ');
    var action = '';
    if (opts.mode === 'admin') {
      action = '<button class="btn btn-ghost btn-sm" data-action="open-edit-plan" data-plan="' + plan.id + '">' + I('settings', 14) + ' Editar</button>';
    } else if (opts.mode === 'company' && opts.company) {
      action = opts.company.planId === plan.id
        ? '<span class="badge badge--accent">Plan actual</span>'
        : '<button class="btn btn-ghost btn-sm" data-action="open-request-plan" data-plan="' + plan.id + '" data-company="' + opts.company.id + '">Solicitar cambio</button>';
    }

    return '<article class="plan-card ' + (opts.highlight ? 'is-highlight' : '') + '" style="--plan-color:' + plan.color + '">'
      + '<div class="plan-card-head"><div><span class="eyebrow">' + plan.billing + '</span><h3>' + plan.name + '</h3></div>' + (plan.id === 'pro' ? '<span class="badge badge--accent">Recomendado</span>' : '') + '</div>'
      + '<div class="plan-price"><strong>' + (plan.price ? U.currency(plan.price) : 'Gratis') + '</strong><span>' + (plan.price ? '/' + plan.period : '') + '</span></div>'
      + '<p class="plan-desc">' + plan.description + '</p>'
      + '<div class="plan-meta"><div><span class="muted">Usuarios</span><strong>' + plan.seats + '</strong></div><div><span class="muted">Skills</span><strong>' + skills + '</strong></div></div>'
      + '<div class="plan-foot"><span class="muted small">' + companiesUsing + ' empresa' + (companiesUsing === 1 ? '' : 's') + '</span>' + action + '</div>'
      + '</article>';
  };

  C.rowMenu = function (items) {
    return '<details class="row-menu"><summary class="icon-btn" aria-label="Más acciones">' + I('more', 16) + '</summary><div class="menu-pop">'
      + items.map(function (item) {
        if (item.href) return '<a href="' + item.href + '">' + (item.icon ? I(item.icon, 14) : '') + item.label + '</a>';
        return '<button type="button" data-action="' + item.action + '"' + (item.attrs || '') + '>' + (item.icon ? I(item.icon, 14) : '') + item.label + '</button>';
      }).join('')
      + '</div></details>';
  };

  C.userTable = function (users, opts) {
    opts = opts || {};
    var canManage = opts.canManage !== false;
    if (!users.length) {
      return C.emptyState({ icon: 'users', title: 'Sin usuarios', text: 'No hay usuarios que coincidan con el filtro.' });
    }

    return '<div class="table-wrap"><table class="table"><thead><tr>'
      + '<th>Usuario</th><th>Rol</th><th>Estado</th><th>Último acceso</th>' + (canManage ? '<th class="th-actions">Acciones</th>' : '')
      + '</tr></thead><tbody>'
      + users.map(function (user) {
        var menu = canManage ? C.rowMenu([
          { label: 'Editar usuario', icon: 'user', action: 'open-edit-user', attrs: ' data-user="' + user.id + '"' },
          { label: 'Restablecer contraseña', icon: 'key', action: 'open-reset-password', attrs: ' data-user="' + user.id + '"' },
          { label: user.status === 'active' ? 'Desactivar' : 'Activar', icon: user.status === 'active' ? 'ban' : 'check', action: 'open-user-status', attrs: ' data-user="' + user.id + '"' }
        ]) : '';
        return '<tr>'
          + '<td><div class="cell-person">' + C.avatar(user.name, { className: 'avatar--sm' }) + '<div><strong>' + U.escapeHtml(user.name) + '</strong><span>' + U.escapeHtml(user.email) + '</span></div></div></td>'
          + '<td>' + C.roleBadge(user.role) + '</td>'
          + '<td>' + C.statusBadge(user.status) + '</td>'
          + '<td><span class="muted">' + U.escapeHtml(user.lastAccess) + '</span></td>'
          + (canManage ? '<td class="td-actions">' + menu + '</td>' : '')
          + '</tr>';
      }).join('')
      + '</tbody></table></div>';
  };

  C.auditTable = function (entries, opts) {
    opts = opts || {};
    if (!entries.length) {
      return C.emptyState({ icon: 'file', title: 'Sin registros', text: 'No hay actividad que coincida con el filtro.' });
    }

    return '<div class="table-wrap"><table class="table"><thead><tr>'
      + '<th>Fecha</th><th>Actor</th><th>Acción</th><th>Objetivo</th><th>Empresa</th><th>IP</th>'
      + '</tr></thead><tbody>'
      + entries.map(function (entry) {
        return '<tr>'
          + '<td><span class="mono muted">' + U.escapeHtml(entry.date) + '</span></td>'
          + '<td><strong>' + U.escapeHtml(entry.actor) + '</strong></td>'
          + '<td><span class="audit-action audit-action--' + U.actionTone(entry.actionType) + '">' + I(U.actionIcon(entry.actionType), 14) + U.escapeHtml(entry.action) + '</span></td>'
          + '<td>' + U.escapeHtml(entry.target) + '</td>'
          + '<td><span class="muted">' + U.escapeHtml(entry.companyName || '—') + '</span></td>'
          + '<td><span class="mono muted">' + U.escapeHtml(entry.ip) + '</span></td>'
          + '</tr>';
      }).join('')
      + '</tbody></table></div>';
  };

  C.requestTypeBadge = function (type) {
    return C.badge(U.requestTypeLabel(type), U.requestTypeTone(type), { dot: true });
  };

  C.notificationsModalBody = function () {
    var notifications = AUTEC.store.notifications;
    return '<div class="notification-list">'
      + notifications.map(function (notification) {
        return '<div class="notification-item ' + (notification.unread ? 'is-unread' : '') + '">'
          + '<span class="notification-icon notification-icon--' + notification.type + '">' + I(notification.type === 'request' ? 'inbox' : notification.type === 'warning' ? 'alert' : 'money', 17) + '</span>'
          + '<div class="notification-copy"><strong>' + U.escapeHtml(notification.title) + '</strong><p>' + U.escapeHtml(notification.text) + '</p><span class="muted small">' + U.escapeHtml(notification.time) + '</span></div>'
          + (notification.unread ? '<span class="unread-dot"></span>' : '')
          + '</div>';
      }).join('')
      + '</div>';
  };

  C.systemStatus = function () {
    var items = [
      { label: 'Servidor local', value: 'En línea', icon: 'server', tone: 'success' },
      { label: 'Base de datos', value: 'Operativa', icon: 'database', tone: 'success' },
      { label: 'Cámara DroidCam', value: '1 conectada', icon: 'camera', tone: 'success' }
    ];
    return '<div class="status-list">'
      + items.map(function (item) {
        return '<div class="status-row"><span class="status-icon">' + I(item.icon, 16) + '</span><div><strong>' + item.label + '</strong><span class="muted small">' + item.value + '</span></div><span class="status-dot status-dot--' + item.tone + '"></span></div>';
      }).join('')
      + '</div>';
  };

  AUTEC.components = C;
})();
