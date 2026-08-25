import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { WebVitalsReporter } from "@/components/marketing/web-vitals-reporter";

import { siteConfig } from "./seo";
import "./globals.css";
import "./ledger-refinements.css";
import "./foundation.css";
import "./profile.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteConfig.metadataBase,
  title: "Proofly — Trusted opportunities through real work",
  description: siteConfig.description,
  applicationName: siteConfig.name,
  referrer: "strict-origin-when-cross-origin",
  alternates: {
    canonical: "/",
  },
  robots: {
    follow: Boolean(siteConfig.publicUrl),
    index: Boolean(siteConfig.publicUrl),
  },
  openGraph: {
    title: "Proofly — Trusted opportunities through real work",
    description:
      "Evidence-led software work, qualified human review, and accountable opportunity decisions.",
    images: [
      {
        alt: "Proofly — trusted opportunities through real work",
        url: "/opengraph-image",
      },
    ],
    siteName: siteConfig.name,
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    description: siteConfig.description,
    images: ["/twitter-image"],
    title: "Proofly — Trusted opportunities through real work",
  },
};

export const viewport = {
  colorScheme: "light dark",
  themeColor: [
    { color: "#f3f6f8", media: "(prefers-color-scheme: light)" },
    { color: "#11171d", media: "(prefers-color-scheme: dark)" },
  ],
  width: "device-width",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
