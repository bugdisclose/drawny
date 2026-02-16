import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://drawny.com'),
  title: 'Drawny - Draw with strangers.',
  description: 'Draw together on a shared canvas. No login, no setup — just draw.',
  keywords: ['drawing', 'collaborative', 'canvas', 'art', 'anonymous', 'real-time'],
  authors: [{ name: 'Drawny' }],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  openGraph: {
    title: 'Drawny - Draw with strangers.',
    description: 'Draw together on a shared canvas. No login, no setup — just draw.',
    type: 'website',
    url: 'https://drawny.com',
    siteName: 'Drawny',
    images: [
      {
        url: '/og-image.png',
        width: 1024,
        height: 1024,
        alt: 'Drawny - Draw with strangers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drawny - Draw with strangers.',
    description: 'Draw together on a shared canvas. No login, no setup — just draw.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
