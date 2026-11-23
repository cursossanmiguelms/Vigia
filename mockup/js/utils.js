(function () {
  window.AUTEC = window.AUTEC || {};

  // Reloj real: las fechas se comparan contra hoy, no contra una fecha fija.
  var TODAY = new Date();

  // El modo demo es opt-in explicito (?demo=1 o localStorage vigia.demo=1).
  // Sin este flag la aplicacion trabaja solo con datos de Supabase.
  var DEMO_MODE = (function () {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('demo') === '1'
        || window.localStorage.getItem('vigia.demo') === '1'
        || window.localStorage.getItem('autecVision.demoMode') === '1';
    } catch (_) {
      return false;
    }
  })();

  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'AV';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    var d = new Date(String(value) + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(value, short) {
    var d = parseDate(value);
    if (!d) return '—';
    var day = String(d.getDate()).padStart(2, '0');
    var month = MONTHS[d.getMonth()];
    var year = d.getFullYear();
    return short ? day + ' ' + month : day + ' ' + month + ' ' + year;
  }

  function daysUntil(value) {
    var d = parseDate(value);
    if (!d) return null;
    return Math.ceil((d.getTime() - TODAY.getTime()) / 86400000);
  }

  function expiryMeta(value) {
    var days = daysUntil(value);
    if (days === null) return { text: '—', tone: 'neutral' };
    if (days < 0) return { text: 'Vencida hace ' + Math.abs(days) + ' d', tone: 'danger' };
    if (days === 0) return { text: 'Vence hoy', tone: 'warning' };
    if (days <= 15) return { text: 'En ' + days + ' d', tone: 'warning' };
    return { text: 'En ' + days + ' d', tone: 'neutral' };
  }

  function currency(value) {
    return 'US$ ' + Number(value || 0).toLocaleString('es-AR');
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normalizeEmailPart(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '');
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 9);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function roleLabel(role) {
    return {
      creator: 'Creador',
      company_admin: 'Admin empresa',
      supervisor: 'Supervisor',
      operator: 'Operador'
    }[role] || role;
  }

  function statusLabel(status) {
    return {
      active: 'Activa',
      trial: 'Prueba',
      expired: 'Vencida',
      suspended: 'Suspendida',
      inactive: 'Inactivo'
    }[status] || status;
  }

  function statusTone(status) {
    return {
      active: 'success',
      trial: 'warning',
      expired: 'danger',
      suspended: 'neutral',
      inactive: 'neutral'
    }[status] || 'neutral';
  }

  function skillStatusLabel(status) {
    return {
      available: 'Disponible',
      training: 'En entrenamiento',
      soon: 'Próximamente'
    }[status] || status;
  }

  function skillStatusTone(status) {
    return {
      available: 'success',
      training: 'warning',
      soon: 'neutral'
    }[status] || 'neutral';
  }

  function requestTypeLabel(type) {
    return {
      company: 'Nueva empresa',
      skill: 'Skill',
      seats: 'Usuarios',
      renewal: 'Renovación',
      plan: 'Cambio de plan'
    }[type] || type;
  }

  function requestTypeTone(type) {
    return {
      company: 'info',
      skill: 'accent',
      seats: 'warning',
      renewal: 'success',
      plan: 'accent'
    }[type] || 'neutral';
  }

  function requestStatusLabel(status) {
    return {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada'
    }[status] || status;
  }

  function requestStatusTone(status) {
    return {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger'
    }[status] || 'neutral';
  }

  function actionTone(type) {
    return {
      create: 'success',
      update: 'info',
      delete: 'danger',
      login: 'neutral',
      payment: 'success',
      request: 'warning',
      system: 'neutral'
    }[type] || 'neutral';
  }

  function actionIcon(type) {
    return {
      create: 'plus',
      update: 'refresh',
      delete: 'ban',
      login: 'logout',
      payment: 'money',
      request: 'inbox',
      system: 'server'
    }[type] || 'activity';
  }

  AUTEC.utils = {
    TODAY: TODAY,
    DEMO_MODE: DEMO_MODE,
    MONTHS: MONTHS,
    escapeHtml: escapeHtml,
    initials: initials,
    parseDate: parseDate,
    formatDate: formatDate,
    daysUntil: daysUntil,
    expiryMeta: expiryMeta,
    currency: currency,
    slugify: slugify,
    normalizeEmailPart: normalizeEmailPart,
    uid: uid,
    clamp: clamp,
    roleLabel: roleLabel,
    statusLabel: statusLabel,
    statusTone: statusTone,
    skillStatusLabel: skillStatusLabel,
    skillStatusTone: skillStatusTone,
    requestTypeLabel: requestTypeLabel,
    requestTypeTone: requestTypeTone,
    requestStatusLabel: requestStatusLabel,
    requestStatusTone: requestStatusTone,
    actionTone: actionTone,
    actionIcon: actionIcon
  };
})();
