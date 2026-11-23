(function () {
  window.AUTEC = window.AUTEC || {};

  AUTEC.boot = {
    ready: false,
    source: 'loading',
    error: '',
    authenticated: false,
    promise: null
  };

  function applyProfile(profile) {
    AUTEC.boot.authenticated = !!profile;
    if (!profile || !AUTEC.app || !AUTEC.app.state) return;

    AUTEC.app.state.auth = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      companyId: profile.companyId || profile.company_id || null,
      profile: profile
    };

    if (profile.role !== 'creator' && profile.companyId && AUTEC.supabase) {
      AUTEC.supabase.saveCaptureContext(profile.companyId, '');
    }
  }

  function start() {
    if (!AUTEC.supabase || !AUTEC.supabase.init) {
      AUTEC.boot.ready = true;
      AUTEC.app && AUTEC.app.render && AUTEC.app.render();
      return Promise.resolve();
    }

    // La sesión se restaura desde la cookie HttpOnly; no se guarda en
    // localStorage ni se finge un usuario. Se comprueba antes de iniciar para
    // que la sincronización de configuración ya sepa si hay sesión activa.
    var sessionCheck = AUTEC.supabase.me ? AUTEC.supabase.me() : Promise.resolve(null);

    return sessionCheck
      .then(function (profile) {
        applyProfile(profile);
        return AUTEC.supabase.init();
      })
      .then(function () {
        var profile = AUTEC.supabase.profile;
        AUTEC.boot.ready = true;
        AUTEC.boot.source = AUTEC.supabase.source;
        AUTEC.boot.error = AUTEC.supabase.lastError;
        if (AUTEC.supabase.configured && AUTEC.app && AUTEC.app.currentCompany && !profile) {
          var company = AUTEC.app.currentCompany();
          if (company) AUTEC.supabase.saveCaptureContext(company.id, '');
        }
        AUTEC.app && AUTEC.app.render && AUTEC.app.render();
      })
      .catch(function (error) {
        AUTEC.boot.ready = true;
        AUTEC.boot.source = 'error';
        AUTEC.boot.error = (error && error.message) || String(error);
        AUTEC.app && AUTEC.app.render && AUTEC.app.render();
      });
  }

  // Los scripts van al final del body: al ejecutarse este archivo ya existe
  // todo el código de la app, incluido AUTEC.app.
  AUTEC.boot.promise = start();
})();
