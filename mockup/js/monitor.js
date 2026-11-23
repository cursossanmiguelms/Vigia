(function () {
  window.AUTEC = window.AUTEC || {};
  var M = AUTEC.monitor = {};

  var STORAGE_KEY = 'autecVision.camera.v1';
  var SOUND_KEY = 'autecVision.alertSound.v1';
  var POLL_MS = 400;
  var HEALTH_MS = 2000;
  var STALL_SECONDS = 6;
  var MAX_RECONNECT = 8;

  var API_BASE = (function () {
    try {
      var params = new URLSearchParams(location.search);
      var override = params.get('api');
      if (override) return String(override).replace(/\/+$/, '');
    } catch (_) {}
    if (location.protocol === 'file:') return 'http://127.0.0.1:8000';
    // La maqueta tambien puede abrirse con el servidor estatico de 8081
    // mientras el backend real corre en 8000.
    if (location.port === '8081') return 'http://127.0.0.1:8000';
    return '';
  })();

  function api(path) {
    return API_BASE + path;
  }

  function readConfig() {
    var fallback = {
      host: '',
      port: '4747',
      resolution: '1280x720',
      cameraName: 'Entrada principal',
      lens: 'unknown',
      autoReconnect: true
    };
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return fallback;
      var resolution = String(saved.resolution || '');
      if (resolution !== '1280x720' && resolution !== '1920x1080' && resolution !== '640x480') {
        resolution = '1280x720';
      }
      var lens = String(saved.lens || 'unknown');
      if (lens !== 'unknown' && lens !== 'back' && lens !== 'front' && lens !== 'external') {
        lens = 'unknown';
      }
      return {
        host: String(saved.host || '').trim(),
        port: String(saved.port || '4747').trim(),
        resolution: resolution,
        cameraName: String(saved.cameraName || 'Entrada principal').trim() || 'Entrada principal',
        lens: lens,
        autoReconnect: saved.autoReconnect !== false
      };
    } catch (_) {
      return fallback;
    }
  }

  function readSoundPref() {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch (_) {
      return true;
    }
  }

  var state = {
    config: readConfig(),
    alertSound: readSoundPref(),
    audioContext: null,
    lastBeepAt: 0,
    alertBannerTimer: null,
    lastAlertCaptureAt: 0,
    alertCaptureInFlight: false,
    fallbackSeq: 0,
    fallbackTracks: [],
    connected: false,
    connecting: false,
    paused: false,
    manualStop: true,
    status: 'idle',
    error: '',
    streamUrl: '',
    firstFrameMs: null,
    reconnects: 0,
    reconnectAttempts: 0,
    reconnectTimer: null,
    connectTimeout: null,
    healthTimer: null,
    detectionTimer: null,
    inFlight: false,
    failures: 0,
    lastFrameCount: null,
    lastFrameCountAt: 0,
    seq: 0,
    detections: [],
    persons: 0,
    visiblePersons: 0,
    trackedPersons: 0,
    uniquePersons: 0,
    reidMatches: 0,
    fps: 0,
    inferenceMs: 0,
    width: 0,
    height: 0,
    updatedAt: 0,
    ageSeconds: null,
    detectorStatus: 'idle',
    detectorError: '',
    events: [],
    zoneStats: { inZones: 0, alerts: 0, byZone: {}, alertZones: {}, alertKinds: {}, queue: {}, unattended: {}, patrol: {} },
    lineStats: { enabled: false, name: 'Acceso principal', capacity: 10, in: 0, out: 0, occupancy: 0, capacityAlert: false, active: false },
    heatStats: { enabled: false, points: 0, cells: 0, max: 0, gridW: 48, gridH: 27 },
    epp: {
      enabled: false, available: false, model: '', reason: 'model-missing',
      persons: 0, compliant: 0, nonCompliant: 0, unknown: 0,
      withHelmet: 0, withVest: 0, withoutHelmet: 0, withoutVest: 0, compliance: null
    },
    eppStats: null,
    tablesStats: null,
    fallsStats: null,
    areaStats: {},
    seen: {},
    lastSeen: {},
    announcedOut: {},
    videoEl: null,
    holder: null,
    demoHtml: null
  };

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function clock() {
    var now = new Date();
    return pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  }

  function timeLabel(value) {
    if (!value) return '—';
    var date = new Date(value);
    return pad(date.getHours()) + ':' + pad(date.getMinutes());
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

  function patrolNextLabel(info) {
    if (!info || !info.nextDueAt) return '—';
    if (info.status === 'overdue') return 'Vencida hace ' + durationLabel(info.overdueSeconds);
    if (info.status === 'due') return 'Vence ahora';
    return 'Próxima ' + timeLabel(info.nextDueAt);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolutionLabel(value) {
    return String(value || '1280x720').replace('x', ' × ');
  }

  function lensLabel(value) {
    var labels = {
      back: 'Trasera',
      front: 'Frontal',
      external: 'Externa / USB',
      unknown: 'Sin especificar'
    };
    return labels[value] || labels.unknown;
  }

  function lensLabelLower(value) {
    if (AUTEC.cameras && typeof AUTEC.cameras.lensLabelLower === 'function') {
      return AUTEC.cameras.lensLabelLower(value);
    }
    var label = lensLabel(value);
    return label.charAt(0).toLowerCase() + label.slice(1);
  }

  function cameraLabel() {
    var config = state.config;
    var name = config.cameraName || 'DroidCam';
    if (!config.host) return name;
    return name + ' · ' + config.host + (config.port ? ':' + config.port : '');
  }

  function statusText() {
    if (state.connecting) return 'Conectando';
    if (state.connected && state.paused) return 'Pausado';
    if (state.connected) return 'En vivo';
    if (state.status === 'error') return 'Sin conexión';
    return 'Sin conexión';
  }

  function statusTone() {
    if (state.connecting) return 'warning';
    if (state.connected) return state.paused ? 'warning' : 'success';
    if (state.status === 'error') return 'danger';
    return 'neutral';
  }

  function addEvent(type, text) {
    state.events.unshift({ time: clock(), text: text, type: type });
    if (state.events.length > 10) state.events.length = 10;
  }

  function audioContext() {
    if (state.audioContext) {
      if (state.audioContext.state === 'suspended') {
        state.audioContext.resume().catch(function () {});
      }
      return state.audioContext;
    }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      state.audioContext = new Ctx();
    } catch (_) {
      return null;
    }
    return state.audioContext;
  }

  function tone(ctx, frequency, start, duration, volume) {
    var oscillator = ctx.createOscillator();
    var gain = ctx.createGain();
    var at = ctx.currentTime + start;
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.03);
  }

  function playAlertSound(kind, force) {
    if (!state.alertSound) return;
    var now = Date.now();
    if (!force && state.lastBeepAt && now - state.lastBeepAt < 700) return;
    state.lastBeepAt = now;
    var ctx = audioContext();
    if (!ctx) return;
    try {
      if (kind === 'entry' || kind === 'queue' || kind === 'unattended' || kind === 'patrol') {
        // Sirena de área restringida: dos tonos alternados y un cierre agudo.
        tone(ctx, 880, 0, 0.16, 0.12);
        tone(ctx, 620, 0.2, 0.16, 0.12);
        tone(ctx, 880, 0.4, 0.16, 0.12);
        tone(ctx, 620, 0.6, 0.16, 0.12);
        tone(ctx, 980, 0.82, 0.24, 0.13);
      } else if (kind === 'epp') {
        // Aviso de EPP: tres pulsos ascendentes, distinto de una intrusión.
        tone(ctx, 740, 0, 0.13, 0.1);
        tone(ctx, 880, 0.17, 0.13, 0.1);
        tone(ctx, 1040, 0.34, 0.2, 0.11);
      } else if (kind === 'fall') {
        // Caída: tres pulsos rápidos y graves para pedir atención inmediata.
        tone(ctx, 980, 0, 0.12, 0.12);
        tone(ctx, 980, 0.17, 0.12, 0.12);
        tone(ctx, 620, 0.36, 0.3, 0.13);
      } else if (kind === 'mesa') {
        // Salón: aviso suave de atención prolongada.
        tone(ctx, 700, 0, 0.14, 0.1);
        tone(ctx, 980, 0.2, 0.2, 0.11);
      } else if (kind === 'area') {
        // Aforos y ocupación: dos pulsos medios y un cierre ascendente.
        tone(ctx, 820, 0, 0.13, 0.1);
        tone(ctx, 820, 0.18, 0.13, 0.1);
        tone(ctx, 1100, 0.38, 0.22, 0.11);
      } else if (kind === 'count') {
        tone(ctx, 880, 0, 0.12, 0.1);
        tone(ctx, 880, 0.18, 0.12, 0.1);
        tone(ctx, 1180, 0.36, 0.2, 0.11);
      } else {
        tone(ctx, 760, 0, 0.16, 0.09);
        tone(ctx, 760, 0.22, 0.16, 0.09);
      }
    } catch (_) {}
  }

  function unlockAudio() {
    var ctx = audioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
  }

  function showZoneAlert(text, kind) {
    var frame = videoFrame();
    if (!frame) return;
    var banner = frame.querySelector('.video-zone-alert');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'video-zone-alert';
      frame.appendChild(banner);
    }
    var isAlarm = kind === 'entry' || kind === 'count' || kind === 'queue' || kind === 'unattended' || kind === 'patrol' || kind === 'epp' || kind === 'fall' || kind === 'mesa' || kind === 'area';
    banner.setAttribute('role', isAlarm ? 'alert' : 'status');
    banner.setAttribute('aria-live', isAlarm ? 'assertive' : 'polite');
    var alertIcon = AUTEC.icon ? AUTEC.icon('alert', 16) : '';
    var badge = isAlarm ? '<span class="video-zone-alert-title">ALARMA</span>' : '';
    banner.className = 'video-zone-alert is-visible is-' + (kind || 'entry');
    banner.innerHTML = badge
      + '<span class="video-zone-alert-icon">' + alertIcon + '</span>'
      + '<span class="video-zone-alert-text">' + esc(text) + '</span>';
    if (state.alertBannerTimer) clearTimeout(state.alertBannerTimer);
    state.alertBannerTimer = setTimeout(function () {
      if (banner && banner.parentNode) banner.classList.remove('is-visible');
    }, 6000);
  }

  function drawCaptureLabel(ctx, text, x, y, options) {
    options = options || {};
    var font = options.font || ('bold ' + Math.max(13, Math.round(ctx.canvas.width / 55)) + 'px sans-serif');
    var padX = options.padX || 8;
    var height = options.height || 28;
    ctx.save();
    ctx.font = font;
    ctx.textBaseline = 'middle';
    var width = Math.ceil(ctx.measureText(text).width) + padX * 2;
    var left = Math.max(0, Math.min(x, ctx.canvas.width - width));
    var top = Math.max(0, Math.min(y, ctx.canvas.height - height));
    ctx.fillStyle = options.background || 'rgba(8, 15, 25, 0.9)';
    ctx.fillRect(left, top, width, height);
    if (options.border) {
      ctx.strokeStyle = options.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(left, top, width, height);
    }
    ctx.fillStyle = options.color || '#ffffff';
    ctx.fillText(text, left + padX, top + height / 2 + 1);
    ctx.restore();
  }

  function decorateCapture(ctx, width, height, event) {
    var zonesConfig = AUTEC.zones ? AUTEC.zones.config() : { zones: [] };
    var zoneStats = AUTEC.zones && AUTEC.zones.stats ? AUTEC.zones.stats() : { alertZones: {} };
    var scaleX = state.width ? width / state.width : 1;
    var scaleY = state.height ? height / state.height : 1;
    var line = Math.max(2, Math.round(width / 480));
    var zoneFont = 'bold ' + Math.max(13, Math.round(width / 60)) + 'px sans-serif';
    var zoneHeight = Math.max(24, Math.round(width / 42));

    zonesConfig.zones.forEach(function (zone) {
      var zx = zone.x * width;
      var zy = zone.y * height;
      var zw = zone.w * width;
      var zh = zone.h * height;
      var alert = !!(zoneStats.alertZones && zoneStats.alertZones[zone.id]);
      ctx.save();
      ctx.fillStyle = alert ? 'rgba(239, 68, 68, 0.16)' : 'rgba(34, 211, 238, 0.06)';
      ctx.fillRect(zx, zy, zw, zh);
      ctx.lineWidth = alert ? line + 2 : line;
      ctx.strokeStyle = alert ? '#ef4444' : zone.color;
      ctx.strokeRect(zx, zy, zw, zh);
      ctx.restore();
      drawCaptureLabel(ctx, (alert ? 'ALARMA · ' : '') + (zone.name || 'Zona'), zx, Math.max(0, zy - zoneHeight - 2), {
        background: alert ? 'rgba(127, 29, 29, 0.92)' : 'rgba(8, 47, 73, 0.9)',
        color: '#ffffff',
        font: zoneFont,
        height: zoneHeight
      });
    });

    if (AUTEC.lines) {
      var lineConfig = AUTEC.lines.config();
      if (lineConfig.enabled) {
        var lx1 = lineConfig.x1 * width;
        var ly1 = lineConfig.y1 * height;
        var lx2 = lineConfig.x2 * width;
        var ly2 = lineConfig.y2 * height;
        var lineAlert = !!state.lineStats.capacityAlert;
        ctx.save();
        ctx.strokeStyle = lineAlert ? '#ef4444' : '#22d3ee';
        ctx.lineWidth = lineAlert ? line + 3 : line + 1;
        ctx.setLineDash([Math.max(8, width / 80), Math.max(5, width / 140)]);
        ctx.beginPath();
        ctx.moveTo(lx1, ly1);
        ctx.lineTo(lx2, ly2);
        ctx.stroke();
        ctx.restore();
        drawCaptureLabel(ctx, 'Aforo · IN ' + state.lineStats.in + ' · OUT ' + state.lineStats.out
          + ' · ' + state.lineStats.occupancy + '/' + lineConfig.capacity,
          Math.max(0, Math.min(lx1, lx2)), Math.max(0, Math.min(ly1, ly2) - 30), {
            background: lineAlert ? 'rgba(127, 29, 29, 0.92)' : 'rgba(8, 47, 73, 0.9)',
            color: '#ffffff',
            font: 'bold ' + Math.max(12, Math.round(width / 70)) + 'px sans-serif',
            height: Math.max(24, Math.round(width / 44))
          });
      }
    }

    var eppConfig = AUTEC.epp ? AUTEC.epp.config() : null;
    var tablesConfig = AUTEC.tables ? AUTEC.tables.config() : null;
    var tablesStats = state.tablesStats || (AUTEC.tables ? AUTEC.tables.statsForView() : null);

    if (tablesConfig && tablesConfig.showAreas) {
      tablesConfig.tables.forEach(function (table) {
        var info = tablesStats && tablesStats.tables ? tablesStats.tables[table.id] : null;
        var occupied = !!(info && info.count);
        var attention = !!(info && info.attention);
        var tx = table.x * width;
        var ty = table.y * height;
        var tw = table.w * width;
        var th = table.h * height;
        ctx.save();
        ctx.fillStyle = attention
          ? 'rgba(239, 68, 68, 0.18)'
          : AUTEC.tables.hexToRgba(table.color, occupied ? 0.14 : 0.05);
        ctx.fillRect(tx, ty, tw, th);
        ctx.lineWidth = attention ? line + 2 : line;
        ctx.strokeStyle = attention ? '#ef4444' : table.color;
        ctx.strokeRect(tx, ty, tw, th);
        ctx.restore();
        var tableLabel = table.name + (occupied
          ? ' · ' + info.count + ' · ' + Math.round(info.seconds) + ' s'
          : ' · libre');
        drawCaptureLabel(ctx, (attention ? 'ATENCIÓN · ' : '') + tableLabel, tx, Math.max(0, ty - zoneHeight - 2), {
          background: attention ? 'rgba(127, 29, 29, 0.92)' : 'rgba(8, 47, 73, 0.9)',
          color: '#ffffff',
          font: zoneFont,
          height: zoneHeight
        });
      });
    }

    if (AUTEC.areas) {
      AUTEC.areas.definitions().forEach(function (areaDef) {
        if (!AUTEC.areas.active(areaDef.id)) return;
        var areaConfig = AUTEC.areas.config(areaDef.id);
        if (!areaConfig || !areaConfig.showAreas) return;
        var areaStats = state.areaStats[areaDef.id]
          || AUTEC.areas.statsForView(areaDef.id);
        areaConfig.areas.forEach(function (area) {
          var info = areaStats && areaStats.areas ? areaStats.areas[area.id] : null;
          var occupied = !!(info && info.count);
          var alert = !!(info && info.alert);
          var attention = !!(info && info.attention);
          var ax = area.x * width;
          var ay = area.y * height;
          var aw = area.w * width;
          var ah = area.h * height;
          ctx.save();
          ctx.fillStyle = alert
            ? 'rgba(239, 68, 68, 0.20)'
            : AUTEC.areas.hexToRgba(area.color, occupied ? 0.15 : 0.05);
          ctx.fillRect(ax, ay, aw, ah);
          ctx.lineWidth = alert ? line + 2 : attention ? line + 1 : line;
          ctx.setLineDash(alert ? [] : [Math.max(6, width / 120), Math.max(4, width / 200)]);
          ctx.strokeStyle = alert ? '#ef4444' : attention ? '#f5a524' : area.color;
          ctx.strokeRect(ax, ay, aw, ah);
          ctx.restore();
          var label = area.name + ' · ' + (info ? info.count : 0) + '/' + area.capacity;
          if (areaDef.mode === 'wait' && info && info.count) {
            label += ' · ' + Math.round(info.seconds) + ' s';
          }
          if (alert) label = 'ALERTA · ' + label;
          drawCaptureLabel(ctx, label, ax, Math.max(0, ay - zoneHeight - 2), {
            background: alert ? 'rgba(127, 29, 29, 0.92)' : 'rgba(8, 47, 73, 0.9)',
            color: '#ffffff',
            font: zoneFont,
            height: zoneHeight
          });
        });
      });
    }

    state.detections.forEach(function (det) {
      var x1 = (Number(det.x1) || 0) * scaleX;
      var y1 = (Number(det.y1) || 0) * scaleY;
      var x2 = (Number(det.x2) || 0) * scaleX;
      var y2 = (Number(det.y2) || 0) * scaleY;
      var eppMissing = !!(AUTEC.epp && det._epp && eppConfig && AUTEC.epp.isMissing(det._epp, eppConfig));
      var fallStatus = det._fall && det._fall.status;
      var alert = !!det._zoneAlert || eppMissing || fallStatus === 'fallen';
      ctx.save();
      ctx.lineWidth = alert ? line + 1 : line;
      ctx.strokeStyle = fallStatus === 'suspect' ? '#f5a524' : alert ? '#ef4444' : '#38bdf8';
      ctx.strokeRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
      ctx.restore();

      if (det._epp && det._epp.boxes) {
        ['helmet', 'vest'].forEach(function (key) {
          var box = det._epp.boxes[key];
          if (!box) return;
          ctx.save();
          ctx.setLineDash(det._eppSimulated ? [6, 4] : []);
          ctx.lineWidth = line;
          ctx.strokeStyle = key === 'helmet' ? '#f5a524' : '#34d399';
          ctx.strokeRect(
            (Number(box.x1) || 0) * scaleX,
            (Number(box.y1) || 0) * scaleY,
            Math.max(1, ((Number(box.x2) || 0) - (Number(box.x1) || 0)) * scaleX),
            Math.max(1, ((Number(box.y2) || 0) - (Number(box.y1) || 0)) * scaleY)
          );
          ctx.restore();
        });
      }

      var confidence = Math.round((Number(det.confidence) || 0) * 100);
      var eppText = AUTEC.epp && det._epp && eppConfig
        ? ' · ' + AUTEC.epp.statusLabel(det._epp, eppConfig)
        : '';
      var fallText = AUTEC.falls && det._fall && det._fall.status !== 'normal'
        ? ' · ' + AUTEC.falls.statusLabel(det._fall)
        : '';
      var areaText = det._areas && det._areas.length
        ? ' · ' + det._areas[0].name
        : '';
      var text = 'persona #' + det.trackId + (confidence ? ' · ' + confidence + '%' : '') + eppText + fallText + areaText;
      drawCaptureLabel(ctx, text, x1, Math.max(0, y1 - 26), {
        background: alert ? 'rgba(127, 29, 29, 0.92)' : 'rgba(8, 47, 73, 0.9)',
        color: '#ffffff',
        font: 'bold ' + Math.max(12, Math.round(width / 70)) + 'px sans-serif',
        height: Math.max(22, Math.round(width / 48))
      });
    });

    if (event && event.text) {
      var headerFont = 'bold ' + Math.max(15, Math.round(width / 48)) + 'px sans-serif';
      ctx.save();
      ctx.font = headerFont;
      var headerText = 'ALARMA · ' + event.text;
      var headerWidth = Math.ceil(ctx.measureText(headerText).width) + 28;
      drawCaptureLabel(ctx, headerText, Math.max(0, (width - headerWidth) / 2), 12, {
        background: 'rgba(127, 29, 29, 0.94)',
        color: '#ffffff',
        font: headerFont,
        height: Math.max(30, Math.round(width / 32)),
        padX: 14
      });
      ctx.restore();
    }

    var stamp = new Date().toLocaleString('es-AR');
    drawCaptureLabel(ctx, stamp, width - Math.max(180, width * 0.28), height - 38, {
      background: 'rgba(0, 0, 0, 0.7)',
      color: '#e5e7eb',
      font: Math.max(11, Math.round(width / 85)) + 'px monospace',
      height: 26,
      padX: 8
    });
  }

  function saveFrame(opts) {
    opts = opts || {};
    if (!state.connected || !state.videoEl) {
      return Promise.resolve({ ok: false, reason: 'offline' });
    }
    var width = state.videoEl.naturalWidth || state.width;
    var height = state.videoEl.naturalHeight || state.height;
    if (!width || !height) {
      return Promise.resolve({ ok: false, reason: 'noframe' });
    }
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext('2d');
    try {
      context.drawImage(state.videoEl, 0, 0, width, height);
      if (opts.decorate) decorateCapture(context, width, height, opts.event || null);
    } catch (_) {
      return Promise.resolve({ ok: false, reason: 'canvas' });
    }

    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          resolve({ ok: false, reason: 'blob' });
          return;
        }
        var params = new URLSearchParams({
          label: opts.label || 'panel',
          host: state.config.host,
          port: state.config.port,
          resolution: width + 'x' + height,
          mode: opts.mode || 'camera',
          zone: opts.zone || '',
          event: opts.eventKind || '',
          profile: opts.profile || '',
          trackId: opts.trackId === null || opts.trackId === undefined ? '' : String(opts.trackId),
          missing: opts.missing || '',
          table: opts.table || '',
          fallSeconds: opts.fallSeconds === null || opts.fallSeconds === undefined ? '' : String(opts.fallSeconds),
          simulated: opts.simulated ? '1' : '0',
          companyId: (AUTEC.supabase && AUTEC.supabase.captureCompanyId) || '',
          cameraId: (AUTEC.supabase && AUTEC.supabase.captureCameraId) || (state.config.cameraName || '')
        });
        fetch(api('/api/capture?' + params.toString()), {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob
        })
          .then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (data) {
              return { ok: response.ok && data.ok !== false, data: data };
            });
          })
          .then(function (result) {
            if (result.ok && opts.logText) {
              addEvent('capture', opts.logText + ' · ' + result.data.filename);
            }
            resolve(result);
          })
          .catch(function (error) {
            resolve({ ok: false, error: error });
          });
      }, 'image/jpeg', 0.92);
    });
  }

  function captureAlertFrame(event, opts) {
    opts = opts || {};
    if (!event) return Promise.resolve(null);
    var now = Date.now();
    if (!opts.force && state.lastAlertCaptureAt && now - state.lastAlertCaptureAt < 1200) {
      return Promise.resolve(null);
    }
    if (state.alertCaptureInFlight) return Promise.resolve(null);
    state.lastAlertCaptureAt = now;
    state.alertCaptureInFlight = true;
    var zone = null;
    var zoneName = event.zoneName || '';
    if (event.zone && AUTEC.zones) {
      zone = AUTEC.zones.config().zones.find(function (item) { return item.id === event.zone; });
      if (zone) zoneName = zone.name;
    }

    return saveFrame({
      label: opts.test ? 'prueba' : 'alerta',
      mode: opts.test ? 'test' : 'alert',
      zone: zoneName,
      eventKind: event.kind || 'entry',
      profile: event.profile || '',
      trackId: event.trackId,
      missing: Array.isArray(event.missing) ? event.missing.join(',') : '',
      table: event.tableName || event.table || '',
      fallSeconds: event.seconds !== undefined && event.kind === 'fall' ? event.seconds : '',
      simulated: !!event.simulated,
      event: event,
      decorate: true,
      logText: opts.test ? 'Captura de prueba' : 'Captura de alarma'
    }).then(function (result) {
      state.alertCaptureInFlight = false;
      if (result && result.ok) {
        if (AUTEC.app && AUTEC.app.toast) {
          AUTEC.app.toast('Captura guardada: ' + result.data.filename, 'success');
        }
      } else if (result && result.error && AUTEC.app && AUTEC.app.toast) {
        AUTEC.app.toast('No se pudo guardar la captura de la alarma', 'danger');
      }
      updateUI();
      return result;
    }).catch(function () {
      state.alertCaptureInFlight = false;
      return null;
    });
  }

  function notifyZoneAlert(event) {
    if (!event) return;
    showZoneAlert(event.text, event.kind);
    playAlertSound(event.kind);
    if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast(event.text, 'warning');
    captureAlertFrame(event);
  }

  function notifyEppAlert(event) {
    if (!event) return;
    showZoneAlert(event.text, 'epp');
    if (!event.simulated) playAlertSound('epp');
    if (AUTEC.app && AUTEC.app.toast) {
      AUTEC.app.toast(event.simulated ? 'SIMULACIÓN · ' + event.text : event.text, 'warning');
    }
    captureAlertFrame(event, { force: true });
    updateUI();
  }

  function testEppAlert() {
    var config = AUTEC.epp ? AUTEC.epp.config() : null;
    if (!config) return false;
    var missing = [];
    if (config.required.helmet) missing.push('helmet');
    if (config.required.vest) missing.push('vest');
    var text = 'PRUEBA · Falta ' + missing.map(function (item) {
      return item === 'helmet' ? 'casco' : 'chaleco';
    }).join(' y ');
    var event = {
      alert: true,
      kind: 'epp',
      text: text,
      trackId: null,
      missing: missing,
      profile: config.profile,
      simulated: !!(AUTEC.epp && AUTEC.epp.isDemoMode())
    };
    showZoneAlert(text, 'epp');
    if (!event.simulated) playAlertSound('epp', true);
    if (AUTEC.app && AUTEC.app.toast) {
      AUTEC.app.toast(event.simulated ? 'SIMULACIÓN · ' + text : text, 'warning');
    }
    captureAlertFrame(event, { test: true, force: true });
    return true;
  }

  function notifyTablesAlert(event) {
    if (!event) return;
    showZoneAlert(event.text, 'mesa');
    if (!event.simulated) playAlertSound('mesa');
    if (AUTEC.app && AUTEC.app.toast) {
      AUTEC.app.toast(event.simulated ? 'SIMULACIÓN · ' + event.text : event.text, 'warning');
    }
    captureAlertFrame(event, { force: true });
    updateUI();
  }

  function notifyFallsAlert(event) {
    if (!event) return;
    showZoneAlert(event.text, 'fall');
    if (!event.simulated) playAlertSound('fall');
    if (AUTEC.app && AUTEC.app.toast) {
      AUTEC.app.toast(event.simulated ? 'SIMULACIÓN · ' + event.text : event.text, 'warning');
    }
    captureAlertFrame(event, { force: true });
    updateUI();
  }

  function testTablesAlert(tableId) {
    var config = AUTEC.tables ? AUTEC.tables.config() : null;
    if (!config) return false;
    var table = null;
    if (tableId && config.tables) {
      table = config.tables.find(function (item) { return item.id === tableId; }) || null;
    }
    if (!table) table = config.tables && config.tables.length ? config.tables[0] : null;
    var name = table ? table.name : 'Mesa de prueba';
    var text = 'PRUEBA · ' + name + ' supera el objetivo de atención';
    var event = {
      alert: true,
      kind: 'mesa',
      text: text,
      tableId: table ? table.id : null,
      tableName: name,
      seconds: config.attentionSeconds,
      simulated: true
    };
    showZoneAlert(text, 'mesa');
    if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast('SIMULACIÓN · ' + text, 'warning');
    captureAlertFrame(event, { test: true, force: true });
    return true;
  }

  function testFallsAlert() {
    var config = AUTEC.falls ? AUTEC.falls.config() : { graceSeconds: 3, ratioThreshold: 1.05 };
    var text = 'PRUEBA · Posible caída detectada · ' + config.graceSeconds + ' s';
    var event = {
      alert: true,
      kind: 'fall',
      text: text,
      trackId: null,
      seconds: config.graceSeconds,
      ratio: config.ratioThreshold,
      simulated: true
    };
    showZoneAlert(text, 'fall');
    if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast('SIMULACIÓN · ' + text, 'warning');
    captureAlertFrame(event, { test: true, force: true });
    return true;
  }

  function notifyAreasAlert(event) {
    if (!event) return;
    showZoneAlert(event.text, 'area');
    if (!event.simulated) playAlertSound('area');
    if (AUTEC.app && AUTEC.app.toast) {
      AUTEC.app.toast(event.simulated ? 'SIMULACIÓN · ' + event.text : event.text, 'warning');
    }
    captureAlertFrame(event, { force: true });
    updateUI();
  }

  function testAreasAlert(skillId) {
    if (!AUTEC.areas) return false;
    var id = skillId || (AUTEC.areas.skillIds ? AUTEC.areas.skillIds()[0] : 'barra');
    var config = AUTEC.areas.config(id);
    var def = AUTEC.areas.definition(id);
    if (!config || !def) return false;
    var area = config.areas && config.areas.length ? config.areas[0] : null;
    var name = area ? area.name : def.areaLabel + ' de prueba';
    var text;
    if (def.mode === 'wait') {
      text = 'PRUEBA · Espera prolongada en ' + name + ' · ' + AUTEC.areas.durationLabel(config.waitSeconds);
    } else if (def.mode === 'crowd') {
      text = 'PRUEBA · Aglomeración en ' + name + ' · umbral ' + (area ? area.capacity : def.areaCapacity);
    } else if (def.mode === 'desks') {
      text = 'PRUEBA · Exceso de ocupación en ' + name + ' · capacidad ' + (area ? area.capacity : def.areaCapacity);
    } else {
      text = 'PRUEBA · Aforo excedido en ' + name + ' · ' + (area ? area.capacity : def.areaCapacity) + ' personas';
    }
    var event = {
      alert: true,
      kind: 'area',
      text: text,
      skillId: id,
      areaId: area ? area.id : null,
      areaName: name,
      zoneName: name,
      capacity: area ? area.capacity : def.areaCapacity,
      seconds: def.mode === 'wait' ? config.waitSeconds : config.graceSeconds,
      simulated: true
    };
    showZoneAlert(text, 'area');
    if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast('SIMULACIÓN · ' + text, 'warning');
    captureAlertFrame(event, { test: true, force: true });
    return true;
  }

  function testZoneAlert(zone) {
    var target = zone;
    if (typeof zone === 'string' && AUTEC.zones) {
      target = AUTEC.zones.config().zones.find(function (item) { return item.id === zone; });
    }
    if (!target) target = { name: 'Zona de prueba', restricted: true, alerts: { entry: true, dwell: true } };
    var restricted = target.restricted !== false || (target.alerts && target.alerts.entry);
    var kind = restricted
      ? 'entry'
      : target.alerts && target.alerts.count
        ? 'count'
        : 'dwell';
    var label = kind === 'entry' ? 'área restringida' : kind === 'count' ? 'conteo' : 'merodeo';
    var text = 'PRUEBA · Alarma de ' + label + ' en ' + (target.name || 'zona');
    showZoneAlert(text, kind);
    playAlertSound(kind, true);
    if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast(text, 'warning');
    captureAlertFrame({ alert: true, kind: kind, zone: target.id || null, text: text }, { test: true, force: true });
    return true;
  }

  function testLineAlert() {
    var config = AUTEC.lines ? AUTEC.lines.config() : { name: 'Acceso principal', capacity: 10 };
    var text = 'PRUEBA · Alerta de aforo en ' + config.name;
    showZoneAlert(text, 'count');
    playAlertSound('count', true);
    if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast(text, 'warning');
    captureAlertFrame({
      alert: true,
      kind: 'count',
      zoneName: config.name,
      text: text
    }, { test: true, force: true });
    return true;
  }

  function zoneForSkill(zoneId) {
    if (!AUTEC.zones) return null;
    return AUTEC.zones.config().zones.find(function (zone) { return zone.id === zoneId; }) || null;
  }

  function testQueueAlert(zoneId) {
    var zone = zoneForSkill(zoneId);
    var name = zone ? zone.name : 'Cola de prueba';
    var text = 'PRUEBA · Espera prolongada en ' + name;
    showZoneAlert(text, 'queue');
    playAlertSound('queue', true);
    if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast(text, 'warning');
    captureAlertFrame({
      alert: true,
      kind: 'queue',
      zone: zone ? zone.id : null,
      zoneName: name,
      text: text
    }, { test: true, force: true });
    return true;
  }

  function testUnattendedAlert(zoneId) {
    var zone = zoneForSkill(zoneId);
    var name = zone ? zone.name : 'Puesto de prueba';
    var text = 'PRUEBA · Puesto desatendido en ' + name;
    showZoneAlert(text, 'unattended');
    playAlertSound('unattended', true);
    if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast(text, 'warning');
    captureAlertFrame({
      alert: true,
      kind: 'unattended',
      zone: zone ? zone.id : null,
      zoneName: name,
      text: text
    }, { test: true, force: true });
    return true;
  }

  function testPatrolAlert(zoneId) {
    var zone = zoneForSkill(zoneId);
    var name = zone ? zone.name : 'Checkpoint de prueba';
    var text = 'PRUEBA · Ronda vencida en ' + name;
    showZoneAlert(text, 'patrol');
    playAlertSound('patrol', true);
    if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast(text, 'warning');
    captureAlertFrame({
      alert: true,
      kind: 'patrol',
      zone: zone ? zone.id : null,
      zoneName: name,
      text: text
    }, { test: true, force: true });
    return true;
  }

  function resetPatrol() {
    if (AUTEC.zones && AUTEC.zones.resetPatrol) AUTEC.zones.resetPatrol();
    state.zoneStats.patrol = {};
    updateUI();
  }

  function overlap(a, b) {
    var x1 = Math.max(a.x1, b.x1);
    var y1 = Math.max(a.y1, b.y1);
    var x2 = Math.min(a.x2, b.x2);
    var y2 = Math.min(a.y2, b.y2);
    var intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    if (!intersection) return 0;
    var areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
    var areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
    var union = areaA + areaB - intersection;
    return union > 0 ? intersection / union : 0;
  }

  function assignFallbackIds(detections) {
    var previous = state.fallbackTracks || [];
    var fallback = [];
    var used = {};
    detections.forEach(function (det) {
      if (det.trackId !== null && det.trackId !== undefined) return;
      var box = {
        x1: Number(det.x1) || 0,
        y1: Number(det.y1) || 0,
        x2: Number(det.x2) || 0,
        y2: Number(det.y2) || 0
      };
      var best = null;
      var bestScore = 0;
      previous.forEach(function (prev) {
        if (used[prev.id]) return;
        var score = overlap(box, prev);
        if (score > bestScore) {
          bestScore = score;
          best = prev;
        }
      });
      if (best && bestScore >= 0.25) {
        det.trackId = best.id;
      } else {
        state.fallbackSeq = (state.fallbackSeq || 0) + 1;
        det.trackId = 'c' + state.fallbackSeq;
      }
      used[det.trackId] = true;
      fallback.push({ id: det.trackId, x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 });
    });
    state.fallbackTracks = fallback;
  }

  function renderZoneRows() {
    var rows = document.querySelectorAll('[data-zone-row-id]');
    Array.prototype.forEach.call(rows, function (row) {
      var id = row.getAttribute('data-zone-row-id');
      var count = state.connected ? (state.zoneStats.byZone[id] || 0) : 0;
      var alert = state.connected && !!(state.zoneStats.alertZones && state.zoneStats.alertZones[id]);
      var kind = state.connected ? (state.zoneStats.alertKinds && state.zoneStats.alertKinds[id]) : null;
      var countEl = row.querySelector('[data-zone-count]');
      if (countEl) countEl.textContent = state.connected ? String(count) : '—';
      row.classList.toggle('is-active', count > 0);
      row.classList.toggle('is-alert', !!alert);
      row.classList.toggle('is-count-alert', !!alert && kind === 'count');
    });
  }

  function saveConfig(config) {
    var host = String(config.host || '').trim();
    var port = String(config.port || '4747').trim();
    host = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    var hostWithPort = host.match(/^([^:/]+):(\d+)$/);
    if (hostWithPort) {
      host = hostWithPort[1];
      if (port === '4747') port = hostWithPort[2];
    }
    state.config = {
      host: host,
      port: port || '4747',
      resolution: String(config.resolution || '1280x720'),
      cameraName: String(config.cameraName || 'Entrada principal').trim() || 'Entrada principal',
      lens: String(config.lens || 'unknown'),
      autoReconnect: config.autoReconnect !== false
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        host: state.config.host,
        port: state.config.port,
        resolution: state.config.resolution,
        cameraName: state.config.cameraName,
        lens: state.config.lens,
        autoReconnect: state.config.autoReconnect
      }));
    } catch (_) {}
    if (AUTEC.cameras && typeof AUTEC.cameras.syncActive === 'function') {
      AUTEC.cameras.syncActive(state.config);
    }
    updateUI();
  }

  function ensureElements() {
    if (!state.videoEl) {
      var img = document.createElement('img');
      img.className = 'video-image video-image--live';
      img.alt = 'Video en vivo de la cámara DroidCam';
      img.setAttribute('crossorigin', 'anonymous');
      img.addEventListener('load', onVideoLoad);
      img.addEventListener('error', onVideoError);
      state.videoEl = img;
    }
    if (!state.holder) {
      var holder = document.createElement('div');
      holder.id = 'autec-video-holder';
      holder.setAttribute('aria-hidden', 'true');
      holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:2px;height:2px;overflow:hidden;pointer-events:none;';
      document.body.appendChild(holder);
      holder.appendChild(state.videoEl);
      state.holder = holder;
    }
  }

  function videoFrame() {
    return document.querySelector('.video-frame[data-monitor-frame]');
  }

  function attach() {
    ensureElements();
    var frame = videoFrame();
    if (!frame) {
      if (state.videoEl.parentNode !== state.holder) state.holder.appendChild(state.videoEl);
      return;
    }

    var overlay = frame.querySelector('.video-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'video-overlay';
      var anchor = frame.querySelector('.video-top');
      frame.insertBefore(overlay, anchor || null);
    }

    if (state.videoEl.parentNode !== frame) {
      var scrim = frame.querySelector('.video-scrim');
      frame.insertBefore(state.videoEl, scrim || overlay || null);
    }

    frame.classList.toggle('is-live', state.connected);
    frame.classList.toggle('is-connecting', state.connecting);
    frame.classList.toggle('is-paused', state.paused);

    state.videoEl.style.display = state.connected || state.connecting ? 'block' : 'none';
    if (state.paused) freezeFrame();
    else clearFreeze();
    updateUI();
    renderDetections();
  }

  function updateText(selector, value) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (el) {
      el.textContent = value;
    });
  }

  function clearFreeze() {
    var frame = videoFrame();
    if (!frame) return;
    var frozen = frame.querySelector('.video-freeze');
    if (frozen) frozen.remove();
  }

  function freezeFrame() {
    var frame = videoFrame();
    if (!frame || !state.videoEl) return;
    var width = state.videoEl.naturalWidth;
    var height = state.videoEl.naturalHeight;
    if (!width || !height) return;
    try {
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.className = 'video-freeze';
      canvas.getContext('2d').drawImage(state.videoEl, 0, 0, width, height);
      clearFreeze();
      var overlay = frame.querySelector('.video-overlay');
      frame.insertBefore(canvas, overlay || null);
    } catch (_) {
      clearFreeze();
    }
  }

  function frameDataUrl() {
    if (!state.videoEl) return null;
    var width = state.videoEl.naturalWidth || state.width;
    var height = state.videoEl.naturalHeight || state.height;
    if (!width || !height) return null;
    try {
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(state.videoEl, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.86);
    } catch (_) {
      return null;
    }
  }

  function refreshView() {
    if (AUTEC.app && typeof AUTEC.app.render === 'function') {
      AUTEC.app.render({ preserveScroll: true });
    }
  }

  function updateUI() {
    var frame = videoFrame();
    if (!frame) return;
    updateText('[data-monitor-status]', statusText());
    updateText('[data-monitor-camera]', cameraLabel());
    updateText('[data-monitor-camera-meta]', state.config.host
      ? state.config.host + ':' + state.config.port + ' · ' + resolutionLabel(state.config.resolution)
        + ' · Lente ' + lensLabelLower(state.config.lens)
      : 'DroidCam · sin IP configurada');
    updateText('[data-monitor-ai]', state.detectorStatus === 'running'
      ? 'IA activa'
      : state.detectorStatus === 'loading'
        ? 'Cargando modelo'
        : state.detectorStatus === 'error'
          ? 'IA sin respuesta'
          : 'IA en espera');
    updateText('[data-monitor-persons]', state.connected ? String(state.persons) : '—');
    updateText('[data-monitor-visible]', state.connected ? String(state.visiblePersons) : '—');
    updateText('[data-monitor-tracked]', state.connected ? String(state.trackedPersons) : '—');
    updateText('[data-monitor-unique]', state.connected ? String(state.uniquePersons) : '—');
    updateText('[data-monitor-fps]', state.connected && state.fps ? state.fps.toFixed(1) : '—');
    updateText('[data-monitor-latency]', state.connected && state.inferenceMs ? Math.round(state.inferenceMs) + ' ms' : '—');
    updateText('[data-monitor-timestamp]', state.connected ? clock() : '—');
    updateText('[data-monitor-zones]', state.connected ? String(state.zoneStats.inZones) : '—');
    updateText('[data-monitor-zone-alerts]', state.connected ? String(state.zoneStats.alerts) : '—');
    updateText('[data-monitor-line-in]', state.connected ? String(state.lineStats.in) : '—');
    updateText('[data-monitor-line-out]', state.connected ? String(state.lineStats.out) : '—');
    updateText('[data-monitor-line-occupancy]', state.connected ? String(state.lineStats.occupancy) : '—');
    var lineConfig = AUTEC.lines ? AUTEC.lines.config() : { capacity: 10, enabled: false };
    updateText('[data-monitor-line-capacity]', String(lineConfig.capacity));
    var lineStateEl = document.querySelector('[data-monitor-line-state]');
    if (lineStateEl) {
      var lineAlert = !!state.lineStats.capacityAlert;
      lineStateEl.textContent = lineAlert ? 'ALERTA' : (lineConfig.enabled ? 'Activo' : 'Inactivo');
      lineStateEl.className = 'badge badge--' + (lineAlert ? 'danger' : lineConfig.enabled ? 'success' : 'neutral');
    }
    updateText('[data-monitor-heat-points]', state.connected ? String(state.heatStats.points) : '—');
    updateText('[data-monitor-heat-cells]', state.connected ? String(state.heatStats.cells) : '—');
    renderEpp();
    renderTables();
    renderFalls();
    renderAreas();
    if (state.connected) {
      updateText('[data-monitor-kpi-persons]', String(state.persons));
      updateText('[data-monitor-kpi-reid]', String(state.reidMatches));
    }

    var dots = document.querySelectorAll('[data-monitor-status-dot]');
    Array.prototype.forEach.call(dots, function (dot) {
      dot.className = 'status-dot status-dot--' + statusTone();
    });

    if (frame) {
      frame.classList.toggle('is-live', state.connected);
      frame.classList.toggle('is-connecting', state.connecting);
      frame.classList.toggle('is-paused', state.paused);
      var pill = frame.querySelector('.live-pill');
      if (pill) {
        pill.classList.toggle('live-pill--paused', !state.connected || state.paused);
        pill.innerHTML = '<span class="live-dot"></span>' + (state.connecting ? 'CONECTANDO' : state.connected ? (state.paused ? 'PAUSADO' : 'EN VIVO') : 'SIN SEÑAL');
      }
      var cam = frame.querySelector('.video-cam');
      if (cam) cam.textContent = cameraLabel();
      var chip = frame.querySelector('.reid-chip');
      if (chip) {
        var showReid = !AUTEC.app || !AUTEC.app.state || AUTEC.app.state.reidEnabled !== false;
        var demoReid = (AUTEC.store && AUTEC.store.monitoring && AUTEC.store.monitoring.reidMatches) || 0;
        var reidCount = state.connected ? state.reidMatches : demoReid;
        chip.style.display = showReid ? '' : 'none';
        chip.innerHTML = '<span class="icon">' + (AUTEC.icon ? AUTEC.icon('scan', 13) : '') + '</span> ReID: <span data-monitor-reid-count>' + reidCount + '</span> ' + (reidCount === 1 ? 'recuperación' : 'recuperaciones');
      }
      var bottom = frame.querySelectorAll('.video-bottom span');
      if (bottom.length >= 2) {
        bottom[0].textContent = state.connected ? clock() : 'Sin señal';
        bottom[1].textContent = state.connected
          ? (state.fps ? state.fps.toFixed(1) : '—') + ' FPS · ' + (state.inferenceMs ? Math.round(state.inferenceMs) + ' ms' : '—')
          : 'DroidCam';
      }
    }

    var pausedLabel = document.querySelectorAll('[data-monitor-pause-label]');
    Array.prototype.forEach.call(pausedLabel, function (el) {
      el.textContent = state.paused ? 'Reanudar' : 'Pausar';
    });

    if (state.connected) {
      renderDetectionTable();
      renderPeople();
      renderEvents();
      renderMetrics();
    }
    renderZoneRows();
    renderSkillRows();
  }

  function renderSkillRows() {
    var queueRows = document.querySelectorAll('[data-queue-row-id]');
    Array.prototype.forEach.call(queueRows, function (row) {
      var id = row.getAttribute('data-queue-row-id');
      var info = state.zoneStats.queue && state.zoneStats.queue[id];
      var countEl = row.querySelector('[data-queue-count]');
      var waitEl = row.querySelector('[data-queue-wait]');
      var alert = !!(state.zoneStats.alertZones && state.zoneStats.alertZones[id]);
      if (countEl) countEl.textContent = state.connected && info ? String(info.count) : '—';
      if (waitEl) waitEl.textContent = state.connected && info ? info.avgWait + ' s' : '—';
      row.classList.toggle('is-active', !!(info && info.count));
      row.classList.toggle('is-alert', alert);
    });

    var unattendedRows = document.querySelectorAll('[data-unattended-row-id]');
    Array.prototype.forEach.call(unattendedRows, function (row) {
      var id = row.getAttribute('data-unattended-row-id');
      var info = state.zoneStats.unattended && state.zoneStats.unattended[id];
      var emptyEl = row.querySelector('[data-unattended-empty]');
      var statusEl = row.querySelector('[data-unattended-status]');
      if (emptyEl) emptyEl.textContent = state.connected && info ? info.emptySeconds + ' s' : '—';
      if (statusEl) {
        var alert = !!(info && info.alert);
        statusEl.textContent = alert ? 'ALERTA' : (state.connected ? 'Cubierto' : 'Sin señal');
        statusEl.className = 'badge ' + (alert ? 'badge--danger' : state.connected ? 'badge--success' : 'badge--neutral');
      }
      row.classList.toggle('is-alert', !!(info && info.alert));
    });

    var patrolRows = document.querySelectorAll('[data-patrol-row-id]');
    Array.prototype.forEach.call(patrolRows, function (row) {
      var id = row.getAttribute('data-patrol-row-id');
      var info = state.zoneStats.patrol && state.zoneStats.patrol[id];
      var lastEl = row.querySelector('[data-patrol-last]');
      var nextEl = row.querySelector('[data-patrol-next]');
      var statusEl = row.querySelector('[data-patrol-status]');
      var overdue = !!(info && info.status === 'overdue');
      if (lastEl) lastEl.textContent = state.connected && info && info.lastVisitAt ? timeLabel(info.lastVisitAt) : '—';
      if (nextEl) nextEl.textContent = state.connected ? patrolNextLabel(info) : 'Sin señal';
      if (statusEl) {
        var pending = !info || !info.nextDueAt;
        var tone = !state.connected ? 'neutral' : overdue ? 'danger' : info && info.status === 'due' ? 'warning' : pending || info && info.status === 'pending' ? 'neutral' : 'success';
        var label = !state.connected ? 'Sin señal' : overdue ? 'VENCIDA' : info && info.status === 'due' ? 'Por vencer' : pending || info && info.status === 'pending' ? 'Sin visitas' : 'Al día';
        statusEl.textContent = label;
        statusEl.className = 'badge badge--' + tone;
      }
      row.classList.toggle('is-alert', overdue);
    });

    var patrolSummary = document.querySelector('[data-patrol-summary]');
    if (patrolSummary) {
      var patrolTotal = patrolRows.length;
      var patrolAlertCount = 0;
      var patrolDueCount = 0;
      var patrolPendingCount = 0;
      Array.prototype.forEach.call(patrolRows, function (row) {
        var id = row.getAttribute('data-patrol-row-id');
        var info = state.zoneStats.patrol && state.zoneStats.patrol[id];
        if (info && info.status === 'overdue') patrolAlertCount += 1;
        else if (info && info.status === 'due') patrolDueCount += 1;
        else if (!info || info.status === 'pending') patrolPendingCount += 1;
      });
      var patrolSummaryText = !state.connected
        ? 'sin señal'
        : patrolAlertCount
          ? patrolAlertCount + ' vencido' + (patrolAlertCount === 1 ? '' : 's')
          : patrolDueCount
            ? patrolDueCount + ' por vencer'
            : patrolPendingCount === patrolTotal
              ? 'sin visitas'
              : 'al día';
      patrolSummary.textContent = patrolTotal + (patrolTotal === 1 ? ' checkpoint' : ' checkpoints')
        + ' · ' + patrolSummaryText;
    }
  }

  function renderEpp() {
    if (!AUTEC.epp || !AUTEC.epp.active()) return;
    var config = AUTEC.epp.config();
    var model = AUTEC.epp.modelState();
    var stats = state.connected ? state.eppStats : AUTEC.epp.statsForView();
    if (!stats) return;
    var connected = state.connected;
    var showValues = connected || (stats.simulated === true && stats.source !== 'disabled');
    updateText('[data-monitor-epp-profile]', config.profileName);
    updateText('[data-monitor-epp-required]', AUTEC.epp.requiredText(config.required));
    updateText('[data-monitor-epp-compliance]', stats.compliance === null || stats.compliance === undefined
      ? '—'
      : stats.compliance + '%');
    updateText('[data-monitor-epp-persons]', showValues ? String(stats.persons) : '—');
    updateText('[data-monitor-epp-helmet]', showValues ? String(stats.withHelmet) : '—');
    updateText('[data-monitor-epp-vest]', showValues ? String(stats.withVest) : '—');
    updateText('[data-monitor-epp-without-helmet]', showValues ? String(stats.withoutHelmet) : '—');
    updateText('[data-monitor-epp-without-vest]', showValues ? String(stats.withoutVest) : '—');
    updateText('[data-monitor-epp-missing]', showValues ? String(stats.nonCompliant) : '—');
    updateText('[data-monitor-epp-alerts]', showValues ? String(stats.alerts) : '—');
    updateText('[data-monitor-epp-model]', model.available
      ? (model.label || 'Modelo EPP')
      : 'Modelo EPP no instalado');

    var source = document.querySelector('[data-monitor-epp-source]');
    if (source) {
      var simulated = !model.available || stats.simulated;
      source.innerHTML = '<span class="badge-dot"></span>' + (simulated ? 'SIMULACIÓN' : 'EN VIVO');
      source.className = 'badge badge--' + (simulated ? 'warning' : 'success') + ' epp-source-badge';
    }
    var stateBadge = document.querySelector('[data-monitor-epp-state]');
    if (stateBadge) {
      var missing = stats.nonCompliant > 0;
      stateBadge.textContent = missing ? 'FALTANTE' : stats.compliance === null ? 'SIN DATOS' : 'CUMPLE';
      stateBadge.className = 'badge badge--' + (missing ? 'danger' : stats.compliance === null ? 'neutral' : 'success');
    }
    var alertText = document.querySelector('[data-monitor-epp-model-note]');
    if (alertText) {
      if (model.available) {
        alertText.textContent = 'Modelo EPP local activo. La regla de la empresa define qué se exige.';
      } else {
        alertText.textContent = 'Sin modelo EPP entrenado: los badges y métricas de esta demo son simulados y no representan detección real.';
      }
    }
  }

  function renderTables() {
    if (!AUTEC.tables || !AUTEC.tables.active()) return;
    var stats = state.connected ? state.tablesStats : AUTEC.tables.statsForView();
    if (!stats) return;
    var config = AUTEC.tables.config();
    updateText('[data-monitor-tables-occupied]', String(stats.occupied));
    updateText('[data-monitor-tables-free]', String(stats.free));
    updateText('[data-monitor-tables-rate]', stats.occupancyRate + '%');
    updateText('[data-monitor-tables-customers]', String(stats.customers));
    updateText('[data-monitor-tables-attention]', AUTEC.tables.durationLabel(stats.attention));
    updateText('[data-monitor-tables-alerts]', String(stats.alerts));

    var source = document.querySelector('[data-monitor-tables-source]');
    if (source) {
      var simulated = !state.connected || stats.simulated !== false;
      source.innerHTML = '<span class="badge-dot"></span>' + (simulated ? 'SIMULACIÓN' : 'EN VIVO');
      source.className = 'badge badge--' + (simulated ? 'warning' : 'success') + ' epp-source-badge';
    }

    var list = document.querySelector('[data-monitor-tables-list]');
    if (!list) return;
    var ids = Object.keys(stats.tables || {});
    if (!ids.length) {
      list.innerHTML = '<div class="monitor-empty">Sin mesas configuradas.</div>';
      return;
    }
    list.innerHTML = ids.map(function (id) {
      var info = stats.tables[id];
      var table = config.tables.find(function (item) { return item.id === id; });
      if (!table) return '';
      var label = !info.count ? 'Libre' : info.attention ? 'Atención' : 'Ocupada';
      var tone = !info.count ? 'neutral' : info.attention ? 'warning' : 'success';
      return '<div class="zone-row table-row' + (info.count ? ' is-active' : '') + (info.attention ? ' is-alert' : '') + '" data-table-row-id="' + esc(id) + '">'
        + '<span class="zone-dot" style="background:' + esc(table.color) + '"></span>'
        + '<div class="zone-row-copy"><strong>' + esc(table.name) + '</strong><span>' + table.seats + ' pax · '
        + AUTEC.tables.durationLabel(info.seconds) + '</span></div>'
        + '<span class="zone-count">' + info.count + '</span>'
        + '<span class="badge badge--' + tone + '">' + label + '</span>'
        + '</div>';
    }).join('');
  }

  function renderFalls() {
    if (!AUTEC.falls || !AUTEC.falls.active()) return;
    var stats = state.connected ? state.fallsStats : AUTEC.falls.statsForView();
    if (!stats) return;
    updateText('[data-monitor-falls-analyzed]', String(stats.analyzed));
    updateText('[data-monitor-falls-suspects]', String(stats.suspects));
    updateText('[data-monitor-falls-fallen]', String(stats.fallen));
    updateText('[data-monitor-falls-alerts]', String(stats.alerts));

    var source = document.querySelector('[data-monitor-falls-source]');
    if (source) {
      var simulated = !state.connected || stats.simulated !== false;
      source.innerHTML = '<span class="badge-dot"></span>' + (simulated ? 'SIMULACIÓN' : 'EN VIVO');
      source.className = 'badge badge--' + (simulated ? 'warning' : 'success') + ' epp-source-badge';
    }

    var list = document.querySelector('[data-monitor-falls-list]');
    if (!list) return;
    var tracks = Array.isArray(stats.tracks) ? stats.tracks : [];
    if (!tracks.length) {
      list.innerHTML = '<div class="monitor-empty">Sin personas evaluadas.</div>';
      return;
    }
    list.innerHTML = tracks.slice(0, 8).map(function (track) {
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

  function areaRowDetail(def, area, info) {
    if (def.mode === 'wait') {
      return 'capacidad ' + area.capacity + ' · espera ' + AUTEC.areas.durationLabel(info.seconds);
    }
    if (def.mode === 'desks') {
      return 'capacidad ' + area.capacity + ' · ' + (info.count ? 'ocupado' : 'libre');
    }
    if (def.mode === 'crowd') {
      return 'umbral ' + area.capacity + ' · ' + info.count + ' personas';
    }
    return 'aforo ' + area.capacity + ' · ' + info.count + '/' + area.capacity;
  }

  function renderAreas() {
    if (!AUTEC.areas) return;
    AUTEC.areas.definitions().forEach(function (def) {
      var body = document.querySelector('[data-area-skill="' + def.id + '"]');
      if (!body) return;
      var stats = state.connected
        ? state.areaStats[def.id]
        : AUTEC.areas.statsForView(def.id);
      if (!stats || stats.source === 'disabled') return;

      var metrics = AUTEC.areas.metrics(def.id, stats);
      metrics.forEach(function (metric) {
        var el = body.querySelector('[data-area-metric="' + metric.key + '"]');
        if (el) el.textContent = String(metric.value);
      });

      var source = body.querySelector('[data-area-source]');
      if (source) {
        var simulated = !state.connected || stats.simulated !== false;
        source.innerHTML = '<span class="badge-dot"></span>' + (simulated ? 'SIMULACIÓN' : 'EN VIVO');
        source.className = 'badge badge--' + (simulated ? 'warning' : 'success') + ' epp-source-badge';
      }

      var config = AUTEC.areas.config(def.id);
      if (!config) return;
      var rows = body.querySelectorAll('[data-area-row-id]');
      Array.prototype.forEach.call(rows, function (row) {
        var id = row.getAttribute('data-area-row-id');
        var info = stats.areas ? stats.areas[id] : null;
        var area = config.areas.find(function (item) { return item.id === id; });
        if (!info || !area) return;
        var count = row.querySelector('[data-area-count]');
        var detail = row.querySelector('[data-area-detail]');
        var status = row.querySelector('[data-area-status]');
        if (count) count.textContent = String(info.count);
        if (detail) detail.textContent = areaRowDetail(def, area, info);
        if (status) {
          status.textContent = AUTEC.areas.statusLabel(def.id, info);
          status.className = 'badge badge--' + AUTEC.areas.statusTone(def.id, info);
        }
        row.classList.toggle('is-active', !!info.count);
        row.classList.toggle('is-alert', !!info.alert);
      });
    });
  }

  function renderMetrics() {
    updateText('[data-monitor-metric-persons]', String(state.persons));
    updateText('[data-monitor-metric-fps]', state.fps ? state.fps.toFixed(1) : '—');
    updateText('[data-monitor-metric-latency]', state.inferenceMs ? Math.round(state.inferenceMs) + ' ms' : '—');
    updateText('[data-monitor-metric-reid]', String(state.reidMatches));
    updateText('[data-monitor-metric-zones]', String(state.zoneStats.inZones));
    updateText('[data-monitor-metric-zone-alerts]', String(state.zoneStats.alerts));
  }

  function detectionRows() {
    if (!state.connected) return '';
    if (!state.detections.length) {
      var message = state.detectorStatus === 'loading'
        ? 'Cargando el modelo de detección…'
        : state.connecting
          ? 'Esperando el primer fotograma…'
          : 'Sin detecciones en este momento.';
      return '<tr><td colspan="4"><div class="monitor-empty">' + esc(message) + '</div></td></tr>';
    }
    return state.detections.map(function (det) {
      var id = det.trackId === null || det.trackId === undefined ? '—' : det.trackId;
      var confidence = Math.round((Number(det.confidence) || 0) * 100);
      var isReid = !!det._reid;
      var stateLabel = isReid
        ? '<span class="badge badge--accent"><span class="badge-dot"></span>ReID</span>'
        : id === '—'
          ? '<span class="badge badge--neutral"><span class="badge-dot"></span>Sin ID</span>'
          : '<span class="badge badge--info"><span class="badge-dot"></span>En seguimiento</span>';
      var zoneBadge = det._zone ? ' <span class="badge badge--' + (det._zoneAlert ? 'danger' : 'warning') + '">' + esc(det._zone) + '</span>' : '';
      var eppBadge = '';
      if (det._epp && AUTEC.epp) {
        var eppConfig = AUTEC.epp.config();
        eppBadge = '<span class="epp-inline">' + AUTEC.epp.badgesHtml(det._epp, eppConfig, det._eppSimulated, true) + '</span>';
      }
      var fallBadge = det._fall && det._fall.status !== 'normal' && AUTEC.falls
        ? '<span class="epp-inline">' + AUTEC.falls.badgesHtml(det._fall, !!det._fall.simulated) + '</span>'
        : '';
      return '<tr>'
        + '<td><span class="person-index">' + esc(id) + '</span> <strong>persona #' + esc(id) + '</strong></td>'
        + '<td><div class="conf-cell"><span class="mono">' + confidence + '%</span><div class="progress progress--sm"><span class="progress-fill progress-fill--info" style="width:' + confidence + '%"></span></div></div></td>'
        + '<td>' + stateLabel + zoneBadge + eppBadge + fallBadge + '</td>'
        + '<td><span class="mono muted">x:' + Math.round(Number(det.x1) || 0) + ' · y:' + Math.round(Number(det.y1) || 0) + '</span></td>'
        + '</tr>';
    }).join('');
  }

  function renderDetectionTable() {
    var body = document.querySelector('[data-monitor-detections]');
    if (!body) return;
    body.innerHTML = detectionRows();
  }

  function renderPeople() {
    var container = document.querySelector('[data-monitor-people]');
    if (!container || !state.connected) return;
    if (!state.detections.length) {
      container.innerHTML = '<div class="monitor-empty">Sin personas en cámara.</div>';
      return;
    }
    container.innerHTML = state.detections.map(function (det) {
      var id = det.trackId === null || det.trackId === undefined ? '—' : det.trackId;
      var confidence = Math.round((Number(det.confidence) || 0) * 100);
      var isReid = !!det._reid;
      var zoneLabel = det._zone ? ' · ' + det._zone : '';
      var eppLabel = det._epp && AUTEC.epp
        ? ' · ' + AUTEC.epp.statusLabel(det._epp, AUTEC.epp.config())
        : '';
      var fallLabel = det._fall && det._fall.status !== 'normal' && AUTEC.falls
        ? ' · ' + AUTEC.falls.statusLabel(det._fall)
        : '';
      var eppClass = det._eppStatus === 'missing' ? ' is-epp-missing' : det._eppStatus === 'ok' ? ' is-epp-ok' : '';
      var fallClass = det._fall && det._fall.status === 'fallen' ? ' is-fall' : det._fall && det._fall.status === 'suspect' ? ' is-fall-risk' : '';
      return '<div class="person-row ' + (isReid ? 'is-reid' : '') + eppClass + fallClass + '">'
        + '<span class="person-index">' + esc(id) + '</span>'
        + '<div class="person-copy"><strong>persona #' + esc(id) + '</strong><span>' + (isReid ? 'ID recuperado por ReID' : 'Detección nueva') + esc(zoneLabel) + esc(eppLabel) + esc(fallLabel) + '</span></div>'
        + '<span class="person-conf">' + confidence + '%</span>'
        + '</div>';
    }).join('');
  }

  function renderEvents() {
    var container = document.querySelector('[data-monitor-events]');
    if (!container || !state.connected) return;
    if (!state.events.length) {
      container.innerHTML = '<div class="monitor-empty">Sin eventos en esta sesión.</div>';
      return;
    }
    container.innerHTML = state.events.map(function (event) {
      var cls = event.type === 'reid' ? ' is-reid' : event.type === 'alarm' ? ' is-alarm' : event.type === 'merodeo' ? ' is-merodeo' : event.type === 'zone' ? ' is-zone' : event.type === 'count' ? ' is-count' : event.type === 'line' ? ' is-line' : event.type === 'queue' ? ' is-queue' : event.type === 'unattended' ? ' is-unattended' : event.type === 'patrol' ? ' is-patrol' : event.type === 'mesa' || event.type === 'mesa-libre' ? ' is-table' : event.type === 'fall' ? ' is-fall' : event.type === 'fall-ok' ? ' is-fall-ok' : '';
      return '<div class="event-row' + cls + '"><span class="event-time">' + esc(event.time) + '</span><span class="event-text">' + esc(event.text) + '</span></div>';
    }).join('');
  }

  function renderDetections() {
    var frame = videoFrame();
    if (!frame) return;
    var overlay = frame.querySelector('.video-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';

    if (!state.connected || state.paused) return;
    var frameRect = frame.getBoundingClientRect();
    var frameW = frameRect.width;
    var frameH = frameRect.height;
    var videoW = Number(state.width) || 0;
    var videoH = Number(state.height) || 0;
    if (!frameW || !frameH || !videoW || !videoH) return;

    // El video usa object-fit: contain. Se compensan las barras negras
    // para que las cajas caigan sobre la imagen real.
    var scale = Math.min(frameW / videoW, frameH / videoH);
    var offsetX = (frameW - videoW * scale) / 2;
    var offsetY = (frameH - videoH * scale) / 2;
    var boxes = [];
    var eppConfig = AUTEC.epp && AUTEC.epp.active() ? AUTEC.epp.config() : null;

    if (AUTEC.heatmap && AUTEC.heatmap.config().enabled) {
      var heatCanvas = document.createElement('canvas');
      heatCanvas.className = 'heatmap-canvas';
      heatCanvas.style.left = offsetX + 'px';
      heatCanvas.style.top = offsetY + 'px';
      heatCanvas.style.width = (videoW * scale) + 'px';
      heatCanvas.style.height = (videoH * scale) + 'px';
      overlay.appendChild(heatCanvas);
      AUTEC.heatmap.render(heatCanvas, {
        x: offsetX,
        y: offsetY,
        w: videoW * scale,
        h: videoH * scale
      });
    }

    var zonesConfig = AUTEC.zones ? AUTEC.zones.config() : null;
    if (zonesConfig && zonesConfig.enabled) {
      zonesConfig.zones.forEach(function (zone) {
        var alertKind = AUTEC.zones.alertKind(zone.id);
        var zoneEl = document.createElement('div');
        zoneEl.className = 'zone-overlay' + (alertKind ? ' is-alert is-' + alertKind : '')
          + (zone.queue && zone.queue.enabled ? ' is-queue' : '')
          + (zone.unattended && zone.unattended.enabled ? ' is-unattended' : '')
          + (zone.patrol && zone.patrol.enabled ? ' is-patrol' : '');
        zoneEl.style.left = (offsetX + zone.x * videoW * scale) + 'px';
        zoneEl.style.top = (offsetY + zone.y * videoH * scale) + 'px';
        zoneEl.style.width = (zone.w * videoW * scale) + 'px';
        zoneEl.style.height = (zone.h * videoH * scale) + 'px';
        zoneEl.style.borderColor = zone.color;
        zoneEl.style.background = AUTEC.zones.hexToRgba(zone.color, 0.1);
        var zoneLabel = document.createElement('span');
        zoneLabel.className = 'zone-overlay-label';
        zoneLabel.style.borderColor = zone.color;
        zoneLabel.style.color = zone.color;
        var zoneText = zone.name;
        var queueInfo = state.zoneStats.queue && state.zoneStats.queue[zone.id];
        if (zone.queue && zone.queue.enabled && queueInfo) {
          zoneText += ' · cola ' + queueInfo.count;
        }
        var unattendedInfo = state.zoneStats.unattended && state.zoneStats.unattended[zone.id];
        if (zone.unattended && zone.unattended.enabled && unattendedInfo && unattendedInfo.emptySeconds) {
          zoneText += ' · ' + unattendedInfo.emptySeconds + ' s sin personas';
        }
        var patrolInfo = state.zoneStats.patrol && state.zoneStats.patrol[zone.id];
        if (zone.patrol && zone.patrol.enabled && patrolInfo) {
          zoneText += ' · ronda ' + (patrolInfo.status === 'overdue'
            ? 'VENCIDA'
            : patrolInfo.status === 'due'
              ? 'por vencer'
              : patrolInfo.status === 'pending'
                ? 'sin visitas'
                : 'al día');
        }
        zoneLabel.textContent = zoneText;
        zoneEl.appendChild(zoneLabel);
        overlay.appendChild(zoneEl);
      });
    }

    if (AUTEC.lines) {
      var lineConfig = AUTEC.lines.config();
      if (lineConfig.enabled) {
        var lx1 = offsetX + lineConfig.x1 * videoW * scale;
        var ly1 = offsetY + lineConfig.y1 * videoH * scale;
        var lx2 = offsetX + lineConfig.x2 * videoW * scale;
        var ly2 = offsetY + lineConfig.y2 * videoH * scale;
        var lineLength = Math.sqrt(Math.pow(lx2 - lx1, 2) + Math.pow(ly2 - ly1, 2));
        var lineAngle = Math.atan2(ly2 - ly1, lx2 - lx1) * 180 / Math.PI;
        var lineEl = document.createElement('div');
        lineEl.className = 'line-overlay' + (state.lineStats.capacityAlert ? ' is-alert' : '');
        lineEl.style.left = lx1 + 'px';
        lineEl.style.top = ly1 + 'px';
        lineEl.style.width = Math.max(1, lineLength) + 'px';
        lineEl.style.transform = 'rotate(' + lineAngle + 'deg)';
        var inLabel = document.createElement('span');
        inLabel.className = 'line-overlay-label line-overlay-label--in';
        inLabel.textContent = lineConfig.invert ? 'SALIDA' : 'ENTRADA';
        var outLabel = document.createElement('span');
        outLabel.className = 'line-overlay-label line-overlay-label--out';
        outLabel.textContent = lineConfig.invert ? 'ENTRADA' : 'SALIDA';
        var labelTransform = 'translateY(-50%) rotate(' + (-lineAngle) + 'deg)';
        inLabel.style.transform = labelTransform;
        outLabel.style.transform = labelTransform;
        lineEl.appendChild(inLabel);
        lineEl.appendChild(outLabel);
        overlay.appendChild(lineEl);

        var lineHud = document.createElement('div');
        lineHud.className = 'aforo-hud' + (state.lineStats.capacityAlert ? ' is-alert' : '');
        lineHud.innerHTML = '<span>IN <strong>' + state.lineStats.in + '</strong></span>'
          + '<span>OUT <strong>' + state.lineStats.out + '</strong></span>'
          + '<span>AFORO <strong>' + state.lineStats.occupancy + '/' + lineConfig.capacity + '</strong></span>';
        overlay.appendChild(lineHud);
      }
    }

    var tablesConfig = AUTEC.tables && AUTEC.tables.active() ? AUTEC.tables.config() : null;
    if (tablesConfig && tablesConfig.showAreas) {
      var tablesStats = state.tablesStats || AUTEC.tables.statsForView();
      tablesConfig.tables.forEach(function (table) {
        var info = tablesStats && tablesStats.tables ? tablesStats.tables[table.id] : null;
        var occupied = !!(info && info.count);
        var attention = !!(info && info.attention);
        var tableEl = document.createElement('div');
        tableEl.className = 'table-overlay' + (occupied ? ' is-occupied' : '') + (attention ? ' is-alert' : '');
        tableEl.style.left = (offsetX + table.x * videoW * scale) + 'px';
        tableEl.style.top = (offsetY + table.y * videoH * scale) + 'px';
        tableEl.style.width = (table.w * videoW * scale) + 'px';
        tableEl.style.height = (table.h * videoH * scale) + 'px';
        tableEl.style.borderColor = attention ? '#ef4444' : table.color;
        tableEl.style.background = AUTEC.tables.hexToRgba(table.color, occupied ? 0.14 : 0.05);
        var tableLabel = document.createElement('span');
        tableLabel.className = 'table-overlay-label';
        tableLabel.style.borderColor = attention ? '#ef4444' : table.color;
        tableLabel.style.color = attention ? '#fecaca' : table.color;
        tableLabel.textContent = table.name + (occupied
          ? ' · ' + info.count + ' · ' + AUTEC.tables.durationLabel(info.seconds)
          : ' · libre');
        tableEl.appendChild(tableLabel);
        overlay.appendChild(tableEl);
      });
    }

    if (AUTEC.areas) {
      AUTEC.areas.definitions().forEach(function (areaDef) {
        if (!AUTEC.areas.active(areaDef.id)) return;
        var areaConfig = AUTEC.areas.config(areaDef.id);
        if (!areaConfig || !areaConfig.showAreas) return;
        var areaStats = state.areaStats[areaDef.id] || AUTEC.areas.statsForView(areaDef.id);
        areaConfig.areas.forEach(function (area) {
          var info = areaStats && areaStats.areas ? areaStats.areas[area.id] : null;
          var occupied = !!(info && info.count);
          var alert = !!(info && info.alert);
          var attention = !!(info && info.attention);
          var areaEl = document.createElement('div');
          areaEl.className = 'table-overlay area-overlay'
            + (occupied ? ' is-occupied' : '')
            + (alert ? ' is-alert' : '')
            + (!alert && attention ? ' is-attention' : '');
          areaEl.style.left = (offsetX + area.x * videoW * scale) + 'px';
          areaEl.style.top = (offsetY + area.y * videoH * scale) + 'px';
          areaEl.style.width = (area.w * videoW * scale) + 'px';
          areaEl.style.height = (area.h * videoH * scale) + 'px';
          areaEl.style.borderColor = alert ? '#ef4444' : attention ? '#f5a524' : area.color;
          areaEl.style.background = AUTEC.areas.hexToRgba(area.color, alert ? 0.2 : occupied ? 0.15 : 0.05);
          var areaLabel = document.createElement('span');
          areaLabel.className = 'table-overlay-label area-overlay-label';
          areaLabel.style.borderColor = alert ? '#ef4444' : attention ? '#f5a524' : area.color;
          areaLabel.style.color = alert ? '#fecaca' : attention ? '#fde68a' : area.color;
          var areaText = area.name + ' · ' + (info ? info.count : 0) + '/' + area.capacity;
          if (areaDef.mode === 'wait' && info && info.count) {
            areaText += ' · ' + AUTEC.areas.durationLabel(info.seconds);
          }
          if (alert) areaText = 'ALERTA · ' + areaText;
          areaLabel.textContent = areaText;
          areaEl.appendChild(areaLabel);
          overlay.appendChild(areaEl);
        });
      });
    }

    state.detections.forEach(function (det) {
      var x1 = Number(det.x1) || 0;
      var y1 = Number(det.y1) || 0;
      var x2 = Number(det.x2) || 0;
      var y2 = Number(det.y2) || 0;
      var left = offsetX + x1 * scale;
      var top = offsetY + y1 * scale;
      var width = Math.max(2, (x2 - x1) * scale);
      var height = Math.max(2, (y2 - y1) * scale);
      var id = det.trackId === null || det.trackId === undefined ? null : det.trackId;
      var confidence = Math.round((Number(det.confidence) || 0) * 100);
      var label = id === null
        ? 'persona · ' + confidence + '%'
        : 'persona #' + id + ' · ' + confidence + '%';
      var isReid = !!det._reid;
      var inZone = !!det._zone;
      var eppPayload = det._epp || null;
      var eppSimulated = !!det._eppSimulated;
      var eppMissing = !!(eppConfig && eppPayload && AUTEC.epp.isMissing(eppPayload, eppConfig));
      var eppOk = !!(eppConfig && eppPayload && AUTEC.epp.isComplete(eppPayload, eppConfig));
      var fallPayload = det._fall || null;
      var fallStatus = fallPayload && fallPayload.status;

      var box = document.createElement('div');
      box.className = 'det-box' + (isReid ? ' is-reid' : '') + (inZone ? ' is-zone' : '')
        + (eppMissing ? ' is-epp-missing' : eppOk ? ' is-epp-ok' : '')
        + (eppSimulated ? ' is-epp-sim' : '')
        + (fallStatus === 'fallen' ? ' is-fall' : fallStatus === 'suspect' ? ' is-fall-risk' : '')
        + (det._zoneAlert ? ' is-zone-alert' : '')
        + (det._zoneAlertKind ? ' is-' + det._zoneAlertKind : '');
      box.style.left = left + 'px';
      box.style.top = top + 'px';
      box.style.width = width + 'px';
      box.style.height = height + 'px';
      if (inZone && !eppMissing) {
        box.style.borderColor = det._zoneColor || 'var(--warning)';
        box.style.background = AUTEC.zones.hexToRgba(det._zoneColor || '#f5a524', 0.14);
      }
      if (id !== null) box.setAttribute('data-person', id);

      if (eppConfig && eppPayload && eppConfig.showBoxes && eppPayload.boxes) {
        ['helmet', 'vest'].forEach(function (key) {
          var sub = eppPayload.boxes[key];
          if (!sub) return;
          var subBox = document.createElement('span');
          subBox.className = 'epp-subbox epp-subbox--' + key + (eppSimulated ? ' is-sim' : '');
          subBox.style.left = ((Number(sub.x1) || 0) - x1) * scale + 'px';
          subBox.style.top = ((Number(sub.y1) || 0) - y1) * scale + 'px';
          subBox.style.width = Math.max(2, ((Number(sub.x2) || 0) - (Number(sub.x1) || 0)) * scale) + 'px';
          subBox.style.height = Math.max(2, ((Number(sub.y2) || 0) - (Number(sub.y1) || 0)) * scale) + 'px';
          box.appendChild(subBox);
        });
      }

      var tag = document.createElement('span');
      tag.className = 'det-label';
      tag.innerHTML = (isReid && AUTEC.icon ? AUTEC.icon('scan', 12) : '') + esc(label) + (isReid ? '<em>REID</em>' : '')
        + (inZone ? '<span class="det-zone">' + esc(det._zone) + '</span>' : '')
        + (eppConfig && eppPayload
          ? '<span class="det-epp">' + AUTEC.epp.badgesHtml(eppPayload, eppConfig, eppSimulated, true) + '</span>'
          : '')
        + (AUTEC.falls && fallPayload && fallStatus !== 'normal'
          ? '<span class="det-fall">' + AUTEC.falls.badgesHtml(fallPayload, !!fallPayload.simulated) + '</span>'
          : '');
      box.appendChild(tag);
      overlay.appendChild(box);
      boxes.push({ box: box, label: tag, left: left, top: top, width: width, height: height });
    });

    placeLabels(boxes, frameW, frameH);
  }

  function placeLabels(boxes, frameW, frameH) {
    var placed = [];
    function overlaps(a, b) {
      return a.left < b.left + b.width
        && a.left + a.width > b.left
        && a.top < b.top + b.height
        && a.top + a.height > b.top;
    }
    boxes.forEach(function (item) {
      var label = item.label;
      var labelW = label.offsetWidth || 92;
      var labelH = label.offsetHeight || 22;
      var candidates = [
        { top: item.top - labelH - 3, left: item.left - 2, mode: 'above' },
        { top: item.top + 4, left: item.left + 4, mode: 'inside' },
        { top: item.top + item.height + 4, left: item.left, mode: 'below' },
        { top: item.top + item.height - labelH - 4, left: item.left + 4, mode: 'inside-bottom' }
      ];
      var chosen = null;
      for (var i = 0; i < candidates.length; i += 1) {
        var candidate = candidates[i];
        var rect = { left: candidate.left, top: candidate.top, width: labelW, height: labelH };
        var inFrame = candidate.top >= 2
          && candidate.top + labelH <= frameH - 2
          && candidate.left >= 2
          && candidate.left + labelW <= frameW - 2;
        if (!inFrame) continue;
        var collision = placed.some(function (other) { return overlaps(rect, other); });
        if (!collision) {
          chosen = candidate;
          placed.push(rect);
          break;
        }
      }
      if (!chosen) {
        chosen = { top: Math.max(2, Math.min(item.top + 4, frameH - labelH - 2)), left: Math.max(2, Math.min(item.left + 4, frameW - labelW - 2)) };
      }
      label.style.left = (chosen.left - item.left) + 'px';
      label.style.top = (chosen.top - item.top) + 'px';
    });
  }

  function onVideoLoad() {
    if (!state.connecting) return;
    markConnected(state.seq);
  }

  function onVideoError() {
    if (!state.connecting) return;
    markError(state.seq, 'No se pudo abrir el stream. Verificá que DroidCam esté libre y que la IP sea correcta.');
  }

  function clearConnectTimeout() {
    if (state.connectTimeout) {
      clearTimeout(state.connectTimeout);
      state.connectTimeout = null;
    }
  }

  function clearReconnectTimer() {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
  }

  function stopTimers() {
    if (state.healthTimer) {
      clearInterval(state.healthTimer);
      state.healthTimer = null;
    }
    if (state.detectionTimer) {
      clearInterval(state.detectionTimer);
      state.detectionTimer = null;
    }
    state.inFlight = false;
    state.failures = 0;
    state.lastFrameCount = null;
    state.lastFrameCountAt = 0;
  }

  function startTimers() {
    stopTimers();
    pollDetections();
    state.detectionTimer = setInterval(pollDetections, POLL_MS);
    state.healthTimer = setInterval(checkHealth, HEALTH_MS);
  }

  function connect(isReconnect) {
    ensureElements();
    if (!state.config.host) {
      if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast('Configurá la IP de DroidCam para conectar', 'warning');
      return false;
    }

    clearReconnectTimer();
    clearConnectTimeout();
    stopTimers();
    if (!isReconnect) {
      state.reconnectAttempts = 0;
      state.reconnects = 0;
    }
    state.seq += 1;
    var seq = state.seq;
    state.manualStop = false;
    state.connecting = true;
    state.connected = false;
    state.paused = false;
    clearFreeze();
    state.status = 'connecting';
    state.error = '';
    state.firstFrameMs = null;
    state.detections = [];
    state.persons = 0;
    state.visiblePersons = 0;
    state.trackedPersons = 0;
    state.uniquePersons = 0;
    state.reidMatches = 0;
    state.fps = 0;
    state.inferenceMs = 0;
    state.detectorStatus = 'idle';
    state.events = [];
    state.seen = {};
    state.lastSeen = {};
    state.announcedOut = {};
    state.fallbackTracks = [];
    if (AUTEC.zones) AUTEC.zones.reset();
    if (AUTEC.lines) AUTEC.lines.reset();
    if (AUTEC.tables) AUTEC.tables.reset();
    if (AUTEC.falls) AUTEC.falls.reset();
    state.tablesStats = null;
    state.fallsStats = null;
    state.zoneStats = { inZones: 0, alerts: 0, byZone: {}, alertZones: {}, alertKinds: {}, queue: {}, unattended: {}, patrol: {} };
    state.lineStats = AUTEC.lines ? AUTEC.lines.stats() : state.lineStats;

    if (AUTEC.app && AUTEC.app.state) AUTEC.app.state.monitorPaused = false;
    addEvent('system', 'Conectando con DroidCam…');
    updateUI();
    renderDetections();

    state.streamUrl = api('/stream?host=' + encodeURIComponent(state.config.host)
      + '&port=' + encodeURIComponent(state.config.port)
      + '&res=' + encodeURIComponent(state.config.resolution)
      + '&t=' + Date.now());
    state.videoEl.src = state.streamUrl;
    state.videoEl.style.display = 'block';

    state.connectTimeout = setTimeout(function () {
      if (seq !== state.seq || !state.connecting) return;
      if (state.videoEl.naturalWidth > 0 && state.videoEl.naturalHeight > 0) {
        markConnected(seq);
      } else {
        markError(seq, 'La cámara no entregó video. Verificá que DroidCam esté abierto y que el cliente de Windows esté detenido.');
      }
    }, 12000);

    return true;
  }

  function markConnected(seq) {
    if (seq !== state.seq || !state.connecting) return;
    clearConnectTimeout();
    state.connecting = false;
    state.connected = true;
    state.status = 'connected';
    state.error = '';
    state.firstFrameMs = Math.round(performance.now());
    clearFreeze();
    state.reconnectAttempts = 0;
    if (state.reconnects > 0) state.reconnects += 1;
    addEvent('system', 'Cámara conectada · ' + resolutionLabel(state.config.resolution));
    startTimers();
    updateUI();
    renderDetections();
    refreshView();
  }

  function markError(seq, message) {
    if (seq !== state.seq) return;
    clearConnectTimeout();
    stopTimers();
    state.connecting = false;
    state.connected = false;
    state.status = 'error';
    state.error = message || 'No se pudo conectar con la cámara.';
    clearFreeze();
    state.videoEl.removeAttribute('src');
    state.videoEl.style.display = 'none';
    addEvent('error', state.error);
    updateUI();
    renderDetections();

    if (state.config.autoReconnect && !state.manualStop) {
      scheduleReconnect(state.error);
    } else if (AUTEC.app && AUTEC.app.toast) {
      AUTEC.app.toast(state.error, 'danger');
    }
    refreshView();
  }

  function scheduleReconnect(reason) {
    if (state.reconnectTimer) return;
    if (state.reconnectAttempts >= MAX_RECONNECT) {
      state.status = 'error';
      state.connecting = false;
      state.error = 'No se pudo reconectar después de ' + MAX_RECONNECT + ' intentos.';
      updateUI();
      if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast(state.error, 'danger');
      refreshView();
      return;
    }
    state.reconnectAttempts += 1;
    var wait = Math.min(1000 * Math.pow(2, state.reconnectAttempts - 1), 10000);
    state.status = 'connecting';
    state.connecting = true;
    updateUI();
    if (AUTEC.app && AUTEC.app.toast) {
      AUTEC.app.toast('Reconectando (' + state.reconnectAttempts + '/' + MAX_RECONNECT + ')…', 'info');
    }
    state.reconnectTimer = setTimeout(function () {
      state.reconnectTimer = null;
      if (state.manualStop || !state.config.autoReconnect) return;
      connect(true);
    }, wait);
  }

  function disconnect(userInitiated) {
    clearReconnectTimer();
    clearConnectTimeout();
    stopTimers();
    state.seq += 1;
    state.manualStop = userInitiated !== false;
    state.connected = false;
    state.connecting = false;
    state.paused = false;
    state.status = 'idle';
    state.error = '';
    state.streamUrl = '';
    clearFreeze();
    state.detections = [];
    state.persons = 0;
    state.visiblePersons = 0;
    state.trackedPersons = 0;
    state.uniquePersons = 0;
    state.reidMatches = 0;
    state.fps = 0;
    state.inferenceMs = 0;
    state.detectorStatus = 'idle';
    state.events = [];
    state.fallbackTracks = [];
    if (AUTEC.zones) AUTEC.zones.reset();
    if (AUTEC.lines) AUTEC.lines.reset();
    if (AUTEC.tables) AUTEC.tables.reset();
    if (AUTEC.falls) AUTEC.falls.reset();
    state.tablesStats = null;
    state.fallsStats = null;
    state.zoneStats = { inZones: 0, alerts: 0, byZone: {}, alertZones: {}, alertKinds: {}, queue: {}, unattended: {}, patrol: {} };
    state.lineStats = AUTEC.lines ? AUTEC.lines.stats() : state.lineStats;
    if (state.videoEl) {
      state.videoEl.removeAttribute('src');
      state.videoEl.style.display = 'none';
    }
    if (AUTEC.app && AUTEC.app.state) AUTEC.app.state.monitorPaused = false;
    updateUI();
    renderDetections();
  }

  function togglePause() {
    if (!state.connected) {
      if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast('Conectá la cámara para pausar el monitoreo', 'warning');
      return false;
    }
    state.paused = !state.paused;
    if (AUTEC.app && AUTEC.app.state) AUTEC.app.state.monitorPaused = state.paused;
    if (state.paused) {
      freezeFrame();
      if (state.detectionTimer) {
        clearInterval(state.detectionTimer);
        state.detectionTimer = null;
      }
    } else {
      clearFreeze();
      pollDetections();
      if (!state.detectionTimer) state.detectionTimer = setInterval(pollDetections, POLL_MS);
    }
    updateUI();
    renderDetections();
    return true;
  }

  function pollDetections() {
    if (!state.connected || state.paused || state.inFlight) return;
    var seq = state.seq;
    state.inFlight = true;
    fetch(api('/api/detections'), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || seq !== state.seq || !state.connected || state.paused) return;
        state.failures = 0;
        applyDetections(data);
        updateUI();
        renderDetections();
      })
      .catch(function () {
        if (seq !== state.seq || !state.connected) return;
        state.failures += 1;
        if (state.failures >= 3) {
          state.detectorStatus = 'error';
          updateUI();
        }
      })
      .then(function () {
        state.inFlight = false;
      });
  }

  var lastMetricAt = 0;

  function sendMetric() {
    if (!AUTEC.supabase || !AUTEC.supabase.configured) return;
    var now = Date.now();
    if (now - lastMetricAt < 10000) return;
    lastMetricAt = now;
    AUTEC.supabase.metric({
      company_id: AUTEC.supabase.captureCompanyId || null,
      camera_id: AUTEC.supabase.captureCameraId || state.config.cameraName || null,
      persons: state.persons || 0,
      visible_persons: state.visiblePersons || 0,
      tracked_persons: state.trackedPersons || 0,
      unique_persons: state.uniquePersons || 0,
      fps: state.fps || null,
      inference_ms: state.inferenceMs || null,
      metadata: { source: 'monitor', mode: state.config.cameraName || '' }
    });
  }

  function applyDetections(data) {
    state.detectorStatus = data.status || 'idle';
    state.detectorError = data.error || '';
    state.persons = Number(data.persons) || 0;
    state.visiblePersons = Number(data.visiblePersons) || 0;
    state.trackedPersons = Number(data.trackedPersons) || 0;
    state.uniquePersons = Number(data.uniquePersons) || 0;
    state.reidMatches = Number(data.reidMatches) || 0;
    state.fps = Number(data.fps) || 0;
    state.inferenceMs = Number(data.inferenceMs) || 0;
    state.width = Number(data.width) || 0;
    state.height = Number(data.height) || 0;
    state.updatedAt = Number(data.updatedAt) || 0;
    state.ageSeconds = typeof data.ageSeconds === 'number' ? data.ageSeconds : null;
    state.detections = Array.isArray(data.detections) ? data.detections : [];
    sendMetric();
    state.epp = data.epp && typeof data.epp === 'object'
      ? data.epp
      : {
        enabled: false, available: false, model: '', reason: 'model-missing',
        persons: 0, compliant: 0, nonCompliant: 0, unknown: 0,
        withHelmet: 0, withVest: 0, withoutHelmet: 0, withoutVest: 0, compliance: null
      };
    assignFallbackIds(state.detections);

    var now = Date.now();
    var present = {};
    state.detections.forEach(function (det) {
      if (det.trackId === null || det.trackId === undefined) return;
      var id = det.trackId;
      present[id] = true;
      if (!state.seen[id]) {
        state.seen[id] = now;
        addEvent('new', 'Persona #' + id + ' detectada');
      } else if (state.lastSeen[id] && now - state.lastSeen[id] > 2500) {
        det._reid = true;
        addEvent('reid', 'Persona #' + id + ' recuperada por ReID');
      }
      if (state.announcedOut[id]) {
        delete state.announcedOut[id];
        det._reid = true;
      }
      state.lastSeen[id] = now;
    });

    Object.keys(state.lastSeen).forEach(function (id) {
      if (present[id]) return;
      if (now - state.lastSeen[id] > 3000 && !state.announcedOut[id]) {
        state.announcedOut[id] = true;
        addEvent('out', 'Persona #' + id + ' salió de cámara');
      }
    });

    state.zoneStats = { inZones: 0, alerts: 0, byZone: {}, alertZones: {}, alertKinds: {}, queue: {}, unattended: {}, patrol: {} };
    if (AUTEC.zones) {
      var zoneResult = AUTEC.zones.evaluate(state.detections, state.width, state.height, now);
      state.zoneStats = zoneResult.stats;
      zoneResult.events.forEach(function (event) {
        addEvent(event.type, event.text);
        if (event.alert) notifyZoneAlert(event);
      });
    }

    if (AUTEC.lines) {
      var lineResult = AUTEC.lines.evaluate(state.detections, state.width, state.height, now);
      state.lineStats = lineResult.stats;
      lineResult.events.forEach(function (event) {
        addEvent(event.type, event.text);
        if (event.alert) notifyZoneAlert(event);
      });
    }

    if (AUTEC.heatmap) {
      state.heatStats = AUTEC.heatmap.add(state.detections, state.width, state.height);
    }

    if (AUTEC.epp && AUTEC.epp.active()) {
      var eppResult = AUTEC.epp.evaluate(state.detections, now, {
        simulate: state.epp.available !== true
      });
      state.eppStats = eppResult.stats;
      eppResult.events.forEach(function (event) {
        addEvent(event.type, event.text);
        if (event.alert) notifyEppAlert(event);
      });
    } else {
      state.eppStats = null;
    }

    state.tablesStats = null;
    if (AUTEC.tables && AUTEC.tables.active()) {
      var tablesResult = AUTEC.tables.evaluate(state.detections, state.width, state.height, now);
      state.tablesStats = tablesResult.stats;
      tablesResult.events.forEach(function (event) {
        addEvent(event.type, event.text);
        if (event.alert) notifyTablesAlert(event);
      });
    }

    state.fallsStats = null;
    if (AUTEC.falls && AUTEC.falls.active()) {
      var fallsResult = AUTEC.falls.evaluate(state.detections, now);
      state.fallsStats = fallsResult.stats;
      fallsResult.events.forEach(function (event) {
        addEvent(event.type, event.text);
        if (event.alert) notifyFallsAlert(event);
      });
    }

    state.areaStats = {};
    if (AUTEC.areas) {
      AUTEC.areas.definitions().forEach(function (def) {
        state.areaStats[def.id] = null;
        if (!AUTEC.areas.active(def.id)) return;
        var areaResult = AUTEC.areas.evaluate(def.id, state.detections, state.width, state.height, now);
        state.areaStats[def.id] = areaResult.stats;
        areaResult.events.forEach(function (event) {
          addEvent(event.type, event.text);
          if (event.alert) notifyAreasAlert(event);
        });
      });
    }
  }

  function checkHealth() {
    if (!state.connected) return;
    var seq = state.seq;
    fetch(api('/api/stream-health'), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (seq !== state.seq || !state.connected) return;
        if (!data.active) {
          markError(seq, 'El stream se detuvo. Reconectando…');
          return;
        }
        if (typeof data.frames === 'number') {
          var now = performance.now();
          if (state.lastFrameCount !== null && state.lastFrameCountAt) {
            var elapsed = (now - state.lastFrameCountAt) / 1000;
            if (elapsed >= 0.5) {
              var delta = Math.max(0, data.frames - state.lastFrameCount);
              var streamFps = Math.round(delta / elapsed);
              if (streamFps > 0 && !state.fps) state.fps = streamFps;
            }
          }
          state.lastFrameCount = data.frames;
          state.lastFrameCountAt = now;
        }
        if (typeof data.ageSeconds === 'number' && data.ageSeconds > STALL_SECONDS) {
          markError(seq, 'El video dejó de recibir datos. Reconectando…');
        }
      })
      .catch(function () {});
  }

  function snapshot() {
    if (!state.connected || !state.videoEl) {
      if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast('Conectá la cámara para capturar', 'warning');
      return;
    }
    var frame = videoFrame();
    if (frame) {
      frame.classList.add('is-flashing');
      setTimeout(function () { frame.classList.remove('is-flashing'); }, 420);
    }

    saveFrame({
      label: 'panel',
      mode: 'camera',
      logText: 'Captura guardada'
    }).then(function (result) {
      if (result && result.ok) {
        updateUI();
        if (AUTEC.app && AUTEC.app.toast) {
          AUTEC.app.toast('Captura guardada: ' + result.data.filename, 'success');
        }
        return;
      }
      if (result && result.reason === 'noframe') {
        if (AUTEC.app && AUTEC.app.toast) AUTEC.app.toast('Todavía no hay un fotograma disponible', 'warning');
        return;
      }
      if (result && result.error) {
        if (AUTEC.app && AUTEC.app.toast) {
          AUTEC.app.toast(result.error.message || 'No se pudo guardar la captura', 'danger');
        }
        return;
      }

      var url = api('/snapshot?host=' + encodeURIComponent(state.config.host)
        + '&port=' + encodeURIComponent(state.config.port)
        + '&res=' + encodeURIComponent(state.config.resolution)
        + '&t=' + Date.now());
      var anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = '';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    });
  }

  M.attach = attach;
  M.connect = function () { return connect(false); };
  M.disconnect = function () { disconnect(true); };
  M.togglePause = togglePause;
  M.snapshot = snapshot;
  M.frameDataUrl = frameDataUrl;
  M.saveConfig = saveConfig;
  M.api = api;
  M.config = function () {
    return {
      host: state.config.host,
      port: state.config.port,
      resolution: state.config.resolution,
      cameraName: state.config.cameraName,
      lens: state.config.lens,
      autoReconnect: state.config.autoReconnect
    };
  };
  M.hasHost = function () { return !!state.config.host; };
  M.isConnected = function () { return state.connected; };
  M.isPaused = function () { return state.paused; };
  M.statusText = statusText;
  M.statusTone = statusTone;
  M.cameraLabel = cameraLabel;
  M.resolutionLabel = resolutionLabel;
  M.state = function () { return state; };
  M.testZoneAlert = testZoneAlert;
  M.testEppAlert = testEppAlert;
  M.testTablesAlert = testTablesAlert;
  M.testFallsAlert = testFallsAlert;
  M.testAreasAlert = testAreasAlert;
  M.testLineAlert = testLineAlert;
  M.testQueueAlert = testQueueAlert;
  M.testUnattendedAlert = testUnattendedAlert;
  M.testPatrolAlert = testPatrolAlert;
  M.resetPatrol = resetPatrol;
  M.toggleAlertSound = function () {
    state.alertSound = !state.alertSound;
    try {
      localStorage.setItem(SOUND_KEY, state.alertSound ? 'on' : 'off');
    } catch (_) {}
    if (state.alertSound) playAlertSound('entry', true);
    return state.alertSound;
  };
  M.alertSoundEnabled = function () { return state.alertSound; };

  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  document.addEventListener('keydown', unlockAudio);

  ensureElements();
})();
