import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import "./ledger-refinements.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Proofly — Trusted opportunities through real work",
  description:
    "Proofly makes real software work visible, reviewable, and understandable before opportunity decisions.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Proofly — Trusted opportunities through real work",
    description:
      "Evidence-led software work, qualified human review, and accountable opportunity decisions.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
