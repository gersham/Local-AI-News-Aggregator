import type { Metadata } from 'next';
import './globals.css';
import { Geist } from 'next/font/google';
import { Navigation } from '@/components/navigation';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'News Aggregator',
  description: 'Personal news feed and morning briefing control plane.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn('dark font-sans antialiased', geist.variable)}
    >
      <body className="min-h-dvh bg-background text-foreground">
        <Navigation />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</div>
      </body>
    </html>
  );
}
