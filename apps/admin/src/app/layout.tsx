import '@homecare/design-tokens/css';
import './styles.css';

import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { adminMetadataTh } from '@/locales/th';

const notoSansThai = localFont({
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
  src: [
    {
      path: '../../node_modules/@expo-google-fonts/noto-sans-thai/400Regular/NotoSansThai_400Regular.ttf',
      weight: '400',
    },
    {
      path: '../../node_modules/@expo-google-fonts/noto-sans-thai/600SemiBold/NotoSansThai_600SemiBold.ttf',
      weight: '600',
    },
    {
      path: '../../node_modules/@expo-google-fonts/noto-sans-thai/700Bold/NotoSansThai_700Bold.ttf',
      weight: '700',
    },
  ],
  variable: '--hc-font-family-loaded',
});

export const metadata: Metadata = {
  title: adminMetadataTh.title,
  description: adminMetadataTh.description,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="th">
      <body className={notoSansThai.variable}>{children}</body>
    </html>
  );
}
