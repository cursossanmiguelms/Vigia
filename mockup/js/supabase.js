(function () {
  window.AUTEC = window.AUTEC || {};

  var BACKEND = (function () {
    try {
      var params = new URLSearchParams(location.search);
      var override = params.get('api');
      if (override) return String(override).replace(/\/+$/, '');
    } catch (_) {}
    if (location.protocol === 'file:') return 'http://127.0.0.1:8000';
    if (location.port === '8081') return 'http://127.0.0.1:8000';
    return '';
  })();

  var FETCH_TIMEOUT = 5000;
  var CONFIG_KINDS = {
    zones: 'autecVision.zones.v1',
    lines: 'autecVision.line.v1',
    heatmap: 'autecVision.heatmap.v1',
    epp: 'autecVision.epp.v1',
    tables: 'autecVision.tables.v1',
    falls: 'autecVision.falls.v1',
    areas: 'autecVision.areas.v1',
    cameras: 'autecVision.cameras.v1',
    camera: 'autecVision.camera.v1',
    cameraSound: 'autecVision.alertSound.v1'
  };

  var LEGACY_TO_KIND = (function () {
    var map = {};
    Object.keys(CONFIG_KINDS).forEach(function (kind) { map[CONFIG_KINDS[kind]] = kind; });
    return map;
  })();

  var S = AUTEC.supabase = {
    backend: BACKEND,
    configured: false,
    source: 'demo',
    lastError: '',
    data: null,
    baseline: null,
    captureCompanyId: '',
    captureCameraId: ''
  };

  // Espejo de la configuración local: los módulos siguen usando localStorage
  // (claves autecVision.*) y nosotros replicamos el cambio en app_configs.
  (function mirrorLocalConfig() {
    if (typeof Storage === 'undefined' || !Storage.prototype || !Storage.prototype.setItem) return;
    var originalSetItem = Storage.prototype.setItem;
    var timers = {};
    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value);
      var kind = LEGACY_TO_KIND[key];
      if (!kind || !S.configured) return;
      clearTimeout(timers[key]);
      timers[key] = setTimeout(function () {
        var companyId = S.captureCompanyId;
        try {
          if (!companyId && AUTEC.app && AUTEC.app.currentCompany) {
            var company = AUTEC.app.currentCompany();
            companyId = company ? company.id : '';
          }
        } catch (_) {}
        var payload = {};
        try { payload = JSON.parse(value); } catch (_) { payload = value; }
        S.saveConfig(companyId || 'global', kind, payload);
      }, 300);
    };
  })();

  function endpoint(path) {
    return BACKEND + path;
  }

  function request(path, options) {
    options = options || {};
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT) : null;
    var init = {
      method: options.method || 'GET',
      headers: options.headers || {},
      cache: 'no-store',
      credentials: 'omit'
    };
    if (controller) init.signal = controller.signal;
    if (options.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    return fetch(endpoint(path), init)
      .then(function (response) {
        return response.text().then(function (text) {
          var payload = null;
          try { payload = text ? JSON.parse(text) : null; } catch (_) {}
          if (!response.ok || (payload && payload.ok === false)) {
            var message = (payload && (payload.error || payload.message)) || ('HTTP ' + response.status);
            throw new Error(message);
          }
          return payload;
        });
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  function fetchTable(table, query) {
    var params = new URLSearchParams(query || {});
    return request('/api/db/' + table + '?' + params.toString()).then(function (response) {
      return Array.isArray(response && response.data) ? response.data : [];
    });
  }

  function readJson(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function slug(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function toPlan(row) {
    return {
      id: row.id,
      name: row.name,
      price: Number(row.price) || 0,
      period: row.period || '',
      billing: row.billing || '',
      seats: Number(row.seats) || 0,
      durationDays: Number(row.duration_days) || 30,
      skills: row.skills || [],
      color: row.color || '#22D3EE',
      description: row.description || ''
    };
  }

  function toCompany(row) {
    return {
      id: row.id,
      name: row.name,
      short: row.short || '',
      sector: row.sector || '',
      status: row.status || 'active',
      planId: row.plan_id || '',
      seats: Number(row.seats) || 0,
      usersCount: Number(row.users_count) || 0,
      expiresAt: row.expires_at || '',
      createdAt: row.created_at || '',
      contact: row.contact || '',
      email: row.email || '',
      phone: row.phone || '',
      skills: row.skills || [],
      lastActivity: row.last_activity || '',
      mrr: Number(row.mrr) || 0,
      color: row.color || '#22D3EE',
      domain: row.domain || '',
      payments: []
    };
  }

  function toProfile(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      lastAccess: row.last_access || '',
      companyId: row.company_id || null
    };
  }

  function toSkill(row) {
    return {
      id: row.id,
      name: row.name,
      short: row.short || '',
      status: row.status || 'available',
      group: row.group_name || 'base',
      description: row.description || '',
      industries: row.industries || [],
      icon: row.icon || 'layers',
      progress: Number(row.progress) || 0,
      globalActive: Boolean(row.global_active),
      companiesUsing: Number(row.companies_using) || 0,
      featured: Boolean(row.featured),
      pilot: Boolean(row.pilot)
    };
  }

  function toRequest(row) {
    return {
      id: row.id,
      type: row.type || 'company',
      companyId: row.company_id || null,
      companyName: row.company_name || '',
      skillId: row.skill_id || null,
      detail: row.detail || '',
      status: row.status || 'pending',
      createdAt: row.created_at || ''
    };
  }

  function toSession(row) {
    return {
      id: row.id,
      userId: row.profile_id || '',
      userName: row.user_name || '',
      companyId: row.company_id || '',
      companyName: row.company_name || '',
      role: row.role || 'operator',
      ip: row.ip || '',
      startedAt: row.started_at || '',
      endedAt: row.ended_at || ''
    };
  }

  function toAudit(row) {
    return {
      id: row.id,
      date: row.created_at || '',
      actor: row.actor || '',
      action: row.action || '',
      actionType: row.action_type || 'update',
      target: row.target || '',
      companyId: row.company_id || null,
      companyName: row.company_name || '—',
      ip: row.ip || '—'
    };
  }

  function toNotification(row) {
    return {
      id: row.id,
      title: row.title || '',
      text: row.body || '',
      time: row.created_at || '',
      unread: Boolean(row.unread),
      type: row.type || 'info'
    };
  }

  function isoDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function SpanishDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    var months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return String(date.getDate()).padStart(2, '0') + ' ' + months[date.getMonth()] + ' ' + date.getFullYear()
      + ' · ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  function decode(row) {
    var payments = [];
    for (var key in row) {
      if (Object.prototype.hasOwnProperty.call(row, key) && key.indexOf('payment_') === 0) {
        payments.push(row[key]);
      }
    }
    return payments;
  }

  function fetchAppSnapshot() {
    return Promise.all([
      fetchTable('plans', { select: '*', order: 'created_at.asc' }),
      fetchTable('companies', { select: '*', order: 'created_at.asc' }),
      fetchTable('skills', { select: '*', order: 'created_at.asc' }),
      fetchTable('profiles', { select: '*', order: 'created_at.asc' }),
      fetchTable('access_requests', { select: '*', order: 'created_at.desc' }),
      fetchTable('sessions', { select: '*', order: 'started_at.desc' }),
      fetchTable('audit_log', { select: '*', order: 'created_at.desc', limit: '200' }),
      fetchTable('notifications', { select: '*', order: 'created_at.desc' })
    ]).then(function (results) {
      var plans = results[0].map(toPlan);
      var companies = results[1].map(toCompany);
      var skills = results[2].map(toSkill);
      var profiles = results[3].map(toProfile);
      var requests = results[4].map(toRequest);
      var sessions = results[5].map(toSession);
      var audit = results[6].map(toAudit);
      var notifications = results[7].map(toNotification);

      var creator = profiles.find(function (p) { return p.role === 'creator'; }) || {
        id: 'u-creator', name: 'Administrador', email: 'admin@vigia.local', role: 'creator'
      };
      var users = profiles.filter(function (p) { return p.role !== 'creator'; });
      var payments = results[1].reduce(function (all, row) {
        return all.concat((row.payments || []).map(function (payment) {
          return {
            id: payment.id,
            companyId: row.id,
            concept: payment.concept || '',
            amount: Number(payment.amount) || 0,
            method: payment.method || '',
            status: payment.status || 'Pagado',
            date: isoDate(payment.paid_at)
          };
        }));
      }, []);

      return {
        creator: creator,
        companies: companies,
        plans: plans,
        industries: AUTEC.data.industries,
        skillGroups: AUTEC.data.skillGroups,
        skills: skills,
        users: users,
        requests: requests,
        sessions: sessions,
        audit: audit,
        monitoring: AUTEC.data.monitoring,
        metrics: AUTEC.data.metrics,
        notifications: notifications,
        payments: payments
      };
    });
  }

  function mergeLocalConfig(companyId, kind, payload) {
    var key = 'autecVision.' + kind + '.' + (companyId || 'global') + '.v1';
    var keys = [key, CONFIG_KINDS[kind]];
    for (var i = 0; i < keys.length; i += 1) {
      var raw = localStorage.getItem(keys[i]);
      if (!raw) continue;
      try {
        return { id: keys[i], payload: JSON.parse(raw) };
      } catch (_) {}
    }
    return { id: key, payload: payload };
  }

  function loadConfigs(companyId) {
    var idPrefix = (companyId || 'global') + ':';
    return fetchTable('app_configs', { select: '*', id: 'like.' + encodeURIComponent(idPrefix + '%') })
      .catch(function () { return []; })
      .then(function (rows) {
        var byKind = {};
        rows.forEach(function (row) { byKind[row.kind] = row.payload; });
        Object.keys(CONFIG_KINDS).forEach(function (kind) {
          var stored = byKind[kind];
          var merged = mergeLocalConfig(companyId, kind, stored || {});
          if (stored && merged.id.indexOf('autecVision.') === 0) localStorage.setItem(merged.id, JSON.stringify(merged.payload));
          if (!stored && merged.payload && Object.keys(merged.payload).length) {
            S.saveConfig(companyId, kind, merged.payload);
          }
        });
        return byKind;
      });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function planRow(plan) {
    return {
      id: plan.id, name: plan.name, price: Number(plan.price) || 0,
      period: plan.period || '', billing: plan.billing || '',
      seats: Number(plan.seats) || 0, duration_days: Number(plan.durationDays) || 30,
      skills: plan.skills || [], color: plan.color || '#22D3EE',
      description: plan.description || ''
    };
  }

  function companyRow(company) {
    return {
      id: company.id, name: company.name, short: company.short || '',
      sector: company.sector || '', status: company.status || 'active',
      plan_id: company.planId || null, seats: Number(company.seats) || 0,
      users_count: Number(company.usersCount) || 0,
      expires_at: isoDate(company.expiresAt) || null,
      created_at: isoDate(company.createdAt) || isoDate(new Date().toISOString()),
      contact: company.contact || '', email: company.email || '', phone: company.phone || '',
      skills: company.skills || [], last_activity: company.lastActivity || '',
      mrr: Number(company.mrr) || 0, color: company.color || '#22D3EE',
      domain: company.domain || ''
    };
  }

  function profileRow(user) {
    return {
      id: user.id, company_id: user.companyId || null, name: user.name,
      email: user.email, role: user.role || 'operator',
      status: user.status || 'active', last_access: user.lastAccess || ''
    };
  }

  function skillRow(skill) {
    return {
      id: skill.id, name: skill.name, short: skill.short || '',
      status: skill.status || 'available', group_name: skill.group || 'base',
      description: skill.description || '', industries: skill.industries || [],
      icon: skill.icon || 'layers', progress: Number(skill.progress) || 0,
      global_active: Boolean(skill.globalActive),
      companies_using: Number(skill.companiesUsing) || 0,
      featured: Boolean(skill.featured), pilot: Boolean(skill.pilot)
    };
  }

  function requestRow(request) {
    return {
      id: request.id, type: request.type || 'company',
      company_id: request.companyId || null, company_name: request.companyName || '',
      skill_id: request.skillId || null, detail: request.detail || '',
      status: request.status || 'pending',
      contact_name: request.contact || '', email: request.email || '',
      phone: request.phone || '', sector: request.sector || '',
      seats: request.seats === undefined ? null : Number(request.seats),
      plan_id: request.planId || null, message: request.message || ''
    };
  }

  function sessionRow(session) {
    return {
      id: session.id, profile_id: session.userId || null,
      company_id: session.companyId || null, user_name: session.userName || '',
      company_name: session.companyName || '', role: session.role || 'operator',
      ip: session.ip || '', started_at: session.startedAt || null,
      ended_at: session.endedAt || null
    };
  }

  function auditTimestamp(value) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
    var match = String(value).match(/(\d{1,2})\s+([a-záéíóú]+)\s+(\d{4})(?:\s*·\s*(\d{1,2}):(\d{2}))?/i);
    if (!match) return null;
    var months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var month = months.indexOf(String(match[2]).toLowerCase().slice(0, 3));
    if (month < 0) return null;
    return new Date(
      Number(match[3]), month, Number(match[1]),
      Number(match[4] || 12), Number(match[5] || 0)
    ).toISOString();
  }

  function auditRow(entry) {
    return {
      id: entry.id, actor: entry.actor || 'Sistema', action: entry.action || '',
      action_type: entry.actionType || 'update', target: entry.target || '',
      company_id: entry.companyId || null, company_name: entry.companyName || '',
      ip: entry.ip || '—', created_at: auditTimestamp(entry.date),
      metadata: { date: entry.date || '' }
    };
  }

  function notificationRow(item) {
    return {
      id: item.id, profile_id: null, company_id: null,
      title: item.title || '', body: item.text || '', type: item.type || 'info',
      unread: Boolean(item.unread)
    };
  }

  function changedRows(current, previous, map) {
    var before = {};
    (previous || []).forEach(function (item) { before[item.id] = JSON.stringify(map(item)); });
    return (current || []).filter(function (item) {
      return before[item.id] !== JSON.stringify(map(item));
    }).map(map);
  }

  function diffAndUpsert(table, current, previous, map) {
    var rows = changedRows(current, previous, map);
    if (!rows.length) return Promise.resolve(true);
    return request('/api/db/' + table + '?on_conflict=id', {
      method: 'POST', body: rows
    }).then(function () { return true; }).catch(function () { return false; });
  }

  S.persistStore = function () {
    if (!S.configured || !S.baseline || !AUTEC.store) return Promise.resolve(false);
    var store = AUTEC.store;
    var base = S.baseline;
    var tasks = [
      diffAndUpsert('plans', store.plans, base.plans, planRow),
      diffAndUpsert('companies', store.companies, base.companies, companyRow),
      diffAndUpsert('profiles', (store.users || []).concat(store.creator ? [store.creator] : []),
        (base.users || []).concat(base.creator ? [base.creator] : []), profileRow),
      diffAndUpsert('skills', store.skills, base.skills, skillRow),
      diffAndUpsert('access_requests', store.requests, base.requests, requestRow),
      diffAndUpsert('sessions', store.sessions, base.sessions, sessionRow),
      diffAndUpsert('audit_log', store.audit, base.audit, auditRow),
      diffAndUpsert('notifications', store.notifications, base.notifications, notificationRow)
    ];

    var baseSessionIds = {};
    (base.sessions || []).forEach(function (item) { baseSessionIds[item.id] = true; });
    (store.sessions || []).forEach(function (item) { delete baseSessionIds[item.id]; });
    Object.keys(baseSessionIds).forEach(function (id) {
      tasks.push(request('/api/db/sessions?id=eq.' + encodeURIComponent(id), { method: 'DELETE' })
        .catch(function () { return false; }));
    });

    S.baseline = clone({
      plans: store.plans, companies: store.companies, users: store.users,
      creator: store.creator, skills: store.skills, requests: store.requests,
      sessions: store.sessions, audit: store.audit, notifications: store.notifications
    });

    return Promise.all(tasks).then(function () { return true; });
  };

  S.saveConfig = function (companyId, kind, payload) {
    if (!S.configured || !CONFIG_KINDS[kind]) return Promise.resolve(false);
    var id = (companyId || 'global') + ':' + kind;
    return request('/api/db/app_configs?on_conflict=id', {
      method: 'POST',
      body: { id: id, company_id: companyId || null, kind: kind, payload: payload }
    }).then(function () { return true; }).catch(function () { return false; });
  };

  S.audit = function (row) {
    if (!S.configured) return Promise.resolve(false);
    return request('/api/events', {
      method: 'POST',
      body: {
        actor: row.actor || 'Sistema',
        action: row.action || '',
        action_type: row.actionType || 'update',
        target: row.target || '',
        company_id: row.companyId || null,
        company_name: row.companyName || '',
        ip: row.ip || '127.0.0.1',
        metadata: { date: row.date || '' }
      }
    }).then(function () { return true; }).catch(function () { return false; });
  };

  S.write = function (table, row, options) {
    if (!S.configured) return Promise.resolve(false);
    options = options || {};
    var query = new URLSearchParams();
    if (options.onConflict) query.set('on_conflict', options.onConflict);
    if (options.match) {
      Object.keys(options.match).forEach(function (key) { query.set(key, String(options.match[key])); });
    }
    return request('/api/db/' + table + '?' + query.toString(), {
      method: options.method || 'POST',
      body: row
    }).then(function () { return true; }).catch(function () { return false; });
  };

  S.metric = function (row) {
    if (!S.configured) return Promise.resolve(false);
    return request('/api/metrics', { method: 'POST', body: row })
      .then(function () { return true; }).catch(function () { return false; });
  };

  S.saveCaptureContext = function (companyId, cameraId) {
    S.captureCompanyId = companyId || '';
    S.captureCameraId = cameraId || '';
  };

  S.init = function () {
    if (S.data) return Promise.resolve(S.data);
    return request('/api/supabase/health').then(function (health) {
      S.configured = !!(health && health.ok && health.configured);
      if (!S.configured) {
        S.source = 'demo';
        S.lastError = (health && health.error) || 'Supabase no configurado';
        return AUTEC.data;
      }
      return fetchAppSnapshot().then(function (snapshot) {
        S.data = snapshot;
        S.baseline = clone({
          plans: snapshot.plans, companies: snapshot.companies, users: snapshot.users,
          creator: snapshot.creator, skills: snapshot.skills, requests: snapshot.requests,
          sessions: snapshot.sessions, audit: snapshot.audit, notifications: snapshot.notifications
        });
        S.source = 'supabase';
        AUTEC.data = snapshot;
        AUTEC.store = clone(snapshot);
        var companyId = snapshot.companies[0] ? snapshot.companies[0].id : '';
        S.saveCaptureContext(companyId, '');
        return loadConfigs(companyId).then(function () { return snapshot; });
      }).catch(function (error) {
        S.source = 'demo';
        S.lastError = error.message || String(error);
        return AUTEC.data;
      });
    }).catch(function (error) {
      S.source = 'demo';
      S.lastError = error.message || String(error);
      return AUTEC.data;
    });
  };

  S.table = function (name) {
    if (!S.configured || !S.data) return [];
    return S.data[name] || [];
  };
})();
