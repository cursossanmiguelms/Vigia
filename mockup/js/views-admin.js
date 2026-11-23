(function () {
  window.AUTEC = window.AUTEC || {};

  var U = AUTEC.utils;
  var C = AUTEC.components;
  var I = AUTEC.icon;
  var V = AUTEC.views = AUTEC.views || {};

  function esc(value) {
    return U.escapeHtml(value);
  }

  function planById(id) {
    return AUTEC.store.plans.find(function (plan) { return plan.id === id; });
  }

  function companyById(id) {
    return AUTEC.store.companies.find(function (company) { return company.id === id; });
  }

  function usersOf(companyId) {
    return AUTEC.store.users.filter(function (user) { return user.companyId === companyId; });
  }

  function pendingRequests() {
    return AUTEC.store.requests.filter(function (request) { return request.status === 'pending'; });
  }

  function skillGroupById(id) {
    return AUTEC.store.skillGroups.find(function (group) { return group.id === id; }) || AUTEC.store.skillGroups[0];
  }

  function skillsOfGroup(id) {
    return AUTEC.store.skills.filter(function (skill) { return skill.group === id; });
  }

  function requestStatusBadge(status) {
    return C.badge(U.requestStatusLabel(status), U.requestStatusTone(status), { dot: true });
  }

  function companyCell(company) {
    return '<div class="cell-person">'
      + C.companyAvatar(company, { className: 'avatar--sm' })
      + '<div><a class="table-link" href="#/admin/empresas/' + company.id + '">' + esc(company.name) + '</a><span>' + esc(company.contact) + ' · ' + esc(company.sector) + '</span></div>'
      + '</div>';
  }

  function expiryCell(company) {
    var meta = U.expiryMeta(company.expiresAt);
    var tone = meta.tone === 'danger' ? 'text-danger' : meta.tone === 'warning' ? 'text-warning' : 'muted';
    return '<span class="mono">' + U.formatDate(company.expiresAt, true) + '</span><br><span class="small ' + tone + '">' + esc(meta.text) + '</span>';
  }

  function companyRow(company) {
    var menu = C.rowMenu([
      { label: 'Ver detalle', icon: 'eye', href: '#/admin/empresas/' + company.id },
      { label: 'Editar empresa', icon: 'settings', action: 'open-edit-company', attrs: ' data-company="' + company.id + '"' },
      { label: company.status === 'suspended' ? 'Reactivar empresa' : 'Suspender empresa', icon: company.status === 'suspended' ? 'check' : 'ban', action: 'open-company-status', attrs: ' data-company="' + company.id + '"' }
    ]);

    return '<tr>'
      + '<td>' + companyCell(company) + '</td>'
      + '<td>' + C.planBadge(company.planId) + '</td>'
      + '<td>' + C.statusBadge(company.status) + '</td>'
      + '<td style="min-width:150px">' + C.seatUsage(company) + '</td>'
      + '<td>' + expiryCell(company) + '</td>'
      + '<td><span class="muted">' + esc(company.lastActivity) + '</span></td>'
      + '<td class="td-actions">' + menu + '</td>'
      + '</tr>';
  }

  function requestMini(request) {
    return '<div class="notification-item">'
      + '<span class="notification-icon notification-icon--request">' + I('inbox', 16) + '</span>'
      + '<div class="notification-copy"><strong>' + esc(request.companyName) + '</strong><p>' + esc(request.detail) + '</p><span class="muted small">' + esc(request.date) + '</span></div>'
      + C.requestTypeBadge(request.type)
      + '</div>';
  }

  function statusSelectOptions(selected) {
    return [
      { value: 'active', label: 'Activa' },
      { value: 'trial', label: 'Prueba' },
      { value: 'expired', label: 'Vencida' },
      { value: 'suspended', label: 'Suspendida' }
    ].map(function (option) {
      return '<option value="' + option.value + '"' + (selected === option.value ? ' selected' : '') + '>' + option.label + '</option>';
    }).join('');
  }

  function planSelectOptions(selected) {
    return AUTEC.store.plans.map(function (plan) {
      return '<option value="' + plan.id + '"' + (selected === plan.id ? ' selected' : '') + '>' + esc(plan.name) + ' · ' + plan.seats + ' usuarios</option>';
    }).join('');
  }

  V.adminOverview = function () {
    var state = AUTEC.app.state;
    var companies = AUTEC.store.companies;
    var active = companies.filter(function (company) { return company.status === 'active'; });
    var trial = companies.filter(function (company) { return company.status === 'trial'; });
    var mrr = active.reduce(function (sum, company) { return sum + Number(company.mrr || 0); }, 0);
    var totalUsers = companies.reduce(function (sum, company) { return sum + Number(company.usersCount || 0); }, 0);
    var pending = pendingRequests();
    var metrics = AUTEC.store.metrics;
    var recentAudit = AUTEC.store.audit.slice(0, 6);

    var kpis = '<div class="grid-4">'
      + C.kpi({
        label: 'MRR activo', value: U.currency(mrr), icon: 'money',
        meta: '<span class="badge badge--success">+4.5%</span><span>vs. mes anterior</span>',
        spark: C.sparkline(metrics.mrr, 'var(--accent)')
      })
      + C.kpi({
        label: 'Empresas', value: companies.length, icon: 'building',
        meta: '<span class="text-success">' + active.length + ' activas</span><span>·</span><span>' + trial.length + ' en prueba</span>'
      })
      + C.kpi({
        label: 'Usuarios', value: totalUsers, icon: 'users',
        meta: '<span class="badge badge--success">+6</span><span>este mes</span>',
        spark: C.sparkline(metrics.users, 'var(--data)')
      })
      + C.kpi({
        label: 'Solicitudes pendientes', value: pending.length, icon: 'inbox',
        meta: '<span class="text-warning">Requieren revisión</span>',
        className: pending.length ? 'kpi--attention' : ''
      })
      + '</div>';

    var catalogSkills = AUTEC.store.skills;
    var catalogGroups = AUTEC.store.skillGroups.filter(function (group) { return group.id !== 'base'; });
    var availableSkills = catalogSkills.filter(function (skill) { return skill.status === 'available'; });
    var industriesCard = C.card({
      eyebrow: 'Producto',
      title: 'Industrias y plataformas',
      subtitle: AUTEC.store.industries.length + ' industrias + drones · ' + catalogSkills.length + ' skills en catálogo · ' + availableSkills.length + ' disponibles',
      action: '<a class="btn btn-ghost btn-sm" href="#/admin/skills">Ver catálogo ' + I('arrow-right', 13) + '</a>',
      body: '<div class="industry-grid">' + catalogGroups.map(function (group) {
        var includesBase = group.id !== 'drones';
        var groupSkills = catalogSkills.filter(function (skill) {
          return skill.group === group.id || (includesBase && skill.group === 'base');
        });
        return C.industryCard(group, {
          skills: groupSkills.length,
          available: groupSkills.filter(function (skill) { return skill.status === 'available'; }).length
        });
      }).join('') + '</div>'
    });

    var revenue = C.card({
      eyebrow: 'Ingresos',
      title: 'Ingreso recurrente mensual',
      subtitle: 'Evolución de los últimos seis meses',
      action: C.badge('MRR', 'accent'),
      body: C.barChart(metrics.mrr, metrics.adminMonths, { money: true, color: 'var(--accent)' })
        + '<div class="chart-legend"><span class="legend-item"><span class="legend-dot"></span> Suscripciones activas</span><span class="legend-item"><span class="legend-dot" style="background:var(--surface-3)"></span> Sin incluir pruebas</span></div>'
    });

    var system = C.card({
      eyebrow: 'Plataforma',
      title: 'Estado del sistema',
      subtitle: 'Servicios locales de la maqueta',
      body: C.systemStatus()
        + '<div class="form-note" style="margin-top:14px">' + I('info', 14) + '<span>Todos los servicios responden con normalidad. La maqueta no ejecuta procesos reales.</span></div>'
    });

    var recentCompanies = C.card({
      title: 'Empresas recientes',
      subtitle: 'Últimas altas y movimientos',
      action: '<a class="btn btn-ghost btn-sm" href="#/admin/empresas">Ver todas ' + I('arrow-right', 13) + '</a>',
      flush: true,
      body: '<div class="table-wrap"><table class="table table--compact"><thead><tr><th>Empresa</th><th>Plan</th><th>Usuarios</th><th>Estado</th></tr></thead><tbody>'
        + companies.slice(0, 5).map(function (company) {
          return '<tr><td>' + companyCell(company) + '</td><td>' + C.planBadge(company.planId) + '</td><td><span class="mono">' + company.usersCount + ' / ' + company.seats + '</span></td><td>' + C.statusBadge(company.status) + '</td></tr>';
        }).join('')
        + '</tbody></table></div>'
    });

    var requestsCard = C.card({
      title: 'Solicitudes pendientes',
      subtitle: pending.length + ' por revisar',
      action: '<a class="btn btn-ghost btn-sm" href="#/admin/solicitudes">Bandeja ' + I('arrow-right', 13) + '</a>',
      body: pending.length
        ? '<div class="notification-list">' + pending.slice(0, 3).map(requestMini).join('') + '</div>'
        : C.emptyState({ icon: 'check-circle', title: 'Todo al día', text: 'No hay solicitudes pendientes en este momento.' })
    });

    var auditCard = C.card({
      title: 'Actividad reciente',
      subtitle: 'Registro de acciones de la plataforma',
      action: '<a class="btn btn-ghost btn-sm" href="#/admin/auditoria">Ver auditoría ' + I('arrow-right', 13) + '</a>',
      flush: true,
      body: C.auditTable(recentAudit)
    });

    return C.pageHead({
      eyebrow: 'Administración global',
      title: 'Resumen de la plataforma',
      subtitle: 'Empresas, ingresos, solicitudes y salud del sistema en una sola vista.',
      actions: '<button class="btn btn-ghost" data-action="export">' + I('download', 15) + ' Exportar</button><button class="btn btn-primary" data-action="open-new-company">' + I('plus', 15) + ' Nueva empresa</button>'
    })
      + kpis
      + '<div class="section-gap">' + industriesCard + '</div>'
      + '<div class="section-gap grid-main">' + revenue + system + '</div>'
      + '<div class="section-gap grid-main-2">' + recentCompanies + requestsCard + '</div>'
      + '<div class="section-gap">' + auditCard + '</div>';
  };

  V.adminCompanies = function () {
    var filters = AUTEC.app.state.filters.companies;
    var companies = AUTEC.store.companies.filter(function (company) {
      var q = filters.q.toLowerCase();
      var matchesQ = !q || (company.name + ' ' + company.contact + ' ' + company.sector + ' ' + company.email).toLowerCase().indexOf(q) !== -1;
      var matchesStatus = filters.status === 'all' || company.status === filters.status;
      var matchesPlan = filters.plan === 'all' || company.planId === filters.plan;
      return matchesQ && matchesStatus && matchesPlan;
    });

    var planOptions = '<option value="all">Todos los planes</option>' + AUTEC.store.plans.map(function (plan) {
      return '<option value="' + plan.id + '"' + (filters.plan === plan.id ? ' selected' : '') + '>' + esc(plan.name) + '</option>';
    }).join('');

    var table = companies.length
      ? '<div class="table-wrap"><table class="table"><thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Asientos</th><th>Vencimiento</th><th>Actividad</th><th class="th-actions">Acciones</th></tr></thead><tbody>'
        + companies.map(companyRow).join('')
        + '</tbody></table></div>'
      : C.emptyState({ icon: 'building', title: 'Sin empresas', text: 'No hay empresas que coincidan con los filtros aplicados.', action: '<button class="btn btn-ghost" data-action="clear-filters" data-scope="companies">Limpiar filtros</button>' });

    return C.pageHead({
      eyebrow: 'Gestión',
      title: 'Empresas',
      subtitle: 'Altas, planes, asientos y estado de cada operación registrada.',
      actions: '<button class="btn btn-ghost" data-action="export">' + I('download', 15) + ' Exportar</button><button class="btn btn-primary" data-action="open-new-company">' + I('plus', 15) + ' Nueva empresa</button>'
    })
      + '<div class="filter-bar">'
      + '<label class="filter-search">' + I('search', 15) + '<input id="filter-companies-q" data-filter="companies.q" value="' + esc(filters.q) + '" placeholder="Buscar empresa, contacto o sector..." aria-label="Buscar empresas"></label>'
      + '<select class="select filter-select" data-filter="companies.status" aria-label="Filtrar por estado"><option value="all">Todos los estados</option><option value="active"' + (filters.status === 'active' ? ' selected' : '') + '>Activas</option><option value="trial"' + (filters.status === 'trial' ? ' selected' : '') + '>En prueba</option><option value="expired"' + (filters.status === 'expired' ? ' selected' : '') + '>Vencidas</option><option value="suspended"' + (filters.status === 'suspended' ? ' selected' : '') + '>Suspendidas</option></select>'
      + '<select class="select filter-select" data-filter="companies.plan" aria-label="Filtrar por plan">' + planOptions + '</select>'
      + '<span class="filter-spacer"></span>'
      + '<span class="muted small">' + companies.length + ' de ' + AUTEC.store.companies.length + ' empresas</span>'
      + '</div>'
      + C.card({ flush: true, body: table });
  };

  V.adminCompanyDetail = function (companyId) {
    var company = companyById(companyId);
    if (!company) {
      return C.pageHead({ eyebrow: 'Empresas', title: 'Empresa no encontrada', subtitle: 'El registro que buscás no existe en esta maqueta.' })
        + C.card({ body: C.emptyState({ icon: 'building', title: 'Sin datos', text: 'Volvé al listado para elegir otra empresa.', action: '<a class="btn btn-primary" href="#/admin/empresas">Volver a empresas</a>' }) });
    }

    var plan = planById(company.planId) || AUTEC.store.plans[0];
    var companyUsers = usersOf(company.id);
    var sessions = AUTEC.store.sessions.filter(function (session) { return session.companyId === company.id; });
    var audit = AUTEC.store.audit.filter(function (entry) { return entry.companyId === company.id; });
    var planSkills = AUTEC.store.skills.filter(function (skill) {
      return plan.skills.indexOf(skill.id) !== -1;
    });
    var extraSkills = AUTEC.store.skills.filter(function (skill) {
      return plan.skills.indexOf(skill.id) === -1 && skill.industries.indexOf(company.sector) !== -1;
    });
    var skills = planSkills.concat(extraSkills).map(function (skill) {
      return C.skillCard(skill, { mode: 'admin-company', company: company });
    }).join('');
    var payments = company.payments || [];

    var head = '<div class="page-head">'
      + '<div class="page-head-copy">'
      + '<div class="eyebrow"><a class="muted" href="#/admin/empresas">Empresas</a> / Detalle</div>'
      + '<div class="page-title-row">' + C.companyAvatar(company, { className: 'avatar--lg' }) + '<h1>' + esc(company.name) + '</h1>' + C.statusBadge(company.status) + '</div>'
      + '<p>' + esc(company.sector) + ' · ' + esc(company.contact) + ' · Alta ' + U.formatDate(company.createdAt) + '</p>'
      + '</div>'
      + '<div class="page-head-actions">'
      + '<button class="btn btn-ghost" data-action="open-edit-company" data-company="' + company.id + '">' + I('settings', 15) + ' Editar</button>'
      + '<button class="btn btn-ghost" data-action="open-company-status" data-company="' + company.id + '">' + I(company.status === 'suspended' ? 'check' : 'ban', 15) + ' ' + (company.status === 'suspended' ? 'Reactivar' : 'Suspender') + '</button>'
      + '<button class="btn btn-primary" data-action="impersonate-company" data-company="' + company.id + '">' + I('eye', 15) + ' Entrar como soporte</button>'
      + '</div>'
      + '</div>';

    var kpis = '<div class="grid-4">'
      + C.kpi({ label: 'Usuarios', value: company.usersCount + ' / ' + company.seats, icon: 'users', meta: '<span>' + Math.round(company.usersCount / Math.max(1, company.seats) * 100) + '% de asientos usados</span>' })
      + C.kpi({ label: 'Skills activas', value: company.skills.length, icon: 'layers', meta: '<span>' + esc(company.skills.map(function (id) { var skill = AUTEC.store.skills.find(function (item) { return item.id === id; }); return skill ? skill.short : id; }).join(' · ')) + '</span>' })
      + C.kpi({ label: 'Sesiones activas', value: sessions.length, icon: 'activity', meta: '<span class="text-success">En línea ahora</span>' })
      + C.kpi({ label: 'Ingreso mensual', value: U.currency(company.mrr || 0), icon: 'money', meta: '<span>' + esc(plan.name) + ' · ' + (company.status === 'active' ? 'activo' : U.statusLabel(company.status).toLowerCase()) + '</span>' })
      + '</div>';

    var ficha = C.card({
      title: 'Ficha de la empresa',
      subtitle: 'Datos de contacto y condiciones comerciales',
      body: '<div class="status-list">'
        + '<div class="status-row"><span class="status-icon">' + I('user', 16) + '</span><div><strong>Contacto</strong><span class="muted small">' + esc(company.contact) + '</span></div></div>'
        + '<div class="status-row"><span class="status-icon">' + I('mail', 16) + '</span><div><strong>Email</strong><span class="muted small">' + esc(company.email) + '</span></div></div>'
        + '<div class="status-row"><span class="status-icon">' + I('phone', 16) + '</span><div><strong>Teléfono</strong><span class="muted small">' + esc(company.phone) + '</span></div></div>'
        + '<div class="status-row"><span class="status-icon">' + I('globe', 16) + '</span><div><strong>Dominio</strong><span class="muted small">' + esc(company.domain) + '</span></div></div>'
        + '<div class="status-row"><span class="status-icon">' + I('credit-card', 16) + '</span><div><strong>Plan</strong><span class="muted small">' + C.planBadge(plan.id) + ' · ' + U.currency(plan.price) + '/' + plan.period + '</span></div></div>'
        + '<div class="status-row"><span class="status-icon">' + I('users', 16) + '</span><div><strong>Asientos</strong><span class="muted small">' + company.usersCount + ' de ' + company.seats + ' asignados</span></div></div>'
        + '<div class="status-row"><span class="status-icon">' + I('calendar', 16) + '</span><div><strong>Vencimiento</strong><span class="muted small">' + U.formatDate(company.expiresAt) + ' · ' + U.expiryMeta(company.expiresAt).text + '</span></div></div>'
        + '</div>'
    });

    var skillsCard = C.card({
      title: 'Skills de la empresa',
      subtitle: planSkills.length + ' incluidas en el plan · ' + extraSkills.length + ' para el sector',
      action: '<a class="btn btn-ghost btn-sm" href="#/admin/skills">Catálogo ' + I('arrow-right', 13) + '</a>',
      body: '<div class="skills-grid skills-grid--2">' + skills + '</div>'
        + '<div class="form-note" style="margin-top:14px">' + I('info', 14) + '<span>El catálogo completo reúne ' + AUTEC.store.skills.length + ' skills para ' + AUTEC.store.industries.length + ' industrias y drones. Acá se muestran las del plan y las que aplican al sector.</span></div>'
    });

    var usersCard = C.card({
      title: 'Usuarios',
      subtitle: company.usersCount + ' de ' + company.seats + ' asientos asignados',
      action: '<button class="btn btn-ghost btn-sm" data-action="open-new-user" data-company="' + company.id + '">' + I('user-plus', 14) + ' Nuevo usuario</button>',
      flush: true,
      body: C.userTable(companyUsers, { canManage: true })
    });

    var paymentsTable = payments.length
      ? '<div class="table-wrap"><table class="table table--compact"><thead><tr><th>Fecha</th><th>Concepto</th><th>Método</th><th>Monto</th><th>Estado</th></tr></thead><tbody>'
        + payments.map(function (payment) {
          return '<tr><td><span class="mono muted">' + esc(payment.date) + '</span></td><td>' + esc(payment.concept) + '</td><td><span class="muted">' + esc(payment.method) + '</span></td><td><span class="mono">' + U.currency(payment.amount) + '</span></td><td>' + C.badge(payment.status, 'success', { dot: true }) + '</td></tr>';
        }).join('')
        + '</tbody></table></div>'
      : C.emptyState({ icon: 'credit-card', title: 'Sin pagos registrados', text: 'La empresa está en período de prueba o la facturación se gestiona fuera de la plataforma.' });

    var paymentsCard = C.card({ title: 'Facturación', subtitle: 'Últimos movimientos registrados', flush: true, body: paymentsTable });

    var sessionsCard = C.card({
      title: 'Sesiones activas',
      subtitle: sessions.length + ' conexiones',
      body: sessions.length
        ? '<div class="status-list">' + sessions.map(function (session) {
          return '<div class="status-row"><span class="status-icon">' + I('activity', 16) + '</span><div><strong>' + esc(session.userName) + '</strong><span class="muted small">' + U.roleLabel(session.role) + ' · ' + esc(session.ip) + ' · ' + esc(session.lastSeen) + '</span></div><button class="icon-btn is-danger" data-action="open-close-session" data-session="' + session.id + '" title="Cerrar sesión" aria-label="Cerrar sesión">' + I('logout', 15) + '</button></div>';
        }).join('') + '</div>'
        : C.emptyState({ icon: 'activity', title: 'Sin sesiones', text: 'No hay usuarios conectados en este momento.' })
    });

    var auditCard = C.card({
      title: 'Actividad de la empresa',
      subtitle: 'Últimos movimientos registrados',
      action: '<button class="btn btn-ghost btn-sm" data-action="filter-company-audit" data-company="' + company.id + '">Ver en auditoría ' + I('arrow-right', 13) + '</button>',
      flush: true,
      body: audit.length ? C.auditTable(audit.slice(0, 6)) : C.emptyState({ icon: 'file', title: 'Sin actividad', text: 'Todavía no hay acciones registradas para esta empresa.' })
    });

    return head + kpis
      + '<div class="section-gap grid-main">' + skillsCard + ficha + '</div>'
      + '<div class="section-gap">' + usersCard + '</div>'
      + '<div class="section-gap grid-main-2">' + paymentsCard + sessionsCard + '</div>'
      + '<div class="section-gap">' + auditCard + '</div>';
  };

  V.adminPlans = function () {
    var plans = AUTEC.store.plans;
    var counts = plans.map(function (plan) {
      return AUTEC.store.companies.filter(function (company) { return company.planId === plan.id; }).length;
    });

    return C.pageHead({
      eyebrow: 'Comercial',
      title: 'Planes y suscripciones',
      subtitle: 'Definí precio, asientos y skills incluidas. La activación sigue siendo manual en esta etapa.',
      actions: '<button class="btn btn-primary" data-action="open-new-plan">' + I('plus', 15) + ' Nuevo plan</button>'
    })
      + '<div class="plan-grid">' + plans.map(function (plan) {
        return C.planCard(plan, { mode: 'admin', highlight: plan.id === 'pro' });
      }).join('') + '</div>'
      + '<div class="section-gap grid-main-2">'
      + C.card({
        eyebrow: 'Distribución',
        title: 'Empresas por plan',
        subtitle: 'Composición actual de la cartera',
        body: C.barChart(counts, plans.map(function (plan) { return plan.name; }), { color: 'var(--data)', showValues: true })
      })
      + C.card({
        title: 'Reglas de negocio',
        subtitle: 'Cómo funciona la activación en la maqueta',
        body: '<div class="status-list">'
          + '<div class="status-row"><span class="status-icon">' + I('users', 16) + '</span><div><strong>Asientos configurables</strong><span class="muted small">Cada empresa puede tener un límite distinto al de su plan.</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('check-circle', 16) + '</span><div><strong>Activación manual</strong><span class="muted small">El creador aprueba la solicitud y asigna plan y asientos.</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('credit-card', 16) + '</span><div><strong>Sin pasarela de pago</strong><span class="muted small">Los pagos se registran a mano para validar el flujo.</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('layers', 16) + '</span><div><strong>Skills por plan</strong><span class="muted small">El plan define qué skills puede activar la empresa.</span></div></div>'
          + '</div>'
      })
      + '</div>';
  };

  V.adminSkills = function () {
    var skills = AUTEC.store.skills;
    var groups = AUTEC.store.skillGroups;
    var filters = AUTEC.app.state.filters.skills;
    var available = skills.filter(function (skill) { return skill.status === 'available'; });
    var training = skills.filter(function (skill) { return skill.status === 'training'; });
    var soon = skills.filter(function (skill) { return skill.status === 'soon'; });
    var q = filters.q.toLowerCase();
    var filtered = skills.filter(function (skill) {
      var group = skillGroupById(skill.group);
      var matchesQ = !q || (skill.name + ' ' + skill.short + ' ' + skill.description + ' ' + skill.industries.join(' ') + ' ' + group.name).toLowerCase().indexOf(q) !== -1;
      var matchesGroup = filters.group === 'all' || skill.group === filters.group;
      var matchesStatus = filters.status === 'all' || skill.status === filters.status;
      return matchesQ && matchesGroup && matchesStatus;
    });

    var groupOptions = '<option value="all">Todas las categorías</option>' + groups.map(function (group) {
      return '<option value="' + group.id + '"' + (filters.group === group.id ? ' selected' : '') + '>' + esc(group.name) + '</option>';
    }).join('');
    var statusOptions = '<option value="all">Todos los estados</option>'
      + '<option value="available"' + (filters.status === 'available' ? ' selected' : '') + '>Disponibles</option>'
      + '<option value="training"' + (filters.status === 'training' ? ' selected' : '') + '>En entrenamiento</option>'
      + '<option value="soon"' + (filters.status === 'soon' ? ' selected' : '') + '>Próximamente</option>';

    var toolbar = '<div class="filter-bar section-gap">'
      + '<label class="filter-search">' + I('search', 15) + '<input id="filter-skills-q" data-filter="skills.q" value="' + esc(filters.q) + '" placeholder="Buscar skill o industria..." aria-label="Buscar skills"></label>'
      + '<select class="select filter-select" data-filter="skills.group" aria-label="Filtrar por categoría">' + groupOptions + '</select>'
      + '<select class="select filter-select" data-filter="skills.status" aria-label="Filtrar por estado">' + statusOptions + '</select>'
      + '<div class="filter-spacer"></div>'
      + '<span class="muted small">' + filtered.length + ' de ' + skills.length + ' skills</span>'
      + '<button class="btn btn-ghost btn-sm" data-action="clear-filters" data-scope="skills">Limpiar</button>'
      + '</div>';

    var droneSkills = skillsOfGroup('drones');
    var droneTraining = droneSkills.filter(function (skill) { return skill.status === 'training'; }).length;
    var droneSoon = droneSkills.filter(function (skill) { return skill.status === 'soon'; }).length;
    var droneCallout = '<div class="drone-callout section-gap">'
      + '<span class="drone-glyph">' + I('drone', 30) + '</span>'
      + '<div class="drone-copy"><span class="eyebrow">Nueva plataforma</span><h2>Drones</h2><p>El software también puede operar sobre la cámara de un dron. De esa línea salen skills de patrullaje, conteo aéreo, EPP, inspección térmica e infraestructura.</p></div>'
      + '<div class="drone-meta">' + C.badge(droneSkills.length + ' skills', 'accent') + C.badge(droneTraining + ' en entrenamiento', 'warning') + (droneSoon ? C.badge(droneSoon + ' próximas', 'neutral') : '') + '</div>'
      + '</div>';

    var visibleGroups = groups.map(function (group) {
      return {
        group: group,
        skills: filtered.filter(function (skill) { return skill.group === group.id; })
      };
    }).filter(function (entry) { return entry.skills.length; });

    var groupSections = visibleGroups.map(function (entry) {
      var group = entry.group;
      var groupAvailable = entry.skills.filter(function (skill) { return skill.status === 'available'; }).length;
      var groupTraining = entry.skills.filter(function (skill) { return skill.status === 'training'; }).length;
      var extra = '';
      if (groupAvailable) extra += C.badge(groupAvailable + ' disponibles', 'success');
      if (groupTraining) extra += C.badge(groupTraining + ' en entrenamiento', 'warning');
      return '<section class="skill-group' + (group.id === 'drones' ? ' skill-group--drones' : '') + '">'
        + '<div class="skill-group-head">'
        + '<div class="skill-group-title"><span class="industry-icon">' + I(group.icon || 'layers', 18) + '</span><div><h2>' + esc(group.name) + (group.id === 'drones' ? ' <span class="badge badge--accent">Nueva línea</span>' : '') + '</h2><p>' + esc(group.description) + '</p></div></div>'
        + '<div class="skill-group-meta">' + C.badge(entry.skills.length + (entry.skills.length === 1 ? ' skill' : ' skills'), 'neutral') + extra + '</div>'
        + '</div>'
        + '<div class="skills-grid">' + entry.skills.map(function (skill) { return C.skillCard(skill, { mode: 'catalog' }); }).join('') + '</div>'
        + '</section>';
    }).join('');

    var empty = C.emptyState({
      icon: 'layers',
      title: 'Sin skills en esta vista',
      text: 'No hay skills que coincidan con la búsqueda o los filtros aplicados.',
      action: '<button class="btn btn-ghost" data-action="clear-filters" data-scope="skills">Limpiar filtros</button>'
    });

    var nextUp = training.concat(soon).slice(0, 8);
    var roadmapRows = nextUp.map(function (skill) {
      var group = skillGroupById(skill.group);
      return '<div class="roadmap-row"><div class="roadmap-copy"><strong>' + esc(skill.name) + '</strong><span class="muted small">' + esc(group.name) + ' · ' + (skill.status === 'training' ? 'Entrenamiento y validación' : 'En investigación') + '</span></div>'
        + '<div class="roadmap-progress">' + C.progress(skill.progress, 100, skill.status === 'training' ? 'warning' : 'accent') + '</div>'
        + '<span class="mono muted small">' + (skill.status === 'training' ? skill.progress + '%' : '—') + '</span></div>';
    }).join('');

    return C.pageHead({
      eyebrow: 'Producto',
      title: 'Catálogo de skills',
      subtitle: 'Todas las capacidades por industria y estado. Las disponibles se activan por empresa; el resto se solicita y queda en roadmap.',
      actions: C.badge(skills.length + ' skills', 'accent', { dot: true })
    })
      + droneCallout
      + toolbar
      + '<div class="section-gap">' + (groupSections || empty) + '</div>'
      + '<div class="section-gap grid-main-2">'
      + C.card({
        title: 'Estado del roadmap',
        subtitle: available.length + ' disponibles · ' + training.length + ' en entrenamiento · ' + soon.length + ' próximas',
        body: roadmapRows
          + '<div class="form-note" style="margin-top:14px">' + I('info', 14) + '<span>Se muestran los próximos hitos. El catálogo completo reúne ' + skills.length + ' skills para ' + AUTEC.store.industries.length + ' industrias y drones.</span></div>'
      })
      + C.card({
        title: 'Cómo se entrena una skill',
        subtitle: 'El mismo proceso para cada nueva capacidad',
        body: '<div class="status-list">'
          + '<div class="status-row"><span class="status-icon">' + I('database', 16) + '</span><div><strong>01 · Dataset propio</strong><span class="muted small">Imágenes reales de la operación, etiquetadas por el equipo.</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('zap', 16) + '</span><div><strong>02 · Entrenamiento</strong><span class="muted small">Ajuste del modelo y pruebas controladas en local.</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('eye', 16) + '</span><div><strong>03 · Validación en campo</strong><span class="muted small">Comparación con la operación real y corrección de falsos positivos.</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('check-circle', 16) + '</span><div><strong>04 · Disponible</strong><span class="muted small">Se habilita por empresa según el plan contratado.</span></div></div>'
          + '</div>'
          + '<div class="form-note" style="margin-top:14px">' + I('info', 14) + '<span>' + training.length + ' skills están en entrenamiento y ' + soon.length + ' figuran como próximas. Ninguna se puede activar hasta completar la validación.</span></div>'
      })
      + '</div>';
  };

  V.adminRequests = function () {
    var filters = AUTEC.app.state.filters.requests;
    var requests = AUTEC.store.requests.filter(function (request) {
      var q = filters.q.toLowerCase();
      var matchesQ = !q || (request.companyName + ' ' + request.detail).toLowerCase().indexOf(q) !== -1;
      var matchesType = filters.type === 'all' || request.type === filters.type;
      var matchesStatus = filters.status === 'all' || request.status === filters.status;
      return matchesQ && matchesType && matchesStatus;
    }).sort(function (a, b) {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return 0;
    });

    var rows = requests.map(function (request) {
      var company = request.companyId ? companyById(request.companyId) : null;
      var cell = '<div class="cell-person">'
        + (company ? C.companyAvatar(company, { className: 'avatar--sm' }) : C.avatar(request.companyName, { className: 'avatar--sm' }))
        + '<div><strong>' + esc(request.companyName) + '</strong><span>' + (company ? 'Empresa registrada' : 'Solicitud externa') + '</span></div>'
        + '</div>';
      var actions = request.status === 'pending'
        ? '<div class="inline-actions"><button class="icon-btn" data-action="open-approve-request" data-request="' + request.id + '" title="Aprobar" aria-label="Aprobar solicitud">' + I('check', 16) + '</button><button class="icon-btn is-danger" data-action="open-reject-request" data-request="' + request.id + '" title="Rechazar" aria-label="Rechazar solicitud">' + I('x', 16) + '</button></div>'
        : '<span class="muted small">Resuelta</span>';

      return '<tr>'
        + '<td>' + C.requestTypeBadge(request.type) + '</td>'
        + '<td>' + cell + '</td>'
        + '<td>' + esc(request.detail) + '</td>'
        + '<td><span class="mono muted">' + esc(request.date) + '</span></td>'
        + '<td>' + requestStatusBadge(request.status) + '</td>'
        + '<td class="td-actions">' + actions + '</td>'
        + '</tr>';
    }).join('');

    var table = requests.length
      ? '<div class="table-wrap"><table class="table"><thead><tr><th>Tipo</th><th>Empresa</th><th>Detalle</th><th>Fecha</th><th>Estado</th><th class="th-actions">Acciones</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : C.emptyState({ icon: 'inbox', title: 'Sin solicitudes', text: 'No hay solicitudes que coincidan con los filtros aplicados.', action: '<button class="btn btn-ghost" data-action="clear-filters" data-scope="requests">Limpiar filtros</button>' });

    return C.pageHead({
      eyebrow: 'Bandeja',
      title: 'Solicitudes',
      subtitle: 'Altas de empresas, cambios de plan, asientos y skills solicitadas.',
      actions: C.badge(pendingRequests().length + ' pendientes', pendingRequests().length ? 'warning' : 'success', { dot: true })
    })
      + '<div class="filter-bar">'
      + '<label class="filter-search">' + I('search', 15) + '<input id="filter-requests-q" data-filter="requests.q" value="' + esc(filters.q) + '" placeholder="Buscar empresa o detalle..." aria-label="Buscar solicitudes"></label>'
      + '<select class="select filter-select" data-filter="requests.type" aria-label="Filtrar por tipo"><option value="all">Todos los tipos</option><option value="company"' + (filters.type === 'company' ? ' selected' : '') + '>Nueva empresa</option><option value="skill"' + (filters.type === 'skill' ? ' selected' : '') + '>Skill</option><option value="seats"' + (filters.type === 'seats' ? ' selected' : '') + '>Usuarios</option><option value="plan"' + (filters.type === 'plan' ? ' selected' : '') + '>Cambio de plan</option><option value="renewal"' + (filters.type === 'renewal' ? ' selected' : '') + '>Renovación</option></select>'
      + '<select class="select filter-select" data-filter="requests.status" aria-label="Filtrar por estado"><option value="all">Todos los estados</option><option value="pending"' + (filters.status === 'pending' ? ' selected' : '') + '>Pendientes</option><option value="approved"' + (filters.status === 'approved' ? ' selected' : '') + '>Aprobadas</option><option value="rejected"' + (filters.status === 'rejected' ? ' selected' : '') + '>Rechazadas</option></select>'
      + '<span class="filter-spacer"></span><span class="muted small">' + requests.length + ' solicitudes</span>'
      + '</div>'
      + C.card({ flush: true, body: table });
  };

  V.adminSessions = function () {
    var filters = AUTEC.app.state.filters.sessions;
    var sessions = AUTEC.store.sessions.filter(function (session) {
      var q = filters.q.toLowerCase();
      var matchesQ = !q || (session.userName + ' ' + session.companyName + ' ' + session.ip).toLowerCase().indexOf(q) !== -1;
      var matchesCompany = filters.company === 'all' || session.companyId === filters.company;
      return matchesQ && matchesCompany;
    });
    var companyOptions = '<option value="all">Todas las empresas</option>' + AUTEC.store.companies.map(function (company) {
      return '<option value="' + company.id + '"' + (filters.company === company.id ? ' selected' : '') + '>' + esc(company.name) + '</option>';
    }).join('');

    var rows = sessions.map(function (session) {
      return '<tr>'
        + '<td><div class="cell-person">' + C.avatar(session.userName, { className: 'avatar--sm' }) + '<div><strong>' + esc(session.userName) + '</strong><span>' + esc(session.companyName) + '</span></div></div></td>'
        + '<td>' + C.roleBadge(session.role) + '</td>'
        + '<td><span class="mono muted">' + esc(session.ip) + '</span></td>'
        + '<td><span class="mono">' + esc(session.startedAt) + '</span></td>'
        + '<td><span class="muted">' + esc(session.lastSeen) + '</span></td>'
        + '<td class="td-actions"><button class="icon-btn is-danger" data-action="open-close-session" data-session="' + session.id + '" title="Cerrar sesión" aria-label="Cerrar sesión">' + I('logout', 16) + '</button></td>'
        + '</tr>';
    }).join('');

    var table = sessions.length
      ? '<div class="table-wrap"><table class="table"><thead><tr><th>Usuario</th><th>Rol</th><th>IP</th><th>Inicio</th><th>Última actividad</th><th class="th-actions">Acciones</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : C.emptyState({ icon: 'activity', title: 'Sin sesiones', text: 'No hay conexiones que coincidan con los filtros.' });

    var uniqueCompanies = {};
    sessions.forEach(function (session) { uniqueCompanies[session.companyId] = true; });

    return C.pageHead({
      eyebrow: 'Sistema',
      title: 'Sesiones',
      subtitle: 'Conexiones activas de todas las empresas. Podés cerrar una sesión manualmente.',
      actions: '<button class="btn btn-ghost" data-action="export">' + I('download', 15) + ' Exportar</button>'
    })
      + '<div class="grid-3">'
      + C.kpi({ label: 'Sesiones activas', value: sessions.length, icon: 'activity', meta: '<span class="text-success">En línea</span>' })
      + C.kpi({ label: 'Empresas conectadas', value: Object.keys(uniqueCompanies).length, icon: 'building', meta: '<span>Con al menos una sesión</span>' })
      + C.kpi({ label: 'Usuarios únicos', value: sessions.length, icon: 'users', meta: '<span>Sin duplicados en la maqueta</span>' })
      + '</div>'
      + '<div class="section-gap filter-bar">'
      + '<label class="filter-search">' + I('search', 15) + '<input id="filter-sessions-q" data-filter="sessions.q" value="' + esc(filters.q) + '" placeholder="Buscar usuario, empresa o IP..." aria-label="Buscar sesiones"></label>'
      + '<select class="select filter-select" data-filter="sessions.company" aria-label="Filtrar por empresa">' + companyOptions + '</select>'
      + '<span class="filter-spacer"></span><span class="muted small">' + sessions.length + ' conexiones</span>'
      + '</div>'
      + C.card({ flush: true, body: table })
      + '<div class="form-note section-gap">' + I('info', 14) + '<span>En la maqueta las sesiones son ficticias. En producción se cerrarán automáticamente por inactividad y quedarán registradas en auditoría.</span></div>';
  };

  V.adminAudit = function () {
    var filters = AUTEC.app.state.filters.audit;
    var entries = AUTEC.store.audit.filter(function (entry) {
      var q = filters.q.toLowerCase();
      var matchesQ = !q || (entry.actor + ' ' + entry.action + ' ' + entry.target + ' ' + entry.companyName).toLowerCase().indexOf(q) !== -1;
      var matchesType = filters.type === 'all' || entry.actionType === filters.type;
      var matchesCompany = filters.company === 'all' || entry.companyId === filters.company;
      return matchesQ && matchesType && matchesCompany;
    });
    var companyOptions = '<option value="all">Todas las empresas</option>' + AUTEC.store.companies.map(function (company) {
      return '<option value="' + company.id + '"' + (filters.company === company.id ? ' selected' : '') + '>' + esc(company.name) + '</option>';
    }).join('');

    return C.pageHead({
      eyebrow: 'Sistema',
      title: 'Auditoría',
      subtitle: 'Registro de acciones de creadores, empresas y procesos automáticos.',
      actions: '<button class="btn btn-ghost" data-action="export">' + I('download', 15) + ' Exportar CSV</button>'
    })
      + '<div class="filter-bar">'
      + '<label class="filter-search">' + I('search', 15) + '<input id="filter-audit-q" data-filter="audit.q" value="' + esc(filters.q) + '" placeholder="Buscar actor, acción u objetivo..." aria-label="Buscar auditoría"></label>'
      + '<select class="select filter-select" data-filter="audit.type" aria-label="Filtrar por tipo"><option value="all">Todas las acciones</option><option value="create"' + (filters.type === 'create' ? ' selected' : '') + '>Altas</option><option value="update"' + (filters.type === 'update' ? ' selected' : '') + '>Cambios</option><option value="delete"' + (filters.type === 'delete' ? ' selected' : '') + '>Bajas</option><option value="login"' + (filters.type === 'login' ? ' selected' : '') + '>Accesos</option><option value="payment"' + (filters.type === 'payment' ? ' selected' : '') + '>Pagos</option><option value="request"' + (filters.type === 'request' ? ' selected' : '') + '>Solicitudes</option><option value="system"' + (filters.type === 'system' ? ' selected' : '') + '>Sistema</option></select>'
      + '<select class="select filter-select" data-filter="audit.company" aria-label="Filtrar por empresa">' + companyOptions + '</select>'
      + '<span class="filter-spacer"></span><span class="muted small">' + entries.length + ' registros</span>'
      + '</div>'
      + C.card({ flush: true, body: C.auditTable(entries) })
      + '<div class="form-note section-gap">' + I('shield-check', 14) + '<span>El registro es de solo lectura en la maqueta. En producción será inmutable y conservará el actor, la IP y el objetivo de cada acción.</span></div>';
  };

  function settingRow(key, title, text, enabled) {
    return '<div class="setting-row"><div class="setting-copy"><strong>' + title + '</strong><span class="muted small">' + text + '</span></div>'
      + '<button class="switch ' + (enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (enabled ? 'true' : 'false') + '" data-action="toggle-setting" data-key="' + key + '" aria-label="' + title + '"><span></span></button></div>';
  }

  V.adminSettings = function () {
    var settings = AUTEC.app.state.settings;
    var system = C.card({
      title: 'Estado del sistema',
      subtitle: 'Servicios de la maqueta',
      body: C.systemStatus()
        + '<div class="status-list" style="margin-top:8px">'
        + '<div class="status-row"><span class="status-icon">' + I('server', 16) + '</span><div><strong>Versión</strong><span class="muted small">VigIA 0.4.0 · mockup</span></div></div>'
        + '<div class="status-row"><span class="status-icon">' + I('monitor', 16) + '</span><div><strong>Modo</strong><span class="muted small">Demostración local, sin backend</span></div></div>'
        + '</div>'
    });

    var danger = C.card({
      title: 'Datos de demostración',
      subtitle: 'Todo el estado vive en memoria',
      body: '<p class="muted small">Reiniciar la demo restaura empresas, usuarios, solicitudes, sesiones y auditoría a su estado inicial. No se borra ningún dato real.</p>'
        + '<div class="inline-actions" style="margin-top:14px"><button class="btn btn-danger" data-action="demo-reset">' + I('refresh', 15) + ' Reiniciar datos</button></div>'
    });

    return C.pageHead({
      eyebrow: 'Sistema',
      title: 'Ajustes de la plataforma',
      subtitle: 'Identidad, seguridad y notificaciones globales. Los cambios son simulados.',
      actions: '<button class="btn btn-primary" data-action="save-settings">' + I('check', 15) + ' Guardar cambios</button>'
    })
      + '<div class="grid-main">'
      + '<div class="stack">'
      + C.card({
        title: 'Identidad de la plataforma',
        subtitle: 'Datos visibles para empresas y usuarios',
        body: '<form class="form-grid" data-form="admin-settings">'
          + '<div class="field-row"><div class="field"><label for="platform-name">Nombre</label><input class="input" id="platform-name" name="platformName" value="VigIA"></div><div class="field"><label for="platform-domain">Dominio</label><input class="input" id="platform-domain" name="domain" value="vigia.local"></div></div>'
          + '<div class="field-row"><div class="field"><label for="platform-zone">Zona horaria</label><select class="select" id="platform-zone" name="timezone"><option>America/Argentina/Buenos_Aires</option><option>America/Santiago</option><option>America/Mexico_City</option></select></div><div class="field"><label for="platform-language">Idioma</label><select class="select" id="platform-language" name="language"><option>Español (Argentina)</option><option>Español (neutral)</option><option>English</option></select></div></div>'
          + '<div class="form-note">' + I('info', 14) + '<span>El nombre y el dominio son de ejemplo. En producción se usarán para el acceso y las notificaciones.</span></div>'
          + '<div class="inline-actions"><button class="btn btn-primary btn-sm" type="submit">' + I('check', 14) + ' Guardar identidad</button></div>'
          + '</form>'
      })
      + C.card({
        title: 'Seguridad',
        subtitle: 'Políticas globales de acceso',
        body: '<form class="form-grid" data-form="security-settings">'
          + settingRow('mfa', 'MFA obligatorio', 'Exigir segundo factor a creadores y administradores.', settings.mfa)
          + settingRow('idleLogout', 'Cierre por inactividad', 'Cerrar sesiones después de 30 minutos sin actividad.', settings.idleLogout)
          + settingRow('loginAlerts', 'Alertas de inicio de sesión', 'Notificar accesos desde dispositivos nuevos.', settings.loginAlerts)
          + '<div class="field-row"><div class="field"><label for="session-timeout">Timeout de sesión</label><select class="select" id="session-timeout" name="timeout"><option>15 minutos</option><option selected>30 minutos</option><option>60 minutos</option></select></div><div class="field"><label for="session-limit">Sesiones por usuario</label><select class="select" id="session-limit" name="limit"><option>1</option><option selected>3</option><option>5</option></select></div></div>'
          + '<div class="inline-actions"><button class="btn btn-primary btn-sm" type="submit">' + I('check', 14) + ' Guardar seguridad</button></div>'
          + '</form>'
      })
      + C.card({
        title: 'Notificaciones',
        subtitle: 'Qué eventos generan avisos',
        body: '<form class="form-grid" data-form="notification-settings">'
          + settingRow('requestAlerts', 'Nuevas solicitudes', 'Avisar al creador cuando una empresa solicite acceso.', settings.requestAlerts)
          + settingRow('expiryAlerts', 'Vencimientos', 'Avisar 7 días antes del vencimiento de un plan.', settings.expiryAlerts)
          + settingRow('paymentAlerts', 'Pagos registrados', 'Avisar cuando se registre un pago manual.', settings.paymentAlerts)
          + settingRow('emailDigest', 'Resumen semanal', 'Enviar un resumen de operación y solicitudes.', settings.emailDigest)
          + '<div class="inline-actions"><button class="btn btn-primary btn-sm" type="submit">' + I('check', 14) + ' Guardar notificaciones</button></div>'
          + '</form>'
      })
      + '</div>'
      + '<div class="stack">' + system + danger
      + C.card({
        title: 'Acerca de',
        subtitle: 'Maqueta visual',
        body: '<div class="status-list">'
          + '<div class="status-row"><span class="status-icon">' + I('shield-check', 16) + '</span><div><strong>VigIA</strong><span class="muted small">Plataforma local de visión artificial</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('server', 16) + '</span><div><strong>Build</strong><span class="muted small">mockup-2026.11.11</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('mail', 16) + '</span><div><strong>Soporte</strong><span class="muted small">soporte@vigia.local</span></div></div>'
          + '</div>'
      })
      + '</div></div>';
  };
})();
