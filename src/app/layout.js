import './globals.css'

export const metadata = {
  title: 'คิดว่า.. - Prediction Platform',
  description: 'แพลตฟอร์มที่จะกระตุกความคิดของคุณ แล้วคุณล่ะ คิดว่า..',
  keywords: 'prediction, poll, vote, ทำนาย, โพล, โหวต, คิดว่า',
  authors: [{ name: 'Kidwa Team' }],
  creator: 'Kidwa',
  publisher: 'Kidwa',
  manifest: '/manifest.json',
  themeColor: '#ec4899',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'คิดว่า..',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    url: 'https://kidwa.vercel.app',
    siteName: 'คิดว่า..',
    title: 'คิดว่า.. - Prediction Platform',
    description: 'แพลตฟอร์มที่จะกระตุกความคิดของคุณ แล้วคุณล่ะ คิดว่า..',
    images: [
      {
        url: '/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'คิดว่า.. Logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'คิดว่า.. - Prediction Platform',
    description: 'แพลตฟอร์มที่จะให้คุณคิดว่า..',
    images: ['/icons/icon-512x512.png'],
  },
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ec4899" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="คิดว่า.." />
        <link rel="apple-touch-icon" href="/icons/icon-180x180.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#ec4899" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
