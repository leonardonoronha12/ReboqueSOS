import { cn } from "./cn";
import { BrandLogo } from "@/components/BrandLogo";
import Link from "next/link";

export function Navbar({ className }: { className?: string }) {
  return (
    <header className={cn("sticky top-0 z-40 border-b border-brand-border/20 bg-brand-white/80 backdrop-blur", className)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
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
        </nav>
      </div>
    </header>
  );
}
