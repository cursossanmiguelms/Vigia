(function () {
  window.AUTEC = window.AUTEC || {};
  var L = AUTEC.lines = {};

  var STORAGE_KEY = 'autecVision.line.v1';
  var CROSS_COOLDOWN_MS = 700;
  var DEAD_ZONE = 0.006;
  var TRACK_TTL_MS = 12000;

  var tracks = {};
  var counts = { in: 0, out: 0, occupancy: 0, capacityAlert: false };
  var editor = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function defaults() {
    return {
      enabled: false,
      name: 'Acceso principal',
      x1: 0.5,
      y1: 0.12,
      x2: 0.5,
      y2: 0.88,
      invert: false,
      capacity: 10,
      alerts: { capacity: true }
    };
  }

  function normalize(raw) {
    var base = defaults();
    if (!raw || typeof raw !== 'object') return base;

    base.enabled = raw.enabled === true;
    base.name = String(raw.name || base.name).slice(0, 40);
    base.x1 = clamp(Number(raw.x1), 0, 1);
    base.y1 = clamp(Number(raw.y1), 0, 1);
    base.x2 = clamp(Number(raw.x2), 0, 1);
    base.y2 = clamp(Number(raw.y2), 0, 1);
    if (isNaN(base.x1) || isNaN(base.y1) || isNaN(base.x2) || isNaN(base.y2)) {
      var fallback = defaults();
      base.x1 = fallback.x1;
      base.y1 = fallback.y1;
      base.x2 = fallback.x2;
      base.y2 = fallback.y2;
    }
    if (Math.sqrt(Math.pow(base.x2 - base.x1, 2) + Math.pow(base.y2 - base.y1, 2)) < 0.05) {
      base.x1 = 0.5;
      base.y1 = 0.12;
      base.x2 = 0.5;
      base.y2 = 0.88;
    }
    base.invert = raw.invert === true;
    var capacity = Number(raw.capacity);
    base.capacity = isNaN(capacity) ? 10 : Math.round(clamp(capacity, 1, 500));
    var rawAlerts = raw.alerts && typeof raw.alerts === 'object' ? raw.alerts : {};
    base.alerts = { capacity: rawAlerts.capacity !== false };
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
    tracks = {};
    counts = { in: 0, out: 0, occupancy: 0, capacityAlert: false };
  }

  function stats() {
    return {
      enabled: config.enabled,
      name: config.name,
      capacity: config.capacity,
      in: counts.in,
      out: counts.out,
      occupancy: counts.occupancy,
      capacityAlert: counts.capacityAlert,
      active: config.enabled
    };
  }

  L.config = function () {
    return clone(config);
  };

  L.stats = function () {
    return stats();
  };

  L.reset = reset;

  L.save = function (next) {
    config = normalize(next);
    persist();
    reset();
  };

  L.setEnabled = function (enabled) {
    config.enabled = !!enabled;
    persist();
    tracks = {};
    counts.capacityAlert = false;
  };

  L.setCapacity = function (capacity) {
    var value = Number(capacity);
    config.capacity = isNaN(value) ? 10 : Math.round(clamp(value, 1, 500));
    persist();
    counts.capacityAlert = false;
  };

  function lineSide(x1, y1, x2, y2, px, py) {
    return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
  }

  L.evaluate = function (detections, width, height, now) {
    var events = [];
    var time = now || Date.now();

    if (!config.enabled || !width || !height || !Array.isArray(detections)) {
      tracks = {};
      return { events: events, stats: stats() };
    }

    var dx = config.x2 - config.x1;
    var dy = config.y2 - config.y1;
    var lineLength = Math.sqrt(dx * dx + dy * dy);
    if (!lineLength) return { events: events, stats: stats() };

    var seen = {};

    detections.forEach(function (det) {
      if (det.trackId === null || det.trackId === undefined) return;
      var x1 = Number(det.x1) || 0;
      var x2 = Number(det.x2) || 0;
      var y2 = Number(det.y2) || 0;
      var px = ((x1 + x2) / 2) / width;
      var py = y2 / height;
      if (px < 0 || px > 1 || py < 0 || py > 1) return;

      var side = lineSide(config.x1, config.y1, config.x2, config.y2, px, py);
      var distance = Math.abs(side) / lineLength;
      if (distance < DEAD_ZONE) return;

      var sign = side > 0 ? 1 : -1;
      var id = String(det.trackId);
      seen[id] = true;
      var previous = tracks[id];

      if (!previous) {
        tracks[id] = { side: sign, lastSeen: time, lastCrossAt: 0 };
        return;
      }

      previous.lastSeen = time;
      if (sign !== previous.side && time - previous.lastCrossAt > CROSS_COOLDOWN_MS) {
        var entering = previous.side < 0 && sign > 0;
        if (config.invert) entering = !entering;

        if (entering) counts.in += 1;
        else counts.out = Math.min(counts.out + 1, counts.in);
        counts.occupancy = Math.max(0, counts.in - counts.out);
        previous.side = sign;
        previous.lastCrossAt = time;

        events.push({
          type: 'line',
          kind: entering ? 'in' : 'out',
          alert: false,
          text: (entering ? 'Ingreso' : 'Salida') + ' en ' + config.name
            + ' · persona #' + det.trackId + ' · aforo ' + counts.occupancy + '/' + config.capacity
        });
      }
    });

    Object.keys(tracks).forEach(function (id) {
      if (seen[id]) return;
      if (time - tracks[id].lastSeen > TRACK_TTL_MS) delete tracks[id];
    });

    if (config.alerts.capacity && counts.occupancy >= config.capacity) {
      if (!counts.capacityAlert) {
        counts.capacityAlert = true;
        events.push({
          type: 'alarm',
          kind: 'count',
          alert: true,
          zoneName: config.name,
          text: 'Aforo máximo alcanzado en ' + config.name + ': '
            + counts.occupancy + ' personas (máximo ' + config.capacity + ')'
        });
      }
    } else if (counts.occupancy < config.capacity) {
      counts.capacityAlert = false;
    }

    return { events: events, stats: stats() };
  };

  function icon(name, size) {
    return AUTEC.icon ? AUTEC.icon(name, size) : '';
  }

  function openEditor() {
    if (!AUTEC.app || typeof AUTEC.app.openModal !== 'function') return;
    editor = null;

    var draft = clone(config);
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
    var body = '<div class="line-editor">'
      + '<div class="line-editor-toolbar">'
      + '<span class="muted small">Trazá la línea que separa el área. Arrastrá los extremos para ajustarla.</span>'
      + '<div class="inline-actions">'
      + '<button type="button" class="btn btn-ghost btn-sm" id="line-horizontal">Horizontal</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" id="line-vertical">Vertical</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" id="line-invert">Invertir sentido</button>'
      + '</div>'
      + '</div>'
      + '<div class="line-stage" id="line-stage" style="--stage-ratio:' + stageRatio + '; aspect-ratio:' + ratioW + ' / ' + ratioH + '">'
      + '<img src="' + background + '" alt="Vista de la cámara para configurar el aforo" draggable="false">'
      + '<div class="line-shape" id="line-shape"><span class="line-shape-label line-shape-label--in" id="line-label-in">ENTRADA</span><span class="line-shape-label line-shape-label--out" id="line-label-out">SALIDA</span></div>'
      + '<span class="line-handle" id="line-handle-1" data-line-handle="1" aria-label="Extremo de entrada"></span>'
      + '<span class="line-handle" id="line-handle-2" data-line-handle="2" aria-label="Extremo de salida"></span>'
      + '</div>'
      + '<div class="line-editor-controls">'
      + '<label class="check-item"><input type="checkbox" id="line-enabled"' + (draft.enabled ? ' checked' : '') + '> Aforo activo</label>'
      + '<label class="line-capacity-field">Capacidad <input class="input" type="number" id="line-capacity" min="1" max="500" value="' + draft.capacity + '"> personas</label>'
      + '<label class="line-name-field">Nombre <input class="input" id="line-name" maxlength="40" value="' + draft.name.replace(/"/g, '&quot;') + '"></label>'
      + '</div>'
      + '<div class="form-note">' + icon('info', 14) + '<span>El aforo se calcula con el punto inferior de cada persona. Al superar la capacidad se dispara la alarma y se guarda una captura automática. Los contadores se reinician al recargar o con <strong>Reiniciar</strong>.</span></div>'
      + '</div>';

    AUTEC.app.openModal({
      title: 'Aforo por línea',
      subtitle: 'Conteo de ingresos y salidas sobre el video.',
      wide: true,
      className: 'modal--line',
      body: body,
      foot: '<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button>'
        + '<button type="button" class="btn btn-primary" data-action="save-line">Guardar línea</button>',
      onMount: function (root) {
        if (editor) initEditor(root, editor.draft);
        else initEditor(root, draft);
      }
    });
  }

  function initEditor(root, draft) {
    var stage = root.querySelector('#line-stage');
    var shape = root.querySelector('#line-shape');
    var handle1 = root.querySelector('#line-handle-1');
    var handle2 = root.querySelector('#line-handle-2');
    var labelIn = root.querySelector('#line-label-in');
    var labelOut = root.querySelector('#line-label-out');
    if (!stage || !shape || !handle1 || !handle2) return;

    var drag = null;

    function bounds() {
      return stage.getBoundingClientRect();
    }

    function clampPoint(point) {
      return { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) };
    }

    function pointerPosition(event) {
      var rect = bounds();
      return clampPoint({
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height
      });
    }

    function update() {
      var rect = bounds();
      if (!rect.width || !rect.height) return;
      var x1 = draft.x1 * rect.width;
      var y1 = draft.y1 * rect.height;
      var x2 = draft.x2 * rect.width;
      var y2 = draft.y2 * rect.height;
      var length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      var angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      shape.style.left = x1 + 'px';
      shape.style.top = y1 + 'px';
      shape.style.width = Math.max(1, length) + 'px';
      shape.style.transform = 'rotate(' + angle + 'deg)';
      var labelTransform = 'translateY(-50%) rotate(' + (-angle) + 'deg)';
      handle1.style.left = x1 + 'px';
      handle1.style.top = y1 + 'px';
      handle2.style.left = x2 + 'px';
      handle2.style.top = y2 + 'px';
      if (labelIn) {
        labelIn.textContent = draft.invert ? 'SALIDA' : 'ENTRADA';
        labelIn.style.transform = labelTransform;
      }
      if (labelOut) {
        labelOut.textContent = draft.invert ? 'ENTRADA' : 'SALIDA';
        labelOut.style.transform = labelTransform;
      }
    }

    function startDrag(event, mode) {
      event.preventDefault();
      event.stopPropagation();
      drag = {
        mode: mode,
        start: pointerPosition(event),
        origin: { x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2 },
        pointerId: event.pointerId
      };
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (_) {}
    }

    stage.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      var handle = event.target.closest('[data-line-handle]');
      if (handle) {
        startDrag(event, handle.getAttribute('data-line-handle') === '1' ? 'handle1' : 'handle2');
        return;
      }
      if (event.target.closest('.line-shape')) {
        startDrag(event, 'move');
        return;
      }
      var point = pointerPosition(event);
      draft.x1 = point.x;
      draft.y1 = point.y;
      draft.x2 = point.x;
      draft.y2 = point.y;
      drag = { mode: 'new', pointerId: event.pointerId };
      update();
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (_) {}
    });

    stage.addEventListener('pointermove', function (event) {
      if (!drag) return;
      var point = pointerPosition(event);
      if (drag.mode === 'new') {
        draft.x2 = point.x;
        draft.y2 = point.y;
      } else if (drag.mode === 'handle1') {
        draft.x1 = point.x;
        draft.y1 = point.y;
      } else if (drag.mode === 'handle2') {
        draft.x2 = point.x;
        draft.y2 = point.y;
      } else if (drag.mode === 'move') {
        var dx = point.x - drag.start.x;
        var dy = point.y - drag.start.y;
        var nextX1 = drag.origin.x1 + dx;
        var nextY1 = drag.origin.y1 + dy;
        var nextX2 = drag.origin.x2 + dx;
        var nextY2 = drag.origin.y2 + dy;
        var minX = Math.min(nextX1, nextX2);
        var maxX = Math.max(nextX1, nextX2);
        var minY = Math.min(nextY1, nextY2);
        var maxY = Math.max(nextY1, nextY2);
        if (minX < 0) { nextX1 -= minX; nextX2 -= minX; }
        if (maxX > 1) { nextX1 -= maxX - 1; nextX2 -= maxX - 1; }
        if (minY < 0) { nextY1 -= minY; nextY2 -= minY; }
        if (maxY > 1) { nextY1 -= maxY - 1; nextY2 -= maxY - 1; }
        draft.x1 = nextX1;
        draft.y1 = nextY1;
        draft.x2 = nextX2;
        draft.y2 = nextY2;
      }
      update();
    });

    function endDrag(event) {
      if (!drag) return;
      drag = null;
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch (_) {}
      update();
    }

    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', function (event) {
      drag = null;
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch (_) {}
    });
    stage.addEventListener('dragstart', function (event) {
      event.preventDefault();
    });

    var enabledInput = root.querySelector('#line-enabled');
    if (enabledInput) {
      enabledInput.addEventListener('change', function () {
        draft.enabled = enabledInput.checked;
      });
    }

    var capacityInput = root.querySelector('#line-capacity');
    if (capacityInput) {
      capacityInput.addEventListener('change', function () {
        var value = Number(capacityInput.value);
        draft.capacity = isNaN(value) ? 10 : Math.round(clamp(value, 1, 500));
        capacityInput.value = draft.capacity;
      });
    }

    var nameInput = root.querySelector('#line-name');
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        draft.name = nameInput.value.slice(0, 40);
      });
    }

    var horizontal = root.querySelector('#line-horizontal');
    if (horizontal) {
      horizontal.addEventListener('click', function () {
        draft.x1 = 0.08;
        draft.y1 = 0.5;
        draft.x2 = 0.92;
        draft.y2 = 0.5;
        update();
      });
    }

    var vertical = root.querySelector('#line-vertical');
    if (vertical) {
      vertical.addEventListener('click', function () {
        draft.x1 = 0.5;
        draft.y1 = 0.08;
        draft.x2 = 0.5;
        draft.y2 = 0.92;
        update();
      });
    }

    var invert = root.querySelector('#line-invert');
    if (invert) {
      invert.addEventListener('click', function () {
        draft.invert = !draft.invert;
        update();
      });
    }

    update();
    window.requestAnimationFrame(update);
    editor = { draft: draft, root: root };
  }

  L.openEditor = openEditor;

  L.saveEditor = function () {
    if (!editor) return false;
    if (editor.root) {
      var enabledInput = editor.root.querySelector('#line-enabled');
      if (enabledInput) editor.draft.enabled = enabledInput.checked;
      var capacityInput = editor.root.querySelector('#line-capacity');
      if (capacityInput) {
        var value = Number(capacityInput.value);
        editor.draft.capacity = isNaN(value) ? 10 : Math.round(clamp(value, 1, 500));
      }
      var nameInput = editor.root.querySelector('#line-name');
      if (nameInput) editor.draft.name = nameInput.value.slice(0, 40);
    }
    config = normalize(editor.draft);
    persist();
    reset();
    editor = null;
    return true;
  };

  L.cancelEditor = function () {
    editor = null;
  };
})();
