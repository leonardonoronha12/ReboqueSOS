import type { Metadata } from "next";
import { Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { ClientActiveTripRedirector } from "@/components/ClientActiveTripRedirector";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReboqueSOS",
  description: "Solicite reboques próximos com proposta e rastreamento em tempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${montserrat.variable} ${geistMono.variable} min-h-dvh overflow-x-hidden bg-brand-white text-brand-black font-sans antialiased`}
      >
        <AppHeader />
        <ClientActiveTripRedirector />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
