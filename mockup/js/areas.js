(function () {
  window.AUTEC = window.AUTEC || {};
  var A = AUTEC.areas = {};

  var STORAGE_KEY = 'autecVision.areas.v1';
  var MIN_SIZE = 0.025;
  var TRACK_MEMORY_MS = 30000;

  var SKILL_ORDER = ['barra', 'puestos-libres', 'aforo-salas', 'aforo-aulas', 'aglomeraciones'];

  var SKILLS = {
    barra: {
      id: 'barra',
      name: 'Ocupación de barra',
      short: 'Barra',
      icon: 'users',
      mode: 'wait',
      eventType: 'barra',
      areaLabel: 'Barra',
      areaPlural: 'barras',
      areaCapacity: 8,
      waitSeconds: 300,
      graceSeconds: 0,
      cooldownSeconds: 180,
      description: 'Mide cuánta gente espera en barra y cuánto tarda en ser atendida.',
      note: 'La barra se ocupa cuando el centro inferior de una persona cae dentro del rectángulo. La espera se estima desde que llega la primera persona hasta que el grupo se libera.',
      hint: 'La barra alerta cuando la espera supera el objetivo configurado o cuando se supera la capacidad del área. La estimación es geométrica y local: no identifica clientes ni personal.'
    },
    'puestos-libres': {
      id: 'puestos-libres',
      name: 'Puestos libres',
      short: 'Puestos',
      icon: 'monitor',
      mode: 'desks',
      eventType: 'puesto',
      areaLabel: 'Puesto',
      areaPlural: 'puestos',
      areaCapacity: 1,
      waitSeconds: 0,
      graceSeconds: 5,
      cooldownSeconds: 300,
      description: 'Mide ocupación real de escritorios y salas de trabajo.',
      note: 'Cada rectángulo representa un puesto o un grupo de puestos. Se cuentan personas por área y se descuentan de la capacidad total para estimar puestos libres.',
      hint: 'Un puesto se marca ocupado cuando una persona se ubica dentro del rectángulo. Si el grupo supera la capacidad configurada durante la gracia, aparece una alerta y se guarda una captura.'
    },
    'aforo-salas': {
      id: 'aforo-salas',
      name: 'Aforo de salas',
      short: 'Salas',
      icon: 'users',
      mode: 'capacity',
      eventType: 'sala',
      areaLabel: 'Sala',
      areaPlural: 'salas',
      areaCapacity: 10,
      waitSeconds: 0,
      graceSeconds: 3,
      cooldownSeconds: 180,
      description: 'Cuenta personas por sala y avisa cuando se supera la capacidad.',
      note: 'La capacidad se configura por sala. El conteo usa el centro inferior de cada caja de persona y se mantiene aunque la persona se mueva dentro del rectángulo.',
      hint: 'La sala alerta cuando el conteo supera la capacidad durante la gracia configurada. No identifica personas: solo mide ocupación y aforo.'
    },
    'aforo-aulas': {
      id: 'aforo-aulas',
      name: 'Aforo de aulas',
      short: 'Aulas',
      icon: 'book-open',
      mode: 'capacity',
      eventType: 'aula',
      areaLabel: 'Aula',
      areaPlural: 'aulas',
      areaCapacity: 30,
      waitSeconds: 0,
      graceSeconds: 3,
      cooldownSeconds: 180,
      description: 'Controla ocupación por aula y presencia de alumnos en horario.',
      note: 'Cada aula tiene su propia capacidad. La ocupación se estima con las cajas de personas y se compara contra el aforo configurado.',
      hint: 'El aula alerta cuando el conteo supera el aforo durante la gracia configurada. Pensado para control de capacidad, no para asistencia nominal ni identificación de alumnos.'
    },
    aglomeraciones: {
      id: 'aglomeraciones',
      name: 'Aglomeraciones',
      short: 'Aglomeración',
      icon: 'users',
      mode: 'crowd',
      eventType: 'aglomeracion',
      areaLabel: 'Punto',
      areaPlural: 'puntos',
      areaCapacity: 8,
      waitSeconds: 0,
      graceSeconds: 3,
      cooldownSeconds: 120,
      description: 'Avisa cuando se concentra demasiada gente en un punto o una salida.',
      note: 'El umbral es la cantidad de personas que se considera aglomeración en ese punto. Se evalúa el centro inferior de cada persona dentro del rectángulo.',
      hint: 'La aglomeración alerta cuando el conteo alcanza o supera el umbral durante la gracia configurada. Sirve como aviso operativo, no como medición de distancia interpersonal.'
    }
  };

  var COLORS = {
    barra: ['#f5a524', '#fb7185', '#facc15', '#f97316', '#fbbf24', '#f472b6'],
    'puestos-libres': ['#22d3ee', '#60a5fa', '#34d399', '#a78bfa', '#2dd4bf', '#38bdf8'],
    'aforo-salas': ['#a78bfa', '#34d399', '#60a5fa', '#f5a524', '#2dd4bf', '#fb7185'],
    'aforo-aulas': ['#34d399', '#22d3ee', '#a78bfa', '#facc15', '#60a5fa', '#f5a524'],
    aglomeraciones: ['#fb7185', '#f97316', '#f5a524', '#ef4444', '#facc15', '#f472b6']
  };

  var LAYOUTS = {
    barra: {
      'hotel-alba': [
        { id: 'barra-principal', name: 'Barra principal', capacity: 8, x: 0.06, y: 0.60, w: 0.40, h: 0.16 },
        { id: 'barra-terraza', name: 'Barra terraza', capacity: 5, x: 0.55, y: 0.78, w: 0.36, h: 0.13 }
      ],
      default: [
        { id: 'barra-1', name: 'Barra 1', capacity: 8, x: 0.06, y: 0.62, w: 0.42, h: 0.16 },
        { id: 'barra-2', name: 'Barra 2', capacity: 6, x: 0.55, y: 0.62, w: 0.38, h: 0.16 }
      ]
    },
    'puestos-libres': {
      'planta-sur': [
        { id: 'puesto-1', name: 'Puesto 1', capacity: 1, x: 0.06, y: 0.50, w: 0.10, h: 0.14 },
        { id: 'puesto-2', name: 'Puesto 2', capacity: 1, x: 0.19, y: 0.50, w: 0.10, h: 0.14 },
        { id: 'puesto-3', name: 'Puesto 3', capacity: 1, x: 0.32, y: 0.50, w: 0.10, h: 0.14 },
        { id: 'puesto-4', name: 'Puesto 4', capacity: 1, x: 0.45, y: 0.50, w: 0.10, h: 0.14 },
        { id: 'puesto-5', name: 'Puesto 5', capacity: 1, x: 0.58, y: 0.50, w: 0.10, h: 0.14 },
        { id: 'puesto-6', name: 'Puesto 6', capacity: 1, x: 0.71, y: 0.50, w: 0.10, h: 0.14 }
      ],
      default: [
        { id: 'puesto-1', name: 'Puesto 1', capacity: 1, x: 0.08, y: 0.52, w: 0.11, h: 0.15 },
        { id: 'puesto-2', name: 'Puesto 2', capacity: 1, x: 0.22, y: 0.52, w: 0.11, h: 0.15 },
        { id: 'puesto-3', name: 'Puesto 3', capacity: 1, x: 0.36, y: 0.52, w: 0.11, h: 0.15 },
        { id: 'puesto-4', name: 'Puesto 4', capacity: 1, x: 0.50, y: 0.52, w: 0.11, h: 0.15 },
        { id: 'puesto-5', name: 'Puesto 5', capacity: 1, x: 0.64, y: 0.52, w: 0.11, h: 0.15 },
        { id: 'puesto-6', name: 'Puesto 6', capacity: 1, x: 0.78, y: 0.52, w: 0.11, h: 0.15 }
      ]
    },
    'aforo-salas': {
      'hotel-alba': [
        { id: 'salon-alba', name: 'Salón Alba', capacity: 30, x: 0.06, y: 0.08, w: 0.40, h: 0.30 },
        { id: 'sala-reuniones', name: 'Sala de reuniones', capacity: 8, x: 0.55, y: 0.08, w: 0.22, h: 0.20 }
      ],
      'clinica-valle': [
        { id: 'sala-espera', name: 'Sala de espera', capacity: 12, x: 0.08, y: 0.44, w: 0.36, h: 0.28 },
        { id: 'consultorio-1', name: 'Consultorio 1', capacity: 3, x: 0.52, y: 0.44, w: 0.17, h: 0.20 },
        { id: 'consultorio-2', name: 'Consultorio 2', capacity: 3, x: 0.74, y: 0.44, w: 0.17, h: 0.20 }
      ],
      default: [
        { id: 'sala-1', name: 'Sala 1', capacity: 10, x: 0.08, y: 0.42, w: 0.24, h: 0.26 },
        { id: 'sala-2', name: 'Sala 2', capacity: 8, x: 0.38, y: 0.42, w: 0.24, h: 0.26 },
        { id: 'sala-3', name: 'Sala 3', capacity: 6, x: 0.68, y: 0.42, w: 0.24, h: 0.26 }
      ]
    },
    'aforo-aulas': {
      'constructora-andes': [
        { id: 'aula-1', name: 'Aula 1', capacity: 30, x: 0.06, y: 0.42, w: 0.26, h: 0.28 },
        { id: 'aula-2', name: 'Aula 2', capacity: 24, x: 0.37, y: 0.42, w: 0.26, h: 0.28 },
        { id: 'taller', name: 'Taller', capacity: 16, x: 0.68, y: 0.42, w: 0.26, h: 0.28 }
      ],
      default: [
        { id: 'aula-1', name: 'Aula 1', capacity: 30, x: 0.07, y: 0.40, w: 0.25, h: 0.30 },
        { id: 'aula-2', name: 'Aula 2', capacity: 30, x: 0.37, y: 0.40, w: 0.25, h: 0.30 },
        { id: 'aula-3', name: 'Aula 3', capacity: 24, x: 0.67, y: 0.40, w: 0.25, h: 0.30 }
      ]
    },
    aglomeraciones: {
      cim: [
        { id: 'acceso-principal', name: 'Acceso principal', capacity: 8, x: 0.06, y: 0.38, w: 0.25, h: 0.34 },
        { id: 'hall', name: 'Hall', capacity: 12, x: 0.37, y: 0.38, w: 0.26, h: 0.34 },
        { id: 'salida-emergencia', name: 'Salida de emergencia', capacity: 6, x: 0.69, y: 0.38, w: 0.24, h: 0.34 }
      ],
      'retail-centro': [
        { id: 'pasillo-central', name: 'Pasillo central', capacity: 10, x: 0.08, y: 0.36, w: 0.36, h: 0.30 },
        { id: 'salida', name: 'Salida', capacity: 6, x: 0.58, y: 0.36, w: 0.25, h: 0.30 }
      ],
      default: [
        { id: 'punto-1', name: 'Punto 1', capacity: 8, x: 0.08, y: 0.40, w: 0.26, h: 0.30 },
        { id: 'punto-2', name: 'Punto 2', capacity: 8, x: 0.40, y: 0.40, w: 0.26, h: 0.30 }
      ]
    }
  };

  var saved = read();
  var runtime = {};
  var editor = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function clampNumber(value, minimum, maximum, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.round(clamp(number, minimum, maximum));
  }

  function uid(skillId) {
    return skillId + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
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

  function read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { skills: {} };
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.skills || typeof parsed.skills !== 'object') {
        return { skills: {} };
      }
      return { skills: parsed.skills };
    } catch (_) {
      return { skills: {} };
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (_) {}
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

  function definition(skillId) {
    return SKILLS[String(skillId || '')] || null;
  }

  function normalizeArea(raw, index, def, skillId) {
    if (!raw || typeof raw !== 'object') return null;
    var x = clamp(Number(raw.x) || 0, 0, 1);
    var y = clamp(Number(raw.y) || 0, 0, 1);
    var w = clamp(Number(raw.w) || 0, 0, 1 - x);
    var h = clamp(Number(raw.h) || 0, 0, 1 - y);
    if (w < MIN_SIZE || h < MIN_SIZE) return null;
    var palette = COLORS[skillId] || COLORS['aforo-salas'];
    var color = String(raw.color || '');
    return {
      id: String(raw.id || uid(skillId)),
      name: String(raw.name || (def.areaLabel + ' ' + (index + 1))).slice(0, 40),
      capacity: clampNumber(raw.capacity, 1, 200, def.areaCapacity),
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : palette[index % palette.length],
      x: Math.round(x * 10000) / 10000,
      y: Math.round(y * 10000) / 10000,
      w: Math.round(w * 10000) / 10000,
      h: Math.round(h * 10000) / 10000
    };
  }

  function layoutFor(skillId, companyId) {
    var group = LAYOUTS[skillId] || {};
    return group[companyId] || group.default || [];
  }

  function normalize(raw, skillId, def, companyId) {
    var baseAreas = layoutFor(skillId, companyId);
    var areasRaw = raw && Array.isArray(raw.areas)
      ? raw.areas
      : baseAreas;
    var areas = areasRaw.map(function (area, index) {
      return normalizeArea(area, index, def, skillId);
    }).filter(Boolean);
    return {
      enabled: !raw || raw.enabled !== false,
      waitSeconds: clampNumber(raw && raw.waitSeconds, 30, 3600, def.waitSeconds || 300),
      graceSeconds: clampNumber(raw && raw.graceSeconds, 0, 120, def.graceSeconds || 3),
      cooldownSeconds: clampNumber(raw && raw.cooldownSeconds, 10, 3600, def.cooldownSeconds || 180),
      alertSound: !raw || raw.alertSound !== false,
      evidence: !raw || raw.evidence !== false,
      showAreas: !raw || raw.showAreas !== false,
      areas: areas
    };
  }

  function companyConfig(skillId, companyId) {
    var def = definition(skillId);
    if (!def) return null;
    var id = resolveCompanyId(companyId);
    var skillStore = saved.skills[def.id] || {};
    var companies = skillStore.companies || {};
    var config = normalize(companies[id], def.id, def, id);
    return {
      skillId: def.id,
      companyId: id,
      mode: def.mode,
      enabled: config.enabled,
      waitSeconds: config.waitSeconds,
      graceSeconds: config.graceSeconds,
      cooldownSeconds: config.cooldownSeconds,
      alertSound: config.alertSound,
      evidence: config.evidence,
      showAreas: config.showAreas,
      areas: config.areas
    };
  }

  function runtimeKey(skillId, companyId) {
    return skillId + ':' + companyId;
  }

  function getRuntime(skillId, companyId) {
    var key = runtimeKey(skillId, companyId);
    if (!runtime[key]) runtime[key] = { skillId: skillId, companyId: companyId, state: {}, stats: null };
    return runtime[key];
  }

  function resetRuntime(skillId, companyId) {
    var id = resolveCompanyId(companyId);
    delete runtime[runtimeKey(skillId, id)];
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

  function emptyStats(def, config, simulated) {
    var areas = {};
    var capacity = 0;
    config.areas.forEach(function (area) {
      capacity += area.capacity;
      areas[area.id] = {
        id: area.id,
        name: area.name,
        count: 0,
        capacity: area.capacity,
        freeSeats: area.capacity,
        status: 'free',
        since: 0,
        seconds: 0,
        attention: false,
        alert: false
      };
    });
    return {
      skillId: def.id,
      companyId: config.companyId,
      mode: def.mode,
      enabled: config.enabled,
      totalAreas: config.areas.length,
      occupiedAreas: 0,
      freeAreas: config.areas.length,
      persons: 0,
      capacity: capacity,
      freeCapacity: capacity,
      occupancyRate: 0,
      maxCount: 0,
      maxWait: 0,
      avgWait: 0,
      overCapacity: 0,
      attention: 0,
      alerts: 0,
      simulated: !!simulated,
      source: simulated ? 'demo' : 'live',
      areas: areas
    };
  }

  function finalize(def, stats) {
    stats.freeAreas = Math.max(0, stats.totalAreas - stats.occupiedAreas);
    stats.freeCapacity = Math.max(0, stats.capacity - stats.persons);
    stats.occupancyRate = stats.capacity ? Math.round(stats.persons / stats.capacity * 100) : 0;
    var waitSum = 0;
    var waitCount = 0;
    stats.attention = 0;
    Object.keys(stats.areas).forEach(function (id) {
      var info = stats.areas[id];
      if (info.attention) stats.attention += 1;
      if (def.mode === 'wait' && info.count > 0) {
        waitSum += info.seconds;
        waitCount += 1;
      }
    });
    stats.avgWait = waitCount ? Math.round(waitSum / waitCount) : 0;
    return stats;
  }

  function areaAt(config, nx, ny) {
    for (var i = 0; i < config.areas.length; i += 1) {
      var area = config.areas[i];
      if (nx >= area.x && nx <= area.x + area.w && ny >= area.y && ny <= area.y + area.h) {
        return area;
      }
    }
    return null;
  }

  function isOverLimit(def, info) {
    if (def.mode === 'crowd') return info.count >= info.capacity;
    return info.count > info.capacity;
  }

  function eventText(def, area, info, simulated) {
    var prefix = simulated ? 'SIMULACIÓN · ' : '';
    if (def.mode === 'wait') {
      return prefix + area.name + ' · espera ' + durationLabel(info.seconds)
        + ' · ' + info.count + (info.count === 1 ? ' persona' : ' personas')
        + (info.count > area.capacity ? ' · sobre capacidad (' + area.capacity + ')' : '');
    }
    if (def.mode === 'crowd') {
      return prefix + area.name + ' · aglomeración · ' + info.count + ' personas (umbral ' + area.capacity + ')';
    }
    return prefix + area.name + ' · ' + info.count + '/' + area.capacity
      + ' personas · aforo excedido';
  }

  function evaluate(skillId, detections, width, height, now, opts) {
    opts = opts || {};
    var def = definition(skillId);
    if (!def) return { stats: null, events: [], config: null };
    var config = companyConfig(def.id, opts.companyId);
    var timestamp = Number(now) || Date.now();
    var simulated = opts.simulate === true;
    var stats = emptyStats(def, config, simulated);
    var events = [];
    var list = Array.isArray(detections) ? detections : [];
    var rt = getRuntime(def.id, config.companyId);

    if (!config.enabled || !width || !height) {
      stats.source = config.enabled ? (simulated ? 'demo' : 'live') : 'disabled';
      rt.stats = stats;
      return { stats: stats, events: events, config: config };
    }

    list.forEach(function (det) {
      if (!det) return;
      var x1 = Number(det.x1) || 0;
      var y1 = Number(det.y1) || 0;
      var x2 = Number(det.x2) || 0;
      var y2 = Number(det.y2) || 0;
      if (x2 <= x1 || y2 <= y1) return;
      var nx = ((x1 + x2) / 2) / width;
      var ny = y2 / height;
      var area = areaAt(config, nx, ny);
      if (!area) return;
      stats.areas[area.id].count += 1;
      det._area = { skillId: def.id, id: area.id, name: area.name, color: area.color };
      if (!Array.isArray(det._areas)) det._areas = [];
      det._areas.push({ skillId: def.id, id: area.id, name: area.name, color: area.color });
    });

    var waitSum = 0;
    var waitCount = 0;

    config.areas.forEach(function (area) {
      var info = stats.areas[area.id];
      var previous = rt.state[area.id] || {
        occupiedSince: 0,
        alertSince: 0,
        alertedAt: 0,
        alerted: false,
        lastCount: 0,
        lastSeen: 0
      };
      previous.lastSeen = timestamp;

      if (info.count > 0) {
        if (!previous.occupiedSince) {
          previous.occupiedSince = timestamp;
          previous.alertedAt = 0;
          previous.alerted = false;
          previous.alertSince = 0;
        }
        info.since = previous.occupiedSince;
        info.seconds = Math.max(0, Math.round((timestamp - previous.occupiedSince) / 1000));
        info.status = 'occupied';
        info.freeSeats = Math.max(0, area.capacity - info.count);
        stats.occupiedAreas += 1;
        stats.persons += info.count;
        stats.maxCount = Math.max(stats.maxCount, info.count);
        var over = isOverLimit(def, info);

        if (def.mode === 'wait') {
          info.attention = info.seconds >= config.waitSeconds || over;
          info.alert = info.attention;
          stats.maxWait = Math.max(stats.maxWait, info.seconds);
          waitSum += info.seconds;
          waitCount += 1;
        } else {
          info.attention = over;
          if (over) {
            if (!previous.alertSince) previous.alertSince = timestamp;
            var sustained = Math.round((timestamp - previous.alertSince) / 1000);
            info.alert = sustained >= config.graceSeconds;
          } else {
            previous.alertSince = 0;
            info.alert = false;
          }
        }

        if (over) stats.overCapacity += 1;

        if (info.alert) {
          info.status = 'alert';
          var cooldownMs = config.cooldownSeconds * 1000;
          if (!previous.alertedAt || timestamp - previous.alertedAt >= cooldownMs) {
            events.push({
              type: def.eventType,
              kind: 'area',
              alert: true,
              text: eventText(def, area, info, simulated),
              skillId: def.id,
              areaId: area.id,
              areaName: area.name,
              zoneName: area.name,
              count: info.count,
              capacity: area.capacity,
              seconds: info.seconds,
              simulated: simulated
            });
            previous.alertedAt = timestamp;
            previous.alerted = true;
            stats.alerts += 1;
          }
        } else if (info.attention) {
          info.status = 'attention';
        }
      } else {
        previous.occupiedSince = 0;
        previous.alertSince = 0;
        previous.alertedAt = 0;
        previous.alerted = false;
        info.status = 'free';
        info.freeSeats = area.capacity;
      }

      previous.lastCount = info.count;
      rt.state[area.id] = previous;
    });

    Object.keys(rt.state).forEach(function (id) {
      if (timestamp - (rt.state[id].lastSeen || 0) > TRACK_MEMORY_MS) {
        delete rt.state[id];
      }
    });

    finalize(def, stats);
    rt.stats = stats;
    return { stats: stats, events: events, config: config };
  }

  function hashString(value) {
    var text = String(value == null ? '' : value);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash >>> 0);
  }

  function previewStats(skillId, companyId) {
    var def = definition(skillId);
    if (!def) return null;
    var config = companyConfig(def.id, companyId);
    var stats = emptyStats(def, config, true);
    var bucket = Math.floor(Date.now() / 60000);
    var waitSum = 0;
    var waitCount = 0;

    config.areas.forEach(function (area, index) {
      var info = stats.areas[area.id];
      var seed = hashString(def.id + ':' + config.companyId + ':' + area.id + ':' + bucket);
      var count = 0;
      var seconds = 0;

      if (def.mode === 'wait') {
        if (index === 0) {
          count = Math.max(2, Math.min(area.capacity, 2 + (seed % Math.max(1, area.capacity - 1))));
          seconds = config.waitSeconds + 45 + (seed % 120);
        } else {
          count = seed % 3 === 0 ? 0 : 1 + (seed % Math.max(1, area.capacity - 1));
          seconds = 30 + (seed % Math.max(60, config.waitSeconds));
        }
      } else if (def.mode === 'desks') {
        count = index === 1 ? 2 : (seed % 5 === 0 ? 0 : 1);
        seconds = 180 + (seed % 900);
      } else if (def.mode === 'capacity') {
        count = index === 0
          ? area.capacity + 1 + (seed % 3)
          : Math.max(1, Math.round(area.capacity * (0.35 + (seed % 55) / 100)));
        seconds = 120 + (seed % 480);
      } else {
        count = index === 0
          ? area.capacity + 1 + (seed % 2)
          : Math.max(1, Math.round(area.capacity * (0.30 + (seed % 65) / 100)));
        seconds = config.graceSeconds + 15 + (seed % 180);
      }

      if (count > 0) {
        info.count = count;
        var over = isOverLimit(def, info);
        info.freeSeats = Math.max(0, area.capacity - count);
        info.seconds = seconds;
        info.since = Date.now() - seconds * 1000;
        info.attention = def.mode === 'wait' ? (seconds >= config.waitSeconds || count > area.capacity) : over;
        info.alert = def.mode === 'wait' ? info.attention : (over && seconds >= config.graceSeconds);
        info.status = info.alert ? 'alert' : info.attention ? 'attention' : 'occupied';
        stats.occupiedAreas += 1;
        stats.persons += count;
        stats.maxCount = Math.max(stats.maxCount, count);
        if (over) stats.overCapacity += 1;
        if (info.alert) stats.alerts += 1;
        if (def.mode === 'wait') {
          stats.maxWait = Math.max(stats.maxWait, seconds);
          waitSum += seconds;
          waitCount += 1;
        }
      }
    });

    stats.avgWait = waitCount ? Math.round(waitSum / waitCount) : 0;
    return finalize(def, stats);
  }

  function statsForView(skillId, companyId) {
    var def = definition(skillId);
    if (!def) return null;
    var id = resolveCompanyId(companyId);
    var rt = runtime[runtimeKey(def.id, id)];
    var connected = !!(AUTEC.monitor && AUTEC.monitor.isConnected && AUTEC.monitor.isConnected());
    if (connected && rt && rt.stats && rt.stats.companyId === id) {
      return clone(rt.stats);
    }
    return previewStats(def.id, id);
  }

  function metrics(skillId, stats) {
    var def = definition(skillId);
    if (!def || !stats) return [];
    if (def.mode === 'wait') {
      return [
        { key: 'persons', label: 'Personas', value: stats.persons },
        { key: 'occupied', label: 'Barras', value: stats.occupiedAreas + '/' + stats.totalAreas },
        { key: 'maxWait', label: 'Espera máx.', value: durationLabel(stats.maxWait) },
        { key: 'alerts', label: 'Alertas', value: stats.alerts }
      ];
    }
    if (def.mode === 'desks') {
      return [
        { key: 'occupied', label: 'Ocupados', value: stats.occupiedAreas },
        { key: 'free', label: 'Libres', value: stats.freeAreas },
        { key: 'persons', label: 'Personas', value: stats.persons },
        { key: 'rate', label: 'Ocupación', value: stats.occupancyRate + '%' },
        { key: 'alerts', label: 'Alertas', value: stats.alerts }
      ];
    }
    if (def.mode === 'crowd') {
      return [
        { key: 'persons', label: 'Personas', value: stats.persons },
        { key: 'points', label: 'Puntos', value: stats.occupiedAreas + '/' + stats.totalAreas },
        { key: 'max', label: 'Máx. por punto', value: stats.maxCount },
        { key: 'alerts', label: 'Alertas', value: stats.alerts }
      ];
    }
    return [
      { key: 'persons', label: 'Personas', value: stats.persons },
      { key: 'capacity', label: 'Capacidad', value: stats.capacity },
      { key: 'rate', label: 'Ocupación', value: stats.occupancyRate + '%' },
      { key: 'over', label: 'Sobre aforo', value: stats.overCapacity },
      { key: 'alerts', label: 'Alertas', value: stats.alerts }
    ];
  }

  function statusLabel(skillId, info) {
    var def = definition(skillId);
    if (!info || !info.count) return 'Libre';
    if (info.alert) return 'ALERTA';
    if (info.attention) return 'Atención';
    if (def && def.mode === 'desks') return 'Ocupado';
    return 'En uso';
  }

  function statusTone(skillId, info) {
    if (!info || !info.count) return 'neutral';
    if (info.alert) return 'danger';
    if (info.attention) return 'warning';
    return 'success';
  }

  function areaSubtitle(skillId, config) {
    var def = definition(skillId);
    if (!def) return '';
    var base = config.areas.length + ' ' + (config.areas.length === 1 ? def.areaLabel.toLowerCase() : def.areaPlural);
    if (def.mode === 'wait') return base + ' · espera objetivo ' + durationLabel(config.waitSeconds);
    var capacity = config.areas.reduce(function (sum, area) { return sum + area.capacity; }, 0);
    if (def.mode === 'desks') return base + ' · capacidad ' + capacity;
    if (def.mode === 'crowd') return base + ' · umbral ' + capacity + ' personas';
    return base + ' · aforo total ' + capacity;
  }

  function hexToRgba(hex, alpha) {
    var value = String(hex || '').replace('#', '');
    if (value.length !== 6) return 'rgba(34, 211, 238, ' + (alpha || 0.12) + ')';
    var r = parseInt(value.slice(0, 2), 16);
    var g = parseInt(value.slice(2, 4), 16);
    var b = parseInt(value.slice(4, 6), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (alpha || 0.12) + ')';
  }

  /* ------------------------------------------------------------- editor */

  function openEditor(skillId) {
    var def = definition(skillId);
    if (!def || !AUTEC.app || typeof AUTEC.app.openModal !== 'function') return;
    var company = currentCompany();
    var companyId = company ? company.id : resolveCompanyId();
    var config = companyConfig(def.id, companyId);
    var draft = clone(config);
    var selectedId = draft.areas.length ? draft.areas[0].id : null;
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
    var controls = '<label class="check-item"><input type="checkbox" id="area-enabled"' + (draft.enabled ? ' checked' : '') + '> Skill activa</label>';
    if (def.mode === 'wait') {
      controls += '<label class="table-limit-field">Espera objetivo <input class="input" type="number" id="area-wait" min="1" max="60" value="' + Math.max(1, Math.round(draft.waitSeconds / 60)) + '"> min</label>';
    } else {
      controls += '<label class="table-limit-field">Gracia <input class="input" type="number" id="area-grace" min="0" max="120" value="' + draft.graceSeconds + '"> s</label>';
    }
    controls += '<label class="table-limit-field">Enfriamiento <input class="input" type="number" id="area-cooldown" min="10" max="3600" value="' + draft.cooldownSeconds + '"> s</label>'
      + '<label class="check-item"><input type="checkbox" id="area-areas"' + (draft.showAreas ? ' checked' : '') + '> Mostrar áreas en el video</label>';

    var body = '<div class="zone-editor table-editor area-editor area-editor--' + def.id + '">'
      + '<div class="zone-editor-toolbar">'
      + '<span class="muted small">Dibujá un rectángulo sobre ' + esc(def.areaLabel.toLowerCase()) + ' o el sector a medir.</span>'
      + '<div class="inline-actions">'
      + '<button type="button" class="btn btn-ghost btn-sm" id="area-add-example">' + esc(def.areaLabel) + ' de ejemplo</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" id="area-clear">Limpiar</button>'
      + '</div>'
      + '</div>'
      + '<div class="zone-stage" id="area-stage" style="--stage-ratio:' + stageRatio + '; aspect-ratio:' + ratioW + ' / ' + ratioH + '">'
      + '<img src="' + background + '" alt="Vista de la cámara para configurar ' + esc(def.name) + '" draggable="false">'
      + '<div class="zone-shapes" id="area-shapes"></div>'
      + '</div>'
      + '<div class="zone-editor-controls">' + controls + '</div>'
      + '<div class="zone-editor-note">Cada área se marca <strong>ocupada</strong> cuando el centro inferior de una persona cae dentro del rectángulo. '
      + (def.mode === 'wait'
        ? 'La espera se estima desde la llegada del primer grupo; si supera el objetivo o la capacidad se dispara la alerta.'
        : def.mode === 'crowd'
          ? 'Si el conteo alcanza el umbral durante la gracia configurada, se dispara una alerta de aglomeración.'
          : 'Si el conteo supera la capacidad durante la gracia configurada, se dispara una alerta de aforo.')
      + ' Las áreas se guardan como porcentajes del cuadro para mantenerse al cambiar la resolución.</div>'
      + '<div class="zone-editor-list" id="area-editor-list"></div>'
      + '<div class="form-note">' + icon('info', 14) + '<span>' + esc(def.note) + ' Todo el procesamiento queda en este equipo; no se envía video a internet.</span></div>'
      + '</div>';

    editor = { skillId: def.id, companyId: companyId, draft: draft, selected: selectedId };

    AUTEC.app.openModal({
      title: def.name,
      subtitle: (company ? company.name : companyId) + ' · ' + def.description,
      wide: true,
      className: 'modal--zones modal--areas modal--areas-' + def.id,
      body: body,
      foot: '<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button>'
        + '<button type="button" class="btn btn-primary" data-action="save-areas" data-skill="' + def.id + '">Guardar ' + esc(def.areaPlural) + '</button>',
      onMount: function (root) {
        initEditor(root, def);
      }
    });
  }

  function initEditor(root, def) {
    if (!editor) return;
    var draft = editor.draft;
    var stage = root.querySelector('#area-stage');
    var shapes = root.querySelector('#area-shapes');
    var list = root.querySelector('#area-editor-list');
    if (!stage || !shapes || !list) return;

    var selected = editor.selected || null;
    var drag = null;
    var draftEl = null;

    function findArea(id) {
      return draft.areas.find(function (area) { return area.id === id; });
    }

    function shapeFor(id) {
      var found = null;
      Array.prototype.forEach.call(shapes.children, function (el) {
        if (el.getAttribute('data-area-shape') === id) found = el;
      });
      return found;
    }

    function capacitySuffix() {
      return def.mode === 'desks' ? ' pax' : ' pers.';
    }

    function renderShapes() {
      shapes.innerHTML = '';
      draft.areas.forEach(function (area) {
        var el = document.createElement('div');
        el.className = 'zone-shape table-shape area-shape' + (area.id === selected ? ' is-selected' : '');
        el.setAttribute('data-area-shape', area.id);
        el.style.left = (area.x * 100) + '%';
        el.style.top = (area.y * 100) + '%';
        el.style.width = (area.w * 100) + '%';
        el.style.height = (area.h * 100) + '%';
        el.style.borderColor = area.color;
        el.style.background = hexToRgba(area.color, 0.12);
        el.innerHTML = '<span class="zone-shape-label" style="background:' + area.color + '">'
          + esc(area.name || def.areaLabel) + ' · ' + area.capacity + capacitySuffix() + '</span>';
        el.addEventListener('pointerdown', function (event) {
          event.stopPropagation();
          selected = area.id;
          refresh();
        });
        shapes.appendChild(el);
      });
    }

    function renderList() {
      if (!draft.areas.length) {
        list.innerHTML = '<div class="monitor-empty">Todavía no hay ' + esc(def.areaPlural) + '. Dibujá un rectángulo sobre la imagen.</div>';
        return;
      }
      list.innerHTML = draft.areas.map(function (area) {
        return '<div class="zone-editor-row table-editor-row area-editor-row' + (area.id === selected ? ' is-selected' : '') + '" data-area-row="' + esc(area.id) + '">'
          + '<div class="zone-editor-row-main">'
          + '<span class="zone-dot" style="background:' + area.color + '"></span>'
          + '<input class="input zone-name-input" data-area-name="' + esc(area.id) + '" value="' + esc(area.name) + '" maxlength="40" aria-label="Nombre de ' + esc(def.areaLabel.toLowerCase()) + '">'
          + '<label class="table-seats-field">' + icon('users', 12) + ' <input class="input" type="number" min="1" max="200" value="' + area.capacity + '" data-area-capacity="' + esc(area.id) + '" aria-label="Capacidad de ' + esc(area.name) + '">' + capacitySuffix() + '</label>'
          + '<span class="zone-coords mono">' + Math.round(area.x * 100) + '%, ' + Math.round(area.y * 100) + '% · '
          + Math.round(area.w * 100) + '×' + Math.round(area.h * 100) + '%</span>'
          + '<button type="button" class="icon-btn zone-remove" data-area-remove="' + esc(area.id) + '" aria-label="Eliminar ' + esc(area.name) + '">'
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

    function addArea(rect, name) {
      var x = clamp(rect.x, 0, 1);
      var y = clamp(rect.y, 0, 1);
      var w = clamp(rect.w, MIN_SIZE, 1 - x);
      var h = clamp(rect.h, MIN_SIZE, 1 - y);
      if (w < MIN_SIZE || h < MIN_SIZE) return null;
      var area = {
        id: uid(def.id),
        name: name || (def.areaLabel + ' ' + (draft.areas.length + 1)),
        capacity: def.mode === 'desks' ? 1 : def.areaCapacity,
        color: COLORS[def.id][draft.areas.length % COLORS[def.id].length],
        x: x,
        y: y,
        w: w,
        h: h
      };
      draft.areas.push(area);
      selected = area.id;
      refresh();
      return area;
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
      if (rect.w >= MIN_SIZE && rect.h >= MIN_SIZE) addArea(rect);
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
      var input = event.target.closest('[data-area-name]');
      if (!input) return;
      var area = findArea(input.getAttribute('data-area-name'));
      if (!area) return;
      area.name = input.value.slice(0, 40);
      var shape = shapeFor(area.id);
      var label = shape ? shape.querySelector('.zone-shape-label') : null;
      if (label) label.textContent = area.name + ' · ' + area.capacity + capacitySuffix();
    });

    list.addEventListener('change', function (event) {
      var capacity = event.target.closest('[data-area-capacity]');
      if (!capacity) return;
      var area = findArea(capacity.getAttribute('data-area-capacity'));
      if (!area) return;
      var value = Number(capacity.value);
      area.capacity = isNaN(value) ? 1 : clamp(Math.round(value), 1, 200);
      capacity.value = area.capacity;
      var shape = shapeFor(area.id);
      var label = shape ? shape.querySelector('.zone-shape-label') : null;
      if (label) label.textContent = area.name + ' · ' + area.capacity + capacitySuffix();
    });

    list.addEventListener('click', function (event) {
      var remove = event.target.closest('[data-area-remove]');
      if (!remove) return;
      var id = remove.getAttribute('data-area-remove');
      draft.areas = draft.areas.filter(function (area) { return area.id !== id; });
      if (selected === id) selected = draft.areas.length ? draft.areas[0].id : null;
      refresh();
    });

    var enabled = root.querySelector('#area-enabled');
    if (enabled) {
      enabled.addEventListener('change', function () {
        draft.enabled = enabled.checked;
      });
    }
    var wait = root.querySelector('#area-wait');
    if (wait) {
      wait.addEventListener('change', function () {
        var minutes = Number(wait.value);
        draft.waitSeconds = isNaN(minutes) ? 5 : clamp(Math.round(minutes * 60), 30, 3600);
        wait.value = Math.max(1, Math.round(draft.waitSeconds / 60));
      });
    }
    var grace = root.querySelector('#area-grace');
    if (grace) {
      grace.addEventListener('change', function () {
        var seconds = Number(grace.value);
        draft.graceSeconds = isNaN(seconds) ? 3 : clamp(Math.round(seconds), 0, 120);
        grace.value = draft.graceSeconds;
      });
    }
    var cooldown = root.querySelector('#area-cooldown');
    if (cooldown) {
      cooldown.addEventListener('change', function () {
        var seconds = Number(cooldown.value);
        draft.cooldownSeconds = isNaN(seconds) ? 180 : clamp(Math.round(seconds), 10, 3600);
        cooldown.value = draft.cooldownSeconds;
      });
    }
    var showAreas = root.querySelector('#area-areas');
    if (showAreas) {
      showAreas.addEventListener('change', function () {
        draft.showAreas = showAreas.checked;
      });
    }

    var addExample = root.querySelector('#area-add-example');
    if (addExample) {
      addExample.addEventListener('click', function () {
        addArea({ x: 0.1, y: 0.48, w: 0.20, h: 0.20 });
      });
    }
    var clear = root.querySelector('#area-clear');
    if (clear) {
      clear.addEventListener('click', function () {
        draft.areas = [];
        selected = null;
        refresh();
      });
    }

    refresh();
  }

  A.saveEditor = function () {
    if (!editor) return false;
    if (!editor.draft.areas.length) {
      if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast('Dibujá al menos un área', 'danger');
      return false;
    }
    var def = definition(editor.skillId);
    var id = editor.companyId;
    if (!saved.skills[editor.skillId]) saved.skills[editor.skillId] = { companies: {} };
    saved.skills[editor.skillId].companies[id] = normalize(editor.draft, editor.skillId, def, id);
    persist();
    resetRuntime(editor.skillId, id);
    var result = { skillId: editor.skillId, name: def.name, config: companyConfig(editor.skillId, id) };
    editor = null;
    return result;
  };

  A.storageKey = STORAGE_KEY;
  A.definitions = function () {
    return SKILL_ORDER.map(function (id) { return clone(SKILLS[id]); });
  };
  A.skillIds = function () {
    return SKILL_ORDER.slice();
  };
  A.definition = function (skillId) {
    var def = definition(skillId);
    return def ? clone(def) : null;
  };
  A.hasSkill = function (skillId, companyId) {
    var def = definition(skillId);
    if (!def || !AUTEC.store || !AUTEC.store.companies) return false;
    var id = resolveCompanyId(companyId);
    var company = AUTEC.store.companies.find(function (item) { return item.id === id; });
    return !!(company && company.skills && company.skills.indexOf(def.id) !== -1);
  };
  A.active = function (skillId, companyId) {
    var config = companyConfig(skillId, companyId);
    return !!config && config.enabled && A.hasSkill(skillId, companyId);
  };
  A.config = function (skillId, companyId) {
    return companyConfig(skillId, companyId);
  };
  A.update = function (skillId, companyId, patch) {
    var def = definition(skillId);
    if (!def) return null;
    var id = resolveCompanyId(companyId);
    var current = companyConfig(def.id, id);
    var next = {
      enabled: patch && typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
      waitSeconds: patch && patch.waitSeconds !== undefined
        ? clampNumber(patch.waitSeconds, 30, 3600, current.waitSeconds)
        : current.waitSeconds,
      graceSeconds: patch && patch.graceSeconds !== undefined
        ? clampNumber(patch.graceSeconds, 0, 120, current.graceSeconds)
        : current.graceSeconds,
      cooldownSeconds: patch && patch.cooldownSeconds !== undefined
        ? clampNumber(patch.cooldownSeconds, 10, 3600, current.cooldownSeconds)
        : current.cooldownSeconds,
      alertSound: patch && typeof patch.alertSound === 'boolean' ? patch.alertSound : current.alertSound,
      evidence: patch && typeof patch.evidence === 'boolean' ? patch.evidence : current.evidence,
      showAreas: patch && typeof patch.showAreas === 'boolean' ? patch.showAreas : current.showAreas,
      areas: patch && Array.isArray(patch.areas) ? patch.areas : current.areas
    };
    if (!saved.skills[def.id]) saved.skills[def.id] = { companies: {} };
    if (!saved.skills[def.id].companies) saved.skills[def.id].companies = {};
    saved.skills[def.id].companies[id] = normalize(next, def.id, def, id);
    persist();
    resetRuntime(def.id, id);
    return companyConfig(def.id, id);
  };
  A.setEnabled = function (skillId, companyId, enabled) {
    return A.update(skillId, companyId, { enabled: !!enabled });
  };
  A.reset = function (skillId, companyId) {
    resetRuntime(skillId, companyId);
  };
  A.stats = function (skillId, companyId) {
    var id = resolveCompanyId(companyId);
    var rt = runtime[runtimeKey(skillId, id)];
    return rt && rt.stats ? clone(rt.stats) : null;
  };
  A.evaluate = evaluate;
  A.previewStats = previewStats;
  A.statsForView = statsForView;
  A.metrics = metrics;
  A.statusLabel = statusLabel;
  A.statusTone = statusTone;
  A.areaSubtitle = areaSubtitle;
  A.durationLabel = durationLabel;
  A.hexToRgba = hexToRgba;
  A.openEditor = openEditor;
})();
