(function () {
  var splash = document.getElementById('splash');
  if (!splash) {
    document.body.classList.remove('is-splashing');
    return;
  }

  var reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var holdMs = reduceMotion ? 1300 : 2900;
  var fadeMs = reduceMotion ? 180 : 620;
  var finished = false;
  var timer = null;

  function finish() {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    splash.classList.add('is-leaving');
    window.setTimeout(function () {
      splash.hidden = true;
      if (splash.parentNode) splash.parentNode.removeChild(splash);
      document.body.classList.remove('is-splashing');
      document.documentElement.classList.add('splash-done');
      window.dispatchEvent(new CustomEvent('autec:splash-done'));
    }, fadeMs);
  }

  timer = window.setTimeout(finish, holdMs);

  // Permitir salir de la animación con un clic o una tecla, sin esperar.
  splash.addEventListener('click', finish);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') finish();
  }, { once: true });
})();
