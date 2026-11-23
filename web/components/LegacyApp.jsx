'use client';

import { useEffect, useState } from 'react';

// Orden literal de mockup/index.html. No cambiar: los modulos capturan
// referencias a AUTEC.* al cargarse y dependen de este orden.
const SCRIPTS = [
  '/legacy/js/icons.js',
  '/legacy/js/utils.js',
  '/legacy/js/data.js',
  '/legacy/js/supabase.js',
  '/legacy/js/components.js',
  '/legacy/js/zones.js',
  '/legacy/js/lines.js',
  '/legacy/js/heatmap.js',
  '/legacy/js/epp.js',
  '/legacy/js/tables.js',
  '/legacy/js/falls.js',
  '/legacy/js/areas.js',
  '/legacy/js/monitor.js',
  '/legacy/js/cameras.js',
  '/legacy/js/views-public.js',
  '/legacy/js/views-admin.js',
  '/legacy/js/views-company.js',
  '/legacy/js/app.js',
  '/legacy/js/boot.js',
  '/legacy/js/splash.js'
];

let scriptsPromise = null;

function appendScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.body.appendChild(script);
  });
}

function loadLegacyScripts() {
  if (!scriptsPromise) {
    scriptsPromise = SCRIPTS.reduce(
      (chain, src) => chain.then(() => appendScript(src)),
      Promise.resolve()
    ).catch((error) => {
      scriptsPromise = null;
      throw error;
    });
  }
  return scriptsPromise;
}

export default function LegacyApp() {
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadLegacyScripts().catch((err) => {
      if (active) setError(err.message || String(err));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div data-vigia-next="1">
      <div className="splash" id="splash" role="status" aria-live="polite" aria-label="Iniciando VigIA">
        <div className="splash-grid" aria-hidden="true" />
        <div className="splash-glow" aria-hidden="true" />
        <div className="splash-center">
          <div className="splash-mark" aria-hidden="true">
            <svg viewBox="0 0 120 120" fill="none">
              <defs>
                <clipPath id="splash-eye-clip">
                  <path d="M25 60c9.5-13 20.6-20 35-20s25.5 7 35 20c-9.5 13-20.6 20-35 20s-25.5-7-35-20Z" />
                </clipPath>
              </defs>
              <rect className="splash-frame" x="9" y="9" width="102" height="102" rx="26" />
              <path className="splash-bracket splash-bracket--tl" d="M25 37V30a5 5 0 0 1 5-5h7" />
              <path className="splash-bracket splash-bracket--tr" d="M95 37V30a5 5 0 0 0-5-5h-7" />
              <path className="splash-bracket splash-bracket--bl" d="M25 83v7a5 5 0 0 0 5 5h7" />
              <path className="splash-bracket splash-bracket--br" d="M95 83v7a5 5 0 0 1-5 5h-7" />
              <circle className="splash-orbit" cx="60" cy="60" r="35" />
              <path className="splash-eye" d="M25 60c9.5-13 20.6-20 35-20s25.5 7 35 20c-9.5 13-20.6 20-35 20s-25.5-7-35-20Z" />
              <circle className="splash-pupil" cx="60" cy="60" r="9" />
              <circle className="splash-pupil-core" cx="60" cy="60" r="3.5" />
              <path className="splash-scan" clipPath="url(#splash-eye-clip)" d="M18 42h84" />
            </svg>
          </div>
          <div className="splash-brand">VIG<span>IA</span></div>
          <p className="splash-tagline">Visión artificial · Vigía inteligente</p>
          <div className="splash-progress"><span /></div>
          <div className="splash-status mono">Iniciando plataforma<i className="splash-dots"><b>.</b><b>.</b><b>.</b></i></div>
        </div>
        <div className="splash-foot"><span className="mono">VIGIA</span><span className="mono">v0.5.0 · SUPABASE</span></div>
      </div>

      <noscript>
        <style>{'#splash { display: none !important; } body.is-splashing { overflow: auto !important; }'}</style>
      </noscript>

      <div id="app" />
      <div id="modal-root" />
      <div id="toast-root" role="status" aria-live="polite" />
      <div id="demo-root" />

      {error ? <div className="vigia-load-error">Error al iniciar la interfaz: {error}</div> : null}
    </div>
  );
}
