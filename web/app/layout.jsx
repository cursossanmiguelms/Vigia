import './globals.css';

export const metadata = {
  title: 'VigIA · Monitoreo inteligente',
  description: 'VigIA · Plataforma de monitoreo inteligente asistido por IA.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" data-accent="cyan" data-density="compact">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/legacy/css/autec.css" />
      </head>
      <body className="is-splashing">{children}</body>
    </html>
  );
}
