import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './site.css';
import { P } from '@/lib/project';
import Track from './_c/Track';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://empiregoldmazgaon.com';
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Empire Gold, Mazgaon — 1 RK, 1 BHK and 1.5 BHK homes on Dockyard Road', template: '%s · Empire Gold, Mazgaon' },
  description: 'Phase II of Empire Gold: 35 homes on floors 8–15 above a delivered, occupied Phase I. 252–621 sq.ft MahaRERA carpet, 2 minutes from Dockyard Road station. MahaRERA P51900008690.',
  openGraph: { type: 'website', siteName: 'Empire Gold', images: ['/og.jpg'], locale: 'en_IN' },
};
export const viewport: Viewport = { themeColor: '#FFFFFF', width: 'device-width', initialScale: 1 };

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GA = process.env.NEXT_PUBLIC_GA_ID;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const ld = { '@context': 'https://schema.org', '@type': 'ApartmentComplex', name: 'Empire Gold', url: SITE,
    address: { '@type': 'PostalAddress', streetAddress: '51C, Dockyard Road, Mazgaon', addressLocality: 'Mumbai', postalCode: '400010', addressRegion: 'Maharashtra', addressCountry: 'IN' },
    numberOfAccommodationUnits: 35, telephone: P.phones[0] };
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Figtree:wght@400;500;600&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      </head>
      <body>
        {children}
        <Track />
        {PIXEL && /^\d{6,20}$/.test(PIXEL) && (
          <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');`}</Script>
        )}
        {GA && /^G-[A-Z0-9]+$/.test(GA) && (<>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA}');`}</Script>
        </>)}
      </body>
    </html>
  );
}
