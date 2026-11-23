(function () {
  window.AUTEC = window.AUTEC || {};
  var F = AUTEC.falls = {};

  var STORAGE_KEY = 'autecVision.falls.v1';
  var TRACK_MEMORY_MS = 30000;

  var SENSITIVITY = {
    baja: { id: 'baja', name: 'Baja', ratio: 1.25, description: 'Solo cajas muy horizontales.' },
    media: { id: 'media', name: 'Media', ratio: 1.05, description: 'Equilibrio entre detección y falsos positivos.' },
    alta: { id: 'alta', name: 'Alta', ratio: 0.85, description: 'Detecta antes, con más riesgo de falsos positivos.' }
  };

  var DEFAULTS = {
    enabled: true,
    sensitivity: 'media',
    graceSeconds: 3,
    cooldownSeconds: 120,
    alertSound: true,
    evidence: true,
    showBoxes: true
  };

  var runtime = {
    companyId: null,
    config: null,
    tracks: {},
    stats: null
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clampNumber(value, minimum, maximum, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
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

  function sanitizeSensitivity(value) {
    return SENSITIVITY[value] ? value : DEFAULTS.sensitivity;
  }

  function sensitivityOf(id) {
    return SENSITIVITY[id] || SENSITIVITY.media;
  }

  function companyConfig(companyId) {
    var id = resolveCompanyId(companyId);
    var base = saved.companies[id] || {};
    var sensitivity = sensitivityOf(sanitizeSensitivity(base.sensitivity));
    return {
      companyId: id,
      enabled: base.enabled !== false,
      sensitivity: sensitivity.id,
      sensitivityName: sensitivity.name,
      sensitivityDescription: sensitivity.description,
      ratioThreshold: sensitivity.ratio,
      graceSeconds: clampNumber(base.graceSeconds, 1, 30, DEFAULTS.graceSeconds),
      cooldownSeconds: clampNumber(base.cooldownSeconds, 10, 600, DEFAULTS.cooldownSeconds),
      alertSound: base.alertSound !== false,
      evidence: base.evidence !== false,
      showBoxes: base.showBoxes !== false
    };
  }

  F.sensitivities = function () {
    return Object.keys(SENSITIVITY).map(function (id) {
      return {
        id: id,
        name: SENSITIVITY[id].name,
        ratio: SENSITIVITY[id].ratio,
        description: SENSITIVITY[id].description
      };
    });
  };

  F.config = function (companyId) {
    return companyConfig(companyId);
  };

  F.update = function (companyId, patch) {
    var id = resolveCompanyId(companyId);
    var current = companyConfig(id);
    var next = {
      enabled: patch && typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
      sensitivity: patch && patch.sensitivity ? sanitizeSensitivity(patch.sensitivity) : current.sensitivity,
      graceSeconds: patch && patch.graceSeconds !== undefined
        ? clampNumber(patch.graceSeconds, 1, 30, current.graceSeconds)
        : current.graceSeconds,
      cooldownSeconds: patch && patch.cooldownSeconds !== undefined
        ? clampNumber(patch.cooldownSeconds, 10, 600, current.cooldownSeconds)
        : current.cooldownSeconds,
      alertSound: patch && typeof patch.alertSound === 'boolean' ? patch.alertSound : current.alertSound,
      evidence: patch && typeof patch.evidence === 'boolean' ? patch.evidence : current.evidence,
      showBoxes: patch && typeof patch.showBoxes === 'boolean' ? patch.showBoxes : current.showBoxes
    };
    saved.companies[id] = next;
    persist();
    resetRuntime(id);
    return companyConfig(id);
  };

  F.setEnabled = function (companyId, enabled) {
    return F.update(companyId, { enabled: !!enabled });
  };

  F.hasSkill = function (companyId) {
    var id = resolveCompanyId(companyId);
    if (!AUTEC.store || !AUTEC.store.companies) return false;
    var company = AUTEC.store.companies.find(function (item) { return item.id === id; });
    return !!(company && company.skills && company.skills.indexOf('caidas') !== -1);
  };

  F.active = function (companyId) {
    return F.hasSkill(companyId) && companyConfig(companyId).enabled;
  };

  F.reset = function (companyId) {
    resetRuntime(resolveCompanyId(companyId));
  };

  function resetRuntime(companyId) {
    if (!companyId || runtime.companyId === companyId) {
      runtime.tracks = {};
      runtime.stats = null;
    }
  }

  function trackKey(det, index) {
    var id = det && det.trackId;
    if (id !== null && id !== undefined) return 'track-' + id;
    return 'fallback-' + index;
  }

  function ratioOf(det) {
    var x1 = Number(det && det.x1) || 0;
    var y1 = Number(det && det.y1) || 0;
    var x2 = Number(det && det.x2) || 0;
    var y2 = Number(det && det.y2) || 0;
    var width = Math.max(0, x2 - x1);
    var height = Math.max(1, y2 - y1);
    return Math.round((width / height) * 100) / 100;
  }

  function payloadOf(det) {
    if (!det || !det.fall || typeof det.fall !== 'object') return null;
    return {
      suspect: det.fall.suspect === true || det.fall.fallen === true,
      fallen: det.fall.fallen === true,
      seconds: Number(det.fall.seconds) || 0,
      ratio: Number(det.fall.ratio) || 0
    };
  }

  function emptyStats(config, simulated) {
    return {
      companyId: config.companyId,
      enabled: config.enabled,
      analyzed: 0,
      suspects: 0,
      fallen: 0,
      alerts: 0,
      threshold: config.ratioThreshold,
      graceSeconds: config.graceSeconds,
      cooldownSeconds: config.cooldownSeconds,
      sensitivity: config.sensitivity,
      simulated: !!simulated,
      source: simulated ? 'demo' : 'live',
      tracks: []
    };
  }

  F.evaluate = function (detections, now, opts) {
    opts = opts || {};
    var config = companyConfig(opts.companyId);
    var simulated = opts.simulate === true;
    var stats = emptyStats(config, simulated);
    var events = [];
    var timestamp = Number(now) || Date.now();
    var list = Array.isArray(detections) ? detections : [];
    var seen = {};

    if (!config.enabled) {
      stats.source = 'disabled';
      runtime.companyId = config.companyId;
      runtime.config = config;
      runtime.stats = stats;
      return { stats: stats, events: events, config: config };
    }

    if (!runtime.config || runtime.companyId !== config.companyId
      || runtime.config.sensitivity !== config.sensitivity) {
      runtime.companyId = config.companyId;
      runtime.tracks = {};
      runtime.config = config;
    }

    list.forEach(function (det, index) {
      if (!det) return;
      var key = trackKey(det, index);
      seen[key] = true;
      var payload = payloadOf(det);
      var ratio = payload && payload.ratio ? payload.ratio : ratioOf(det);
      var suspect = payload ? payload.suspect : ratio >= config.ratioThreshold;
      var track = runtime.tracks[key];
      if (!track) {
        track = {
          since: 0,
          lastSeen: timestamp,
          alertedAt: 0,
          alerted: false
        };
        runtime.tracks[key] = track;
      }
      track.lastSeen = timestamp;

      if (suspect) {
        if (!track.since) track.since = timestamp;
        var elapsed = (timestamp - track.since) / 1000;
        var seconds = payload && payload.seconds ? Math.max(payload.seconds, elapsed) : elapsed;
        seconds = Math.round(seconds * 10) / 10;
        var fallen = seconds >= config.graceSeconds;
        det._fall = {
          status: fallen ? 'fallen' : 'suspect',
          ratio: ratio,
          seconds: seconds,
          threshold: config.ratioThreshold,
          simulated: simulated
        };
        stats.suspects += 1;
        if (fallen) stats.fallen += 1;
        stats.tracks.push({
          trackId: det.trackId,
          ratio: ratio,
          seconds: seconds,
          status: fallen ? 'fallen' : 'suspect',
          simulated: simulated
        });

        var cooldownMs = config.cooldownSeconds * 1000;
        if (fallen && (!track.alerted || timestamp - track.alertedAt >= cooldownMs)) {
          var who = det.trackId !== null && det.trackId !== undefined
            ? ' · persona #' + det.trackId
            : '';
          events.push({
            type: 'fall',
            kind: 'fall',
            alert: true,
            text: (simulated ? 'SIMULACIÓN · ' : '') + 'Posible caída detectada' + who
              + ' · ' + seconds.toFixed(1) + ' s',
            trackId: det.trackId,
            seconds: seconds,
            ratio: ratio,
            simulated: simulated
          });
          track.alerted = true;
          track.alertedAt = timestamp;
          stats.alerts += 1;
        }
      } else {
        if (track.alerted) {
          var recoveryWho = det.trackId !== null && det.trackId !== undefined
            ? ' · persona #' + det.trackId
            : '';
          events.push({
            type: 'fall-ok',
            kind: 'fall',
            alert: false,
            text: (simulated ? 'SIMULACIÓN · ' : '') + 'Persona de pie nuevamente' + recoveryWho,
            trackId: det.trackId,
            simulated: simulated
          });
        }
        track.since = 0;
        track.alerted = false;
        track.alertedAt = 0;
        det._fall = {
          status: 'normal',
          ratio: ratio,
          seconds: 0,
          threshold: config.ratioThreshold,
          simulated: simulated
        };
        stats.tracks.push({
          trackId: det.trackId,
          ratio: ratio,
          seconds: 0,
          status: 'normal',
          simulated: simulated
        });
      }

      stats.analyzed += 1;
    });

    Object.keys(runtime.tracks).forEach(function (key) {
      if (!seen[key] && timestamp - runtime.tracks[key].lastSeen > TRACK_MEMORY_MS) {
        delete runtime.tracks[key];
      }
    });

    runtime.companyId = config.companyId;
    runtime.config = config;
    runtime.stats = stats;
    return { stats: stats, events: events, config: config };
  };

  F.stats = function () {
    return runtime.stats ? clone(runtime.stats) : null;
  };

  function demoDetections() {
    var monitoring = AUTEC.store && AUTEC.store.monitoring;
    var people = monitoring && Array.isArray(monitoring.people) ? monitoring.people : [];
    return people.map(function (person) {
      var box = person.box || { x: 0, y: 0, w: 10, h: 40 };
      return {
        trackId: person.id,
        confidence: person.confidence,
        x1: box.x / 100 * 1280,
        y1: box.y / 100 * 720,
        x2: (box.x + box.w) / 100 * 1280,
        y2: (box.y + box.h) / 100 * 720
      };
    });
  }

  F.previewStats = function (companyId) {
    var config = companyConfig(companyId);
    var stats = emptyStats(config, true);
    stats.source = 'demo';
    stats.simulated = true;
    demoDetections().forEach(function (det) {
      var ratio = ratioOf(det);
      var suspect = false;
      // Una persona del demo queda en riesgo para mostrar el estado sin
      // disparar una alerta: la interfaz indica que es simulación.
      if (det.trackId === 3) {
        ratio = Math.round((config.ratioThreshold + 0.05) * 100) / 100;
        suspect = true;
      }
      stats.analyzed += 1;
      if (suspect) stats.suspects += 1;
      stats.tracks.push({
        trackId: det.trackId,
        ratio: ratio,
        seconds: suspect ? Math.max(1, config.graceSeconds - 1) : 0,
        status: suspect ? 'suspect' : 'normal',
        simulated: true
      });
    });
    return stats;
  };

  F.statsForView = function (companyId) {
    var id = resolveCompanyId(companyId);
    var connected = !!(AUTEC.monitor && AUTEC.monitor.isConnected && AUTEC.monitor.isConnected());
    if (connected && runtime.stats && runtime.stats.companyId === id) {
      return clone(runtime.stats);
    }
    return F.previewStats(id);
  };

  F.modelState = function () {
    return {
      available: true,
      heuristic: true,
      label: 'Heurística local de caja',
      reason: ''
    };
  };

  F.statusLabel = function (payload) {
    if (!payload) return 'Sin datos';
    if (payload.status === 'fallen') return 'Posible caída';
    if (payload.status === 'suspect') return 'En riesgo';
    return 'Normal';
  };

  F.badgesHtml = function (payload, simulated) {
    if (!payload || payload.status === 'normal') return '';
    var label = payload.status === 'fallen' ? 'CAÍDA' : 'RIESGO';
    var tone = payload.status === 'fallen' ? 'danger' : 'warning';
    return '<span class="fall-badge fall-badge--' + tone + (simulated ? ' is-sim' : '') + '">' + label + '</span>';
  };

  F.isFallen = function (payload) {
    return !!(payload && payload.status === 'fallen');
  };

  F.ratioLabel = function (value) {
    var number = Number(value) || 0;
    return number.toFixed(2);
  };
})();
