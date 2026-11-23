(function () {
  window.AUTEC = window.AUTEC || {};
  var E = AUTEC.epp = {};

  var STORAGE_KEY = 'autecVision.epp.v1';
  var TRACK_MEMORY_MS = 30000;
  var DEMO_WIDTH = 1280;
  var DEMO_HEIGHT = 720;

  var PROFILES = {
    industrial: {
      id: 'industrial',
      name: 'Planta industrial',
      short: 'Industrial',
      description: 'Casco y chaleco obligatorios en toda la planta.',
      required: { helmet: true, vest: true }
    },
    'industrial-cliente': {
      id: 'industrial-cliente',
      name: 'Sitio industrial del cliente',
      short: 'Sitio industrial',
      description: 'Guardias en planta de un cliente: casco y chaleco.',
      required: { helmet: true, vest: true }
    },
    corporativo: {
      id: 'corporativo',
      name: 'Sede corporativa',
      short: 'Sede corporativa',
      description: 'Guardias en sede administrativa: solo chaleco.',
      required: { helmet: false, vest: true }
    }
  };

  var DEFAULTS = {
    enabled: true,
    graceSeconds: 5,
    cooldownSeconds: 60,
    alertSound: true,
    evidence: true,
    showBoxes: true
  };

  var COMPANY_PROFILES = {
    'planta-sur': 'industrial',
    cim: 'industrial-cliente'
  };

  var runtime = {
    companyId: null,
    config: null,
    stats: null,
    tracks: {},
    lastAlertAt: {}
  };

  function storeCompany() {
    if (AUTEC.app && AUTEC.app.state && AUTEC.app.state.auth && AUTEC.app.currentCompany) {
      return AUTEC.app.currentCompany();
    }
    return null;
  }

  function resolveCompanyId(companyId) {
    if (companyId) return String(companyId);
    var company = storeCompany();
    return company ? company.id : 'default';
  }

  function defaultProfile(companyId) {
    var id = resolveCompanyId(companyId);
    if (COMPANY_PROFILES[id]) return COMPANY_PROFILES[id];
    var company = AUTEC.store && AUTEC.store.companies
      ? AUTEC.store.companies.find(function (item) { return item.id === id; })
      : null;
    if (company && company.sector === 'Seguridad privada') return 'industrial-cliente';
    return 'industrial';
  }

  function profileOf(id) {
    return PROFILES[id] || PROFILES.industrial;
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

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (_) {}
  }

  var saved = read();

  function sanitizeProfile(value, companyId) {
    return PROFILES[value] ? value : defaultProfile(companyId);
  }

  function clampNumber(value, minimum, maximum, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
  }

  function normalizeRequired(value, profile) {
    var fallback = profile.required;
    if (!value || typeof value !== 'object') {
      return { helmet: !!fallback.helmet, vest: !!fallback.vest };
    }
    var required = {
      helmet: value.helmet === true,
      vest: value.vest === true
    };
    if (!required.helmet && !required.vest) {
      return { helmet: !!fallback.helmet, vest: !!fallback.vest };
    }
    return required;
  }

  function companyConfig(companyId) {
    var id = resolveCompanyId(companyId);
    var base = saved.companies[id] || {};
    var profileId = sanitizeProfile(base.profile, id);
    var profile = profileOf(profileId);
    var required = normalizeRequired(base.required, profile);
    return {
      companyId: id,
      enabled: base.enabled !== false,
      profile: profileId,
      profileName: profile.name,
      profileShort: profile.short,
      profileDescription: profile.description,
      required: required,
      requiredLabel: [
        required.helmet ? 'casco' : '',
        required.vest ? 'chaleco' : ''
      ].filter(Boolean).join(' + '),
      graceSeconds: clampNumber(base.graceSeconds, 1, 60, DEFAULTS.graceSeconds),
      cooldownSeconds: clampNumber(base.cooldownSeconds, 10, 600, DEFAULTS.cooldownSeconds),
      alertSound: base.alertSound !== false,
      evidence: base.evidence !== false,
      showBoxes: base.showBoxes !== false
    };
  }

  E.profiles = function () {
    return Object.keys(PROFILES).map(function (id) {
      return {
        id: id,
        name: PROFILES[id].name,
        short: PROFILES[id].short,
        description: PROFILES[id].description,
        required: {
          helmet: !!PROFILES[id].required.helmet,
          vest: !!PROFILES[id].required.vest
        }
      };
    });
  };

  E.profile = function (id) {
    return profileOf(id);
  };

  E.config = function (companyId) {
    return companyConfig(companyId);
  };

  E.update = function (companyId, patch) {
    var id = resolveCompanyId(companyId);
    var current = companyConfig(id);
    var next = {
      enabled: patch && typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
      profile: patch && patch.profile ? sanitizeProfile(patch.profile, id) : current.profile,
      graceSeconds: patch && patch.graceSeconds !== undefined
        ? clampNumber(patch.graceSeconds, 1, 60, current.graceSeconds)
        : current.graceSeconds,
      cooldownSeconds: patch && patch.cooldownSeconds !== undefined
        ? clampNumber(patch.cooldownSeconds, 10, 600, current.cooldownSeconds)
        : current.cooldownSeconds,
      alertSound: patch && typeof patch.alertSound === 'boolean' ? patch.alertSound : current.alertSound,
      evidence: patch && typeof patch.evidence === 'boolean' ? patch.evidence : current.evidence,
      showBoxes: patch && typeof patch.showBoxes === 'boolean' ? patch.showBoxes : current.showBoxes
    };

    if (patch && patch.resetRequired === true) {
      next.required = null;
    } else if (patch && patch.required) {
      next.required = normalizeRequired(patch.required, profileOf(next.profile));
    } else {
      next.required = saved.companies[id] && saved.companies[id].required
        ? normalizeRequired(saved.companies[id].required, profileOf(next.profile))
        : null;
    }

    if (!next.required) {
      next.required = {
        helmet: !!profileOf(next.profile).required.helmet,
        vest: !!profileOf(next.profile).required.vest
      };
    }

    if (next.profile !== current.profile
      && !(patch && patch.required)
      && !(patch && patch.resetRequired === true)) {
      next.required = {
        helmet: !!profileOf(next.profile).required.helmet,
        vest: !!profileOf(next.profile).required.vest
      };
    }

    saved.companies[id] = next;
    persist();
    resetRuntime(id);
    return companyConfig(id);
  };

  E.setEnabled = function (companyId, enabled) {
    return E.update(companyId, { enabled: !!enabled });
  };

  E.setProfile = function (companyId, profileId) {
    return E.update(companyId, { profile: profileId, resetRequired: true });
  };

  E.reset = function (companyId) {
    var id = resolveCompanyId(companyId);
    delete saved.companies[id];
    persist();
    resetRuntime(id);
    return companyConfig(id);
  };

  function resetRuntime(companyId) {
    if (!companyId || runtime.companyId === companyId) {
      runtime.tracks = {};
      runtime.lastAlertAt = {};
      runtime.stats = null;
    }
  }

  E.hasSkill = function (companyId) {
    var id = resolveCompanyId(companyId);
    if (!AUTEC.store || !AUTEC.store.companies) return false;
    var company = AUTEC.store.companies.find(function (item) { return item.id === id; });
    return !!(company && company.skills && company.skills.indexOf('epp') !== -1);
  };

  E.active = function (companyId) {
    return E.hasSkill(companyId) && companyConfig(companyId).enabled;
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

  function trackKey(det, index) {
    var id = det && det.trackId;
    if (id !== null && id !== undefined) return 'track-' + id;
    return 'fallback-' + index;
  }

  function buildSimulatedBoxes(det, helmet, vest) {
    var x1 = Number(det.x1) || 0;
    var y1 = Number(det.y1) || 0;
    var x2 = Number(det.x2) || 0;
    var y2 = Number(det.y2) || 0;
    var width = Math.max(1, x2 - x1);
    var height = Math.max(1, y2 - y1);
    var boxes = {};
    if (helmet !== null) {
      boxes.helmet = {
        x1: Math.round((x1 + width * 0.34) * 10) / 10,
        y1: Math.round((y1 + height * 0.02) * 10) / 10,
        x2: Math.round((x1 + width * 0.66) * 10) / 10,
        y2: Math.round((y1 + height * 0.19) * 10) / 10,
        confidence: 0.86,
        simulated: true
      };
    }
    if (vest !== null) {
      boxes.vest = {
        x1: Math.round((x1 + width * 0.18) * 10) / 10,
        y1: Math.round((y1 + height * 0.28) * 10) / 10,
        x2: Math.round((x1 + width * 0.82) * 10) / 10,
        y2: Math.round((y1 + height * 0.68) * 10) / 10,
        confidence: 0.83,
        simulated: true
      };
    }
    return boxes;
  }

  E.simulateForTrack = function (trackId, profileId, det) {
    var profile = profileOf(profileId);
    var numeric = Number(trackId);
    var seed = isFinite(numeric) && String(trackId).trim() !== ''
      ? numeric
      : hashString(trackId);
    var bucket = Math.abs(Math.round(seed) * 37 + 11) % 10;
    var missingHelmet = bucket === 4 || bucket === 7 || bucket === 9;
    var missingVest = bucket === 2 || bucket === 6 || bucket === 9;
    // La simulación usa los dos elementos aunque el perfil no exija casco.
    // La regla de la empresa decide qué falta de verdad.
    var helmet = !missingHelmet;
    var vest = !missingVest;
    var missing = [];
    if (!helmet) missing.push('helmet');
    if (!vest) missing.push('vest');
    var payload = {
      helmet: helmet,
      vest: vest,
      helmetConfidence: helmet ? 0.9 : 0.12,
      vestConfidence: vest ? 0.88 : 0.1,
      missing: missing,
      status: missing.length ? 'missing' : 'ok',
      simulation: true,
      simulated: true,
      boxes: det ? buildSimulatedBoxes(det, profile.required.helmet ? helmet : null, profile.required.vest ? vest : null) : undefined
    };
    return payload;
  };

  function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return {
      helmet: payload.helmet === true ? true : payload.helmet === false ? false : null,
      vest: payload.vest === true ? true : payload.vest === false ? false : null,
      helmetConfidence: Number(payload.helmetConfidence) || 0,
      vestConfidence: Number(payload.vestConfidence) || 0,
      boxes: payload.boxes && typeof payload.boxes === 'object' ? payload.boxes : null,
      simulation: payload.simulation === true || payload.simulated === true
    };
  }

  function evaluatePayload(payload, required) {
    var missing = [];
    var unknown = [];
    if (required.helmet) {
      if (payload.helmet === false) missing.push('helmet');
      else if (payload.helmet !== true) unknown.push('helmet');
    }
    if (required.vest) {
      if (payload.vest === false) missing.push('vest');
      else if (payload.vest !== true) unknown.push('vest');
    }
    if (missing.length) return { status: 'missing', missing: missing, unknown: unknown };
    if (unknown.length) return { status: 'unknown', missing: [], unknown: unknown };
    return { status: 'ok', missing: [], unknown: [] };
  }

  function missingLabel(missing) {
    if (!missing.length) return 'EPP completo';
    if (missing.length === 2) return 'Falta casco y chaleco';
    return missing[0] === 'helmet' ? 'Falta casco' : 'Falta chaleco';
  }

  function modelState() {
    var monitor = AUTEC.monitor;
    var state = monitor && monitor.state ? monitor.state() : null;
    var summary = state && state.epp ? state.epp : null;
    if (summary && summary.available === true) {
      return {
        available: true,
        enabled: summary.enabled !== false,
        label: summary.model || 'Modelo EPP',
        reason: '',
        simulated: false
      };
    }
    return {
      available: false,
      enabled: summary ? summary.enabled === true : false,
      label: summary && summary.model ? summary.model : '',
      reason: summary && summary.reason ? summary.reason : 'model-missing',
      simulated: true
    };
  }

  E.modelState = modelState;

  function baseStats(config, simulated, model) {
    return {
      companyId: config.companyId,
      enabled: config.enabled,
      profile: config.profile,
      profileName: config.profileName,
      profileShort: config.profileShort,
      required: config.required,
      requiredLabel: config.requiredLabel,
      persons: 0,
      compliant: 0,
      nonCompliant: 0,
      unknown: 0,
      withHelmet: 0,
      withVest: 0,
      withoutHelmet: 0,
      withoutVest: 0,
      compliance: null,
      alerts: 0,
      simulated: !!simulated,
      modelAvailable: !!(model && model.available),
      modelLabel: model && model.label ? model.label : '',
      modelReason: model && model.reason ? model.reason : '',
      source: simulated ? 'simulation' : 'live'
    };
  }

  function accumulate(stats, payload, status) {
    stats.persons += 1;
    if (payload.helmet === true) stats.withHelmet += 1;
    else if (payload.helmet === false) stats.withoutHelmet += 1;
    if (payload.vest === true) stats.withVest += 1;
    else if (payload.vest === false) stats.withoutVest += 1;
    if (status === 'ok') stats.compliant += 1;
    else if (status === 'missing') stats.nonCompliant += 1;
    else stats.unknown += 1;
  }

  function finalize(stats) {
    var evaluable = stats.compliant + stats.nonCompliant;
    stats.compliance = evaluable ? Math.round(stats.compliant / evaluable * 1000) / 10 : null;
    return stats;
  }

  E.evaluate = function (detections, now, opts) {
    opts = opts || {};
    var config = companyConfig(opts.companyId);
    var model = modelState();
    var simulated = model.available !== true || opts.simulate === true;
    var stats = baseStats(config, simulated, model);
    var events = [];
    var timestamp = Number(now) || Date.now();
    var list = Array.isArray(detections) ? detections : [];
    var seen = {};

    if (!config.enabled) {
      stats.source = 'disabled';
      runtime.companyId = config.companyId;
      runtime.stats = stats;
      return { stats: stats, events: events, config: config };
    }

    if (!runtime.config || runtime.companyId !== config.companyId
      || runtime.config.profile !== config.profile
      || runtime.lastRequired !== config.requiredLabel) {
      runtime.companyId = config.companyId;
      runtime.tracks = {};
      runtime.lastAlertAt = {};
      runtime.config = config;
      runtime.lastRequired = config.requiredLabel;
    }

    list.forEach(function (det, index) {
      var key = trackKey(det, index);
      seen[key] = true;
      var raw = null;
      if (det && det.epp && typeof det.epp === 'object') {
        raw = det.epp;
      } else if (simulated) {
        raw = E.simulateForTrack(det && det.trackId, config.profile, det);
      }
      if (!raw) {
        stats.unknown += 1;
        stats.persons += 1;
        det._epp = null;
        det._eppStatus = 'unknown';
        det._eppMissing = [];
        det._eppSimulated = false;
        return;
      }

      var payload = normalizePayload(raw);
      var result = evaluatePayload(payload, config.required);
      var isSimulated = payload.simulation || simulated;
      payload.simulation = isSimulated;

      det._epp = payload;
      det._eppStatus = result.status;
      det._eppMissing = result.missing;
      det._eppUnknown = result.unknown;
      det._eppSimulated = isSimulated;
      det._eppProfile = config.profile;
      det._eppRequired = config.required;

      accumulate(stats, payload, result.status);

      var track = runtime.tracks[key];
      if (!track) {
        track = {
          missingSince: 0,
          lastMissing: '',
          alertedAt: 0,
          alerted: false,
          lastSeen: timestamp,
          label: ''
        };
        runtime.tracks[key] = track;
      }
      track.lastSeen = timestamp;

      if (result.status === 'missing') {
        var signature = result.missing.slice().sort().join(',');
        if (track.lastMissing !== signature || !track.missingSince) {
          track.missingSince = timestamp;
          track.lastMissing = signature;
        }
        var lastAlert = runtime.lastAlertAt[key] || track.alertedAt || 0;
        var graceMs = config.graceSeconds * 1000;
        var cooldownMs = config.cooldownSeconds * 1000;
        if (timestamp - track.missingSince >= graceMs
          && timestamp - lastAlert >= cooldownMs) {
          var label = missingLabel(result.missing);
          var who = det && det.trackId !== null && det.trackId !== undefined
            ? ' · persona #' + det.trackId
            : '';
          var text = (isSimulated ? 'SIMULACIÓN · ' : '') + label + who;
          events.push({
            type: 'epp',
            kind: 'epp',
            alert: true,
            text: text,
            trackId: det ? det.trackId : null,
            missing: result.missing.slice(),
            profile: config.profile,
            simulated: isSimulated
          });
          runtime.lastAlertAt[key] = timestamp;
          track.alertedAt = timestamp;
          track.alerted = true;
          track.label = label;
          stats.alerts += 1;
        }
      } else if (result.status === 'ok') {
        if (track.alerted) {
          var recoveryWho = det && det.trackId !== null && det.trackId !== undefined
            ? ' · persona #' + det.trackId
            : '';
          events.push({
            type: 'epp-ok',
            kind: 'epp',
            alert: false,
            text: (isSimulated ? 'SIMULACIÓN · ' : '') + 'EPP completo recuperado' + recoveryWho,
            trackId: det ? det.trackId : null,
            profile: config.profile,
            simulated: isSimulated
          });
        }
        track.missingSince = 0;
        track.lastMissing = '';
        track.alerted = false;
      } else {
        track.missingSince = 0;
        track.lastMissing = '';
      }
    });

    Object.keys(runtime.tracks).forEach(function (key) {
      if (!seen[key] && timestamp - runtime.tracks[key].lastSeen > TRACK_MEMORY_MS) {
        delete runtime.tracks[key];
        delete runtime.lastAlertAt[key];
      }
    });

    finalize(stats);
    runtime.companyId = config.companyId;
    runtime.config = config;
    runtime.stats = stats;
    return { stats: stats, events: events, config: config };
  };

  E.stats = function () {
    return runtime.stats ? JSON.parse(JSON.stringify(runtime.stats)) : null;
  };

  function demoDetections() {
    var monitoring = AUTEC.store && AUTEC.store.monitoring;
    var people = monitoring && Array.isArray(monitoring.people) ? monitoring.people : [];
    return people.map(function (person) {
      var box = person.box || { x: 0, y: 0, w: 10, h: 40 };
      return {
        trackId: person.id,
        confidence: person.confidence,
        x1: box.x / 100 * DEMO_WIDTH,
        y1: box.y / 100 * DEMO_HEIGHT,
        x2: (box.x + box.w) / 100 * DEMO_WIDTH,
        y2: (box.y + box.h) / 100 * DEMO_HEIGHT
      };
    });
  }

  E.previewStats = function (companyId) {
    var config = companyConfig(companyId);
    var model = modelState();
    var simulated = model.available !== true;
    var stats = baseStats(config, simulated, model);
    stats.source = 'demo';
    demoDetections().forEach(function (det) {
      var payload = normalizePayload(E.simulateForTrack(det.trackId, config.profile, det));
      payload.simulation = true;
      var result = evaluatePayload(payload, config.required);
      accumulate(stats, payload, result.status);
    });
    finalize(stats);
    return stats;
  };

  E.statsForView = function (companyId) {
    var connected = !!(AUTEC.monitor && AUTEC.monitor.isConnected && AUTEC.monitor.isConnected());
    var current = runtime.stats;
    if (connected && current && current.companyId === resolveCompanyId(companyId)) {
      return JSON.parse(JSON.stringify(current));
    }
    return E.previewStats(companyId);
  };

  E.attachDemoBadges = function () {
    if (!AUTEC.store || !AUTEC.store.monitoring) return;
    var boxes = document.querySelectorAll('.det-box--demo[data-person]');
    var companyId = resolveCompanyId();
    if (!E.active(companyId)) return;
    var config = companyConfig(companyId);
    Array.prototype.forEach.call(boxes, function (box) {
      if (box.querySelector('.epp-demo-badges')) return;
      var id = box.getAttribute('data-person');
      var payload = E.simulateForTrack(id, config.profile, {
        x1: 0, y1: 0, x2: 100, y2: 100
      });
      var wrap = document.createElement('span');
      wrap.className = 'epp-demo-badges';
      wrap.innerHTML = E.badgesHtml(payload, config, true, false);
      box.appendChild(wrap);
      if (E.isMissing(payload, config)) box.classList.add('is-epp-missing');
    });
  };

  E.isMissing = function (payload, config) {
    if (!payload) return false;
    if (config.required.helmet && payload.helmet === false) return true;
    if (config.required.vest && payload.vest === false) return true;
    return false;
  };

  E.isComplete = function (payload, config) {
    if (!payload) return false;
    if (config.required.helmet && payload.helmet !== true) return false;
    if (config.required.vest && payload.vest !== true) return false;
    return true;
  };

  function badge(label, tone, extra) {
    return '<span class="epp-badge epp-badge--' + tone + (extra ? ' ' + extra : '') + '">' + label + '</span>';
  }

  E.badgesHtml = function (payload, config, simulated, compact) {
    if (!payload) return '';
    var html = '';
    function item(key, label) {
      var value = payload[key];
      if (value === true) {
        html += badge(label, key === 'helmet' ? 'helmet' : 'vest', simulated ? 'is-sim' : '');
      } else if (value === false) {
        var required = config.required[key];
        html += badge(required ? 'SIN ' + label : label + ' N/R', required ? 'danger' : 'muted', simulated ? 'is-sim' : '');
      } else if (config.required[key]) {
        html += badge(label + ' ?', 'neutral', simulated ? 'is-sim' : '');
      }
    }
    item('helmet', 'CASCO');
    item('vest', 'CHALECO');
    if (simulated && !compact) html += '<span class="epp-sim-mark">SIM</span>';
    return html;
  };

  E.requiredText = function (required) {
    var parts = [];
    if (required.helmet) parts.push('casco');
    if (required.vest) parts.push('chaleco');
    return parts.join(' + ');
  };

  E.statusLabel = function (payload, config) {
    if (!payload) return 'Sin datos';
    if (E.isMissing(payload, config)) {
      var missing = [];
      if (config.required.helmet && payload.helmet === false) missing.push('casco');
      if (config.required.vest && payload.vest === false) missing.push('chaleco');
      return 'Falta ' + missing.join(' y ');
    }
    if (E.isComplete(payload, config)) return 'EPP completo';
    return 'Estado desconocido';
  };

  E.isDemoMode = function () {
    return modelState().available !== true;
  };
})();
