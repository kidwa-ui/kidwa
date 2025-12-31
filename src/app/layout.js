import './globals.css'
import { defaultMetadata, siteConfig } from '@/lib/seo-config'

export const metadata = defaultMetadata

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a1a' },
  ],
}

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        {/* Preconnect to Supabase */}
        <link rel="preconnect" href="https://your-supabase-url.supabase.co" />
        
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        
        {/* Google Analytics - Replace GA_MEASUREMENT_ID */}
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'GA_MEASUREMENT_ID', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
        
        {/* JSON-LD Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: siteConfig.name,
              url: siteConfig.url,
              logo: `${siteConfig.url}/logo.png`,
              description: siteConfig.description,
              sameAs: [
                siteConfig.links.twitter,
              ],
            }),
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
