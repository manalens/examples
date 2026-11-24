import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { AnalyticsTracker } from '../components/analytics-tracker';
import './globals.css';

export const metadata: Metadata = {
  title: 'Manalens: Next.js App Router example',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/pricing?plan=pro">Pricing (pro)</Link>
        </nav>
        <main>{children}</main>
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
      </body>
    </html>
  );
}
