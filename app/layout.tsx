import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';

import './globals.css';

const ibmPlexMono = IBM_Plex_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '700'],
    variable: '--font-mono',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Meta Ad Competitor Analysis',
    description: 'Run an Apify-powered Meta ad competitor analysis and export the result as JSON.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={ibmPlexMono.variable}>
            <body style={{ fontFamily: 'var(--font-mono), "IBM Plex Mono", ui-monospace, monospace' }}>{children}</body>
        </html>
    );
}
