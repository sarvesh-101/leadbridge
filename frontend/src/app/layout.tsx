import type { Metadata } from "next";
import { Toaster } from "sonner";
import { QueryProvider } from "../lib/query-client";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LeadBridge — AI Calling Agent for Real Estate Brokers",
    template: "%s | LeadBridge",
  },
  description:
    "LeadBridge puts an AI agent on every inbound lead within 60 seconds — qualifying, booking, following up — while you focus on closing. One broker per city.",
  keywords: [
    "real estate CRM",
    "AI calling agent",
    "lead qualification",
    "real estate broker",
    "India real estate",
    "lead management",
    "AI sales agent",
    "property broker tool",
  ],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "LeadBridge",
    title: "LeadBridge — Your leads call themselves back.",
    description:
      "AI calling agent for Indian real estate brokers. One broker per city. AI calls every lead within 60 seconds.",
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
      <body className="min-h-screen bg-[#0A0A0F] text-[#F0F0F8] antialiased">
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
