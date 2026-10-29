import type { Metadata, Viewport } from 'next';
import { Fraunces, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', style: ['normal', 'italic'] });
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'Night Café Butuan — Your city, after hours.',
  description: 'Your city, after hours. Find 24/7 and late-night cafés in Butuan City, Philippines on an interactive map.',
};

export const viewport: Viewport = { themeColor: '#111820', viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${jetbrains.variable}`}>
      <body className="font-sans text-[15px] leading-snug">{children}</body>
    </html>
  );
}
