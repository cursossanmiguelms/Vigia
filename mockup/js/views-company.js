(function () {
  window.AUTEC = window.AUTEC || {};

  var U = AUTEC.utils;
  var C = AUTEC.components;
  var I = AUTEC.icon;
  var V = AUTEC.views = AUTEC.views || {};

  function esc(value) {
    return U.escapeHtml(value);
  }

  function company() {
    return AUTEC.app.currentCompany();
  }

  function planOf(entity) {
    return AUTEC.app.planFor(entity || company());
  }

  function usersOf(companyId) {
    return AUTEC.store.users.filter(function (user) { return user.companyId === companyId; });
  }

  function skillById(id) {
    return AUTEC.store.skills.find(function (skill) { return skill.id === id; });
  }

  function isAdmin() {
    return AUTEC.app.state.auth.role === 'company_admin';
  }

  function eppAvailable() {
    return !!(AUTEC.epp && AUTEC.epp.hasSkill());
  }

  function eppConfig() {
    return AUTEC.epp ? AUTEC.epp.config() : null;
  }

  function eppModelState() {
    return AUTEC.epp ? AUTEC.epp.modelState() : null;
  }

  function eppStatsFor(companyId) {
    return AUTEC.epp ? AUTEC.epp.statsForView(companyId) : null;
  }

  function tablesAvailable() {
    return !!(AUTEC.tables && AUTEC.tables.hasSkill());
  }

  function tablesConfig() {
    return AUTEC.tables ? AUTEC.tables.config() : null;
  }

  function tablesStatsFor(companyId) {
    return AUTEC.tables ? AUTEC.tables.statsForView(companyId) : null;
  }

  function fallsAvailable() {
    return !!(AUTEC.falls && AUTEC.falls.hasSkill());
  }

  function fallsConfig() {
    return AUTEC.falls ? AUTEC.falls.config() : null;
  }

  function fallsStatsFor(companyId) {
    return AUTEC.falls ? AUTEC.falls.statsForView(companyId) : null;
  }

  function skillSourceBadge(simulated, attr) {
    return '<span class="badge badge--' + (simulated ? 'warning' : 'success') + ' epp-source-badge" ' + (attr || '') + '>'
      + '<span class="badge-dot"></span>' + (simulated ? 'SIMULACIÓN' : 'EN VIVO') + '</span>';
  }

  function tablesSourceBadge(stats) {
    return skillSourceBadge(!stats || stats.simulated !== false, 'data-monitor-tables-source');
  }

  function fallsSourceBadge(stats) {
    return skillSourceBadge(!stats || stats.simulated !== false, 'data-monitor-falls-source');
  }

  function tablesOccupiedRows(stats) {
    if (!stats) return '';
    var ids = Object.keys(stats.tables || {});
    if (!ids.length) return '<div class="monitor-empty">Sin mesas configuradas.</div>';
    return ids.map(function (id) {
      var info = stats.tables[id];
      var table = (tablesConfig() || { tables: [] }).tables.find(function (item) { return item.id === id; });
      if (!table) return '';
      var label = !info.count ? 'Libre' : info.attention ? 'Atención' : 'Ocupada';
      var tone = !info.count ? 'neutral' : info.attention ? 'warning' : 'success';
      return '<div class="zone-row table-row' + (info.count ? ' is-active' : '') + (info.attention ? ' is-alert' : '') + '" data-table-row-id="' + esc(id) + '">'
        + '<span class="zone-dot" style="background:' + esc(table.color) + '"></span>'
        + '<div class="zone-row-copy"><strong>' + esc(table.name) + '</strong><span>' + table.seats + ' pax · '
        + '<span data-table-seconds>' + AUTEC.tables.durationLabel(info.seconds) + '</span></span></div>'
        + '<span class="zone-count" data-table-count>' + info.count + '</span>'
        + '<span class="badge badge--' + tone + ' table-state" data-table-state>' + label + '</span>'
        + '</div>';
    }).join('');
  }

  function fallsTrackRows(stats) {
    if (!stats) return '';
    var tracks = Array.isArray(stats.tracks) ? stats.tracks : [];
    if (!tracks.length) return '<div class="monitor-empty">Sin personas evaluadas.</div>';
    return tracks.slice(0, 6).map(function (track) {
      var tone = track.status === 'fallen' ? 'danger' : track.status === 'suspect' ? 'warning' : 'success';
      var label = track.status === 'fallen' ? 'CAÍDA' : track.status === 'suspect' ? 'RIESGO' : 'Normal';
      return '<div class="zone-row fall-row' + (track.status !== 'normal' ? ' is-alert' : '') + '">'
        + '<span class="zone-dot" style="background:' + (tone === 'danger' ? '#ef4444' : tone === 'warning' ? '#f5a524' : '#34d399') + '"></span>'
        + '<div class="zone-row-copy"><strong>Persona #' + esc(track.trackId == null ? '—' : track.trackId) + '</strong><span>ancho/alto '
        + AUTEC.falls.ratioLabel(track.ratio) + ' · ' + (track.seconds ? track.seconds.toFixed(1) + ' s' : 'estable') + '</span></div>'
        + '<span class="badge badge--' + tone + '">' + label + '</span>'
        + '</div>';
    }).join('');
  }

  var AREA_SKILL_IDS = ['barra', 'puestos-libres', 'aforo-salas', 'aforo-aulas', 'aglomeraciones'];

  function areaSkills() {
    return AREA_SKILL_IDS.filter(function (skillId) {
      return !!(AUTEC.areas && AUTEC.areas.hasSkill(skillId));
    });
  }

  function areaConfig(skillId) {
    return AUTEC.areas ? AUTEC.areas.config(skillId) : null;
  }

  function areaStatsFor(skillId, companyId) {
    return AUTEC.areas ? AUTEC.areas.statsForView(skillId, companyId) : null;
  }

  function areaSourceBadge(skillId, stats) {
    var simulated = !stats || stats.simulated !== false;
    return '<span class="badge badge--' + (simulated ? 'warning' : 'success') + ' epp-source-badge" data-area-source="' + esc(skillId) + '">'
      + '<span class="badge-dot"></span>' + (simulated ? 'SIMULACIÓN' : 'EN VIVO') + '</span>';
  }

  function areaMetricGrid(skillId, stats) {
    var metrics = AUTEC.areas ? AUTEC.areas.metrics(skillId, stats) : [];
    return '<div class="metric-grid">' + metrics.map(function (metric) {
      return '<div class="metric-box"><span>' + esc(metric.label) + '</span><strong data-area-metric="' + esc(metric.key) + '">' + esc(metric.value) + '</strong></div>';
    }).join('') + '</div>';
  }

  function areaRows(skillId, config, stats) {
    var def = AUTEC.areas ? AUTEC.areas.definition(skillId) : null;
    if (!def || !config || !stats) return '';
    var ids = Object.keys(stats.areas || {});
    if (!ids.length) return '<div class="monitor-empty">Sin ' + esc(def.areaPlural) + ' configuradas.</div>';
    return ids.map(function (id) {
      var info = stats.areas[id];
      var area = config.areas.find(function (item) { return item.id === id; });
      if (!area) return '';
      var detail;
      if (def.mode === 'wait') {
        detail = 'capacidad ' + area.capacity + ' · espera ' + AUTEC.areas.durationLabel(info.seconds);
      } else if (def.mode === 'desks') {
        detail = 'capacidad ' + area.capacity + ' · ' + (info.count ? 'ocupado' : 'libre');
      } else if (def.mode === 'crowd') {
        detail = 'umbral ' + area.capacity + ' · ' + info.count + ' personas';
      } else {
        detail = 'aforo ' + area.capacity + ' · ' + info.count + '/' + area.capacity;
      }
      var tone = AUTEC.areas.statusTone(skillId, info);
      var label = AUTEC.areas.statusLabel(skillId, info);
      return '<div class="zone-row area-row' + (info.count ? ' is-active' : '') + (info.alert ? ' is-alert' : '') + '"'
        + ' data-area-row-id="' + esc(id) + '" data-area-row-skill="' + esc(skillId) + '">'
        + '<span class="zone-dot" style="background:' + esc(area.color) + '"></span>'
        + '<div class="zone-row-copy"><strong>' + esc(area.name) + '</strong><span data-area-detail>' + esc(detail) + '</span></div>'
        + '<span class="zone-count" data-area-count>' + info.count + '</span>'
        + '<span class="badge badge--' + tone + '" data-area-status>' + esc(label) + '</span>'
        + '</div>';
    }).join('');
  }

  function areaSummaryCard(skillId, companyId) {
    var def = AUTEC.areas ? AUTEC.areas.definition(skillId) : null;
    var config = areaConfig(skillId);
    var stats = areaStatsFor(skillId, companyId);
    if (!def || !config) return '';
    return C.card({
      className: 'area-card area-card--' + skillId,
      title: def.name,
      subtitle: AUTEC.areas.areaSubtitle(skillId, config),
      action: '<div class="inline-actions"><button class="btn btn-ghost btn-sm" data-action="open-areas-config" data-skill="' + esc(skillId) + '">' + I('sliders', 13) + ' Editar</button><a class="btn btn-ghost btn-sm" href="#/app/monitoreo">Ver monitoreo ' + I('arrow-right', 13) + '</a></div>',
      body: '<div class="area-card-body" data-area-skill="' + esc(skillId) + '">'
        + '<div class="epp-summary-head">' + areaSourceBadge(skillId, stats)
        + '<span class="badge badge--' + (config.enabled ? 'success' : 'neutral') + '">' + (config.enabled ? 'Activa' : 'Desactivada') + '</span></div>'
        + areaMetricGrid(skillId, stats)
        + '<div class="form-note epp-model-note">' + I('info', 14) + '<span>' + esc(def.note) + '</span></div>'
        + '</div>'
    });
  }

  function areaMonitoringCard(skillId, companyId) {
    var def = AUTEC.areas ? AUTEC.areas.definition(skillId) : null;
    var config = areaConfig(skillId);
    var stats = areaStatsFor(skillId, companyId);
    if (!def || !config) return '';
    var action = '<div class="inline-actions">'
      + '<button class="btn btn-ghost btn-sm" data-action="test-areas-alert" data-skill="' + esc(skillId) + '">' + I('bell', 14) + ' Probar</button>'
      + '<button class="btn btn-ghost btn-sm" data-action="open-areas-config" data-skill="' + esc(skillId) + '">' + I('sliders', 14) + ' Editar</button>'
      + '</div>';
    return C.card({
      className: 'area-card area-card--' + skillId,
      title: def.name,
      subtitle: AUTEC.areas.areaSubtitle(skillId, config),
      action: action,
      body: !config.enabled
        ? '<div class="form-note epp-disabled-note">' + I('info', 14) + '<span>' + esc(def.name) + ' está desactivada. No se cuenta ocupación ni se generan alertas.</span></div>'
          + '<div class="inline-actions epp-card-actions"><button class="btn btn-primary btn-sm" data-action="toggle-areas" data-skill="' + esc(skillId) + '">' + I('power', 14) + ' Activar ' + esc(def.short.toLowerCase()) + '</button></div>'
        : '<div class="area-card-body" data-area-skill="' + esc(skillId) + '">'
          + '<div class="epp-summary-head">' + areaSourceBadge(skillId, stats)
          + '<span class="badge badge--success">Local</span></div>'
          + areaMetricGrid(skillId, stats)
          + '<div class="zone-list" data-area-list>' + areaRows(skillId, config, stats) + '</div>'
          + '<div class="skill-controls">'
          + '<div class="zone-control"><span>' + esc(def.name) + ' activa</span><button class="switch ' + (config.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (config.enabled ? 'true' : 'false') + '" data-action="toggle-areas" data-skill="' + esc(skillId) + '" aria-label="Activar o desactivar ' + esc(def.name.toLowerCase()) + '"><span></span></button></div>'
          + '<span class="badge badge--neutral">Sin identificación</span>'
          + '</div>'
          + '<div class="zone-hint">' + esc(def.hint) + '</div>'
          + '</div>'
    });
  }

  function eppSourceBadge(model, stats) {
    var simulated = !model || model.available !== true || !!(stats && stats.simulated);
    return '<span class="badge badge--' + (simulated ? 'warning' : 'success') + ' epp-source-badge" data-monitor-epp-source>'
      + '<span class="badge-dot"></span>' + (simulated ? 'SIMULACIÓN' : 'EN VIVO') + '</span>';
  }

  function eppStateBadge(stats) {
    var incomplete = !!(stats && stats.nonCompliant > 0);
    var hasData = !!(stats && stats.compliance !== null && stats.compliance !== undefined);
    return '<span class="badge badge--' + (incomplete ? 'danger' : hasData ? 'success' : 'neutral') + '" data-monitor-epp-state>'
      + (incomplete ? 'FALTANTE' : hasData ? 'CUMPLE' : 'SIN DATOS') + '</span>';
  }

  function eppDisabledNotice() {
    return '<div class="form-note epp-disabled-note">' + I('info', 14) + '<span>EPP está desactivado. No se evalúan prendas ni se generan alertas para esta empresa.</span></div>'
      + '<div class="inline-actions epp-card-actions"><button class="btn btn-primary btn-sm" data-action="toggle-epp">' + I('power', 14) + ' Activar EPP</button></div>';
  }

  function eppPreview(person, config) {
    if (!AUTEC.epp || !config) return null;
    var box = person.box || { x: 0, y: 0, w: 100, h: 100 };
    return AUTEC.epp.simulateForTrack(person.id, config.profile, {
      x1: box.x,
      y1: box.y,
      x2: box.x + box.w,
      y2: box.y + box.h
    });
  }

  function eppProfileSwitch(entity, config) {
    if (!config) return '';
    if (entity.id !== 'cim') {
      return '<div class="epp-profile-static"><span>Perfil</span><strong>' + esc(config.profileName) + '</strong></div>';
    }
    var options = [
      { id: 'industrial-cliente', label: 'Sitio industrial' },
      { id: 'corporativo', label: 'Sede corporativa' }
    ];
    return '<div class="epp-profile-switch" role="group" aria-label="Perfil de EPP">'
      + options.map(function (option) {
        return '<button type="button" class="epp-profile-btn' + (config.profile === option.id ? ' is-active' : '') + '" data-action="epp-profile" data-profile="' + option.id + '">' + option.label + '</button>';
      }).join('')
      + '</div>';
  }

  function monitorConfig() {
    return AUTEC.monitor ? AUTEC.monitor.config() : {
      host: '', port: '4747', resolution: '1280x720', cameraName: 'Entrada principal', lens: 'unknown'
    };
  }

  function lensLabel(value) {
    return AUTEC.cameras ? AUTEC.cameras.lensLabel(value) : 'Sin especificar';
  }

  function lensLabelLower(value) {
    return AUTEC.cameras && AUTEC.cameras.lensLabelLower
      ? AUTEC.cameras.lensLabelLower(value)
      : lensLabel(value).toLowerCase();
  }

  function timeLabel(value) {
    if (!value) return '—';
    var date = new Date(value);
    var hours = date.getHours();
    var minutes = date.getMinutes();
    return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
  }

  function durationLabel(seconds) {
    var total = Math.max(0, Math.round(Number(seconds) || 0));
    if (total < 60) return total + ' s';
    var minutes = Math.round(total / 60);
    if (minutes < 60) return minutes + ' min';
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return hours + ' h' + (rest ? ' ' + rest + ' min' : '');
  }

  function patrolNextText(info) {
    if (!info || !info.nextDueAt) return 'Próxima —';
    if (info.status === 'overdue') return 'Vencida hace ' + durationLabel(info.overdueSeconds);
    if (info.status === 'due') return 'Vence ahora';
    return 'Próxima ' + timeLabel(info.nextDueAt);
  }

  function monitorConnected() {
    return !!(AUTEC.monitor && AUTEC.monitor.isConnected());
  }

  function monitorPaused() {
    return !!(AUTEC.monitor && AUTEC.monitor.isPaused());
  }

  function zonesConfig() {
    return AUTEC.zones ? AUTEC.zones.config() : {
      enabled: false, merodeoEnabled: false, dwellSeconds: 8, zones: []
    };
  }

  function zonesStats() {
    return AUTEC.zones ? AUTEC.zones.stats() : {
      inZones: 0, alerts: 0, byZone: {}, alertZones: {}, alertKinds: {}, queue: {}, unattended: {}, patrol: {}
    };
  }

  function lineConfig() {
    return AUTEC.lines ? AUTEC.lines.config() : {
      enabled: false, name: 'Acceso principal', capacity: 10, x1: 0.5, y1: 0.12, x2: 0.5, y2: 0.88, invert: false
    };
  }

  function lineStats() {
    return AUTEC.lines ? AUTEC.lines.stats() : {
      enabled: false, name: 'Acceso principal', capacity: 10, in: 0, out: 0, occupancy: 0, capacityAlert: false
    };
  }

  function heatmapConfig() {
    return AUTEC.heatmap ? AUTEC.heatmap.config() : { enabled: false };
  }

  function heatmapStats() {
    return AUTEC.heatmap ? AUTEC.heatmap.stats() : {
      enabled: false, points: 0, cells: 0, max: 0
    };
  }

  function canSeeUsers() {
    var role = AUTEC.app.state.auth.role;
    return role === 'company_admin' || role === 'supervisor';
  }

  function skillLine(skill, active) {
    return '<div class="status-row"><span class="status-icon">' + I(skill.icon || 'layers', 16) + '</span><div><strong>' + esc(skill.name) + '</strong><span class="muted small">' + esc(skill.short) + ' · ' + U.skillStatusLabel(skill.status) + '</span></div>' + (active ? C.badge('Activa', 'success', { dot: true }) : C.skillStatusBadge(skill.status)) + '</div>';
  }

  V.companyOverview = function () {
    var entity = company();
    var plan = planOf(entity);
    var team = usersOf(entity.id);
    var activeTeam = team.filter(function (user) { return user.status === 'active'; });
    var skills = entity.skills.map(skillById).filter(Boolean);
    var monitoring = AUTEC.store.monitoring;
    var metrics = AUTEC.store.metrics;
    var hasEpp = eppAvailable();
    var epp = hasEpp ? eppConfig() : null;
    var eppData = hasEpp ? eppStatsFor(entity.id) : null;
    var eppModel = hasEpp ? eppModelState() : null;
    var eppConnected = monitorConnected();
    var hasTables = tablesAvailable();
    var tableConfig = hasTables ? tablesConfig() : null;
    var tableData = hasTables ? tablesStatsFor(entity.id) : null;
    var hasFalls = fallsAvailable();
    var fallConfig = hasFalls ? fallsConfig() : null;
    var fallData = hasFalls ? fallsStatsFor(entity.id) : null;
    var activeAreaSkills = areaSkills();
    var areaCards = activeAreaSkills.map(function (skillId) {
      return areaSummaryCard(skillId, entity.id);
    }).filter(Boolean);

    var eppDemo = !!(epp && epp.enabled && eppData && eppData.simulated && eppData.source !== 'disabled');
    var eppKpi = hasEpp
      ? C.kpi({
        label: 'Cumplimiento EPP', icon: 'hard-hat',
        value: epp.enabled && (eppConnected || eppDemo) && eppData && eppData.compliance !== null && eppData.compliance !== undefined
          ? eppData.compliance + '%'
          : '—',
        meta: !epp.enabled
          ? '<span class="badge badge--neutral">Desactivado</span><span>activalo en monitoreo o ajustes</span>'
          : eppConnected || eppDemo
            ? eppSourceBadge(eppModel, eppData) + '<span>' + (eppData ? eppData.persons : 0) + ' personas</span>'
            : '<span class="badge badge--neutral">Sin cámara</span><span>conectá para medir</span>'
      })
      : C.kpi({
        label: 'Detecciones hoy', value: 128, icon: 'scan',
        meta: '<span class="badge badge--success">+12%</span><span>vs. ayer</span>',
        spark: C.sparkline([42, 58, 51, 74, 66, 91, 128], 'var(--accent)')
      });

    var kpis = '<div class="grid-4">'
      + C.kpi({
        label: 'Personas en cámara', value: '<span data-monitor-kpi-persons>' + monitoring.people.length + '</span>', icon: 'users',
        meta: '<span class="text-success">En vivo</span><span>· actualizado hace 2 s</span>',
        spark: C.sparkline([1, 2, 2, 3, 2, 3, 3], 'var(--data)')
      })
      + eppKpi
      + C.kpi({
        label: 'Recuperaciones ReID', value: '<span data-monitor-kpi-reid>' + monitoring.reidMatches + '</span>', icon: 'scan',
        meta: '<span>Última a las ' + esc(monitoring.timestamp) + '</span>'
      })
      + C.kpi({
        label: 'Usuarios activos', value: activeTeam.length + ' / ' + entity.seats, icon: 'users',
        meta: '<span>' + Math.round(activeTeam.length / Math.max(1, entity.seats) * 100) + '% de asientos</span>'
      })
      + '</div>';

    var videoCard = C.card({
      title: 'Cámara principal',
      subtitle: '<span data-monitor-camera-meta>' + esc(monitoring.camera) + ' · ' + esc(monitoring.resolution) + '</span>',
      action: '<a class="btn btn-ghost btn-sm" href="#/app/monitoreo">Abrir monitoreo ' + I('arrow-right', 13) + '</a>',
      flush: true,
      body: C.videoFrame({ compact: true, reidEnabled: AUTEC.app.state.reidEnabled, paused: AUTEC.app.state.monitorPaused })
    });

    var systemCard = C.card({
      title: 'Estado del sistema',
      subtitle: 'Servicios de la operación',
      body: C.systemStatus()
    });

    var eppCard = hasEpp ? C.card({
      className: 'epp-card',
      title: 'EPP / Indumentaria',
      subtitle: esc(epp.profileName) + ' · requiere ' + esc(epp.requiredLabel),
      action: '<button class="btn btn-ghost btn-sm" data-action="open-epp-config">' + I('sliders', 13) + ' Configurar</button>',
      body: !epp.enabled ? eppDisabledNotice() : '<div class="epp-summary-head">' + eppSourceBadge(eppModel, eppData) + eppStateBadge(eppData) + '</div>'
        + '<div class="metric-grid">'
        + '<div class="metric-box"><span>Cumplimiento</span><strong data-monitor-epp-compliance>' + (eppData && eppData.compliance !== null ? eppData.compliance + '%' : '—') + '</strong></div>'
        + '<div class="metric-box"><span>Personas</span><strong data-monitor-epp-persons>' + (eppData ? eppData.persons : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Con casco</span><strong data-monitor-epp-helmet>' + (eppData ? eppData.withHelmet : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Con chaleco</span><strong data-monitor-epp-vest>' + (eppData ? eppData.withVest : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Sin EPP</span><strong data-monitor-epp-missing>' + (eppData ? eppData.nonCompliant : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Alertas</span><strong data-monitor-epp-alerts>' + (eppData ? eppData.alerts : 0) + '</strong></div>'
        + '</div>'
        + (entity.id === 'cim' ? eppProfileSwitch(entity, epp) : '')
        + '<div class="form-note epp-model-note" data-monitor-epp-model-note>'
        + I('info', 14) + '<span>' + (eppModel && eppModel.available
          ? 'Modelo EPP local activo. La regla de la empresa define qué se exige.'
          : 'Sin modelo EPP entrenado: los badges y métricas de esta demo son simulados y no representan detección real.') + '</span></div>'
        + '<div class="inline-actions epp-card-actions"><button class="btn btn-ghost btn-sm" data-action="test-epp-alert">' + I('bell', 13) + ' Probar</button><a class="btn btn-ghost btn-sm" href="#/app/monitoreo">Ver monitoreo ' + I('arrow-right', 13) + '</a></div>'
    }) : '';

    var tablesCard = hasTables ? C.card({
      className: 'tables-card',
      title: 'Mesas y clientes',
      subtitle: tableConfig.tables.length + (tableConfig.tables.length === 1 ? ' mesa' : ' mesas')
        + ' · objetivo de atención ' + AUTEC.tables.durationLabel(tableConfig.attentionSeconds),
      action: '<div class="inline-actions"><button class="btn btn-ghost btn-sm" data-action="open-tables-config">' + I('sliders', 13) + ' Editar</button><a class="btn btn-ghost btn-sm" href="#/app/monitoreo">Ver monitoreo ' + I('arrow-right', 13) + '</a></div>',
      body: '<div class="epp-summary-head">' + tablesSourceBadge(tableData)
        + '<span class="badge badge--' + (tableConfig.enabled ? 'success' : 'neutral') + '">' + (tableConfig.enabled ? 'Activa' : 'Desactivada') + '</span></div>'
        + '<div class="metric-grid">'
        + '<div class="metric-box"><span>Ocupadas</span><strong data-monitor-tables-occupied>' + (tableData ? tableData.occupied : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Libres</span><strong data-monitor-tables-free>' + (tableData ? tableData.free : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Ocupación</span><strong data-monitor-tables-rate>' + (tableData ? tableData.occupancyRate + '%' : '—') + '</strong></div>'
        + '<div class="metric-box"><span>Clientes</span><strong data-monitor-tables-customers>' + (tableData ? tableData.customers : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Atención prom.</span><strong data-monitor-tables-attention>' + (tableData ? AUTEC.tables.durationLabel(tableData.attention) : '—') + '</strong></div>'
        + '<div class="metric-box"><span>Alertas</span><strong data-monitor-tables-alerts>' + (tableData ? tableData.alerts : 0) + '</strong></div>'
        + '</div>'
        + '<div class="form-note epp-model-note">' + I('info', 14) + '<span>La ocupación se estima por la posición de los pies dentro de cada mesa. No identifica clientes ni personal: mide ocupación y permanencia.</span></div>'
    }) : '';

    var fallsCard = hasFalls ? C.card({
      className: 'falls-card',
      title: 'Detección de caídas',
      subtitle: 'Heurística local · sensibilidad ' + fallConfig.sensitivityName.toLowerCase()
        + ' · gracia ' + fallConfig.graceSeconds + ' s',
      action: '<div class="inline-actions"><button class="btn btn-ghost btn-sm" data-action="open-falls-config">' + I('sliders', 13) + ' Editar</button><a class="btn btn-ghost btn-sm" href="#/app/monitoreo">Ver monitoreo ' + I('arrow-right', 13) + '</a></div>',
      body: '<div class="epp-summary-head">' + fallsSourceBadge(fallData)
        + '<span class="badge badge--' + (fallConfig.enabled ? 'success' : 'neutral') + '">' + (fallConfig.enabled ? 'Activa' : 'Desactivada') + '</span></div>'
        + '<div class="metric-grid">'
        + '<div class="metric-box"><span>Analizadas</span><strong data-monitor-falls-analyzed>' + (fallData ? fallData.analyzed : 0) + '</strong></div>'
        + '<div class="metric-box"><span>En riesgo</span><strong data-monitor-falls-suspects>' + (fallData ? fallData.suspects : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Caídas</span><strong data-monitor-falls-fallen>' + (fallData ? fallData.fallen : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Alertas</span><strong data-monitor-falls-alerts>' + (fallData ? fallData.alerts : 0) + '</strong></div>'
        + '</div>'
        + '<div class="form-note epp-model-note">' + I('info', 14) + '<span>Sin modelo de pose: se evalúa la relación ancho/alto de la caja de persona durante varios segundos. Puede fallar con personas sentadas o cámaras muy inclinadas.</span></div>'
    }) : '';

    var skillsCard = C.card({
      title: 'Skills activas',
      subtitle: entity.skills.length + ' de ' + plan.skills.length + ' incluidas en el plan',
      action: isAdmin() ? '<a class="btn btn-ghost btn-sm" href="#/app/skills">Gestionar ' + I('arrow-right', 13) + '</a>' : '',
      body: skills.length
        ? '<div class="status-list">' + skills.map(function (skill) { return skillLine(skill, true); }).join('') + '</div>'
        : C.emptyState({ icon: 'layers', title: 'Sin skills activas', text: 'El administrador de la empresa todavía no activó ninguna skill.' })
    });

    var eventsCard = C.card({
      title: 'Eventos recientes',
      subtitle: 'Últimos movimientos de la cámara',
      body: '<div class="event-list">' + monitoring.events.map(function (event) {
        return '<div class="event-row ' + (event.type === 'reid' ? 'is-reid' : '') + '"><span class="event-time">' + esc(event.time) + '</span><span class="event-text">' + esc(event.text) + '</span></div>';
      }).join('') + '</div>'
    });

    var chartCard = C.card({
      eyebrow: 'Operación',
      title: 'Personas por hora',
      subtitle: 'Detecciones acumuladas en la jornada',
      action: C.badge('Hoy', 'neutral'),
      body: C.barChart(metrics.companyPeople, metrics.companyHours, { color: 'var(--data)' })
        + '<div class="chart-legend"><span class="legend-item"><span class="legend-dot" style="background:var(--data)"></span> Personas detectadas</span><span class="legend-item"><span class="legend-dot" style="background:var(--accent)"></span> Recuperaciones ReID: ' + monitoring.reidMatches + '</span></div>'
    });

    var teamCard = C.card({
      title: 'Equipo',
      subtitle: activeTeam.length + ' usuarios activos de ' + entity.seats + ' asientos',
      action: canSeeUsers() ? '<a class="btn btn-ghost btn-sm" href="#/app/usuarios">Ver equipo ' + I('arrow-right', 13) + '</a>' : '',
      body: C.seatUsage(entity)
        + '<div class="person-list" style="margin-top:12px">' + team.slice(0, 4).map(function (user) {
          return '<div class="person-row"><span class="person-index">' + U.initials(user.name) + '</span><div class="person-copy"><strong>' + esc(user.name) + '</strong><span>' + U.roleLabel(user.role) + ' · ' + esc(user.lastAccess) + '</span></div>' + C.statusBadge(user.status) + '</div>';
        }).join('') + '</div>'
    });

    var skillSummaryCards = [];
    if (hasTables) skillSummaryCards.push(tablesCard);
    if (hasFalls) skillSummaryCards.push(fallsCard);
    areaCards.forEach(function (card) { skillSummaryCards.push(card); });
    var skillCardsLayout = skillSummaryCards.length
      ? '<div class="section-gap ' + (skillSummaryCards.length > 1 ? 'grid-main-2' : '') + '">' + skillSummaryCards.join('') + '</div>'
      : '';

    return C.pageHead({
      eyebrow: entity.sector + ' · ' + plan.name,
      title: 'Resumen de ' + entity.name,
      subtitle: 'Estado operativo de la cámara, el equipo y las skills contratadas.',
      actions: (isAdmin() ? '<button class="btn btn-ghost" data-action="open-new-user" data-company="' + entity.id + '">' + I('user-plus', 15) + ' Invitar usuario</button>' : '')
        + '<a class="btn btn-primary" href="#/app/monitoreo">' + I('video', 15) + ' Abrir monitoreo</a>'
    })
      + kpis
      + '<div class="section-gap grid-main">' + videoCard + '<div class="stack">' + systemCard + eppCard + skillsCard + eventsCard + '</div></div>'
      + skillCardsLayout
      + '<div class="section-gap grid-main-2">' + chartCard + teamCard + '</div>';
  };

  V.companyMonitoring = function () {
    var entity = company();
    var monitoring = AUTEC.store.monitoring;
    var state = AUTEC.app.state;
    var people = monitoring.people;
    var config = monitorConfig();
    var connected = monitorConnected();
    var paused = monitorPaused();
    var connecting = !!(AUTEC.monitor && AUTEC.monitor.state().connecting);
    var active = connected || connecting;
    var statusLabel = AUTEC.monitor ? AUTEC.monitor.statusText() : 'Sin conexión';
    var statusTone = AUTEC.monitor ? AUTEC.monitor.statusTone() : 'neutral';
    var resolution = AUTEC.monitor ? AUTEC.monitor.resolutionLabel(config.resolution) : '1280 × 720';
    var hostLabel = config.host ? config.host + ':' + config.port : 'Sin IP configurada';
    var zones = zonesConfig();
    var zoneStats = zonesStats();
    var line = lineConfig();
    var lineData = lineStats();
    var heat = heatmapConfig();
    var heatData = heatmapStats();
    var hasEpp = eppAvailable();
    var epp = hasEpp ? eppConfig() : null;
    var eppModel = hasEpp ? eppModelState() : null;
    var eppData = hasEpp ? eppStatsFor(entity.id) : null;
    var hasTables = tablesAvailable();
    var tableConfig = hasTables ? tablesConfig() : null;
    var tableData = hasTables ? tablesStatsFor(entity.id) : null;
    var hasFalls = fallsAvailable();
    var fallConfig = hasFalls ? fallsConfig() : null;
    var fallData = hasFalls ? fallsStatsFor(entity.id) : null;
    var activeAreaSkills = areaSkills();
    var areaCards = activeAreaSkills.map(function (skillId) {
      return areaMonitoringCard(skillId, entity.id);
    }).filter(Boolean);
    var cameras = AUTEC.cameras ? AUTEC.cameras.all() : [];
    var activeCameraId = AUTEC.cameras ? AUTEC.cameras.activeId() : '';
    var cameraOptions = cameras.map(function (camera) {
      return '<option value="' + esc(camera.id) + '"' + (camera.id === activeCameraId ? ' selected' : '') + '>'
        + esc(camera.name) + (camera.lens !== 'unknown' ? ' · ' + esc(lensLabel(camera.lens)) : '')
        + '</option>';
    }).join('');
    var cameraSelect = cameras.length
      ? '<label class="camera-switch-wrap" title="Cámara activa">' + I('video', 14)
        + '<select class="select camera-switch" data-camera-switch aria-label="Cámara activa">' + cameraOptions + '</select></label>'
      : '';
    var alertZoneCount = zones.zones.filter(function (zone) {
      return zone.restricted !== false || zone.alerts.entry || zone.alerts.dwell || zone.alerts.count;
    }).length;
    var soundOn = !!(AUTEC.monitor && AUTEC.monitor.alertSoundEnabled && AUTEC.monitor.alertSoundEnabled());

    var actions = '<div class="monitor-toggle"><span>ReID</span><button class="switch ' + (state.reidEnabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (state.reidEnabled ? 'true' : 'false') + '" data-action="toggle-reid" aria-label="Activar o desactivar ReID"><span></span></button></div>'
      + '<div class="monitor-toggle"><span>Zonas</span><button class="switch ' + (zones.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (zones.enabled ? 'true' : 'false') + '" data-action="toggle-zones" aria-label="Activar o desactivar zonas"><span></span></button></div>'
      + (hasEpp ? '<div class="monitor-toggle"><span>EPP</span><button class="switch ' + (epp.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (epp.enabled ? 'true' : 'false') + '" data-action="toggle-epp" aria-label="Activar o desactivar EPP"><span></span></button></div>' : '')
      + (hasTables ? '<div class="monitor-toggle"><span>Mesas</span><button class="switch ' + (tableConfig.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (tableConfig.enabled ? 'true' : 'false') + '" data-action="toggle-tables" aria-label="Activar o desactivar mesas"><span></span></button></div>' : '')
      + (hasFalls ? '<div class="monitor-toggle"><span>Caídas</span><button class="switch ' + (fallConfig.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (fallConfig.enabled ? 'true' : 'false') + '" data-action="toggle-falls" aria-label="Activar o desactivar caídas"><span></span></button></div>' : '')
      + '<button class="btn btn-ghost btn-sm" data-action="open-zone-config">' + I('map', 14) + ' Zonas</button>'
      + '<button class="btn btn-ghost btn-sm" data-action="toggle-monitor"' + (connected ? '' : ' disabled') + '>' + I(paused ? 'play' : 'pause', 14) + ' <span data-monitor-pause-label>' + (paused ? 'Reanudar' : 'Pausar') + '</span></button>'
      + '<button class="btn btn-ghost btn-sm" data-action="snapshot"' + (connected ? '' : ' disabled') + '>' + I('camera', 14) + ' Captura</button>'
      + (active
        ? '<button class="btn btn-ghost btn-sm" data-action="monitor-disconnect">' + I('power', 14) + ' ' + (connecting ? 'Cancelar' : 'Desconectar') + '</button>'
        : '<button class="btn btn-primary btn-sm" data-action="monitor-connect">' + I('video', 14) + ' Conectar cámara</button>');

    var connection = '<div class="monitor-connection' + (connected ? ' is-live' : connecting ? ' is-connecting' : '') + '">'
      + '<div class="monitor-connection-main">'
      + '<span class="status-dot status-dot--' + statusTone + '" data-monitor-status-dot></span>'
      + '<div class="monitor-connection-copy"><strong data-monitor-status>' + esc(statusLabel) + '</strong>'
      + '<span data-monitor-camera-meta>' + esc(hostLabel) + ' · ' + esc(resolution) + ' · Lente ' + esc(lensLabelLower(config.lens)) + '</span></div>'
      + '</div>'
      + '<div class="monitor-connection-side">'
      + cameraSelect
      + '<button class="btn btn-ghost btn-sm" data-action="open-camera-manager">' + I('camera', 14) + ' Cámaras</button>'
      + '<span class="badge badge--neutral" data-monitor-ai>IA en espera</span>'
      + '<button class="btn btn-ghost btn-sm" data-action="open-camera-config">' + I('sliders', 14) + ' Configurar</button>'
      + '</div>'
      + '</div>';

    var detections = C.card({
      title: 'Detecciones activas',
      subtitle: 'Seguimiento local con IDs estables',
      action: '<span class="badge badge--' + (connected ? 'success' : connecting ? 'warning' : 'neutral') + '" data-monitor-mode>' + (connected ? 'EN VIVO' : connecting ? 'CONECTANDO' : 'DEMO') + '</span>',
      flush: true,
      body: '<div class="table-wrap"><table class="table table--compact"><thead><tr><th>Persona</th><th>Confianza</th><th>Estado</th><th>Posición</th></tr></thead><tbody data-monitor-detections>'
        + people.map(function (person) {
          var isReid = state.reidEnabled && person.reid;
          var previewEpp = !connected && hasEpp && epp.enabled ? eppPreview(person, epp) : null;
          var eppMissing = previewEpp && AUTEC.epp.isMissing(previewEpp, epp);
          var eppBadge = previewEpp
            ? '<span class="epp-inline">' + AUTEC.epp.badgesHtml(previewEpp, epp, true, true) + '</span>'
            : '';
          var previewFall = !connected && hasFalls && fallConfig.enabled && person.id === 3
            ? { status: 'suspect', simulated: true }
            : null;
          var fallBadge = previewFall
            ? '<span class="epp-inline">' + AUTEC.falls.badgesHtml(previewFall, true) + '</span>'
            : '';
          return '<tr class="' + (eppMissing ? 'is-epp-missing' : '') + '"><td><span class="person-index">' + person.id + '</span> <strong>persona #' + person.id + '</strong></td>'
            + '<td><div class="conf-cell"><span class="mono">' + person.confidence + '%</span><div class="progress progress--sm"><span class="progress-fill progress-fill--info" style="width:' + person.confidence + '%"></span></div></div></td>'
            + '<td>' + (isReid ? C.badge('ReID', 'accent', { dot: true }) : C.badge('Nueva', 'neutral', { dot: true })) + eppBadge + fallBadge + '</td>'
            + '<td><span class="mono muted">x:' + person.box.x + '% · y:' + person.box.y + '%</span></td></tr>';
        }).join('')
        + '</tbody></table></div>'
    });

    var metricsCard = C.card({
      title: 'Métricas de sesión',
      subtitle: 'Cámara local',
      body: '<div class="metric-grid">'
        + '<div class="metric-box"><span>Personas</span><strong data-monitor-metric-persons>' + people.length + '</strong></div>'
        + '<div class="metric-box"><span>FPS</span><strong data-monitor-metric-fps>' + monitoring.fps + '</strong></div>'
        + '<div class="metric-box"><span>Latencia</span><strong data-monitor-metric-latency>' + monitoring.latency + ' ms</strong></div>'
        + '<div class="metric-box"><span>ReID</span><strong data-monitor-metric-reid>' + (state.reidEnabled ? monitoring.reidMatches : '—') + '</strong></div>'
        + '<div class="metric-box"><span>En zonas</span><strong data-monitor-metric-zones>' + (connected ? zoneStats.inZones : '—') + '</strong></div>'
        + '<div class="metric-box"><span>Alertas</span><strong data-monitor-metric-zone-alerts>' + (connected ? zoneStats.alerts : '—') + '</strong></div>'
        + '</div>'
        + '<div class="monitor-metrics-foot"><span data-monitor-ai>IA en espera</span><span class="mono">' + esc(resolution) + '</span></div>'
    });

    var eppCard = hasEpp ? C.card({
      className: 'epp-card',
      title: 'EPP / Indumentaria',
      subtitle: '<span data-monitor-epp-profile>' + esc(epp.profileName) + '</span> · requiere <span data-monitor-epp-required>' + esc(epp.requiredLabel) + '</span>',
      action: epp.enabled
        ? '<div class="inline-actions"><button class="btn btn-ghost btn-sm" data-action="test-epp-alert">' + I('bell', 14) + ' Probar</button><button class="btn btn-ghost btn-sm" data-action="open-epp-config">' + I('sliders', 14) + ' Configurar</button></div>'
        : '<button class="btn btn-ghost btn-sm" data-action="open-epp-config">' + I('sliders', 14) + ' Configurar</button>',
      body: !epp.enabled ? eppDisabledNotice() : '<div class="epp-summary-head">' + eppSourceBadge(eppModel, eppData) + eppStateBadge(eppData) + '</div>'
        + '<div class="metric-grid">'
        + '<div class="metric-box"><span>Cumplimiento</span><strong data-monitor-epp-compliance>' + (eppData && eppData.compliance !== null ? eppData.compliance + '%' : '—') + '</strong></div>'
        + '<div class="metric-box"><span>Personas</span><strong data-monitor-epp-persons>' + (eppData ? eppData.persons : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Con casco</span><strong data-monitor-epp-helmet>' + (eppData ? eppData.withHelmet : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Con chaleco</span><strong data-monitor-epp-vest>' + (eppData ? eppData.withVest : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Sin casco</span><strong data-monitor-epp-without-helmet>' + (eppData ? eppData.withoutHelmet : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Sin chaleco</span><strong data-monitor-epp-without-vest>' + (eppData ? eppData.withoutVest : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Sin EPP</span><strong data-monitor-epp-missing>' + (eppData ? eppData.nonCompliant : 0) + '</strong></div>'
        + '<div class="metric-box"><span>Alertas</span><strong data-monitor-epp-alerts>' + (eppData ? eppData.alerts : 0) + '</strong></div>'
        + '</div>'
        + eppProfileSwitch(entity, epp)
        + '<div class="skill-controls">'
        + '<div class="zone-control"><span>EPP activo</span><button class="switch ' + (epp.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (epp.enabled ? 'true' : 'false') + '" data-action="toggle-epp" aria-label="Activar o desactivar EPP"><span></span></button></div>'
        + '<span class="badge badge--' + (eppModel && eppModel.available ? 'success' : 'warning') + '">' + (eppModel && eppModel.available ? 'Modelo local' : 'Demo simulada') + '</span>'
        + '</div>'
        + '<div class="form-note epp-model-note" data-monitor-epp-model-note>'
        + I('info', 14) + '<span>' + (eppModel && eppModel.available
          ? 'Modelo EPP local activo. La regla de la empresa define qué se exige.'
          : 'Sin modelo EPP entrenado: los badges y métricas de esta demo son simulados y no representan detección real.') + '</span></div>'
        + '<div class="monitor-metrics-foot"><span data-monitor-epp-model>' + (eppModel && eppModel.available ? esc(eppModel.label || 'Modelo EPP') : 'Modelo EPP no instalado') + '</span><span class="mono">Local</span></div>'
    }) : '';

    var tablesCard = hasTables ? C.card({
      className: 'tables-card',
      title: 'Mesas y clientes',
      subtitle: tableConfig.tables.length + (tableConfig.tables.length === 1 ? ' mesa' : ' mesas')
        + ' · objetivo de atención ' + AUTEC.tables.durationLabel(tableConfig.attentionSeconds),
      action: '<div class="inline-actions">'
        + '<button class="btn btn-ghost btn-sm" data-action="test-tables-alert">' + I('bell', 14) + ' Probar</button>'
        + '<button class="btn btn-ghost btn-sm" data-action="open-tables-config">' + I('sliders', 14) + ' Editar</button>'
        + '</div>',
      body: !tableConfig.enabled
        ? '<div class="form-note epp-disabled-note">' + I('info', 14) + '<span>Mesas está desactivado. No se estima ocupación ni se generan alertas de atención.</span></div>'
          + '<div class="inline-actions epp-card-actions"><button class="btn btn-primary btn-sm" data-action="toggle-tables">' + I('power', 14) + ' Activar mesas</button></div>'
        : '<div class="epp-summary-head">' + tablesSourceBadge(tableData)
          + '<span class="badge badge--success">Local</span></div>'
          + '<div class="metric-grid">'
          + '<div class="metric-box"><span>Ocupadas</span><strong data-monitor-tables-occupied>' + (tableData ? tableData.occupied : 0) + '</strong></div>'
          + '<div class="metric-box"><span>Libres</span><strong data-monitor-tables-free>' + (tableData ? tableData.free : 0) + '</strong></div>'
          + '<div class="metric-box"><span>Ocupación</span><strong data-monitor-tables-rate>' + (tableData ? tableData.occupancyRate + '%' : '—') + '</strong></div>'
          + '<div class="metric-box"><span>Clientes</span><strong data-monitor-tables-customers>' + (tableData ? tableData.customers : 0) + '</strong></div>'
          + '<div class="metric-box"><span>Atención prom.</span><strong data-monitor-tables-attention>' + (tableData ? AUTEC.tables.durationLabel(tableData.attention) : '—') + '</strong></div>'
          + '<div class="metric-box"><span>Alertas</span><strong data-monitor-tables-alerts>' + (tableData ? tableData.alerts : 0) + '</strong></div>'
          + '</div>'
          + '<div class="zone-list" data-monitor-tables-list>' + tablesOccupiedRows(tableData) + '</div>'
          + '<div class="skill-controls">'
          + '<div class="zone-control"><span>Mesas activas</span><button class="switch ' + (tableConfig.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (tableConfig.enabled ? 'true' : 'false') + '" data-action="toggle-tables" aria-label="Activar o desactivar mesas"><span></span></button></div>'
          + '<span class="badge badge--neutral">Sin identificación</span>'
          + '</div>'
          + '<div class="zone-hint">Una mesa se ocupa cuando el centro inferior de una persona cae dentro de su rectángulo. Si supera el objetivo de atención, suena la alarma y se guarda una captura automática con el nombre de la mesa.</div>'
    }) : '';

    var fallsCard = hasFalls ? C.card({
      className: 'falls-card',
      title: 'Detección de caídas',
      subtitle: 'Sensibilidad ' + fallConfig.sensitivityName.toLowerCase()
        + ' · ancho/alto ≥ ' + AUTEC.falls.ratioLabel(fallConfig.ratioThreshold)
        + ' · gracia ' + fallConfig.graceSeconds + ' s',
      action: '<div class="inline-actions">'
        + '<button class="btn btn-ghost btn-sm" data-action="test-falls-alert">' + I('bell', 14) + ' Probar</button>'
        + '<button class="btn btn-ghost btn-sm" data-action="open-falls-config">' + I('sliders', 14) + ' Editar</button>'
        + '</div>',
      body: !fallConfig.enabled
        ? '<div class="form-note epp-disabled-note">' + I('info', 14) + '<span>Caídas está desactivado. No se evalúan personas ni se generan alertas.</span></div>'
          + '<div class="inline-actions epp-card-actions"><button class="btn btn-primary btn-sm" data-action="toggle-falls">' + I('power', 14) + ' Activar caídas</button></div>'
        : '<div class="epp-summary-head">' + fallsSourceBadge(fallData)
          + '<span class="badge badge--warning">Heurística</span></div>'
          + '<div class="metric-grid">'
          + '<div class="metric-box"><span>Analizadas</span><strong data-monitor-falls-analyzed>' + (fallData ? fallData.analyzed : 0) + '</strong></div>'
          + '<div class="metric-box"><span>En riesgo</span><strong data-monitor-falls-suspects>' + (fallData ? fallData.suspects : 0) + '</strong></div>'
          + '<div class="metric-box"><span>Caídas</span><strong data-monitor-falls-fallen>' + (fallData ? fallData.fallen : 0) + '</strong></div>'
          + '<div class="metric-box"><span>Alertas</span><strong data-monitor-falls-alerts>' + (fallData ? fallData.alerts : 0) + '</strong></div>'
          + '</div>'
          + '<div class="zone-list" data-monitor-falls-list>' + fallsTrackRows(fallData) + '</div>'
          + '<div class="skill-controls">'
          + '<div class="zone-control"><span>Caídas activas</span><button class="switch ' + (fallConfig.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (fallConfig.enabled ? 'true' : 'false') + '" data-action="toggle-falls" aria-label="Activar o desactivar caídas"><span></span></button></div>'
          + '<span class="badge badge--neutral">Sin modelo de pose</span>'
          + '</div>'
          + '<div class="zone-hint">La heurística compara ancho y alto de la caja de cada persona. Si la relación se mantiene sobre el umbral durante la gracia configurada, se dispara la alarma y se guarda una captura. No detecta caídas fuera del cuadro ni reemplaza una revisión humana.</div>'
    }) : '';

    var zonesCard = C.card({
      title: 'Zonas y merodeo',
      subtitle: zones.zones.length + (zones.zones.length === 1 ? ' zona' : ' zonas') + ' · merodeo ' + (zones.merodeoEnabled ? 'a los ' + zones.dwellSeconds + ' s' : 'desactivado') + ' · ' + alertZoneCount + ' con alertas',
      action: '<div class="inline-actions"><button class="btn btn-ghost btn-sm" data-action="test-zone-alert">' + I('bell', 14) + ' Probar</button><button class="btn btn-ghost btn-sm" data-action="open-zone-config">' + I('sliders', 14) + ' Editar</button></div>',
      body: '<div class="zone-list">'
        + (zones.zones.length
          ? zones.zones.map(function (zone) {
            var count = zoneStats.byZone[zone.id] || 0;
            var alert = !!(zoneStats.alertZones && zoneStats.alertZones[zone.id]);
            var alertTags = [];
            if (zone.restricted !== false || zone.alerts.entry) alertTags.push('Restringida');
            if (zone.alerts.dwell && zones.merodeoEnabled) alertTags.push('Merodeo');
            if (zone.alerts.count) alertTags.push('Conteo desde ' + zone.maxPeople);
            if (zone.queue && zone.queue.enabled) alertTags.push('Cola');
            if (zone.unattended && zone.unattended.enabled) alertTags.push('Puesto desatendido');
            if (zone.patrol && zone.patrol.enabled) alertTags.push('Rondas');
            return '<div class="zone-row' + (count ? ' is-active' : '') + (alert ? ' is-alert' : '') + '" data-zone-row-id="' + esc(zone.id) + '">'
              + '<span class="zone-dot" style="background:' + esc(zone.color) + '"></span>'
              + '<div class="zone-row-copy"><strong>' + esc(zone.name) + '</strong><span>' + Math.round(zone.w * 100) + ' × ' + Math.round(zone.h * 100) + '% del cuadro</span>'
              + (alertTags.length ? '<div class="zone-alert-tags">' + alertTags.map(function (tag) {
                return '<span class="zone-alert-tag">' + esc(tag) + '</span>';
              }).join('') + '</div>' : '')
              + '</div>'
              + '<span class="zone-count" data-zone-count title="Personas en la zona">' + count + '</span>'
              + '<button type="button" class="icon-btn zone-test-btn" data-action="test-zone-alert" data-zone-id="' + esc(zone.id) + '" title="Probar alerta de esta zona" aria-label="Probar alerta de ' + esc(zone.name) + '">' + I('bell', 13) + '</button>'
              + '</div>';
          }).join('')
          : '<div class="monitor-empty">Sin zonas configuradas. Dibujá un rectángulo sobre la cámara.</div>')
        + '</div>'
        + '<div class="zone-controls">'
        + '<div class="zone-control"><span>Zonas activas</span><button class="switch ' + (zones.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (zones.enabled ? 'true' : 'false') + '" data-action="toggle-zones" aria-label="Activar o desactivar zonas"><span></span></button></div>'
        + '<div class="zone-control"><span>Alertas de merodeo</span><button class="switch ' + (zones.merodeoEnabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (zones.merodeoEnabled ? 'true' : 'false') + '" data-action="toggle-merodeo" aria-label="Activar o desactivar merodeo"><span></span></button></div>'
        + '<div class="zone-control"><span>Sonido de alertas</span><button class="switch ' + (soundOn ? 'is-on' : '') + '" role="switch" aria-checked="' + (soundOn ? 'true' : 'false') + '" data-action="toggle-alert-sound" aria-label="Activar o desactivar sonido de alertas"><span></span></button></div>'
        + '</div>'
        + '<div class="zone-hint">Las zonas restringidas alertan y guardan una captura al ingresar. El conteo alerta desde el límite configurado. Las capturas se guardan en data/captures.</div>'
        + '<div class="monitor-metrics-foot"><span>En zonas: <strong data-monitor-zones>' + (connected ? zoneStats.inZones : '—') + '</strong></span><span>Alertas: <strong data-monitor-zone-alerts>' + (connected ? zoneStats.alerts : '—') + '</strong></span></div>'
    });

    var lineCard = C.card({
      title: 'Aforo por línea',
      subtitle: line.enabled
        ? line.name + ' · capacidad ' + line.capacity + ' personas'
        : 'Sin línea configurada',
      action: '<div class="inline-actions">'
        + '<button class="btn btn-ghost btn-sm" data-action="test-line-alert">' + I('bell', 14) + ' Probar</button>'
        + '<button class="btn btn-ghost btn-sm" data-action="open-line-config">' + I('sliders', 14) + ' Editar</button>'
        + '</div>',
      body: '<div class="metric-grid">'
        + '<div class="metric-box"><span>Ingresos</span><strong data-monitor-line-in>' + (connected ? lineData.in : '—') + '</strong></div>'
        + '<div class="metric-box"><span>Salidas</span><strong data-monitor-line-out>' + (connected ? lineData.out : '—') + '</strong></div>'
        + '<div class="metric-box"><span>Aforo</span><strong data-monitor-line-occupancy>' + (connected ? lineData.occupancy : '—') + '</strong></div>'
        + '</div>'
        + '<div class="skill-controls">'
        + '<div class="zone-control"><span>Aforo activo</span><button class="switch ' + (line.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (line.enabled ? 'true' : 'false') + '" data-action="toggle-line" aria-label="Activar o desactivar aforo"><span></span></button></div>'
        + '<span class="badge badge--' + (lineData.capacityAlert ? 'danger' : line.enabled ? 'success' : 'neutral') + '" data-monitor-line-state>' + (lineData.capacityAlert ? 'ALERTA' : line.enabled ? 'Activo' : 'Inactivo') + '</span>'
        + '<button class="btn btn-ghost btn-sm" data-action="reset-line">' + I('refresh', 13) + ' Reiniciar</button>'
        + '</div>'
        + '<div class="monitor-metrics-foot"><span>Capacidad: <strong data-monitor-line-capacity>' + line.capacity + '</strong></span><span>Línea: ' + (line.enabled ? 'activa' : 'inactiva') + '</span></div>'
        + '<div class="zone-hint">Al cruzar la línea se cuentan ingresos y salidas. Si el aforo supera la capacidad se dispara la alarma y se guarda una captura automática.</div>'
    });

    var queueZones = zones.zones.filter(function (zone) { return zone.queue && zone.queue.enabled; });
    var queueRows = queueZones.map(function (zone) {
      var info = (zoneStats.queue && zoneStats.queue[zone.id]) || { count: 0, avgWait: 0, maxWait: 0 };
      var alert = !!(zoneStats.alertZones && zoneStats.alertZones[zone.id]);
      return '<div class="zone-row queue-row' + (info.count ? ' is-active' : '') + (alert ? ' is-alert' : '') + '" data-queue-row-id="' + esc(zone.id) + '">'
        + '<span class="zone-dot" style="background:' + esc(zone.color) + '"></span>'
        + '<div class="zone-row-copy"><strong>' + esc(zone.name) + '</strong><span>espera máx ' + zone.queue.maxWaitSeconds + ' s · desde ' + zone.maxPeople + ' personas</span></div>'
        + '<span class="zone-count" data-queue-count>' + (connected ? info.count : '—') + '</span>'
        + '<span class="zone-wait mono" data-queue-wait>' + (connected ? info.avgWait + ' s' : '—') + '</span>'
        + '<button type="button" class="icon-btn zone-test-btn" data-action="test-queue-alert" data-zone-id="' + esc(zone.id) + '" title="Probar alerta de cola" aria-label="Probar alerta de cola en ' + esc(zone.name) + '">' + I('bell', 13) + '</button>'
        + '</div>';
    }).join('');
    var queueCard = C.card({
      title: 'Gestión de colas',
      subtitle: queueZones.length
        ? queueZones.length + (queueZones.length === 1 ? ' zona en cola' : ' zonas en cola')
        : 'Sin zonas en cola',
      action: '<button class="btn btn-ghost btn-sm" data-action="open-zone-config">' + I('sliders', 14) + ' Configurar</button>',
      body: (queueZones.length
        ? '<div class="zone-list">' + queueRows + '</div>'
        : '<div class="monitor-empty">Marcá una zona como <strong>Cola</strong> desde el editor de zonas.</div>')
        + '<div class="zone-hint">La cola mide cantidad de personas y espera promedio. Si una persona supera la espera máxima o la cola llega al límite, se dispara la alarma y se guarda captura.</div>'
    });

    var unattendedZones = zones.zones.filter(function (zone) { return zone.unattended && zone.unattended.enabled; });
    var unattendedRows = unattendedZones.map(function (zone) {
      var info = (zoneStats.unattended && zoneStats.unattended[zone.id]) || { emptySeconds: 0, alert: false };
      return '<div class="zone-row unattended-row' + (info.alert ? ' is-alert' : '') + '" data-unattended-row-id="' + esc(zone.id) + '">'
        + '<span class="zone-dot" style="background:' + esc(zone.color) + '"></span>'
        + '<div class="zone-row-copy"><strong>' + esc(zone.name) + '</strong><span>avisar tras ' + zone.unattended.absenceSeconds + ' s sin personas</span></div>'
        + '<span class="zone-wait mono" data-unattended-empty>' + (connected ? info.emptySeconds + ' s' : '—') + '</span>'
        + '<span class="badge ' + (info.alert ? 'badge--danger' : connected ? 'badge--success' : 'badge--neutral') + '" data-unattended-status>' + (info.alert ? 'ALERTA' : connected ? 'Cubierto' : 'Sin señal') + '</span>'
        + '<button type="button" class="icon-btn zone-test-btn" data-action="test-unattended-alert" data-zone-id="' + esc(zone.id) + '" title="Probar alerta de puesto desatendido" aria-label="Probar alerta de puesto desatendido en ' + esc(zone.name) + '">' + I('bell', 13) + '</button>'
        + '</div>';
    }).join('');
    var unattendedCard = C.card({
      title: 'Puesto desatendido',
      subtitle: unattendedZones.length
        ? unattendedZones.length + (unattendedZones.length === 1 ? ' zona vigilada' : ' zonas vigiladas')
        : 'Sin zonas vigiladas',
      action: '<button class="btn btn-ghost btn-sm" data-action="open-zone-config">' + I('sliders', 14) + ' Configurar</button>',
      body: (unattendedZones.length
        ? '<div class="zone-list">' + unattendedRows + '</div>'
        : '<div class="monitor-empty">Marcá una zona como <strong>Puesto desatendido</strong> desde el editor de zonas.</div>')
        + '<div class="zone-hint">Si la zona queda sin personas durante el tiempo configurado, suena la alarma y se guarda una captura automática.</div>'
    });

    var patrolZones = zones.zones.filter(function (zone) { return zone.patrol && zone.patrol.enabled; });
    var patrolOverdue = patrolZones.filter(function (zone) {
      var info = zoneStats.patrol && zoneStats.patrol[zone.id];
      return info && info.status === 'overdue';
    }).length;
    var patrolDue = patrolZones.filter(function (zone) {
      var info = zoneStats.patrol && zoneStats.patrol[zone.id];
      return info && info.status === 'due';
    }).length;
    var patrolPending = patrolZones.filter(function (zone) {
      var info = zoneStats.patrol && zoneStats.patrol[zone.id];
      return !info || info.status === 'pending';
    }).length;
    var patrolSummary = !connected
      ? 'sin señal'
      : patrolOverdue
        ? patrolOverdue + ' vencido' + (patrolOverdue === 1 ? '' : 's')
        : patrolDue
          ? patrolDue + ' por vencer'
          : patrolPending === patrolZones.length
            ? 'sin visitas'
            : 'al día';
    var patrolRows = patrolZones.map(function (zone) {
      var info = (zoneStats.patrol && zoneStats.patrol[zone.id]) || {
        status: 'pending', lastVisitAt: null, nextDueAt: null, visits: 0, dueInSeconds: 0, overdueSeconds: 0, alert: false
      };
      var overdue = info.status === 'overdue';
      var due = info.status === 'due';
      var pending = info.status === 'pending' || !info.nextDueAt;
      var tone = !connected ? 'neutral' : overdue ? 'danger' : due ? 'warning' : pending ? 'neutral' : 'success';
      var label = !connected ? 'Sin señal' : overdue ? 'VENCIDA' : due ? 'Por vencer' : pending ? 'Sin visitas' : 'Al día';
      return '<div class="zone-row patrol-row' + (overdue ? ' is-alert' : '') + '" data-patrol-row-id="' + esc(zone.id) + '">'
        + '<span class="zone-dot" style="background:' + esc(zone.color) + '"></span>'
        + '<div class="zone-row-copy"><strong>' + esc(zone.name) + '</strong><span>cada ' + Math.round(zone.patrol.intervalSeconds / 60)
        + ' min · tolerancia ' + Math.round(zone.patrol.toleranceSeconds / 60) + ' min · última '
        + '<span data-patrol-last>' + (connected && info.lastVisitAt ? timeLabel(info.lastVisitAt) : '—') + '</span> · '
        + '<span data-patrol-next>' + (connected ? patrolNextText(info) : 'Sin señal') + '</span></span></div>'
        + '<span class="badge badge--' + tone + '" data-patrol-status>' + label + '</span>'
        + '<button type="button" class="icon-btn zone-test-btn" data-action="test-patrol-alert" data-zone-id="' + esc(zone.id) + '" title="Probar alerta de ronda" aria-label="Probar alerta de ronda en ' + esc(zone.name) + '">' + I('bell', 13) + '</button>'
        + '</div>';
    }).join('');
    var patrolCard = C.card({
      className: 'patrol-card',
      title: 'Control de rondas',
      subtitle: patrolZones.length
        ? '<span data-patrol-summary>' + patrolZones.length + (patrolZones.length === 1 ? ' checkpoint' : ' checkpoints')
          + ' · ' + patrolSummary + '</span>'
        : 'Sin checkpoints configurados',
      action: '<div class="inline-actions">'
        + '<button class="btn btn-ghost btn-sm" data-action="reset-patrol">' + I('refresh', 13) + ' Reiniciar</button>'
        + '<button class="btn btn-ghost btn-sm" data-action="open-zone-config">' + I('sliders', 14) + ' Configurar</button>'
        + '</div>',
      body: (patrolZones.length
        ? '<div class="zone-list">' + patrolRows + '</div>'
        : '<div class="monitor-empty">Marcá una zona como <strong>Control de rondas</strong> desde el editor de zonas.</div>')
        + '<div class="zone-hint">Cada checkpoint avisa si no recibe una visita dentro del intervalo y la tolerancia configurados. Cualquier persona que ingrese a la zona registra la visita; si es un checkpoint de paso, desactivá <strong>Área restringida</strong> para no generar alarmas de ingreso.</div>'
    });

    var heatCard = C.card({
      title: 'Mapa de calor',
      subtitle: heat.enabled ? 'Acumulando posiciones de personas' : 'Desactivado',
      action: '<button class="btn btn-ghost btn-sm" data-action="reset-heatmap">' + I('refresh', 13) + ' Reiniciar</button>',
      body: '<div class="metric-grid">'
        + '<div class="metric-box"><span>Puntos</span><strong data-monitor-heat-points>' + (connected ? heatData.points : '—') + '</strong></div>'
        + '<div class="metric-box"><span>Celdas activas</span><strong data-monitor-heat-cells>' + (connected ? heatData.cells : '—') + '</strong></div>'
        + '</div>'
        + '<div class="skill-controls">'
        + '<div class="zone-control"><span>Mapa activo</span><button class="switch ' + (heat.enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (heat.enabled ? 'true' : 'false') + '" data-action="toggle-heatmap" aria-label="Activar o desactivar mapa de calor"><span></span></button></div>'
        + '</div>'
        + '<div class="zone-hint">El mapa acumula la posición de los pies de cada persona. Se reinicia manualmente o al recargar la página. No genera alertas.</div>'
    });

    var peopleCard = C.card({
      title: 'Personas detectadas',
      subtitle: 'IDs activos en el frame',
      body: '<div class="person-list" data-monitor-people>' + people.map(function (person) {
        var isReid = state.reidEnabled && person.reid;
        var previewEpp = !connected && hasEpp && epp.enabled ? eppPreview(person, epp) : null;
        var eppMissing = previewEpp && AUTEC.epp.isMissing(previewEpp, epp);
        var eppLabel = previewEpp ? ' · SIM · ' + AUTEC.epp.statusLabel(previewEpp, epp) : '';
        return '<div class="person-row ' + (isReid ? 'is-reid' : '') + (eppMissing ? ' is-epp-missing' : '') + '"><span class="person-index">' + person.id + '</span><div class="person-copy"><strong>persona #' + person.id + '</strong><span>' + (isReid ? 'ID recuperado por ReID' : 'Detección nueva') + esc(eppLabel) + '</span></div><span class="person-conf">' + person.confidence + '%</span></div>';
      }).join('') + '</div>'
    });

    var eventsCard = C.card({
      title: 'Eventos',
      subtitle: 'Registro de la sesión',
      body: '<div class="event-list" data-monitor-events>' + monitoring.events.map(function (event) {
        var areaEvent = ['barra', 'puesto', 'sala', 'aula', 'aglomeracion'].indexOf(event.type) !== -1;
        var cls = event.type === 'reid' ? ' is-reid' : event.type === 'alarm' ? ' is-alarm' : event.type === 'merodeo' ? ' is-merodeo' : event.type === 'zone' ? ' is-zone' : event.type === 'count' ? ' is-count' : event.type === 'line' ? ' is-line' : event.type === 'queue' ? ' is-queue' : event.type === 'unattended' ? ' is-unattended' : event.type === 'patrol' ? ' is-patrol' : event.type === 'mesa' || event.type === 'mesa-libre' ? ' is-table' : event.type === 'fall' ? ' is-fall' : event.type === 'fall-ok' ? ' is-fall-ok' : areaEvent ? ' is-area' : '';
        return '<div class="event-row' + cls + '"><span class="event-time">' + esc(event.time) + '</span><span class="event-text">' + esc(event.text) + '</span></div>';
      }).join('') + '</div>'
    });

    var noteCard = C.card({
      title: 'Nota técnica',
      subtitle: hasEpp ? 'Alcance de ReID, EPP y nuevas skills' : 'Alcance de ReID y nuevas skills',
      body: '<div class="form-note">' + I('info', 14) + '<span>ReID usa color de ropa y contexto temporal, no biometría. Puede fallar con uniformes idénticos, cambios bruscos de luz, giros o ausencias mayores a 120 segundos.</span></div>'
        + (hasEpp
          ? '<div class="form-note">' + I('hard-hat', 14) + '<span>EPP evalúa casco y chaleco por persona y aplica la regla del perfil activo. El video se procesa localmente; no hay reconocimiento facial ni envío a internet. En modo demo las métricas son simuladas y no miden detección real.</span></div>'
          : '')
        + (hasTables
          ? '<div class="form-note">' + I('utensils', 14) + '<span>Mesas estima ocupación por geometría de la caja de persona: el centro inferior debe caer dentro del rectángulo de la mesa. No identifica clientes ni personal y todo el cálculo queda en este equipo.</span></div>'
          : '')
        + (hasFalls
          ? '<div class="form-note">' + I('alert', 14) + '<span>Caídas usa una heurística temporal de relación ancho/alto de la caja de persona, sin modelo de pose. Es una ayuda operativa: puede fallar con personas sentadas, de espaldas o cámaras muy inclinadas. El video permanece local.</span></div>'
          : '')
        + activeAreaSkills.map(function (skillId) {
          var def = AUTEC.areas ? AUTEC.areas.definition(skillId) : null;
          return def
            ? '<div class="form-note">' + I(def.icon, 14) + '<span>' + esc(def.note) + '</span></div>'
            : '';
        }).join('')
    });

    return C.pageHead({
      eyebrow: entity.name + ' · ' + (AUTEC.monitor ? AUTEC.monitor.cameraLabel() : monitoring.camera),
      title: 'Monitoreo en vivo',
      subtitle: 'Procesamiento local. Cajas azules: personas; cian: identidad recuperada'
        + (hasEpp ? '; ámbar y verde: casco y chaleco' : '')
        + (hasTables ? '; rectángulos de color: mesas y su ocupación' : '')
        + (hasFalls ? '; rojo: posible caída o riesgo' : '')
        + (activeAreaSkills.length ? '; rectángulos punteados: barras, puestos, salas o aulas' : '')
        + '.',
      actions: actions
    })
      + connection
      + '<div class="monitor-layout">'
      + '<div class="monitor-main">'
      + C.videoFrame({ reidEnabled: state.reidEnabled, paused: paused })
      + detections
      + '</div>'
      + '<aside class="monitor-side">' + metricsCard + eppCard + zonesCard + peopleCard + eventsCard + noteCard + '</aside>'
      + '</div>'
      + '<div class="section-gap grid-main-2">' + lineCard + heatCard + '</div>'
      + '<div class="section-gap grid-main-2">' + queueCard + unattendedCard + '</div>'
      + (function () {
        var cards = [];
        if (hasTables) cards.push(tablesCard);
        if (hasFalls) cards.push(fallsCard);
        areaCards.forEach(function (card) { cards.push(card); });
        return cards.length
          ? '<div class="section-gap ' + (cards.length > 1 ? 'grid-main-2' : '') + '">' + cards.join('') + '</div>'
          : '';
      })()
      + '<div class="section-gap">' + patrolCard + '</div>';
  };

  V.companyUsers = function () {
    var entity = company();
    var filters = AUTEC.app.state.filters.users;
    var team = usersOf(entity.id);
    var filtered = team.filter(function (user) {
      var q = filters.q.toLowerCase();
      var matchesQ = !q || (user.name + ' ' + user.email).toLowerCase().indexOf(q) !== -1;
      var matchesRole = filters.role === 'all' || user.role === filters.role;
      var matchesStatus = filters.status === 'all' || user.status === filters.status;
      return matchesQ && matchesRole && matchesStatus;
    });

    var table = C.userTable(filtered, { canManage: isAdmin() });

    return C.pageHead({
      eyebrow: entity.name,
      title: 'Usuarios',
      subtitle: 'Gestioná accesos, roles y asientos de tu empresa.',
      actions: isAdmin()
        ? '<button class="btn btn-primary" data-action="open-new-user" data-company="' + entity.id + '">' + I('user-plus', 15) + ' Invitar usuario</button>'
        : C.badge('Solo lectura', 'neutral', { dot: true })
    })
      + '<div class="grid-main-2">'
      + C.card({
        title: 'Asientos',
        subtitle: entity.usersCount + ' de ' + entity.seats + ' asignados',
        action: C.planBadge(entity.planId),
        body: C.seatUsage(entity)
          + '<p class="muted small" style="margin-top:12px">Los asientos se configuran por empresa. Si necesitás más, podés solicitar una ampliación al creador.</p>'
          + (isAdmin() ? '<div class="inline-actions" style="margin-top:14px"><button class="btn btn-ghost btn-sm" data-action="open-request-seats" data-company="' + entity.id + '">' + I('plus', 14) + ' Solicitar asientos</button></div>' : '')
      })
      + C.card({
        title: 'Roles y permisos',
        subtitle: 'Qué puede hacer cada perfil',
        body: '<div class="status-list">'
          + '<div class="status-row"><span class="status-icon">' + I('building', 16) + '</span><div><strong>Admin empresa</strong><span class="muted small">Usuarios, skills, plan y ajustes.</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('eye', 16) + '</span><div><strong>Supervisor</strong><span class="muted small">Monitoreo y lectura del equipo.</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('users', 16) + '</span><div><strong>Operador</strong><span class="muted small">Monitoreo en vivo y eventos.</span></div></div>'
          + '</div>'
      })
      + '</div>'
      + '<div class="section-gap filter-bar">'
      + '<label class="filter-search">' + I('search', 15) + '<input id="filter-users-q" data-filter="users.q" value="' + esc(filters.q) + '" placeholder="Buscar usuario o email..." aria-label="Buscar usuarios"></label>'
      + '<select class="select filter-select" data-filter="users.role" aria-label="Filtrar por rol"><option value="all">Todos los roles</option><option value="company_admin"' + (filters.role === 'company_admin' ? ' selected' : '') + '>Admin empresa</option><option value="supervisor"' + (filters.role === 'supervisor' ? ' selected' : '') + '>Supervisor</option><option value="operator"' + (filters.role === 'operator' ? ' selected' : '') + '>Operador</option></select>'
      + '<select class="select filter-select" data-filter="users.status" aria-label="Filtrar por estado"><option value="all">Todos los estados</option><option value="active"' + (filters.status === 'active' ? ' selected' : '') + '>Activos</option><option value="inactive"' + (filters.status === 'inactive' ? ' selected' : '') + '>Inactivos</option></select>'
      + '<span class="filter-spacer"></span><span class="muted small">' + filtered.length + ' de ' + team.length + ' usuarios</span>'
      + '</div>'
      + C.card({ flush: true, body: table });
  };

  V.companySkills = function () {
    var entity = company();
    var plan = planOf(entity);
    var skills = AUTEC.store.skills;
    var planSkills = plan.skills.map(skillById).filter(Boolean);
    var sectorSkills = skills.filter(function (skill) {
      return plan.skills.indexOf(skill.id) === -1 && skill.industries.indexOf(entity.sector) !== -1;
    });
    var activeInPlan = planSkills.filter(function (skill) { return entity.skills.indexOf(skill.id) !== -1; }).length;
    var sectorReady = sectorSkills.filter(function (skill) { return skill.status === 'available'; }).length;
    var sectorSoon = sectorSkills.filter(function (skill) { return skill.status !== 'available'; }).length;

    var planSection = '<section class="skill-group">'
      + '<div class="skill-group-head">'
      + '<div class="skill-group-title"><span class="industry-icon">' + I('layers', 18) + '</span><div><h2>Incluidas en tu plan</h2><p>Skills que podés activar o desactivar según tu operación.</p></div></div>'
      + '<div class="skill-group-meta">' + C.badge(activeInPlan + ' de ' + planSkills.length + ' activas', activeInPlan ? 'success' : 'neutral') + '</div>'
      + '</div>'
      + '<div class="skills-grid">' + planSkills.map(function (skill) {
        return C.skillCard(skill, { mode: 'company', company: entity });
      }).join('') + '</div>'
      + '</section>';

    var sectorSection = sectorSkills.length
      ? '<section class="skill-group">'
        + '<div class="skill-group-head">'
        + '<div class="skill-group-title"><span class="industry-icon">' + I('building', 18) + '</span><div><h2>Para tu sector</h2><p>Capacidades del catálogo que aplican a ' + esc(entity.sector) + ' y todavía no están en tu plan.</p></div></div>'
        + '<div class="skill-group-meta">' + (sectorReady ? C.badge(sectorReady + ' disponibles', 'success') : '') + (sectorSoon ? C.badge(sectorSoon + ' próximas', 'neutral') : '') + '</div>'
        + '</div>'
        + '<div class="skills-grid">' + sectorSkills.map(function (skill) {
          return C.skillCard(skill, { mode: 'company', company: entity });
        }).join('') + '</div>'
        + '</section>'
      : '';

    return C.pageHead({
      eyebrow: entity.name,
      title: 'Skills de la empresa',
      subtitle: 'Activá las skills incluidas en tu plan. Las que están en entrenamiento se solicitan al creador.',
      actions: C.planBadge(entity.planId)
    })
      + '<div class="form-note section-gap">' + I('info', 14) + '<span>Tu plan <strong>' + esc(plan.name) + '</strong> incluye ' + plan.skills.map(function (id) { var skill = skillById(id); return skill ? skill.short : id; }).join(', ') + '. El catálogo completo reúne ' + skills.length + ' skills para ' + AUTEC.store.industries.length + ' industrias y drones; las marcadas como Próximamente todavía no están disponibles.</span></div>'
      + '<div class="section-gap">' + planSection + '</div>'
      + (sectorSection ? '<div class="section-gap">' + sectorSection + '</div>' : '')
      + '<div class="section-gap">'
      + C.card({
        title: '¿Necesitás otra skill?',
        subtitle: 'Contanos qué querés medir',
        body: '<p class="muted small">Si tu operación necesita una capacidad que no aparece en el catálogo, podés dejar la solicitud. El creador la revisa y te avisa cuando la skill esté disponible.</p>'
          + '<div class="inline-actions" style="margin-top:14px"><button class="btn btn-primary" data-action="open-request-skill" data-skill="colas" data-company="' + entity.id + '">' + I('inbox', 15) + ' Solicitar una skill</button><a class="btn btn-ghost" href="#/app/plan">Ver mi plan</a></div>'
      })
      + '</div>';
  };

  V.companyPlan = function () {
    var entity = company();
    var plan = planOf(entity);
    var payments = entity.payments || [];
    var paymentsTable = payments.length
      ? '<div class="table-wrap"><table class="table table--compact"><thead><tr><th>Fecha</th><th>Concepto</th><th>Método</th><th>Monto</th><th>Estado</th></tr></thead><tbody>'
        + payments.map(function (payment) {
          return '<tr><td><span class="mono muted">' + esc(payment.date) + '</span></td><td>' + esc(payment.concept) + '</td><td><span class="muted">' + esc(payment.method) + '</span></td><td><span class="mono">' + U.currency(payment.amount) + '</span></td><td>' + C.badge(payment.status, 'success', { dot: true }) + '</td></tr>';
        }).join('')
        + '</tbody></table></div>'
      : C.emptyState({ icon: 'credit-card', title: 'Sin pagos registrados', text: 'La empresa está en período de prueba. Cuando se active un plan pago, el historial aparecerá acá.' });

    return C.pageHead({
      eyebrow: entity.name,
      title: 'Plan y facturación',
      subtitle: 'Revisá tu plan actual, los límites y el historial de pagos.',
      actions: '<button class="btn btn-primary" data-action="open-request-plan" data-plan="' + plan.id + '" data-company="' + entity.id + '">' + I('arrow-up-right', 15) + ' Solicitar cambio de plan</button>'
    })
      + '<div class="grid-main">'
      + C.card({
        title: 'Plan actual',
        subtitle: 'Condiciones vigentes de la empresa',
        action: C.planBadge(plan.id),
        body: '<div class="plan-price"><strong>' + (plan.price ? U.currency(plan.price) : 'Gratis') + '</strong><span>' + (plan.price ? '/' + plan.period : '') + '</span></div>'
          + '<p class="muted small" style="margin-top:8px">' + esc(plan.description) + '</p>'
          + '<div class="status-list" style="margin-top:14px">'
          + '<div class="status-row"><span class="status-icon">' + I('calendar', 16) + '</span><div><strong>Vencimiento</strong><span class="muted small">' + U.formatDate(entity.expiresAt) + ' · ' + U.expiryMeta(entity.expiresAt).text + '</span></div>' + C.statusBadge(entity.status) + '</div>'
          + '<div class="status-row"><span class="status-icon">' + I('users', 16) + '</span><div><strong>Asientos</strong><span class="muted small">' + entity.usersCount + ' de ' + entity.seats + ' asignados</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('layers', 16) + '</span><div><strong>Skills incluidas</strong><span class="muted small">' + plan.skills.map(function (id) { var skill = skillById(id); return skill ? skill.short : id; }).join(' · ') + '</span></div></div>'
          + '</div>'
          + '<div class="inline-actions" style="margin-top:14px"><button class="btn btn-ghost btn-sm" data-action="open-request-seats" data-company="' + entity.id + '">' + I('plus', 14) + ' Solicitar asientos</button><button class="btn btn-ghost btn-sm" data-action="open-request-plan" data-plan="' + plan.id + '" data-company="' + entity.id + '">' + I('refresh', 14) + ' Cambiar de plan</button></div>'
      })
      + C.card({
        title: 'Consumo',
        subtitle: 'Uso actual del plan',
        body: '<div class="metric-grid">'
          + '<div class="metric-box"><span>Usuarios</span><strong>' + entity.usersCount + ' / ' + entity.seats + '</strong></div>'
          + '<div class="metric-box"><span>Skills</span><strong>' + entity.skills.length + '</strong></div>'
          + '<div class="metric-box"><span>Cámaras</span><strong>1</strong></div>'
          + '<div class="metric-box"><span>Almacenamiento</span><strong>Local</strong></div>'
          + '</div>'
          + '<div class="form-note" style="margin-top:14px">' + I('info', 14) + '<span>El almacenamiento y el procesamiento son locales. No se envía video a la nube.</span></div>'
      })
      + '</div>'
      + '<div class="section-gap"><div class="page-head"><div class="page-head-copy"><div class="eyebrow">Planes disponibles</div><h1 style="font-size:22px">Compará y solicitá un cambio.</h1></div></div>'
      + '<div class="plan-grid">' + AUTEC.store.plans.map(function (item) {
        return C.planCard(item, { mode: 'company', company: entity, highlight: item.id === entity.planId });
      }).join('') + '</div></div>'
      + '<div class="section-gap">' + C.card({ title: 'Historial de pagos', subtitle: 'Movimientos registrados por el creador', flush: true, body: paymentsTable }) + '</div>'
      + '<div class="form-note section-gap">' + I('info', 14) + '<span>Los cambios de plan y asientos se aprueban manualmente. En esta maqueta no se procesa ningún pago real.</span></div>';
  };

  V.companySettings = function () {
    var entity = company();
    var plan = planOf(entity);
    var user = AUTEC.app.currentUser();
    var settings = AUTEC.app.state.settings;
    var hasEpp = eppAvailable();
    var epp = hasEpp ? eppConfig() : null;
    var eppModel = hasEpp ? eppModelState() : null;
    var hasTables = tablesAvailable();
    var tableConfig = hasTables ? tablesConfig() : null;
    var hasFalls = fallsAvailable();
    var fallConfig = hasFalls ? fallsConfig() : null;

    function settingRow(key, title, text, enabled) {
      return '<div class="setting-row"><div class="setting-copy"><strong>' + title + '</strong><span class="muted small">' + text + '</span></div>'
        + '<button class="switch ' + (enabled ? 'is-on' : '') + '" role="switch" aria-checked="' + (enabled ? 'true' : 'false') + '" data-action="toggle-setting" data-key="' + key + '" aria-label="' + title + '"><span></span></button></div>';
    }

    return C.pageHead({
      eyebrow: entity.name,
      title: 'Ajustes',
      subtitle: 'Perfil de la empresa, cámara y preferencias de la cuenta.',
      actions: '<button class="btn btn-primary" data-action="save-settings">' + I('check', 15) + ' Guardar cambios</button>'
    })
      + '<div class="grid-main">'
      + '<div class="stack">'
      + C.card({
        title: 'Perfil de la empresa',
        subtitle: 'Datos visibles en el panel del creador',
        body: '<form class="form-grid" data-form="company-profile">'
          + '<div class="field-row"><div class="field"><label for="company-name">Nombre</label><input class="input" id="company-name" name="name" value="' + esc(entity.name) + '"></div><div class="field"><label for="company-sector">Sector</label><input class="input" id="company-sector" name="sector" value="' + esc(entity.sector) + '"></div></div>'
          + '<div class="field-row"><div class="field"><label for="company-contact">Contacto</label><input class="input" id="company-contact" name="contact" value="' + esc(entity.contact) + '"></div><div class="field"><label for="company-email">Email</label><input class="input" id="company-email" name="email" type="email" value="' + esc(entity.email) + '"></div></div>'
          + '<div class="field"><label for="company-phone">Teléfono</label><input class="input" id="company-phone" name="phone" value="' + esc(entity.phone) + '"></div>'
          + '<div class="inline-actions"><button class="btn btn-primary btn-sm" type="submit">' + I('check', 14) + ' Guardar perfil</button></div>'
          + '</form>'
      })
      + (function () {
        var cam = monitorConfig();
        var camConnected = monitorConnected();
        var resolutionOptions = ['1280x720', '1920x1080', '640x480'].map(function (value) {
          return '<option value="' + value + '"' + (cam.resolution === value ? ' selected' : '') + '>' + value.replace('x', ' × ') + '</option>';
        }).join('');
        var lensOptions = [
          { id: 'unknown', label: 'Sin especificar' },
          { id: 'back', label: 'Trasera' },
          { id: 'front', label: 'Frontal' },
          { id: 'external', label: 'Externa / USB' }
        ].map(function (item) {
          return '<option value="' + item.id + '"' + ((cam.lens || 'unknown') === item.id ? ' selected' : '') + '>' + item.label + '</option>';
        }).join('');
        return C.card({
          title: 'Cámara',
          subtitle: 'DroidCam · fuente de video local',
          body: '<form class="form-grid" data-form="camera-settings">'
            + '<div class="field"><label for="camera-name">Nombre de la cámara</label><input class="input" id="camera-name" name="cameraName" value="' + esc(cam.cameraName) + '"></div>'
            + '<div class="field-row"><div class="field"><label for="camera-host">IP o URL de DroidCam</label><input class="input" id="camera-host" name="host" value="' + esc(cam.host) + '" placeholder="192.168.1.42" autocomplete="off"></div><div class="field"><label for="camera-port">Puerto</label><input class="input" id="camera-port" name="port" value="' + esc(cam.port) + '" placeholder="4747" autocomplete="off"></div></div>'
            + '<div class="field-row"><div class="field"><label for="camera-resolution">Resolución</label><select class="select" id="camera-resolution" name="resolution">' + resolutionOptions + '</select></div><div class="field"><label for="camera-lens">Lente</label><select class="select" id="camera-lens" name="lens">' + lensOptions + '</select></div></div>'
            + '<div class="field"><label>Estado</label><div class="camera-state">' + (camConnected ? C.badge('Conectada', 'success', { dot: true }) : C.badge('Sin conexión', 'neutral', { dot: true })) + '</div></div>'
            + '<div class="form-note">' + I('wifi', 14) + '<span>DroidCam es el único cliente de video. La IP y el puerto se muestran en la app del teléfono; el video se procesa localmente. Con DroidCam OBS el lente se cambia por su API v1; con DroidCam clásico usá Camera Swap en el móvil.</span></div>'
            + '<div class="inline-actions"><button class="btn btn-primary btn-sm" type="submit">' + I('check', 14) + ' Guardar cámara</button><button type="button" class="btn btn-ghost btn-sm" data-action="open-camera-manager">' + I('camera', 14) + ' Gestionar cámaras</button><a class="btn btn-ghost btn-sm" href="#/app/monitoreo">Abrir monitoreo</a></div>'
            + '</form>'
        });
      })()
      + (hasEpp ? C.card({
        className: 'epp-card',
        title: 'EPP / Indumentaria',
        subtitle: 'Regla de cumplimiento por empresa',
        action: '<div class="inline-actions"><button class="btn btn-ghost btn-sm" data-action="test-epp-alert">' + I('bell', 14) + ' Probar</button><button class="btn btn-ghost btn-sm" data-action="open-epp-config">' + I('sliders', 14) + ' Editar</button></div>',
        body: '<div class="epp-summary-head">' + eppSourceBadge(eppModel, null) + eppStateBadge(null) + '</div>'
          + '<div class="status-list">'
          + '<div class="status-row"><span class="status-icon">' + I('hard-hat', 16) + '</span><div><strong>Perfil activo</strong><span class="muted small">' + esc(epp.profileName) + ' · requiere ' + esc(epp.requiredLabel) + '</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('clock', 16) + '</span><div><strong>Gracia y enfriamiento</strong><span class="muted small">' + epp.graceSeconds + ' s para alertar · ' + epp.cooldownSeconds + ' s entre alertas</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('server', 16) + '</span><div><strong>Modelo</strong><span class="muted small">' + (eppModel && eppModel.available ? esc(eppModel.label || 'Modelo EPP local') : 'No instalado · demo simulada') + '</span></div></div>'
          + '</div>'
          + eppProfileSwitch(entity, epp)
          + '<div class="form-note epp-model-note">' + I('info', 14) + '<span>La detección es global, pero cada empresa define si exige casco, chaleco o ambos. En CIM podés alternar entre sitio industrial y sede corporativa sin recargar.</span></div>'
      }) : '')
      + (hasTables ? C.card({
        className: 'tables-card',
        title: 'Mesas y clientes',
        subtitle: 'Ocupación y atención en salón',
        action: '<div class="inline-actions"><button class="btn btn-ghost btn-sm" data-action="test-tables-alert">' + I('bell', 14) + ' Probar</button><button class="btn btn-ghost btn-sm" data-action="open-tables-config">' + I('sliders', 14) + ' Editar</button></div>',
        body: '<div class="status-list">'
          + '<div class="status-row"><span class="status-icon">' + I('utensils', 16) + '</span><div><strong>' + tableConfig.tables.length + (tableConfig.tables.length === 1 ? ' mesa configurada' : ' mesas configuradas') + '</strong><span class="muted small">' + (tableConfig.enabled ? 'Skill activa' : 'Skill desactivada') + ' · objetivo ' + AUTEC.tables.durationLabel(tableConfig.attentionSeconds) + '</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('clock', 16) + '</span><div><strong>Gracia y enfriamiento</strong><span class="muted small">Alerta al superar el objetivo · ' + tableConfig.cooldownSeconds + ' s entre alertas</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('map', 16) + '</span><div><strong>Áreas en video</strong><span class="muted small">' + (tableConfig.showAreas ? 'Visibles' : 'Ocultas') + ' · coordenadas relativas al cuadro</span></div></div>'
          + '</div>'
          + '<div class="form-note">' + I('info', 14) + '<span>La mesa se ocupa cuando el centro inferior de una persona cae dentro del rectángulo. No se identifica a nadie: solo se mide ocupación y permanencia.</span></div>'
      }) : '')
      + (hasFalls ? C.card({
        className: 'falls-card',
        title: 'Detección de caídas',
        subtitle: 'Heurística local de caja',
        action: '<div class="inline-actions"><button class="btn btn-ghost btn-sm" data-action="test-falls-alert">' + I('bell', 14) + ' Probar</button><button class="btn btn-ghost btn-sm" data-action="open-falls-config">' + I('sliders', 14) + ' Editar</button></div>',
        body: '<div class="status-list">'
          + '<div class="status-row"><span class="status-icon">' + I('activity', 16) + '</span><div><strong>Sensibilidad ' + fallConfig.sensitivityName.toLowerCase() + '</strong><span class="muted small">Ancho/alto ≥ ' + AUTEC.falls.ratioLabel(fallConfig.ratioThreshold) + ' durante ' + fallConfig.graceSeconds + ' s</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('clock', 16) + '</span><div><strong>Enfriamiento</strong><span class="muted small">' + fallConfig.cooldownSeconds + ' s entre alertas de la misma persona</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('server', 16) + '</span><div><strong>Procesamiento</strong><span class="muted small">Local · sin modelo de pose ni envío de video</span></div></div>'
          + '</div>'
          + '<div class="form-note">' + I('info', 14) + '<span>Es una ayuda operativa, no un diagnóstico. Una persona sentada o una cámara muy inclinada puede generar falsos positivos; la gracia y el enfriamiento reducen el ruido.</span></div>'
      }) : '')
      + C.card({
        title: 'Notificaciones',
        subtitle: 'Preferencias de la empresa',
        body: '<form class="form-grid" data-form="notification-settings">'
          + settingRow('requestAlerts', 'Novedades de skills', 'Avisar cuando una skill solicitada esté disponible.', settings.requestAlerts)
          + settingRow('expiryAlerts', 'Vencimiento del plan', 'Avisar 7 días antes del vencimiento.', settings.expiryAlerts)
          + settingRow('emailDigest', 'Resumen semanal', 'Recibir un resumen de operación por email.', settings.emailDigest)
          + '<div class="inline-actions"><button class="btn btn-primary btn-sm" type="submit">' + I('check', 14) + ' Guardar preferencias</button></div>'
          + '</form>'
      })
      + '</div>'
      + '<div class="stack">'
      + C.card({
        title: 'Plan actual',
        subtitle: 'Resumen de la suscripción',
        action: C.planBadge(plan.id),
        body: '<div class="plan-price"><strong>' + (plan.price ? U.currency(plan.price) : 'Gratis') + '</strong><span>' + (plan.price ? '/' + plan.period : '') + '</span></div>'
          + '<div class="status-list" style="margin-top:12px">'
          + '<div class="status-row"><span class="status-icon">' + I('calendar', 16) + '</span><div><strong>Vence</strong><span class="muted small">' + U.formatDate(entity.expiresAt) + '</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('users', 16) + '</span><div><strong>Asientos</strong><span class="muted small">' + entity.usersCount + ' de ' + entity.seats + '</span></div></div>'
          + '</div>'
          + '<div class="inline-actions" style="margin-top:14px"><a class="btn btn-ghost btn-sm" href="#/app/plan">Ver plan y facturación</a></div>'
      })
      + C.card({
        title: 'Tu sesión',
        subtitle: 'Cuenta activa',
        body: '<div class="account-card"><div class="account-head">' + C.avatar(user.name) + '<div><strong>' + esc(user.name) + '</strong><span class="muted small">' + esc(user.email || 'demo@vigia.local') + '</span></div></div>'
          + '<div class="inline-actions" style="margin-top:12px">' + C.roleBadge(AUTEC.app.state.auth.role) + C.badge(entity.name, 'neutral') + '</div>'
          + '<div class="inline-actions" style="margin-top:14px"><button class="btn btn-ghost btn-sm" data-action="logout">' + I('logout', 14) + ' Cerrar sesión</button></div>'
          + '</div>'
      })
      + C.card({
        title: 'Acerca de',
        subtitle: 'Maqueta visual',
        body: '<div class="status-list">'
          + '<div class="status-row"><span class="status-icon">' + I('shield-check', 16) + '</span><div><strong>VigIA</strong><span class="muted small">Versión 0.4.0 · mockup</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('server', 16) + '</span><div><strong>Modo</strong><span class="muted small">Local, sin backend</span></div></div>'
          + '<div class="status-row"><span class="status-icon">' + I('mail', 16) + '</span><div><strong>Soporte</strong><span class="muted small">soporte@vigia.local</span></div></div>'
          + '</div>'
      })
      + '</div></div>';
  };

  V.noAccess = function () {
    return C.pageHead({
      eyebrow: 'Permisos',
      title: 'Acceso restringido',
      subtitle: 'Tu rol no tiene permiso para abrir esta sección.'
    })
      + C.card({
        body: C.emptyState({
          icon: 'lock',
          title: 'Esta sección no está disponible',
          text: 'Probá con otro perfil desde el panel Demo o volvé al resumen de tu operación.',
          action: '<a class="btn btn-primary" href="#' + AUTEC.app.homePath() + '">Volver al resumen</a>'
        })
      });
  };
})();
