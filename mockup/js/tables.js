(function () {
  window.AUTEC = window.AUTEC || {};
  var T = AUTEC.tables = {};

  var STORAGE_KEY = 'autecVision.tables.v1';
  var MIN_SIZE = 0.025;
  var TRACK_MEMORY_MS = 30000;
  var COLORS = ['#22d3ee', '#f5a524', '#34d399', '#60a5fa', '#fb7185', '#a78bfa', '#facc15', '#2dd4bf'];

  var DEFAULTS = {
    enabled: true,
    attentionSeconds: 600,
    cooldownSeconds: 180,
    alertSound: true,
    evidence: true,
    showAreas: true
  };

  var LAYOUTS = {
    'retail-centro': [
      { id: 'mesa-1', name: 'Mesa 1', seats: 2, x: 0.06, y: 0.56, w: 0.15, h: 0.22 },
      { id: 'mesa-2', name: 'Mesa 2', seats: 4, x: 0.30, y: 0.55, w: 0.16, h: 0.25 },
      { id: 'mesa-3', name: 'Mesa 3', seats: 4, x: 0.48, y: 0.55, w: 0.16, h: 0.25 },
      { id: 'mesa-4', name: 'Mesa 4', seats: 2, x: 0.66, y: 0.54, w: 0.15, h: 0.26 },
      { id: 'barra', name: 'Barra', seats: 5, x: 0.06, y: 0.82, w: 0.42, h: 0.12 },
      { id: 'terraza', name: 'Terraza', seats: 4, x: 0.55, y: 0.82, w: 0.37, h: 0.12 }
    ],
    'hotel-alba': [
      { id: 'mesa-1', name: 'Mesa 1', seats: 2, x: 0.08, y: 0.50, w: 0.16, h: 0.22 },
      { id: 'mesa-2', name: 'Mesa 2', seats: 4, x: 0.32, y: 0.48, w: 0.18, h: 0.24 },
      { id: 'mesa-3', name: 'Mesa 3', seats: 2, x: 0.58, y: 0.50, w: 0.16, h: 0.22 },
      { id: 'mesa-4', name: 'Mesa 4', seats: 6, x: 0.79, y: 0.48, w: 0.15, h: 0.25 },
      { id: 'barra', name: 'Barra', seats: 6, x: 0.08, y: 0.82, w: 0.46, h: 0.12 },
      { id: 'salon', name: 'Salón', seats: 8, x: 0.60, y: 0.80, w: 0.34, h: 0.14 }
    ],
    default: [
      { id: 'mesa-1', name: 'Mesa 1', seats: 2, x: 0.08, y: 0.54, w: 0.16, h: 0.24 },
      { id: 'mesa-2', name: 'Mesa 2', seats: 4, x: 0.31, y: 0.54, w: 0.17, h: 0.24 },
      { id: 'mesa-3', name: 'Mesa 3', seats: 4, x: 0.53, y: 0.54, w: 0.17, h: 0.24 },
      { id: 'mesa-4', name: 'Mesa 4', seats: 2, x: 0.75, y: 0.54, w: 0.17, h: 0.24 },
      { id: 'barra', name: 'Barra', seats: 5, x: 0.08, y: 0.82, w: 0.42, h: 0.12 },
      { id: 'terraza', name: 'Terraza', seats: 4, x: 0.55, y: 0.82, w: 0.37, h: 0.12 }
    ]
  };

  var runtime = {
    companyId: null,
    state: {},
    stats: null
  };

  var editor = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampNumber(value, minimum, maximum, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.round(clamp(number, minimum, maximum));
  }

  function uid() {
    return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function icon(name, size) {
    return AUTEC.icon ? AUTEC.icon(name, size) : '';
  }

  function hexToRgba(hex, alpha) {
    var value = String(hex || '').replace('#', '');
    if (value.length !== 6) return 'rgba(34, 211, 238, ' + (alpha || 0.12) + ')';
    var r = parseInt(value.slice(0, 2), 16);
    var g = parseInt(value.slice(2, 4), 16);
    var b = parseInt(value.slice(4, 6), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (alpha || 0.12) + ')';
  }

  function currentCompany() {
    if (AUTEC.app && AUTEC.app.state && AUTEC.app.state.auth && AUTEC.app.currentCompany) {
      return AUTEC.app.currentCompany();
    }
    return null;
  }

  function resolveCompanyId(companyId) {
    if (companyId) return String(companyId);
    var company = currentCompany();
    return company ? company.id : 'default';
  }

  function read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { companies: {} };
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.companies || typeof parsed.companies !== 'object') {
        return { companies: {} };
      }
      return { companies: parsed.companies };
    } catch (_) {
      return { companies: {} };
    }
  }

  var saved = read();

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (_) {}
  }

  function normalizeTable(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    var x = clamp(Number(raw.x) || 0, 0, 1);
    var y = clamp(Number(raw.y) || 0, 0, 1);
    var w = clamp(Number(raw.w) || 0, 0, 1 - x);
    var h = clamp(Number(raw.h) || 0, 0, 1 - y);
    if (w < MIN_SIZE || h < MIN_SIZE) return null;
    var color = String(raw.color || '');
    return {
      id: String(raw.id || uid()),
      name: String(raw.name || ('Mesa ' + (index + 1))).slice(0, 40),
      seats: clampNumber(raw.seats, 1, 20, 2),
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : COLORS[index % COLORS.length],
      x: Math.round(x * 10000) / 10000,
      y: Math.round(y * 10000) / 10000,
      w: Math.round(w * 10000) / 10000,
      h: Math.round(h * 10000) / 10000
    };
  }

  function normalize(raw, companyId) {
    var layout = LAYOUTS[companyId] || LAYOUTS.default;
    var base = {
      enabled: DEFAULTS.enabled,
      attentionSeconds: DEFAULTS.attentionSeconds,
      cooldownSeconds: DEFAULTS.cooldownSeconds,
      alertSound: DEFAULTS.alertSound,
      evidence: DEFAULTS.evidence,
      showAreas: DEFAULTS.showAreas,
      tables: clone(layout)
    };
    if (!raw || typeof raw !== 'object') {
      return {
        enabled: base.enabled,
        attentionSeconds: base.attentionSeconds,
        cooldownSeconds: base.cooldownSeconds,
        alertSound: base.alertSound,
        evidence: base.evidence,
        showAreas: base.showAreas,
        tables: base.tables.map(normalizeTable).filter(Boolean)
      };
    }
    var tables = Array.isArray(raw.tables)
      ? raw.tables.map(normalizeTable).filter(Boolean)
      : base.tables.map(normalizeTable).filter(Boolean);
    return {
      enabled: raw.enabled !== false,
      attentionSeconds: clampNumber(raw.attentionSeconds, 30, 7200, DEFAULTS.attentionSeconds),
      cooldownSeconds: clampNumber(raw.cooldownSeconds, 10, 3600, DEFAULTS.cooldownSeconds),
      alertSound: raw.alertSound !== false,
      evidence: raw.evidence !== false,
      showAreas: raw.showAreas !== false,
      tables: tables
    };
  }

  function companyConfig(companyId) {
    var id = resolveCompanyId(companyId);
    var raw = saved.companies[id];
    var config = normalize(raw, id);
    return {
      companyId: id,
      enabled: config.enabled,
      attentionSeconds: config.attentionSeconds,
      cooldownSeconds: config.cooldownSeconds,
      alertSound: config.alertSound,
      evidence: config.evidence,
      showAreas: config.showAreas,
      tables: config.tables
    };
  }

  function resetRuntime(companyId) {
    if (!companyId || runtime.companyId === companyId) {
      runtime.state = {};
      runtime.stats = null;
    }
  }

  T.config = function (companyId) {
    return clone(companyConfig(companyId));
  };

  T.update = function (companyId, patch) {
    var id = resolveCompanyId(companyId);
    var current = companyConfig(id);
    var next = {
      enabled: patch && typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
      attentionSeconds: patch && patch.attentionSeconds !== undefined
        ? clampNumber(patch.attentionSeconds, 30, 7200, current.attentionSeconds)
        : current.attentionSeconds,
      cooldownSeconds: patch && patch.cooldownSeconds !== undefined
        ? clampNumber(patch.cooldownSeconds, 10, 3600, current.cooldownSeconds)
        : current.cooldownSeconds,
      alertSound: patch && typeof patch.alertSound === 'boolean' ? patch.alertSound : current.alertSound,
      evidence: patch && typeof patch.evidence === 'boolean' ? patch.evidence : current.evidence,
      showAreas: patch && typeof patch.showAreas === 'boolean' ? patch.showAreas : current.showAreas,
      tables: patch && Array.isArray(patch.tables) ? patch.tables : current.tables
    };
    saved.companies[id] = normalize(next, id);
    persist();
    resetRuntime(id);
    return companyConfig(id);
  };

  T.setEnabled = function (companyId, enabled) {
    return T.update(companyId, { enabled: !!enabled });
  };

  T.hasSkill = function (companyId) {
    var id = resolveCompanyId(companyId);
    if (!AUTEC.store || !AUTEC.store.companies) return false;
    var company = AUTEC.store.companies.find(function (item) { return item.id === id; });
    return !!(company && company.skills && company.skills.indexOf('mesas') !== -1);
  };

  T.active = function (companyId) {
    return T.hasSkill(companyId) && companyConfig(companyId).enabled;
  };

  T.reset = function (companyId) {
    resetRuntime(resolveCompanyId(companyId));
  };

  function durationLabel(seconds) {
    var total = Math.max(0, Math.round(Number(seconds) || 0));
    if (total < 60) return total + ' s';
    var minutes = Math.round(total / 60);
    if (minutes < 60) return minutes + ' min';
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return hours + ' h' + (rest ? ' ' + rest + ' min' : '');
  }

  T.durationLabel = durationLabel;

  function emptyStats(config, simulated) {
    var tables = {};
    config.tables.forEach(function (table) {
      tables[table.id] = {
        count: 0,
        seats: table.seats,
        status: 'free',
        since: 0,
        seconds: 0,
        attention: false,
        alert: false
      };
    });
    return {
      companyId: config.companyId,
      enabled: config.enabled,
      total: config.tables.length,
      occupied: 0,
      free: config.tables.length,
      customers: 0,
      seats: config.tables.reduce(function (sum, table) { return sum + table.seats; }, 0),
      occupancyRate: 0,
      attentionSeconds: config.attentionSeconds,
      attention: 0,
      pending: 0,
      alerts: 0,
      simulated: !!simulated,
      source: simulated ? 'demo' : 'live',
      tables: tables
    };
  }

  function finalize(stats) {
    stats.free = Math.max(0, stats.total - stats.occupied);
    stats.occupancyRate = stats.total ? Math.round(stats.occupied / stats.total * 100) : 0;
    var occupiedSeconds = 0;
    var occupiedCount = 0;
    stats.pending = 0;
    Object.keys(stats.tables).forEach(function (id) {
      var info = stats.tables[id];
      if (info.count > 0) {
        occupiedCount += 1;
        occupiedSeconds += info.seconds;
      }
      if (info.attention) stats.pending += 1;
    });
    stats.attention = occupiedCount ? Math.round(occupiedSeconds / occupiedCount) : 0;
    return stats;
  }

  function tableAt(config, nx, ny) {
    for (var i = 0; i < config.tables.length; i += 1) {
      var table = config.tables[i];
      if (nx >= table.x && nx <= table.x + table.w && ny >= table.y && ny <= table.y + table.h) {
        return table;
      }
    }
    return null;
  }

  T.evaluate = function (detections, width, height, now, opts) {
    opts = opts || {};
    var config = companyConfig(opts.companyId);
    var timestamp = Number(now) || Date.now();
    var simulated = opts.simulate === true;
    var stats = emptyStats(config, simulated);
    var events = [];
    var list = Array.isArray(detections) ? detections : [];

    if (!config.enabled || !width || !height) {
      runtime.companyId = config.companyId;
      stats.source = config.enabled ? (simulated ? 'demo' : 'live') : 'disabled';
      runtime.stats = stats;
      return { stats: stats, events: events, config: config };
    }

    if (runtime.companyId !== config.companyId) {
      runtime.companyId = config.companyId;
      runtime.state = {};
    }

    var seen = {};

    list.forEach(function (det) {
      if (!det) return;
      var x1 = Number(det.x1) || 0;
      var y1 = Number(det.y1) || 0;
      var x2 = Number(det.x2) || 0;
      var y2 = Number(det.y2) || 0;
      if (x2 <= x1 || y2 <= y1) return;
      var nx = ((x1 + x2) / 2) / width;
      var ny = y2 / height;
      var table = tableAt(config, nx, ny);
      if (!table) return;
      stats.tables[table.id].count += 1;
      det._table = {
        id: table.id,
        name: table.name,
        seats: table.seats,
        color: table.color
      };
    });

    config.tables.forEach(function (table) {
      var info = stats.tables[table.id];
      var previous = runtime.state[table.id] || {
        occupiedSince: 0,
        alertedAt: 0,
        alerted: false,
        lastCount: 0
      };
      seen[table.id] = true;
      previous.lastSeen = timestamp;

      if (info.count > 0) {
        if (!previous.occupiedSince) {
          previous.occupiedSince = timestamp;
          previous.alertedAt = 0;
          previous.alerted = false;
        }
        info.since = previous.occupiedSince;
        info.seconds = Math.max(0, Math.round((timestamp - previous.occupiedSince) / 1000));
        info.status = 'occupied';
        info.attention = info.seconds >= config.attentionSeconds;
        info.alert = info.attention;
        stats.occupied += 1;
        stats.customers += info.count;

        var cooldownMs = config.cooldownSeconds * 1000;
        if (info.attention && timestamp - previous.alertedAt >= cooldownMs) {
          var who = info.count === 1 ? '1 persona' : info.count + ' personas';
          events.push({
            type: 'mesa',
            kind: 'mesa',
            alert: true,
            text: (simulated ? 'SIMULACIÓN · ' : '') + table.name + ' supera el objetivo de atención · '
              + who + ' · ' + durationLabel(info.seconds),
            tableId: table.id,
            tableName: table.name,
            seconds: info.seconds,
            count: info.count,
            simulated: simulated
          });
          previous.alertedAt = timestamp;
          previous.alerted = true;
          stats.alerts += 1;
        }

        if (!previous.alerted && info.attention) {
          previous.alerted = true;
        }
      } else {
        if (previous.occupiedSince) {
          var held = Math.round((timestamp - previous.occupiedSince) / 1000);
          if (held >= 30) {
            events.push({
              type: 'mesa-libre',
              kind: 'mesa',
              alert: false,
              text: (simulated ? 'SIMULACIÓN · ' : '') + table.name + ' liberada · '
                + durationLabel(held) + ' de permanencia',
              tableId: table.id,
              tableName: table.name,
              seconds: held,
              simulated: simulated
            });
          }
          previous.occupiedSince = 0;
          previous.alertedAt = 0;
          previous.alerted = false;
        }
        info.status = 'free';
      }

      previous.lastCount = info.count;
      runtime.state[table.id] = previous;
    });

    Object.keys(runtime.state).forEach(function (id) {
      if (!seen[id] && timestamp - (runtime.state[id].lastSeen || 0) > TRACK_MEMORY_MS) {
        delete runtime.state[id];
      }
    });

    finalize(stats);
    runtime.companyId = config.companyId;
    runtime.stats = stats;
    return { stats: stats, events: events, config: config };
  };

  T.stats = function () {
    return runtime.stats ? clone(runtime.stats) : null;
  };

  function hashString(value) {
    var text = String(value == null ? '' : value);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash >>> 0);
  }

  function demoDetections() {
    var monitoring = AUTEC.store && AUTEC.store.monitoring;
    var people = monitoring && Array.isArray(monitoring.people) ? monitoring.people : [];
    return people.map(function (person) {
      var box = person.box || { x: 0, y: 0, w: 10, h: 40 };
      return {
        trackId: person.id,
        confidence: person.confidence,
        x1: box.x,
        y1: box.y,
        x2: box.x + box.w,
        y2: box.y + box.h
      };
    });
  }

  T.previewStats = function (companyId) {
    var config = companyConfig(companyId);
    var stats = emptyStats(config, true);
    stats.source = 'demo';
    stats.simulated = true;

    demoDetections().forEach(function (det) {
      var table = tableAt(config, (det.x1 + det.x2) / 2 / 100, det.y2 / 100);
      if (table) stats.tables[table.id].count += 1;
    });

    var bucket = Math.floor(Date.now() / 60000);
    var firstOccupied = true;
    config.tables.forEach(function (table) {
      var info = stats.tables[table.id];
      if (info.count > 0) {
        var seed = hashString(table.id + ':' + bucket);
        var seconds = 120 + (seed % 480);
        if (firstOccupied) {
          seconds = config.attentionSeconds + 60 + (seed % 180);
          firstOccupied = false;
        }
        info.status = 'occupied';
        info.seconds = seconds;
        info.since = Date.now() - seconds * 1000;
        info.attention = seconds >= config.attentionSeconds;
        info.alert = info.attention;
        stats.occupied += 1;
        stats.customers += info.count;
      }
    });

    return finalize(stats);
  };

  T.statsForView = function (companyId) {
    var id = resolveCompanyId(companyId);
    var connected = !!(AUTEC.monitor && AUTEC.monitor.isConnected && AUTEC.monitor.isConnected());
    if (connected && runtime.stats && runtime.stats.companyId === id) {
      return clone(runtime.stats);
    }
    return T.previewStats(id);
  };

  T.statusLabel = function (info) {
    if (!info || !info.count) return 'Libre';
    if (info.attention) return 'Atención';
    return 'Ocupada';
  };

  T.statusTone = function (info) {
    if (!info || !info.count) return 'neutral';
    return info.attention ? 'warning' : 'success';
  };

  function ratioLabel(info) {
    if (!info || !info.count) return 'Sin personas';
    return info.count + (info.count === 1 ? ' persona' : ' personas');
  }

  T.ratioLabel = ratioLabel;

  /* ------------------------------------------------------------- editor */

  function openEditor() {
    if (!AUTEC.app || typeof AUTEC.app.openModal !== 'function') return;
    var company = currentCompany();
    var companyId = company ? company.id : resolveCompanyId();
    var config = companyConfig(companyId);
    editor = null;

    var draft = clone(config);
    var selectedId = draft.tables.length ? draft.tables[0].id : null;
    var ratioW = 16;
    var ratioH = 9;
    var monitorState = AUTEC.monitor && AUTEC.monitor.state ? AUTEC.monitor.state() : null;

    if (monitorState && monitorState.width && monitorState.height) {
      ratioW = monitorState.width;
      ratioH = monitorState.height;
    }

    var background = null;
    try {
      background = AUTEC.monitor && AUTEC.monitor.frameDataUrl
        ? AUTEC.monitor.frameDataUrl()
        : null;
    } catch (_) {}
    if (!background) background = 'assets/camera-frame.jpg';

    var stageRatio = ratioW / ratioH;
    var body = '<div class="zone-editor table-editor">'
      + '<div class="zone-editor-toolbar">'
      + '<span class="muted small">Dibujá un rectángulo sobre la mesa o el sector del salón.</span>'
      + '<div class="inline-actions">'
      + '<button type="button" class="btn btn-ghost btn-sm" id="table-add-example">Mesa de ejemplo</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" id="table-clear">Limpiar</button>'
      + '</div>'
      + '</div>'
      + '<div class="zone-stage" id="table-stage" style="--stage-ratio:' + stageRatio + '; aspect-ratio:' + ratioW + ' / ' + ratioH + '">'
      + '<img src="' + background + '" alt="Vista de la cámara para configurar mesas" draggable="false">'
      + '<div class="zone-shapes" id="table-shapes"></div>'
      + '</div>'
      + '<div class="zone-editor-controls">'
      + '<label class="check-item"><input type="checkbox" id="table-enabled"' + (draft.enabled ? ' checked' : '') + '> Mesas activas</label>'
      + '<label class="table-limit-field">Atención objetivo <input class="input" type="number" id="table-attention" min="1" max="120" value="' + Math.round(draft.attentionSeconds / 60) + '"> min</label>'
      + '<label class="table-limit-field">Enfriamiento <input class="input" type="number" id="table-cooldown" min="10" max="3600" value="' + draft.cooldownSeconds + '"> s</label>'
      + '<label class="check-item"><input type="checkbox" id="table-areas"' + (draft.showAreas ? ' checked' : '') + '> Mostrar áreas en el video</label>'
      + '</div>'
      + '<div class="zone-editor-note">La mesa se marca <strong>ocupada</strong> cuando una persona se ubica dentro del rectángulo. Si supera el <strong>objetivo de atención</strong>, aparece una alerta y se guarda una <strong>captura automática</strong>. Las mesas se guardan como porcentajes del cuadro para mantenerse al cambiar la resolución.</div>'
      + '<div class="zone-editor-list" id="table-editor-list"></div>'
      + '<div class="form-note">' + icon('info', 14) + '<span>Esta skill estima ocupación y permanencia con las cajas de personas; no identifica clientes ni personal. Usá el objetivo de atención como referencia operativa del salón.</span></div>'
      + '</div>';

    AUTEC.app.openModal({
      title: 'Mesas y clientes',
      subtitle: company.name + ' · ocupación y atención en salón',
      wide: true,
      className: 'modal--zones modal--tables',
      body: body,
      foot: '<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button>'
        + '<button type="button" class="btn btn-primary" data-action="save-tables">Guardar mesas</button>',
      onMount: function (root) {
        if (editor) initEditor(root, editor.draft, editor.selected);
        else initEditor(root, draft, selectedId);
      }
    });
  }

  function initEditor(root, draft, selectedId) {
    var stage = root.querySelector('#table-stage');
    var shapes = root.querySelector('#table-shapes');
    var list = root.querySelector('#table-editor-list');
    if (!stage || !shapes || !list) return;

    var selected = selectedId || null;
    var drag = null;
    var draftEl = null;

    function findTable(id) {
      return draft.tables.find(function (table) { return table.id === id; });
    }

    function shapeFor(id) {
      var found = null;
      Array.prototype.forEach.call(shapes.children, function (el) {
        if (el.getAttribute('data-table-shape') === id) found = el;
      });
      return found;
    }

    function renderShapes() {
      shapes.innerHTML = '';
      draft.tables.forEach(function (table) {
        var el = document.createElement('div');
        el.className = 'zone-shape table-shape' + (table.id === selected ? ' is-selected' : '');
        el.setAttribute('data-table-shape', table.id);
        el.style.left = (table.x * 100) + '%';
        el.style.top = (table.y * 100) + '%';
        el.style.width = (table.w * 100) + '%';
        el.style.height = (table.h * 100) + '%';
        el.style.borderColor = table.color;
        el.style.background = hexToRgba(table.color, 0.12);
        el.innerHTML = '<span class="zone-shape-label" style="background:' + table.color + '">'
          + esc(table.name || 'Mesa') + ' · ' + table.seats + ' pax</span>';
        el.addEventListener('pointerdown', function (event) {
          event.stopPropagation();
          selected = table.id;
          refresh();
        });
        shapes.appendChild(el);
      });
    }

    function renderList() {
      if (!draft.tables.length) {
        list.innerHTML = '<div class="monitor-empty">Todavía no hay mesas. Dibujá un rectángulo sobre la imagen.</div>';
        return;
      }
      list.innerHTML = draft.tables.map(function (table) {
        return '<div class="zone-editor-row table-editor-row' + (table.id === selected ? ' is-selected' : '') + '" data-table-row="' + esc(table.id) + '">'
          + '<div class="zone-editor-row-main">'
          + '<span class="zone-dot" style="background:' + table.color + '"></span>'
          + '<input class="input zone-name-input" data-table-name="' + esc(table.id) + '" value="' + esc(table.name) + '" maxlength="40" aria-label="Nombre de la mesa">'
          + '<label class="table-seats-field">' + icon('users', 12) + ' <input class="input" type="number" min="1" max="20" value="' + table.seats + '" data-table-seats="' + esc(table.id) + '" aria-label="Comensales de ' + esc(table.name) + '"> pax</label>'
          + '<span class="zone-coords mono">' + Math.round(table.x * 100) + '%, ' + Math.round(table.y * 100) + '% · '
          + Math.round(table.w * 100) + '×' + Math.round(table.h * 100) + '%</span>'
          + '<button type="button" class="icon-btn zone-remove" data-table-remove="' + esc(table.id) + '" aria-label="Eliminar mesa">'
          + icon('x', 14) + '</button>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    function refresh() {
      renderShapes();
      renderList();
      if (editor) editor.selected = selected;
    }

    function addTable(rect, name) {
      var x = clamp(rect.x, 0, 1);
      var y = clamp(rect.y, 0, 1);
      var w = clamp(rect.w, MIN_SIZE, 1 - x);
      var h = clamp(rect.h, MIN_SIZE, 1 - y);
      if (w < MIN_SIZE || h < MIN_SIZE) return null;
      var table = {
        id: uid(),
        name: name || ('Mesa ' + (draft.tables.length + 1)),
        color: COLORS[draft.tables.length % COLORS.length],
        seats: 2,
        x: x,
        y: y,
        w: w,
        h: h
      };
      draft.tables.push(table);
      selected = table.id;
      refresh();
      return table;
    }

    function pointerPosition(event) {
      var rect = stage.getBoundingClientRect();
      return {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
      };
    }

    stage.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest('.zone-shape')) return;
      event.preventDefault();
      var point = pointerPosition(event);
      drag = {
        start: point,
        rect: { x: point.x, y: point.y, w: 0, h: 0 },
        pointerId: event.pointerId
      };
      draftEl = document.createElement('div');
      draftEl.className = 'zone-shape is-draft';
      draftEl.style.left = (point.x * 100) + '%';
      draftEl.style.top = (point.y * 100) + '%';
      draftEl.style.width = '0%';
      draftEl.style.height = '0%';
      shapes.appendChild(draftEl);
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (_) {}
    });

    stage.addEventListener('pointermove', function (event) {
      if (!drag) return;
      var point = pointerPosition(event);
      var left = Math.min(drag.start.x, point.x);
      var top = Math.min(drag.start.y, point.y);
      var width = Math.abs(point.x - drag.start.x);
      var height = Math.abs(point.y - drag.start.y);
      drag.rect = { x: left, y: top, w: width, h: height };
      if (draftEl) {
        draftEl.style.left = (left * 100) + '%';
        draftEl.style.top = (top * 100) + '%';
        draftEl.style.width = (width * 100) + '%';
        draftEl.style.height = (height * 100) + '%';
      }
    });

    stage.addEventListener('pointerup', function (event) {
      if (!drag) return;
      var rect = drag.rect;
      drag = null;
      if (draftEl) {
        draftEl.remove();
        draftEl = null;
      }
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch (_) {}
      if (rect.w >= MIN_SIZE && rect.h >= MIN_SIZE) addTable(rect);
    });

    stage.addEventListener('pointercancel', function () {
      drag = null;
      if (draftEl) {
        draftEl.remove();
        draftEl = null;
      }
    });

    stage.addEventListener('dragstart', function (event) {
      event.preventDefault();
    });

    list.addEventListener('input', function (event) {
      var input = event.target.closest('[data-table-name]');
      if (!input) return;
      var table = findTable(input.getAttribute('data-table-name'));
      if (!table) return;
      table.name = input.value.slice(0, 40);
      var shape = shapeFor(table.id);
      var label = shape ? shape.querySelector('.zone-shape-label') : null;
      if (label) label.textContent = table.name + ' · ' + table.seats + ' pax';
    });

    list.addEventListener('change', function (event) {
      var seats = event.target.closest('[data-table-seats]');
      if (seats) {
        var seatsTable = findTable(seats.getAttribute('data-table-seats'));
        if (!seatsTable) return;
        var value = Number(seats.value);
        seatsTable.seats = isNaN(value) ? 2 : clamp(Math.round(value), 1, 20);
        seats.value = seatsTable.seats;
        var shape = shapeFor(seatsTable.id);
        var label = shape ? shape.querySelector('.zone-shape-label') : null;
        if (label) label.textContent = seatsTable.name + ' · ' + seatsTable.seats + ' pax';
      }
    });

    list.addEventListener('click', function (event) {
      var remove = event.target.closest('[data-table-remove]');
      if (!remove) return;
      var id = remove.getAttribute('data-table-remove');
      draft.tables = draft.tables.filter(function (table) { return table.id !== id; });
      if (selected === id) selected = draft.tables.length ? draft.tables[0].id : null;
      refresh();
    });

    var enabled = root.querySelector('#table-enabled');
    if (enabled) {
      enabled.addEventListener('change', function () {
        draft.enabled = enabled.checked;
      });
    }
    var attention = root.querySelector('#table-attention');
    if (attention) {
      attention.addEventListener('change', function () {
        var minutes = Number(attention.value);
        draft.attentionSeconds = isNaN(minutes) ? 10 : clamp(Math.round(minutes * 60), 30, 7200);
        attention.value = Math.max(1, Math.round(draft.attentionSeconds / 60));
      });
    }
    var cooldown = root.querySelector('#table-cooldown');
    if (cooldown) {
      cooldown.addEventListener('change', function () {
        var seconds = Number(cooldown.value);
        draft.cooldownSeconds = isNaN(seconds) ? 180 : clamp(Math.round(seconds), 10, 3600);
        cooldown.value = draft.cooldownSeconds;
      });
    }
    var areas = root.querySelector('#table-areas');
    if (areas) {
      areas.addEventListener('change', function () {
        draft.showAreas = areas.checked;
      });
    }

    var addExample = root.querySelector('#table-add-example');
    if (addExample) {
      addExample.addEventListener('click', function () {
        addTable({ x: 0.1, y: 0.55, w: 0.18, h: 0.24 });
      });
    }
    var clear = root.querySelector('#table-clear');
    if (clear) {
      clear.addEventListener('click', function () {
        draft.tables = [];
        selected = null;
        refresh();
      });
    }

    editor = { draft: draft, selected: selected };
    refresh();
  }

  T.saveEditor = function () {
    if (!editor) return false;
    if (!editor.draft.tables.length) {
      if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast('Dibujá al menos una mesa', 'danger');
      return false;
    }
    var company = currentCompany();
    var id = company ? company.id : resolveCompanyId();
    saved.companies[id] = normalize(editor.draft, id);
    persist();
    resetRuntime(id);
    editor = null;
    return true;
  };

  T.openEditor = openEditor;
  T.hexToRgba = hexToRgba;
})();
