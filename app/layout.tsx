import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300','400','500','600','700','800','900'],
  display: 'swap',
});

export const metadata: Metadata = {
  // Every relative URL in metadata (canonical, og:url, og:image) resolves
  // against the production domain — never against a preview deployment.
  metadataBase: new URL(SITE_URL),
  title: 'Munimark — דירוג ראשי רשויות',
  description: 'פלטפורמה לדירוג וניתוח ביצועי ראשי רשויות מקומיות בישראל',
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    locale: 'he_IL',
    type: 'website',
  },
  twitter: {
    card: 'summary',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={heebo.className}>
      <body>{children}</body>
    </html>
  );
}
