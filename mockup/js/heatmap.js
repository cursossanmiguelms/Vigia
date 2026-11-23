(function () {
  window.AUTEC = window.AUTEC || {};
  var H = AUTEC.heatmap = {};

  var STORAGE_KEY = 'autecVision.heatmap.v1';
  var GRID_W = 48;
  var GRID_H = 27;
  var MAX_POINTS = 24000;

  var config = read();
  var cells = {};
  var points = 0;
  var max = 0;

  function defaults() {
    return { enabled: false, opacity: 0.72 };
  }

  function read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      var parsed = JSON.parse(raw);
      return {
        enabled: parsed && parsed.enabled === true,
        opacity: 0.72
      };
    } catch (_) {
      return defaults();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: config.enabled }));
    } catch (_) {}
  }

  H.config = function () {
    return { enabled: config.enabled, opacity: config.opacity, grid: { w: GRID_W, h: GRID_H } };
  };

  H.stats = function () {
    return {
      enabled: config.enabled,
      points: points,
      cells: Object.keys(cells).length,
      max: max,
      gridW: GRID_W,
      gridH: GRID_H
    };
  };

  H.setEnabled = function (enabled) {
    config.enabled = !!enabled;
    persist();
  };

  H.reset = function () {
    cells = {};
    points = 0;
    max = 0;
  };

  H.add = function (detections, width, height) {
    if (!config.enabled || !width || !height || !Array.isArray(detections)) return H.stats();

    detections.forEach(function (det) {
      var x1 = Number(det.x1) || 0;
      var x2 = Number(det.x2) || 0;
      var y2 = Number(det.y2) || 0;
      var px = ((x1 + x2) / 2) / width;
      var py = y2 / height;
      if (px < 0 || px > 1 || py < 0 || py > 1) return;
      var gx = Math.min(GRID_W - 1, Math.floor(px * GRID_W));
      var gy = Math.min(GRID_H - 1, Math.floor(py * GRID_H));
      var key = gx + ',' + gy;
      cells[key] = (cells[key] || 0) + 1;
      points += 1;
      if (cells[key] > max) max = cells[key];
    });

    if (points > MAX_POINTS) {
      Object.keys(cells).forEach(function (key) {
        cells[key] = Math.floor(cells[key] / 2);
        if (cells[key] <= 0) delete cells[key];
      });
      points = Math.floor(points / 2);
      max = 0;
      Object.keys(cells).forEach(function (key) {
        if (cells[key] > max) max = cells[key];
      });
    }

    return H.stats();
  };

  H.render = function (canvas, rect) {
    if (!canvas || !rect || !rect.w || !rect.h) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = Math.max(1, Math.round(rect.w));
    canvas.height = Math.max(1, Math.round(rect.h));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!config.enabled || !max) return;

    var cellW = canvas.width / GRID_W;
    var cellH = canvas.height / GRID_H;
    var radius = Math.max(cellW, cellH) * 1.35;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    Object.keys(cells).forEach(function (key) {
      var parts = key.split(',');
      var gx = Number(parts[0]);
      var gy = Number(parts[1]);
      var count = cells[key];
      if (!count) return;
      var intensity = Math.min(1, count / max);
      if (intensity < 0.04) return;
      var cx = (gx + 0.5) * cellW;
      var cy = (gy + 0.5) * cellH;
      var hue = 190 - 190 * intensity;
      var alpha = (0.08 + intensity * 0.62) * config.opacity;
      var gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, 'hsla(' + hue + ', 95%, 58%, ' + alpha + ')');
      gradient.addColorStop(0.55, 'hsla(' + hue + ', 95%, 52%, ' + (alpha * 0.55) + ')');
      gradient.addColorStop(1, 'hsla(' + hue + ', 95%, 48%, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    });
    ctx.restore();
  };
})();
