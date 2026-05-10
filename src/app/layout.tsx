import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Suspense } from 'react';
import AnalyticsPageview from '@/components/AnalyticsPageview';
import './globals.css';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-7C3HNJ7QPL';

export const metadata: Metadata = {
  metadataBase: new URL('https://drawny.com'),
  title: 'Drawny - Draw with strangers.',
  description: 'Draw together on a shared canvas. No login, no setup — just draw.',
  keywords: ['drawing', 'collaborative', 'canvas', 'art', 'anonymous', 'real-time'],
  authors: [{ name: 'Drawny' }],
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <body>
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
              `}
            </Script>
            <Suspense fallback={null}>
              <AnalyticsPageview gaId={GA_MEASUREMENT_ID} />
            </Suspense>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
