(function () {
  window.AUTEC = window.AUTEC || {};
  var K = AUTEC.cameras = {};

  var STORAGE_KEY = 'autecVision.cameras.v1';
  var RESOLUTIONS = ['1280x720', '1920x1080', '640x480'];
  var LENSES = [
    { id: 'unknown', label: 'Sin especificar' },
    { id: 'back', label: 'Trasera' },
    { id: 'front', label: 'Frontal' },
    { id: 'external', label: 'Externa / USB' }
  ];

  var formReturn = null;
  var confirmReturnManager = false;

  function esc(value) {
    return AUTEC.utils ? AUTEC.utils.escapeHtml(value) : String(value == null ? '' : value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid() {
    return 'cam-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function icon(name, size) {
    return AUTEC.icon ? AUTEC.icon(name, size) : '';
  }

  function toast(message, type) {
    if (AUTEC.app && typeof AUTEC.app.toast === 'function') {
      AUTEC.app.toast(message, type || 'info');
    }
  }

  function badge(text, tone, opts) {
    return AUTEC.components
      ? AUTEC.components.badge(text, tone, opts)
      : '<span class="badge badge--' + (tone || 'neutral') + '">' + esc(text) + '</span>';
  }

  function normalizeResolution(value) {
    var resolution = String(value || '');
    return RESOLUTIONS.indexOf(resolution) === -1 ? '1280x720' : resolution;
  }

  function normalizeLens(value) {
    var lens = String(value || 'unknown');
    return LENSES.some(function (item) { return item.id === lens; }) ? lens : 'unknown';
  }

  function lensLabel(value) {
    var found = LENSES.filter(function (item) { return item.id === value; })[0];
    return found ? found.label : LENSES[0].label;
  }

  function lensLabelLower(value) {
    var label = lensLabel(value);
    return label.charAt(0).toLowerCase() + label.slice(1);
  }

  function normalizeHost(value) {
    return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  }

  function splitHostPort(hostValue, portValue) {
    var host = normalizeHost(hostValue);
    var port = String(portValue || '4747').trim() || '4747';
    var match = host.match(/^([^:/]+):(\d+)$/);
    if (match) {
      host = match[1];
      if (port === '4747') port = match[2];
    }
    return { host: host, port: port };
  }

  function normalizeProfile(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    var pair = splitHostPort(raw.host, raw.port);
    var fallbackName = 'Cámara ' + (index + 1);
    var name = String(raw.name || fallbackName).trim().slice(0, 40) || fallbackName;
    return {
      id: String(raw.id || uid()),
      name: name,
      host: pair.host,
      port: pair.port,
      resolution: normalizeResolution(raw.resolution),
      lens: normalizeLens(raw.lens),
      notes: String(raw.notes || '').trim().slice(0, 160)
    };
  }

  function profileFromMonitor() {
    var config = AUTEC.monitor && AUTEC.monitor.config ? AUTEC.monitor.config() : {};
    var pair = splitHostPort(config.host, config.port);
    return {
      id: uid(),
      name: String(config.cameraName || 'Cámara principal').trim().slice(0, 40) || 'Cámara principal',
      host: pair.host,
      port: pair.port,
      resolution: normalizeResolution(config.resolution),
      lens: normalizeLens(config.lens),
      notes: ''
    };
  }

  function defaults() {
    var profile = profileFromMonitor();
    return { activeId: profile.id, profiles: [profile] };
  }

  function readStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaults();
      var profiles = Array.isArray(parsed.profiles)
        ? parsed.profiles.map(normalizeProfile).filter(Boolean)
        : [];
      if (!profiles.length) return defaults();
      var activeId = String(parsed.activeId || '');
      var activeExists = profiles.some(function (profile) { return profile.id === activeId; });
      return { activeId: activeExists ? activeId : profiles[0].id, profiles: profiles };
    } catch (_) {
      return defaults();
    }
  }

  var store = readStore();

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (_) {}
  }

  function find(id) {
    return store.profiles.filter(function (profile) { return profile.id === id; })[0] || null;
  }

  function managerOpen() {
    var modal = AUTEC.app && AUTEC.app.state ? AUTEC.app.state.modal : null;
    return !!(modal && String(modal.className || '').indexOf('modal--cameras') !== -1);
  }

  function refreshView() {
    if (AUTEC.app && typeof AUTEC.app.render === 'function') {
      AUTEC.app.render({ preserveScroll: true });
    }
  }

  function refreshAfterChange() {
    if (managerOpen()) K.openManager();
    else refreshView();
  }

  function ensure() {
    if (!Array.isArray(store.profiles)) store.profiles = [];
    if (!store.profiles.length) {
      var created = profileFromMonitor();
      store.profiles.push(created);
      store.activeId = created.id;
      persist();
    }
    if (!find(store.activeId)) {
      store.activeId = store.profiles[0].id;
      persist();
    }

    var active = find(store.activeId);
    var config = AUTEC.monitor && AUTEC.monitor.config ? AUTEC.monitor.config() : null;
    if (!active || !config) return;

    if (config.host) {
      var configName = String(config.cameraName || '').trim().slice(0, 40);
      var configLens = normalizeLens(config.lens);
      if (active.host !== normalizeHost(config.host)
        || active.port !== (String(config.port || '4747').trim() || '4747')
        || active.resolution !== normalizeResolution(config.resolution)
        || active.lens !== configLens
        || active.name !== configName) {
        K.syncActive(config);
      }
    } else if (active.host && AUTEC.monitor && typeof AUTEC.monitor.saveConfig === 'function') {
      AUTEC.monitor.saveConfig(active);
    }
  }

  K.syncActive = function (config) {
    if (!config) return;
    var active = find(store.activeId);
    if (!active) {
      active = profileFromMonitor();
      store.profiles.push(active);
      store.activeId = active.id;
    }
    var pair = splitHostPort(config.host, config.port);
    active.name = String(config.cameraName || active.name || 'Cámara principal').trim().slice(0, 40) || 'Cámara principal';
    active.host = pair.host;
    active.port = pair.port;
    active.resolution = normalizeResolution(config.resolution);
    active.lens = normalizeLens(config.lens);
    persist();
  };

  function applyToMonitor(profile, opts) {
    opts = opts || {};
    if (!AUTEC.monitor) return;
    var previous = AUTEC.monitor.config();
    var changed = previous.host !== profile.host
      || previous.port !== profile.port
      || previous.resolution !== profile.resolution;
    var wasConnected = AUTEC.monitor.isConnected();

    if (changed && wasConnected) AUTEC.monitor.disconnect();

    AUTEC.monitor.saveConfig({
      host: profile.host,
      port: profile.port,
      resolution: profile.resolution,
      cameraName: profile.name,
      lens: profile.lens,
      autoReconnect: previous.autoReconnect
    });

    if (AUTEC.store && AUTEC.store.monitoring) {
      AUTEC.store.monitoring.camera = 'DroidCam · ' + profile.name;
      AUTEC.store.monitoring.resolution = profile.resolution.replace('x', ' × ');
    }

    if (profile.host && (opts.connect || wasConnected)) {
      AUTEC.monitor.connect();
    }

    if (!opts.skipLens && profile.host && profile.lens && profile.lens !== 'unknown') {
      requestLens(profile, { silent: true, reconnect: false }).then(function (data) {
        if (!data || !data.changed) return;
        var monitorState = AUTEC.monitor.state ? AUTEC.monitor.state() : null;
        if (monitorState && (monitorState.connected || monitorState.connecting)) {
          AUTEC.monitor.connect();
        }
      });
    }
  }

  K.all = function () {
    ensure();
    return clone(store.profiles);
  };

  K.activeId = function () {
    ensure();
    return store.activeId;
  };

  K.active = function () {
    ensure();
    return clone(find(store.activeId));
  };

  K.lensLabel = lensLabel;

  K.lensLabelLower = function (value) {
    var label = lensLabel(value);
    return label.charAt(0).toLowerCase() + label.slice(1);
  };

  K.lenses = function () {
    return clone(LENSES);
  };

  K.resolutions = function () {
    return RESOLUTIONS.slice();
  };

  K.saveProfile = function (fd) {
    var id = String(fd.get('id') || '').trim();
    var name = String(fd.get('name') || '').trim();
    if (!name) {
      toast('Poné un nombre para identificar la cámara', 'danger');
      return false;
    }

    var pair = splitHostPort(fd.get('host'), fd.get('port'));
    var data = {
      name: name.slice(0, 40),
      host: pair.host,
      port: pair.port,
      resolution: normalizeResolution(fd.get('resolution')),
      lens: normalizeLens(fd.get('lens')),
      notes: String(fd.get('notes') || '').trim().slice(0, 160)
    };

    var existing = find(id);
    var previousLens = existing ? existing.lens : null;
    if (existing) {
      existing.name = data.name;
      existing.host = data.host;
      existing.port = data.port;
      existing.resolution = data.resolution;
      existing.lens = data.lens;
      existing.notes = data.notes;
    } else {
      id = uid();
      store.profiles.push({
        id: id,
        name: data.name,
        host: data.host,
        port: data.port,
        resolution: data.resolution,
        lens: data.lens,
        notes: data.notes
      });
      if (!store.activeId) store.activeId = id;
    }
    persist();

    var saved = find(id);
    var returnToManager = formReturn === 'manager';
    formReturn = null;
    if (AUTEC.app && AUTEC.app.closeModal) AUTEC.app.closeModal();

    if (saved && saved.id === store.activeId) {
      applyToMonitor(saved, { connect: false, skipLens: true });
    }

    toast('Cámara guardada: ' + saved.name, 'success');
    if (saved && saved.host && data.lens !== 'unknown' && data.lens !== previousLens) {
      requestLens(saved, { reconnect: true });
    }
    if (returnToManager) K.openManager();
    else refreshView();
    return true;
  };

  K.activate = function (id, opts) {
    opts = opts || {};
    ensure();
    var profile = find(id);
    if (!profile) return false;

    store.activeId = profile.id;
    persist();
    applyToMonitor(profile, { connect: opts.connect !== false });
    toast(
      profile.host
        ? 'Cámara activa: ' + profile.name + ' · conectando…'
        : 'Cámara activa: ' + profile.name + ' (sin IP configurada)',
      profile.host ? 'info' : 'warning'
    );

    if (managerOpen()) K.openManager();
    else refreshView();

    if (!profile.host && opts.openForm !== false) K.openForm(profile.id);
    return true;
  };

  K.remove = function (id) {
    ensure();
    var profile = find(id);
    if (!profile) return;
    if (store.profiles.length <= 1) {
      toast('Necesitás al menos una cámara configurada', 'warning');
      return;
    }

    confirmReturnManager = managerOpen();
    if (AUTEC.app && AUTEC.app.openModal) {
      AUTEC.app.openModal({
        title: 'Eliminar cámara',
        subtitle: profile.name,
        className: 'modal--camera-confirm',
        body: '<div class="form-note">' + icon('alert', 14)
          + '<span>Se eliminará el perfil <strong>' + esc(profile.name) + '</strong>. Las zonas y alertas se mantienen; solo se borra esta fuente de video.</span></div>',
        foot: '<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button>'
          + '<button type="button" class="btn btn-danger" data-action="confirm-remove-camera" data-camera="' + esc(profile.id) + '">Eliminar cámara</button>'
      });
    }
  };

  K.confirmRemove = function (id) {
    ensure();
    var profile = find(id);
    if (!profile) return;
    if (store.profiles.length <= 1) {
      toast('Necesitás al menos una cámara configurada', 'warning');
      return;
    }

    var returnToManager = confirmReturnManager;
    confirmReturnManager = false;
    var wasActive = store.activeId === id;
    var wasConnected = !!(AUTEC.monitor && AUTEC.monitor.isConnected());

    store.profiles = store.profiles.filter(function (item) { return item.id !== id; });
    if (wasActive) {
      store.activeId = store.profiles[0].id;
      persist();
      applyToMonitor(store.profiles[0], { connect: wasConnected });
    } else {
      persist();
    }

    if (AUTEC.app && AUTEC.app.closeModal) AUTEC.app.closeModal();
    toast('Cámara eliminada: ' + profile.name, 'success');
    if (returnToManager) K.openManager();
    else refreshView();
  };

  K.probe = function (id) {
    ensure();
    var profile = find(id);
    if (!profile) return;
    if (!profile.host) {
      toast('Completá la IP del teléfono para probar la conexión', 'warning');
      return;
    }
    if (!AUTEC.monitor || typeof AUTEC.monitor.api !== 'function') return;

    toast('Probando ' + profile.name + '…', 'info');
    var url = AUTEC.monitor.api('/api/probe?host=' + encodeURIComponent(profile.host)
      + '&port=' + encodeURIComponent(profile.port)
      + '&res=' + encodeURIComponent(profile.resolution)
      + '&t=' + Date.now());

    fetch(url, { cache: 'no-store' })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          throw new Error(result.data.error || 'No se pudo conectar con la cámara.');
        }
        toast('Conexión correcta: ' + profile.name + ' · ' + profile.resolution.replace('x', ' × '), 'success');
      })
      .catch(function (error) {
        toast(error.message || 'No se pudo conectar con la cámara.', 'danger');
      });
  };

  function requestLens(profile, opts) {
    opts = opts || {};
    if (!profile) return Promise.resolve(null);
    if (!profile.host) {
      if (!opts.silent) toast('Completá la IP del teléfono para cambiar el lente', 'warning');
      return Promise.resolve(null);
    }
    if (!AUTEC.monitor || typeof AUTEC.monitor.api !== 'function') return Promise.resolve(null);

    return fetch(AUTEC.monitor.api('/api/camera/lens'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: profile.host,
        port: profile.port,
        lens: profile.lens
      })
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        var data = result.data || {};
        if (!result.ok || data.ok === false) {
          throw new Error(data.error || 'No se pudo cambiar el lente.');
        }
        if (!data.supported) {
          if (!opts.silent) {
            toast(data.message || 'DroidCam clásico no permite cambiar de lente por HTTP.', 'warning');
          }
          return data;
        }
        if (data.changed) {
          if (!opts.silent) toast(data.message || ('Lente cambiado: ' + lensLabel(profile.lens)), 'success');
          if (opts.reconnect !== false && AUTEC.monitor && AUTEC.monitor.isConnected()) {
            setTimeout(function () { AUTEC.monitor.connect(); }, 350);
          }
        } else if (!opts.silent) {
          toast(data.message || 'El lente ya estaba activo en el teléfono', 'info');
        }
        return data;
      })
      .catch(function (error) {
        if (!opts.silent) toast(error.message || 'No se pudo cambiar el lente', 'danger');
        return null;
      });
  }

  K.applyLens = function (id, opts) {
    ensure();
    var profile = find(id);
    if (!profile) return null;
    if (profile.lens === 'unknown') {
      toast('Elegí frontal, trasera o externa en el perfil para cambiar el lente', 'warning');
      return null;
    }
    if (!profile.host) {
      toast('Completá la IP del teléfono para cambiar el lente', 'warning');
      return null;
    }
    toast('Solicitando cambio de lente a ' + profile.name + '…', 'info');
    return requestLens(profile, opts || {});
  };

  K.openManager = function () {
    ensure();
    if (!AUTEC.app || typeof AUTEC.app.openModal !== 'function') return;
    // Refrescar la vista de fondo para que el selector de camaras refleje
    // los perfiles nuevos o eliminados al cerrar el gestor.
    refreshView();

    var activeId = store.activeId;
    var profilesHtml = store.profiles.map(function (profile) {
      var isActive = profile.id === activeId;
      var host = profile.host
        ? profile.host + (profile.port ? ':' + profile.port : '')
        : 'Sin IP configurada';
      return '<div class="camera-profile' + (isActive ? ' is-active' : '') + '">'
        + '<div class="camera-profile-main">'
        + '<span class="camera-profile-icon">' + icon('camera', 18) + '</span>'
        + '<div class="camera-profile-copy">'
        + '<strong>' + esc(profile.name) + '</strong>'
        + '<span>' + esc(host) + ' · ' + esc(profile.resolution.replace('x', ' × ')) + ' · Lente ' + esc(lensLabelLower(profile.lens)) + '</span>'
        + (profile.notes ? '<span class="camera-profile-notes">' + esc(profile.notes) + '</span>' : '')
        + '</div>'
        + (isActive ? badge('Activa', 'success', { dot: true }) : '')
        + '</div>'
        + '<div class="camera-profile-actions">'
        + (isActive ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-action="activate-camera" data-camera="' + esc(profile.id) + '">Usar</button>')
        + '<button type="button" class="btn btn-ghost btn-sm" data-action="probe-camera" data-camera="' + esc(profile.id) + '">Probar</button>'
        + (profile.host && profile.lens !== 'unknown'
          ? '<button type="button" class="btn btn-ghost btn-sm" data-action="apply-camera-lens" data-camera="' + esc(profile.id) + '" title="Aplicar el lente seleccionado en el teléfono">' + icon('refresh', 13) + ' Lente</button>'
          : '')
        + '<button type="button" class="btn btn-ghost btn-sm" data-action="open-camera-form" data-camera="' + esc(profile.id) + '">Editar</button>'
        + '<button type="button" class="icon-btn is-danger" data-action="remove-camera" data-camera="' + esc(profile.id) + '" aria-label="Eliminar ' + esc(profile.name) + '">' + icon('trash', 15) + '</button>'
        + '</div>'
        + '</div>';
    }).join('');

    AUTEC.app.openModal({
      title: 'Cámaras y ángulos',
      subtitle: 'Elegí qué fuente de DroidCam se muestra en el monitoreo.',
      wide: true,
      className: 'modal--cameras',
      body: '<div class="camera-manager">'
        + '<div class="camera-manager-toolbar">'
        + '<span class="muted small">' + store.profiles.length + (store.profiles.length === 1 ? ' perfil guardado' : ' perfiles guardados') + '. Solo se monitorea la cámara activa.</span>'
        + '<button type="button" class="btn btn-ghost btn-sm" data-action="camera-swap-help">' + icon('help', 14) + ' Cambiar lente en el teléfono</button>'
        + '</div>'
        + '<div class="camera-profile-list">' + profilesHtml + '</div>'
        + '<div class="form-note">' + icon('info', 14)
        + '<span>DroidCam entrega un solo stream por vez. Para sumar otro ángulo, agregá un perfil con la IP y el puerto de otro teléfono o de otra instancia de DroidCam. Las zonas se comparten entre perfiles. Con <strong>DroidCam OBS</strong>, el botón Lente cambia la cámara del teléfono por su API v1; con DroidCam clásico usá Camera Swap en el móvil.</span></div>'
        + '</div>',
      foot: '<button type="button" class="btn btn-ghost" data-action="close-modal">Cerrar</button>'
        + '<button type="button" class="btn btn-primary" data-action="open-camera-form">' + icon('plus', 15) + ' Nueva cámara</button>'
    });
  };

  K.openForm = function (id) {
    ensure();
    if (!AUTEC.app || typeof AUTEC.app.openModal !== 'function') return;
    formReturn = managerOpen() ? 'manager' : 'monitor';

    var profile = id ? find(id) : null;
    var isNew = !profile;
    if (!profile) {
      profile = {
        id: '',
        name: 'Cámara ' + (store.profiles.length + 1),
        host: '',
        port: '4747',
        resolution: '1280x720',
        lens: 'unknown',
        notes: ''
      };
    }

    var resolutionOptions = RESOLUTIONS.map(function (value) {
      return '<option value="' + value + '"' + (profile.resolution === value ? ' selected' : '') + '>' + value.replace('x', ' × ') + '</option>';
    }).join('');
    var lensOptions = LENSES.map(function (item) {
      return '<option value="' + item.id + '"' + (profile.lens === item.id ? ' selected' : '') + '>' + item.label + '</option>';
    }).join('');

    AUTEC.app.openModal({
      title: isNew ? 'Nueva cámara' : 'Editar cámara',
      subtitle: isNew ? 'Agregá otro teléfono, ángulo o lente.' : profile.name,
      form: 'camera-profile',
      submitLabel: 'Guardar cámara',
      className: 'modal--camera-form',
      body: '<div class="form-grid">'
        + '<input type="hidden" name="id" value="' + esc(profile.id) + '">'
        + '<div class="field"><label for="camera-profile-name">Nombre</label><input class="input" id="camera-profile-name" name="name" value="' + esc(profile.name) + '" maxlength="40" placeholder="Entrada principal" autocomplete="off"></div>'
        + '<div class="field-row">'
        + '<div class="field"><label for="camera-profile-host">IP o URL de DroidCam</label><input class="input" id="camera-profile-host" name="host" value="' + esc(profile.host) + '" placeholder="192.168.1.42" autocomplete="off"></div>'
        + '<div class="field"><label for="camera-profile-port">Puerto</label><input class="input" id="camera-profile-port" name="port" value="' + esc(profile.port) + '" placeholder="4747" autocomplete="off"></div>'
        + '</div>'
        + '<div class="field-row">'
        + '<div class="field"><label for="camera-profile-resolution">Resolución</label><select class="select" id="camera-profile-resolution" name="resolution">' + resolutionOptions + '</select></div>'
        + '<div class="field"><label for="camera-profile-lens">Lente</label><select class="select" id="camera-profile-lens" name="lens">' + lensOptions + '</select></div>'
        + '</div>'
        + '<div class="field"><label for="camera-profile-notes">Notas o ángulo</label><input class="input" id="camera-profile-notes" name="notes" value="' + esc(profile.notes) + '" maxlength="160" placeholder="Ej. entrada, patio, caja 2" autocomplete="off"></div>'
        + '<div class="form-note">' + icon('info', 14)
        + '<span>Con DroidCam OBS, al guardar el perfil VigIA intenta cambiar el lente por su API v1. Con DroidCam clásico el lente se cambia con <strong>Camera Swap</strong> en el móvil y se guarda como referencia.</span></div>'
        + '<div class="inline-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="camera-swap-help">' + icon('help', 14) + ' ¿Cómo cambiar de lente?</button></div>'
        + '</div>'
    });
  };

  K.openLensHelp = function () {
    if (!AUTEC.app || typeof AUTEC.app.openModal !== 'function') return;
    var fromManager = managerOpen();
    AUTEC.app.openModal({
      title: 'Cambiar entre cámara frontal y trasera',
      subtitle: 'DroidCam · cambio de lente',
      className: 'modal--camera-help',
      body: '<div class="camera-help">'
        + '<ol class="camera-help-list">'
        + '<li><strong>DroidCam OBS:</strong> editá el perfil, elegí el lente y guardá. VigIA consulta la lista de cámaras del teléfono y activa el lente por la API v1. También podés usar el botón <strong>Lente</strong> en el gestor.</li>'
        + '<li><strong>DroidCam clásico:</strong> abrí la app en el teléfono y tocá <strong>Camera Swap</strong> (o el botón de rotar cámara) para pasar de frontal a trasera.</li>'
        + '<li>Después actualizá el lente del perfil para identificarlo. La IP y el puerto no cambian.</li>'
        + '</ol>'
        + '<div class="form-note">' + icon('info', 14)
        + '<span>DroidCam clásico no expone un endpoint HTTP para cambiar de lente; el cambio real se hace desde la app del teléfono. DroidCam OBS sí permite hacerlo desde VigIA con su API v1.</span></div>'
        + '</div>',
      foot: '<button type="button" class="btn btn-ghost" data-action="close-modal">Entendido</button>'
        + (fromManager ? '<button type="button" class="btn btn-primary" data-action="open-camera-manager">Volver a cámaras</button>' : '')
    });
  };

  ensure();
})();
