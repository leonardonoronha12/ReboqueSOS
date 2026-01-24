"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { Sheet } from "@/components/ui/Sheet";

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-brand-border/20 bg-brand-white/90 backdrop-blur">
      <div
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <BrandLogo size="sm" tone="light" />

        <div className="flex items-center gap-2 sm:hidden">
          <button
            className="rounded-2xl border border-brand-border/20 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
            type="button"
            onClick={() => {
              try {
                window.sessionStorage.setItem("reboquesos.openRequestSheet", "1");
              } catch {
                return;
              }
              if (pathname !== "/") {
                router.push("/");
              } else {
                window.dispatchEvent(new Event("reboquesos:open-request-sheet"));
              }
            }}
          >
            Pedir
          </button>
          <button
            className="rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black hover:bg-brand-yellow/10"
            type="button"
            onClick={() => setOpenMenu(true)}
            aria-label="Abrir menu"
          >
            <MenuIcon />
          </button>
        </div>

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

      <Sheet open={openMenu} title="Menu" onClose={() => setOpenMenu(false)}>
        <div className="space-y-2">
          <Link
            className="block rounded-2xl border border-brand-border/20 bg-white px-4 py-3 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
            href="/setup"
            onClick={() => setOpenMenu(false)}
          >
            Setup
          </Link>
          <Link
            className="block rounded-2xl border border-brand-border/20 bg-white px-4 py-3 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
            href="/partner"
            onClick={() => setOpenMenu(false)}
          >
            Parceiro
          </Link>
          <Link
            className="block rounded-2xl border border-brand-border/20 bg-white px-4 py-3 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
            href="/admin"
            onClick={() => setOpenMenu(false)}
          >
            Admin
          </Link>
          <Link
            className="block rounded-2xl border border-brand-border/20 bg-white px-4 py-3 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
            href="/login"
            onClick={() => setOpenMenu(false)}
          >
            Entrar
          </Link>
          <form action="/auth/logout" method="post">
            <button
              className="w-full rounded-2xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-left text-sm font-semibold text-brand-red hover:bg-brand-red/15"
              type="submit"
              onClick={() => setOpenMenu(false)}
            >
              Sair
            </button>
          </form>
        </div>
      </Sheet>
    </header>
  );
}

