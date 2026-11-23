// Next.js solo sirve la interfaz. Toda la logica de negocio, Supabase,
// autenticacion y camara sigue viviendo en server.py (puerto 8000).
const backend = process.env.VIGIA_API_ORIGIN || 'http://127.0.0.1:8000';

const rewrites = [
  { source: '/api/:path*', destination: `${backend}/api/:path*` },
  { source: '/stream', destination: `${backend}/stream` },
  { source: '/snapshot', destination: `${backend}/snapshot` },
  { source: '/favicon.ico', destination: `${backend}/favicon.ico` },
  // La UI legacy todavia no es ESM: se sirve tal cual desde Python.
  { source: '/legacy/js/:path*', destination: `${backend}/js/:path*` },
  { source: '/legacy/css/:path*', destination: `${backend}/css/:path*` },
  // components.js y los editores usan rutas relativas 'assets/...'.
  { source: '/assets/:path*', destination: `${backend}/assets/:path*` }
];

export default {
  poweredByHeader: false,
  rewrites: async () => rewrites
};
