import type { Metadata } from "next";
import { Toaster } from "sonner";
import { QueryProvider } from "../lib/query-client";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Converza — AI Lead Conversion",
    template: "%s | Converza",
  },
  description:
    "Every enquiry called back in 60 seconds. AI-powered lead conversion infrastructure for international B2B.",
  keywords:
    ["AI lead conversion",
    "lead management",
    "AI calling",
    "B2B SaaS",
    "lead qualification",
    "appointment booking",
  ],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Converza",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Converza",
    title: "Converza — Intelligent Lead Conversion",
    description:
      "Every enquiry called back in 60 seconds. Your AI-powered lead conversion infrastructure.",
  },
  robots: {
    index: true,
    follow: true,
  },
};



export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}
