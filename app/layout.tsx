import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300','400','500','600','700','800','900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Munimark — דירוג ראשי רשויות',
  description: 'פלטפורמה לדירוג וניתוח ביצועי ראשי רשויות מקומיות בישראל',
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
