(function () {
  window.AUTEC = window.AUTEC || {};
  var Z = AUTEC.zones = {};

  var STORAGE_KEY = 'autecVision.zones.v1';
  var COLORS = ['#22d3ee', '#f5a524', '#34d399', '#60a5fa', '#f87171'];
  var MIN_SIZE = 0.02;
  var EXIT_GRACE_MS = 1500;
  var ALERT_HOLD_MS = 6000;

  var presence = {};
  var countAlerted = {};
  var unattendedState = {};
  var patrolState = {};
  var stats = emptyStats();
  var editor = null;

  function emptyStats() {
    return {
      inZones: 0,
      alerts: 0,
      byZone: {},
      alertZones: {},
      alertKinds: {},
      queue: {},
      unattended: {},
      patrol: {}
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function uid() {
    return 'z-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function defaults() {
    return { enabled: true, merodeoEnabled: true, dwellSeconds: 8, zones: [] };
  }

  function normalize(raw) {
    var base = defaults();
    if (!raw || typeof raw !== 'object') return base;

    base.enabled = raw.enabled !== false;
    base.merodeoEnabled = raw.merodeoEnabled !== false;
    var dwell = Number(raw.dwellSeconds);
    base.dwellSeconds = isNaN(dwell) ? 8 : clamp(dwell, 2, 120);

    if (Array.isArray(raw.zones)) {
      base.zones = raw.zones.map(function (zone, index) {
        if (!zone || typeof zone !== 'object') return null;
        var x = clamp(Number(zone.x) || 0, 0, 1);
        var y = clamp(Number(zone.y) || 0, 0, 1);
        var w = clamp(Number(zone.w) || 0, 0, 1 - x);
        var h = clamp(Number(zone.h) || 0, 0, 1 - y);
        if (w < MIN_SIZE || h < MIN_SIZE) return null;
        var color = String(zone.color || '');
        var rawAlerts = zone.alerts && typeof zone.alerts === 'object' ? zone.alerts : {};
        var rawQueue = zone.queue && typeof zone.queue === 'object' ? zone.queue : {};
        var rawUnattended = zone.unattended && typeof zone.unattended === 'object' ? zone.unattended : {};
        var rawPatrol = zone.patrol && typeof zone.patrol === 'object' ? zone.patrol : {};
        var restricted = zone.restricted !== false;
        var maxPeople = Number(zone.maxPeople);
        if (isNaN(maxPeople)) maxPeople = 1;
        maxPeople = Math.round(clamp(maxPeople, 1, 50));
        var queueWait = Number(rawQueue.maxWaitSeconds);
        if (isNaN(queueWait)) queueWait = 45;
        queueWait = Math.round(clamp(queueWait, 5, 600));
        var absenceSeconds = Number(rawUnattended.absenceSeconds);
        if (isNaN(absenceSeconds)) absenceSeconds = 60;
        absenceSeconds = Math.round(clamp(absenceSeconds, 5, 3600));
        var patrolInterval = Number(rawPatrol.intervalSeconds);
        if (isNaN(patrolInterval)) patrolInterval = 900;
        patrolInterval = Math.round(clamp(patrolInterval, 60, 86400));
        var patrolTolerance = Number(rawPatrol.toleranceSeconds);
        if (isNaN(patrolTolerance)) patrolTolerance = 300;
        patrolTolerance = Math.round(clamp(patrolTolerance, 0, 3600));
        return {
          id: String(zone.id || uid()),
          name: String(zone.name || ('Zona ' + (index + 1))).slice(0, 40),
          color: /^#[0-9a-f]{6}$/i.test(color) ? color : COLORS[index % COLORS.length],
          x: x,
          y: y,
          w: w,
          h: h,
          restricted: restricted,
          alerts: {
            entry: restricted || rawAlerts.entry === true,
            dwell: rawAlerts.dwell !== false,
            count: rawAlerts.count === true
          },
          maxPeople: maxPeople,
          queue: {
            enabled: rawQueue.enabled === true,
            maxWaitSeconds: queueWait
          },
          unattended: {
            enabled: rawUnattended.enabled === true,
            absenceSeconds: absenceSeconds
          },
          patrol: {
            enabled: rawPatrol.enabled === true,
            intervalSeconds: patrolInterval,
            toleranceSeconds: patrolTolerance
          }
        };
      }).filter(Boolean);
    }

    return base;
  }

  function read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      return normalize(JSON.parse(raw));
    } catch (_) {
      return defaults();
    }
  }

  var config = read();

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (_) {}
  }

  function reset() {
    presence = {};
    countAlerted = {};
    unattendedState = {};
    patrolState = {};
    stats = emptyStats();
  }

  function resetPatrol() {
    patrolState = {};
    stats.patrol = {};
  }

  function zoneById(id) {
    return config.zones.find(function (zone) { return zone.id === id; });
  }

  Z.config = function () {
    return clone(config);
  };

  Z.stats = function () {
    return clone(stats);
  };

  Z.reset = reset;
  Z.resetPatrol = resetPatrol;

  Z.save = function (next) {
    config = normalize(next);
    persist();
    reset();
  };

  Z.setEnabled = function (enabled) {
    config.enabled = !!enabled;
    persist();
    reset();
  };

  Z.setMerodeoEnabled = function (enabled) {
    config.merodeoEnabled = !!enabled;
    persist();
    reset();
  };

  Z.setDwellSeconds = function (seconds) {
    var value = Number(seconds);
    config.dwellSeconds = isNaN(value) ? 8 : clamp(value, 2, 120);
    persist();
    reset();
  };

  Z.zoneAlertActive = function (id) {
    return !!(stats.alertZones && stats.alertZones[id]);
  };

  Z.alertKind = function (id) {
    return (stats.alertKinds && stats.alertKinds[id]) || null;
  };

  Z.evaluate = function (detections, width, height, now) {
    var events = [];
    var byZone = {};
    var inZoneTracks = {};
    var zoneTracks = {};
    var queueByZone = {};
    var unattendedByZone = {};
    var patrolByZone = {};
    var time = now || Date.now();

    config.zones.forEach(function (zone) {
      byZone[zone.id] = 0;
      zoneTracks[zone.id] = [];
      queueByZone[zone.id] = { count: 0, avgWait: 0, maxWait: 0, totalWait: 0 };
      unattendedByZone[zone.id] = { emptySeconds: 0, alert: false };
      if (zone.patrol && zone.patrol.enabled) {
        patrolByZone[zone.id] = {
          status: 'pending',
          lastVisitAt: null,
          nextDueAt: null,
          visits: 0,
          dueInSeconds: 0,
          overdueSeconds: 0,
          alert: false
        };
      }
    });

    if (!config.enabled || !width || !height || !Array.isArray(detections)) {
      presence = {};
      countAlerted = {};
      unattendedState = {};
      patrolState = {};
      stats = emptyStats();
      stats.byZone = byZone;
      return { events: events, stats: clone(stats) };
    }

    config.zones.forEach(function (zone) {
      if (!zone.patrol || !zone.patrol.enabled) {
        delete patrolState[zone.id];
        return;
      }
      if (!patrolState[zone.id]) {
        patrolState[zone.id] = {
          present: false,
          lastSeenAt: 0,
          lastVisitAt: null,
          nextDueAt: time + zone.patrol.intervalSeconds * 1000,
          visits: 0,
          alerted: false
        };
      }
    });

    var active = {};

    function markAlert(zone, kind, det, type, text) {
      stats.alerts += 1;
      stats.alertZones[zone.id] = time;
      stats.alertKinds[zone.id] = kind;
      if (det) {
        det._zoneAlert = true;
        det._zoneAlertKind = kind;
      }
      events.push({
        type: type,
        kind: kind,
        zone: zone.id,
        alert: true,
        text: text
      });
    }

    detections.forEach(function (det) {
      if (det.trackId === null || det.trackId === undefined) return;
      var x1 = Number(det.x1) || 0;
      var x2 = Number(det.x2) || 0;
      var y2 = Number(det.y2) || 0;
      var px = ((x1 + x2) / 2) / width;
      var py = y2 / height;
      if (px < 0 || px > 1 || py < 0 || py > 1) return;

      config.zones.forEach(function (zone) {
        if (px < zone.x || px > zone.x + zone.w || py < zone.y || py > zone.y + zone.h) return;

        var key = String(det.trackId) + ':' + zone.id;
        active[key] = true;
        byZone[zone.id] += 1;
        inZoneTracks[det.trackId] = true;
        zoneTracks[zone.id].push(det);

        if (!det._zone) {
          det._zone = zone.name;
          det._zoneColor = zone.color;
        }

        if (!presence[key]) {
          presence[key] = { since: time, lastSeen: time, alerted: false };
          if (zone.restricted !== false || zone.alerts.entry) {
            markAlert(zone, 'entry', det, 'alarm',
              'Persona no autorizada ingresando a ' + zone.name + ' · persona #' + det.trackId);
          } else {
            events.push({
              type: 'zone',
              kind: 'entry',
              zone: zone.id,
              alert: false,
              text: 'Persona #' + det.trackId + ' ingresó a ' + zone.name
            });
          }
          return;
        }

        presence[key].lastSeen = time;

        if (zone.queue && zone.queue.enabled) {
          var waitSeconds = (time - presence[key].since) / 1000;
          var queueStats = queueByZone[zone.id];
          queueStats.count += 1;
          queueStats.totalWait += waitSeconds;
          if (waitSeconds > queueStats.maxWait) queueStats.maxWait = waitSeconds;
          if (!presence[key].queueAlerted && waitSeconds >= zone.queue.maxWaitSeconds) {
            presence[key].queueAlerted = true;
            markAlert(zone, 'queue', det, 'alarm',
              'Espera prolongada en ' + zone.name + ' · persona #' + det.trackId
                + ' (' + Math.round(waitSeconds) + ' s)');
          }
        }

        if (config.merodeoEnabled
          && zone.alerts.dwell
          && !presence[key].alerted
          && (time - presence[key].since) >= config.dwellSeconds * 1000) {
          presence[key].alerted = true;
          markAlert(zone, 'dwell', det, 'merodeo',
            'Merodeo en ' + zone.name + ' · persona #' + det.trackId
              + ' (' + Math.round((time - presence[key].since) / 1000) + ' s)');
        }
      });
    });

    config.zones.forEach(function (zone) {
      var count = byZone[zone.id] || 0;
      var limit = zone.maxPeople || 1;
      if (zone.alerts.count && count >= limit) {
        if (!countAlerted[zone.id]) {
          countAlerted[zone.id] = true;
          stats.alerts += 1;
          stats.alertZones[zone.id] = time;
          stats.alertKinds[zone.id] = 'count';
          zoneTracks[zone.id].forEach(function (det) {
            det._zoneAlert = true;
            det._zoneAlertKind = 'count';
          });
          events.push({
            type: 'count',
            kind: 'count',
            zone: zone.id,
            alert: true,
            text: (zone.queue && zone.queue.enabled ? 'Cola en ' : 'Conteo en ') + zone.name + ': ' + count
              + (count === 1 ? ' persona' : ' personas')
              + (zone.queue && zone.queue.enabled ? ' (máximo ' + limit + ')' : ' (desde ' + limit + ')')
          });
        }
      } else {
        delete countAlerted[zone.id];
      }
    });

    config.zones.forEach(function (zone) {
      var queue = queueByZone[zone.id];
      queue.avgWait = queue.count ? Math.round((queue.totalWait / queue.count) * 10) / 10 : 0;
      queue.maxWait = Math.round(queue.maxWait * 10) / 10;
      delete queue.totalWait;

      var count = byZone[zone.id] || 0;
      var state = unattendedState[zone.id];
      if (!state) {
        state = unattendedState[zone.id] = { lastOccupiedAt: time, alerted: false };
      }
      if (count > 0) {
        state.lastOccupiedAt = time;
        state.alerted = false;
        unattendedByZone[zone.id] = { emptySeconds: 0, alert: false };
        return;
      }
      var emptySeconds = Math.max(0, (time - state.lastOccupiedAt) / 1000);
      unattendedByZone[zone.id] = {
        emptySeconds: Math.round(emptySeconds),
        alert: !!state.alerted
      };
      if (zone.unattended && zone.unattended.enabled
        && emptySeconds >= zone.unattended.absenceSeconds
        && !state.alerted) {
        state.alerted = true;
        unattendedByZone[zone.id].alert = true;
        markAlert(zone, 'unattended', null, 'alarm',
          'Puesto desatendido en ' + zone.name + ' · sin personas hace '
            + Math.round(emptySeconds) + ' s');
      }
    });

    Object.keys(unattendedState).forEach(function (id) {
      if (!zoneById(id)) delete unattendedState[id];
    });

    config.zones.forEach(function (zone) {
      if (!zone.patrol || !zone.patrol.enabled) return;
      var state = patrolState[zone.id];
      if (!state) return;

      var count = byZone[zone.id] || 0;
      if (count > 0) {
        if (!state.present) {
          state.lastVisitAt = time;
          state.nextDueAt = time + zone.patrol.intervalSeconds * 1000;
          state.visits += 1;
          state.alerted = false;
          state.present = true;
          events.push({
            type: 'patrol',
            kind: 'visit',
            zone: zone.id,
            alert: false,
            text: 'Ronda registrada en ' + zone.name + ' · '
              + (count === 1 ? '1 persona' : count + ' personas')
          });
        }
        state.lastSeenAt = time;
      } else if (state.present && time - state.lastSeenAt > EXIT_GRACE_MS) {
        state.present = false;
      }

      var deadline = state.nextDueAt + zone.patrol.toleranceSeconds * 1000;
      var dueInSeconds = Math.round((state.nextDueAt - time) / 1000);
      var overdueSeconds = Math.max(0, Math.round((time - deadline) / 1000));
      var status = 'ok';
      if (!state.lastVisitAt) status = 'pending';
      if (time >= state.nextDueAt) status = 'due';
      if (time >= deadline) status = 'overdue';

      patrolByZone[zone.id] = {
        status: status,
        lastVisitAt: state.lastVisitAt,
        nextDueAt: state.nextDueAt,
        visits: state.visits,
        dueInSeconds: dueInSeconds,
        overdueSeconds: overdueSeconds,
        alert: !!state.alerted && status === 'overdue'
      };

      if (status === 'overdue' && !state.alerted) {
        state.alerted = true;
        patrolByZone[zone.id].alert = true;
        var sinceVisit = state.lastVisitAt
          ? Math.max(0, Math.round((time - state.lastVisitAt) / 1000))
          : 0;
        var delay = sinceVisit < 60
          ? sinceVisit + ' s'
          : sinceVisit < 3600
            ? Math.round(sinceVisit / 60) + ' min'
            : Math.round(sinceVisit / 3600) + ' h';
        var detail = state.lastVisitAt
          ? ' · última visita hace ' + delay
          : ' · sin visitas';
        markAlert(zone, 'patrol', null, 'patrol',
          'Ronda vencida en ' + zone.name + detail);
      }
    });

    Object.keys(patrolState).forEach(function (id) {
      var zone = zoneById(id);
      if (!zone || !zone.patrol || !zone.patrol.enabled) delete patrolState[id];
    });

    Object.keys(presence).forEach(function (key) {
      if (active[key]) return;
      var parts = key.split(':');
      var zone = zoneById(parts[1]);
      if (!zone) {
        delete presence[key];
        return;
      }
      if (time - presence[key].lastSeen > EXIT_GRACE_MS) {
        events.push({
          type: 'zone',
          kind: 'exit',
          zone: zone.id,
          alert: false,
          text: 'Persona #' + parts[0] + ' salió de ' + zone.name
        });
        delete presence[key];
      }
    });

    stats.inZones = Object.keys(inZoneTracks).length;
    stats.byZone = byZone;
    stats.queue = queueByZone;
    stats.unattended = unattendedByZone;
    stats.patrol = patrolByZone;
    stats.alertZones = stats.alertZones || {};
    stats.alertKinds = stats.alertKinds || {};
    Object.keys(stats.alertZones).forEach(function (id) {
      if (time - stats.alertZones[id] > ALERT_HOLD_MS) {
        delete stats.alertZones[id];
        delete stats.alertKinds[id];
      }
    });

    return { events: events, stats: clone(stats) };
  };

  function icon(name, size) {
    return AUTEC.icon ? AUTEC.icon(name, size) : '';
  }

  function openEditor() {
    if (!AUTEC.app || typeof AUTEC.app.openModal !== 'function') return;
    editor = null;

    var draft = clone(config);
    var selectedId = draft.zones.length ? draft.zones[0].id : null;
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
    var body = '<div class="zone-editor">'
      + '<div class="zone-editor-toolbar">'
      + '<span class="muted small">Dibujá un rectángulo sobre la imagen para crear una zona.</span>'
      + '<div class="inline-actions">'
      + '<button type="button" class="btn btn-ghost btn-sm" id="zone-add-example">Zona de ejemplo</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" id="zone-clear">Limpiar</button>'
      + '</div>'
      + '</div>'
      + '<div class="zone-stage" id="zone-stage" style="--stage-ratio:' + stageRatio + '; aspect-ratio:' + ratioW + ' / ' + ratioH + '">'
      + '<img src="' + background + '" alt="Vista de la cámara para configurar zonas" draggable="false">'
      + '<div class="zone-shapes" id="zone-shapes"></div>'
      + '</div>'
      + '<div class="zone-editor-controls">'
      + '<label class="check-item"><input type="checkbox" id="zone-enabled"' + (draft.enabled ? ' checked' : '') + '> Zonas activas</label>'
      + '<label class="check-item"><input type="checkbox" id="zone-merodeo"' + (draft.merodeoEnabled ? ' checked' : '') + '> Merodeo global</label>'
      + '<label class="zone-dwell-field">Merodeo después de <input class="input" type="number" id="zone-dwell" min="2" max="120" value="' + draft.dwellSeconds + '"> s</label>'
      + '</div>'
      + '<div class="zone-editor-note">Cada zona puede marcarse como <strong>área restringida</strong>: al ingresar suena una alarma, aparece un aviso y se guarda una <strong>captura automática</strong>. También podés activar merodeo, conteo, <strong>cola</strong>, <strong>puesto desatendido</strong> y <strong>control de rondas</strong>. El merodeo global funciona como interruptor maestro. En un checkpoint de paso, desactivá <strong>Área restringida</strong> para que la visita no dispare una alarma de ingreso.</div>'
      + '<div class="zone-editor-list" id="zone-editor-list"></div>'
      + '<div class="form-note">' + icon('info', 14) + '<span>Las zonas se guardan como porcentajes del cuadro para mantenerse al cambiar la resolución. Las capturas de alarma se guardan en <strong>data/captures</strong> con el nombre de la zona y el tipo de evento.</span></div>'
      + '</div>';

    AUTEC.app.openModal({
      title: 'Zonas y merodeo',
      subtitle: 'Rectángulos sobre la imagen de la cámara.',
      wide: true,
      className: 'modal--zones',
      body: body,
      foot: '<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button>'
        + '<button type="button" class="btn btn-primary" data-action="save-zones">Guardar zonas</button>',
      onMount: function (root) {
        // El monitor puede re-renderizar la vista y reconstruir el modal
        // mientras se editan zonas. Si ya hay un borrador, se reutiliza
        // para no perder los cambios sin guardar.
        if (editor) initEditor(root, editor.draft, editor.selected);
        else initEditor(root, draft, selectedId);
      }
    });
  }

  function initEditor(root, draft, selectedId) {
    var stage = root.querySelector('#zone-stage');
    var shapes = root.querySelector('#zone-shapes');
    var list = root.querySelector('#zone-editor-list');
    if (!stage || !shapes || !list) return;

    var selected = selectedId || null;
    var drag = null;
    var draftEl = null;

    function findZone(id) {
      return draft.zones.find(function (zone) { return zone.id === id; });
    }

    function shapeFor(id) {
      var found = null;
      Array.prototype.forEach.call(shapes.children, function (el) {
        if (el.getAttribute('data-zone-shape') === id) found = el;
      });
      return found;
    }

    function renderShapes() {
      shapes.innerHTML = '';
      draft.zones.forEach(function (zone) {
        var el = document.createElement('div');
        el.className = 'zone-shape' + (zone.id === selected ? ' is-selected' : '');
        el.setAttribute('data-zone-shape', zone.id);
        el.style.left = (zone.x * 100) + '%';
        el.style.top = (zone.y * 100) + '%';
        el.style.width = (zone.w * 100) + '%';
        el.style.height = (zone.h * 100) + '%';
        el.style.borderColor = zone.color;
        el.style.background = hexToRgba(zone.color, 0.12);
        el.innerHTML = '<span class="zone-shape-label" style="background:' + zone.color + '">'
          + esc(zone.name || 'Zona') + '</span>';
        el.addEventListener('pointerdown', function (event) {
          event.stopPropagation();
          selected = zone.id;
          refresh();
        });
        shapes.appendChild(el);
      });
    }

    function renderList() {
      if (!draft.zones.length) {
        list.innerHTML = '<div class="monitor-empty">Todavía no hay zonas. Dibujá un rectángulo sobre la imagen.</div>';
        return;
      }
      list.innerHTML = draft.zones.map(function (zone) {
        var alerts = zone.alerts || { entry: true, dwell: true, count: false };
        var restricted = zone.restricted !== false || alerts.entry;
        var maxPeople = zone.maxPeople || 1;
        var patrol = zone.patrol || { enabled: false, intervalSeconds: 900, toleranceSeconds: 300 };
        var patrolIntervalMinutes = Math.max(1, Math.round(patrol.intervalSeconds / 60));
        var patrolToleranceMinutes = Math.max(0, Math.round(patrol.toleranceSeconds / 60));
        return '<div class="zone-editor-row' + (zone.id === selected ? ' is-selected' : '') + '" data-zone-row="' + esc(zone.id) + '">'
          + '<div class="zone-editor-row-main">'
          + '<span class="zone-dot" style="background:' + zone.color + '"></span>'
          + '<input class="input zone-name-input" data-zone-name="' + esc(zone.id) + '" value="' + esc(zone.name) + '" maxlength="40" aria-label="Nombre de la zona">'
          + '<span class="zone-coords mono">' + Math.round(zone.x * 100) + '%, ' + Math.round(zone.y * 100) + '% · '
          + Math.round(zone.w * 100) + '×' + Math.round(zone.h * 100) + '%</span>'
          + '<button type="button" class="icon-btn zone-remove" data-zone-remove="' + esc(zone.id) + '" aria-label="Eliminar zona">'
          + icon('x', 14) + '</button>'
          + '</div>'
          + '<div class="zone-alert-options">'
          + '<label class="zone-alert-option" title="Alarma, aviso y captura automática al ingresar"><input type="checkbox" data-zone-alert="entry" data-zone-id="' + esc(zone.id) + '"' + (restricted ? ' checked' : '') + '> Área restringida</label>'
          + '<label class="zone-alert-option"><input type="checkbox" data-zone-alert="dwell" data-zone-id="' + esc(zone.id) + '"' + (alerts.dwell ? ' checked' : '') + '> Merodeo</label>'
          + '<label class="zone-alert-option"><input type="checkbox" data-zone-alert="count" data-zone-id="' + esc(zone.id) + '"' + (alerts.count ? ' checked' : '') + '> Conteo</label>'
          + '<label class="zone-alert-limit">desde <input class="input" type="number" min="1" max="50" value="' + maxPeople + '" data-zone-max="' + esc(zone.id) + '"' + (alerts.count || (zone.queue && zone.queue.enabled) ? '' : ' disabled') + ' aria-label="Mínimo de personas para alertar en ' + esc(zone.name) + '"> personas</label>'
          + '<button type="button" class="btn btn-ghost btn-sm zone-test-btn" data-zone-test="' + esc(zone.id) + '">' + icon('bell', 13) + ' Probar</button>'
          + '</div>'
          + '<div class="zone-skill-options">'
          + '<label class="zone-skill-option"><input type="checkbox" data-zone-queue="' + esc(zone.id) + '"' + (zone.queue && zone.queue.enabled ? ' checked' : '') + '> Cola</label>'
          + '<label class="zone-skill-limit">espera máx <input class="input" type="number" min="5" max="600" value="' + (zone.queue ? zone.queue.maxWaitSeconds : 45) + '" data-zone-queue-wait="' + esc(zone.id) + '"' + (zone.queue && zone.queue.enabled ? '' : ' disabled') + '> s</label>'
          + '<label class="zone-skill-option"><input type="checkbox" data-zone-unattended="' + esc(zone.id) + '"' + (zone.unattended && zone.unattended.enabled ? ' checked' : '') + '> Puesto desatendido</label>'
          + '<label class="zone-skill-limit">avisar tras <input class="input" type="number" min="5" max="3600" value="' + (zone.unattended ? zone.unattended.absenceSeconds : 60) + '" data-zone-unattended-wait="' + esc(zone.id) + '"' + (zone.unattended && zone.unattended.enabled ? '' : ' disabled') + '> s</label>'
          + '</div>'
          + '<div class="zone-skill-options">'
          + '<label class="zone-skill-option"><input type="checkbox" data-zone-patrol="' + esc(zone.id) + '"' + (patrol.enabled ? ' checked' : '') + '> Control de rondas</label>'
          + '<label class="zone-skill-limit">cada <input class="input" type="number" min="1" max="1440" value="' + patrolIntervalMinutes + '" data-zone-patrol-interval="' + esc(zone.id) + '"' + (patrol.enabled ? '' : ' disabled') + '> min</label>'
          + '<label class="zone-skill-limit">tolerancia <input class="input" type="number" min="0" max="60" value="' + patrolToleranceMinutes + '" data-zone-patrol-tolerance="' + esc(zone.id) + '"' + (patrol.enabled ? '' : ' disabled') + '> min</label>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    function refresh() {
      renderShapes();
      renderList();
      if (editor) editor.selected = selected;
    }

    function addZone(rect, name) {
      var x = clamp(rect.x, 0, 1);
      var y = clamp(rect.y, 0, 1);
      var w = clamp(rect.w, MIN_SIZE, 1 - x);
      var h = clamp(rect.h, MIN_SIZE, 1 - y);
      if (w < MIN_SIZE || h < MIN_SIZE) return null;
      var zone = {
        id: uid(),
        name: name || ('Zona ' + (draft.zones.length + 1)),
        color: COLORS[draft.zones.length % COLORS.length],
        x: x,
        y: y,
        w: w,
        h: h,
        restricted: true,
        alerts: { entry: true, dwell: true, count: false },
        maxPeople: 1,
        queue: { enabled: false, maxWaitSeconds: 45 },
        unattended: { enabled: false, absenceSeconds: 60 },
        patrol: { enabled: false, intervalSeconds: 900, toleranceSeconds: 300 }
      };
      draft.zones.push(zone);
      selected = zone.id;
      refresh();
      return zone;
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
      if (rect.w >= MIN_SIZE && rect.h >= MIN_SIZE) {
        addZone(rect);
      }
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
      var input = event.target.closest('[data-zone-name]');
      if (!input) return;
      var zone = findZone(input.getAttribute('data-zone-name'));
      if (!zone) return;
      zone.name = input.value.slice(0, 40);
      var shape = shapeFor(zone.id);
      var label = shape ? shape.querySelector('.zone-shape-label') : null;
      if (label) label.textContent = zone.name || 'Zona';
    });

    list.addEventListener('change', function (event) {
      var alertInput = event.target.closest('[data-zone-alert]');
      if (alertInput) {
        var zone = findZone(alertInput.getAttribute('data-zone-id'));
        if (!zone) return;
        var kind = alertInput.getAttribute('data-zone-alert');
        zone.alerts = zone.alerts || { entry: true, dwell: true, count: false };
        zone.alerts[kind] = alertInput.checked;
        if (kind === 'entry') zone.restricted = alertInput.checked;
        if (kind === 'count') {
          var limit = list.querySelector('[data-zone-max="' + zone.id + '"]');
          if (limit) limit.disabled = !(alertInput.checked || (zone.queue && zone.queue.enabled));
        }
        return;
      }

      var maxInput = event.target.closest('[data-zone-max]');
      if (maxInput) {
        var maxZone = findZone(maxInput.getAttribute('data-zone-max'));
        if (!maxZone) return;
        var value = Number(maxInput.value);
        maxZone.maxPeople = isNaN(value) ? 1 : clamp(Math.round(value), 1, 50);
        maxInput.value = maxZone.maxPeople;
        return;
      }

      var queueInput = event.target.closest('[data-zone-queue]');
      if (queueInput) {
        var queueZone = findZone(queueInput.getAttribute('data-zone-queue'));
        if (!queueZone) return;
        queueZone.queue = queueZone.queue || { enabled: false, maxWaitSeconds: 45 };
        queueZone.queue.enabled = queueInput.checked;
        var queueWaitInput = list.querySelector('[data-zone-queue-wait="' + queueZone.id + '"]');
        if (queueWaitInput) queueWaitInput.disabled = !queueInput.checked;
        var queueLimit = list.querySelector('[data-zone-max="' + queueZone.id + '"]');
        if (queueLimit) queueLimit.disabled = !(queueInput.checked || queueZone.alerts.count);
        return;
      }

      var queueWaitInput = event.target.closest('[data-zone-queue-wait]');
      if (queueWaitInput) {
        var queueWaitZone = findZone(queueWaitInput.getAttribute('data-zone-queue-wait'));
        if (!queueWaitZone) return;
        queueWaitZone.queue = queueWaitZone.queue || { enabled: false, maxWaitSeconds: 45 };
        var waitValue = Number(queueWaitInput.value);
        queueWaitZone.queue.maxWaitSeconds = isNaN(waitValue) ? 45 : clamp(Math.round(waitValue), 5, 600);
        queueWaitInput.value = queueWaitZone.queue.maxWaitSeconds;
        return;
      }

      var unattendedInput = event.target.closest('[data-zone-unattended]');
      if (unattendedInput) {
        var unattendedZone = findZone(unattendedInput.getAttribute('data-zone-unattended'));
        if (!unattendedZone) return;
        unattendedZone.unattended = unattendedZone.unattended || { enabled: false, absenceSeconds: 60 };
        unattendedZone.unattended.enabled = unattendedInput.checked;
        var absenceInput = list.querySelector('[data-zone-unattended-wait="' + unattendedZone.id + '"]');
        if (absenceInput) absenceInput.disabled = !unattendedInput.checked;
        return;
      }

      var absenceInput = event.target.closest('[data-zone-unattended-wait]');
      if (absenceInput) {
        var absenceZone = findZone(absenceInput.getAttribute('data-zone-unattended-wait'));
        if (!absenceZone) return;
        absenceZone.unattended = absenceZone.unattended || { enabled: false, absenceSeconds: 60 };
        var absenceValue = Number(absenceInput.value);
        absenceZone.unattended.absenceSeconds = isNaN(absenceValue) ? 60 : clamp(Math.round(absenceValue), 5, 3600);
        absenceInput.value = absenceZone.unattended.absenceSeconds;
        return;
      }

      var patrolInput = event.target.closest('[data-zone-patrol]');
      if (patrolInput) {
        var patrolZone = findZone(patrolInput.getAttribute('data-zone-patrol'));
        if (!patrolZone) return;
        patrolZone.patrol = patrolZone.patrol || { enabled: false, intervalSeconds: 900, toleranceSeconds: 300 };
        patrolZone.patrol.enabled = patrolInput.checked;
        var patrolIntervalInput = list.querySelector('[data-zone-patrol-interval="' + patrolZone.id + '"]');
        var patrolToleranceInput = list.querySelector('[data-zone-patrol-tolerance="' + patrolZone.id + '"]');
        if (patrolIntervalInput) patrolIntervalInput.disabled = !patrolInput.checked;
        if (patrolToleranceInput) patrolToleranceInput.disabled = !patrolInput.checked;
        return;
      }

      var patrolIntervalField = event.target.closest('[data-zone-patrol-interval]');
      if (patrolIntervalField) {
        var patrolIntervalZone = findZone(patrolIntervalField.getAttribute('data-zone-patrol-interval'));
        if (!patrolIntervalZone) return;
        patrolIntervalZone.patrol = patrolIntervalZone.patrol || { enabled: false, intervalSeconds: 900, toleranceSeconds: 300 };
        var patrolMinutes = Number(patrolIntervalField.value);
        patrolIntervalZone.patrol.intervalSeconds = isNaN(patrolMinutes) ? 900 : clamp(Math.round(patrolMinutes * 60), 60, 86400);
        patrolIntervalField.value = Math.max(1, Math.round(patrolIntervalZone.patrol.intervalSeconds / 60));
        return;
      }

      var patrolToleranceField = event.target.closest('[data-zone-patrol-tolerance]');
      if (patrolToleranceField) {
        var patrolToleranceZone = findZone(patrolToleranceField.getAttribute('data-zone-patrol-tolerance'));
        if (!patrolToleranceZone) return;
        patrolToleranceZone.patrol = patrolToleranceZone.patrol || { enabled: false, intervalSeconds: 900, toleranceSeconds: 300 };
        var toleranceMinutes = Number(patrolToleranceField.value);
        patrolToleranceZone.patrol.toleranceSeconds = isNaN(toleranceMinutes) ? 300 : clamp(Math.round(toleranceMinutes * 60), 0, 3600);
        patrolToleranceField.value = Math.max(0, Math.round(patrolToleranceZone.patrol.toleranceSeconds / 60));
      }
    });

    list.addEventListener('click', function (event) {
      var test = event.target.closest('[data-zone-test]');
      if (test) {
        var testZone = findZone(test.getAttribute('data-zone-test'));
        if (testZone && AUTEC.monitor && AUTEC.monitor.testZoneAlert) {
          AUTEC.monitor.testZoneAlert(testZone);
        }
        return;
      }
      var remove = event.target.closest('[data-zone-remove]');
      if (remove) {
        var id = remove.getAttribute('data-zone-remove');
        draft.zones = draft.zones.filter(function (zone) { return zone.id !== id; });
        if (selected === id) selected = draft.zones.length ? draft.zones[0].id : null;
        refresh();
        return;
      }
      var row = event.target.closest('[data-zone-row]');
      if (row && !event.target.closest('input')) {
        selected = row.getAttribute('data-zone-row');
        refresh();
      }
    });

    var enabledInput = root.querySelector('#zone-enabled');
    if (enabledInput) {
      enabledInput.checked = !!draft.enabled;
      enabledInput.addEventListener('change', function () {
        draft.enabled = enabledInput.checked;
      });
    }

    var merodeoInput = root.querySelector('#zone-merodeo');
    if (merodeoInput) {
      merodeoInput.checked = !!draft.merodeoEnabled;
      merodeoInput.addEventListener('change', function () {
        draft.merodeoEnabled = merodeoInput.checked;
      });
    }

    var dwellInput = root.querySelector('#zone-dwell');
    if (dwellInput) {
      dwellInput.value = draft.dwellSeconds;
      dwellInput.addEventListener('change', function () {
        var value = Number(dwellInput.value);
        draft.dwellSeconds = isNaN(value) ? 8 : clamp(value, 2, 120);
        dwellInput.value = draft.dwellSeconds;
      });
    }

    var exampleButton = root.querySelector('#zone-add-example');
    if (exampleButton) {
      exampleButton.addEventListener('click', function () {
        var name = draft.zones.length ? 'Zona de ejemplo ' + (draft.zones.length + 1) : 'Zona de ejemplo';
        addZone({ x: 0.58, y: 0.2, w: 0.24, h: 0.55 }, name);
      });
    }

    var clearButton = root.querySelector('#zone-clear');
    if (clearButton) {
      clearButton.addEventListener('click', function () {
        if (!draft.zones.length) return;
        draft.zones = [];
        selected = null;
        refresh();
      });
    }

    refresh();
    editor = { draft: draft, root: root, selected: selected };
  }

  function hexToRgba(hex, alpha) {
    var value = String(hex || '').replace('#', '');
    if (value.length !== 6) return 'rgba(34, 211, 238, ' + alpha + ')';
    var r = parseInt(value.slice(0, 2), 16);
    var g = parseInt(value.slice(2, 4), 16);
    var b = parseInt(value.slice(4, 6), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  Z.openEditor = openEditor;

  Z.saveEditor = function () {
    if (!editor) return false;
    if (editor.root) {
      var dwellInput = editor.root.querySelector('#zone-dwell');
      if (dwellInput) {
        var seconds = Number(dwellInput.value);
        editor.draft.dwellSeconds = isNaN(seconds) ? 8 : clamp(seconds, 2, 120);
      }
      var enabledInput = editor.root.querySelector('#zone-enabled');
      if (enabledInput) editor.draft.enabled = enabledInput.checked;
      var merodeoInput = editor.root.querySelector('#zone-merodeo');
      if (merodeoInput) editor.draft.merodeoEnabled = merodeoInput.checked;
    }
    config = normalize(editor.draft);
    persist();
    reset();
    editor = null;
    return true;
  };

  Z.cancelEditor = function () {
    editor = null;
  };

  Z.hexToRgba = hexToRgba;
})();
