(function () {
  window.AUTEC = window.AUTEC || {};

  AUTEC.boot = {
    ready: false,
    source: 'demo',
    error: '',
    promise: null
  };

  function start() {
    if (!AUTEC.supabase || !AUTEC.supabase.init) {
      AUTEC.boot.ready = true;
      AUTEC.app && AUTEC.app.render && AUTEC.app.render();
      return Promise.resolve();
    }
    return AUTEC.supabase.init().then(function () {
      AUTEC.boot.ready = true;
      AUTEC.boot.source = AUTEC.supabase.source;
      AUTEC.boot.error = AUTEC.supabase.lastError;
      if (AUTEC.supabase.configured && AUTEC.app && AUTEC.app.currentCompany) {
        var company = AUTEC.app.currentCompany();
        if (company) AUTEC.supabase.saveCaptureContext(company.id, '');
      }
      AUTEC.app && AUTEC.app.render && AUTEC.app.render();
    });
  }

  // Los scripts van al final del body: al ejecutarse este archivo ya existe
  // todo el código de la app, incluido AUTEC.app.
  AUTEC.boot.promise = start();
})();
