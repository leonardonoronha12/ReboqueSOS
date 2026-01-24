import type { Metadata } from "next";
import { Geist_Mono, Montserrat } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { BrandLogo } from "@/components/BrandLogo";

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
        className={`${montserrat.variable} ${geistMono.variable} min-h-dvh bg-brand-white text-brand-black font-sans antialiased`}
      >
        <div className="border-b border-brand-border/20 bg-brand-white">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
            <BrandLogo size="sm" tone="light" />
            <nav className="flex items-center gap-4 text-sm text-brand-text2">
              <Link className="hover:text-brand-black" href="/setup">
                Setup
              </Link>
              <Link className="hover:text-brand-black" href="/partner">
                Parceiro
              </Link>
              <Link className="hover:text-brand-black" href="/admin">
                Admin
              </Link>
              <Link className="hover:text-brand-black" href="/login">
                Entrar
              </Link>
              <form action="/auth/logout" method="post">
                <button className="hover:text-brand-black" type="submit">
                  Sair
                </button>
              </form>
            </nav>
          </div>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
