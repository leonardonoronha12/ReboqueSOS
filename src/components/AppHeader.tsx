"use client";

import Link from "next/link";

import { BrandLogo } from "@/components/BrandLogo";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-border/20 bg-brand-white/90 backdrop-blur">
      <div
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <BrandLogo size="sm" tone="light" />

        <nav className="hidden items-center gap-4 text-sm text-brand-text2 sm:flex">
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
    </header>
  );
}
