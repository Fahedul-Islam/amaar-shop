import type { Metadata } from 'next';
import { Inter, Noto_Sans_Bengali } from 'next/font/google';
// @ts-ignore - global CSS is handled by Next.js
import './globals.css';
import { Providers } from '@/components/Providers';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const bengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bengali',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AmaarShop — A warmer marketplace for Bangladesh',
  description: 'Handmade goods, honest sellers, delivery you can trust.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bengali.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
