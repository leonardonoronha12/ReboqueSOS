import { RequestForm } from "@/app/_components/RequestForm";
import { BrandLogo } from "@/components/BrandLogo";
import { RequestCtaButton } from "@/app/_components/RequestCtaButton";

export default function Home() {
  return (
    <div className="relative -mx-4 -mt-4 overflow-hidden bg-brand-white px-4 py-6 sm:-mt-8 sm:py-10 sm:rounded-3xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_12%_0%,rgba(255,195,0,0.28)_0%,rgba(255,255,255,0)_60%),radial-gradient(55%_55%_at_88%_8%,rgba(225,6,0,0.22)_0%,rgba(255,255,255,0)_60%)]" />
      <div className="pointer-events-none absolute inset-0 border border-brand-border/20 sm:rounded-3xl" />

      <div className="relative grid gap-6 sm:gap-10 lg:grid-cols-2 lg:items-start">
        <section className="space-y-5 sm:space-y-6">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <BrandLogo size="md" tone="light" />
            <span className="rounded-full border border-brand-yellow/35 bg-brand-yellow/15 px-3 py-1 text-xs font-semibold text-brand-black">
              24h • SOS
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
              Chame um reboque agora
              <span className="text-brand-red">.</span>
            </h1>
            <p className="max-w-xl text-pretty text-base leading-7 text-brand-black/70">
              Digite o endereço, use seu local ou arraste o pino no mapa. Você recebe propostas antes de confirmar.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <RequestCtaButton className="btn-primary inline-flex w-full items-center justify-center text-base sm:w-auto">
              Pedir Reboque Agora
            </RequestCtaButton>
            <a className="btn-secondary inline-flex w-full items-center justify-center text-base sm:w-auto" href="/partner">
              Sou reboque parceiro
            </a>
          </div>

          <div className="hidden grid gap-4 sm:grid-cols-3 lg:grid">
            <div className="card p-4">
              <div className="text-sm font-bold">1) Local</div>
              <div className="mt-1 text-sm text-brand-black/70">GPS, endereço ou mapa</div>
            </div>
            <div className="card p-4">
              <div className="text-sm font-bold">2) Propostas</div>
              <div className="mt-1 text-sm text-brand-black/70">Preço e tempo estimado</div>
            </div>
            <div className="card p-4">
              <div className="text-sm font-bold">3) Acompanhe</div>
              <div className="mt-1 text-sm text-brand-black/70">Rastreio ao vivo</div>
            </div>
          </div>

          <div className="hidden flex-wrap items-center gap-2 text-sm lg:flex">
            <span className="rounded-full border border-brand-yellow/35 bg-brand-yellow/10 px-3 py-1 font-semibold text-brand-black">
              Amarelo: destaque de reboques
            </span>
            <span className="rounded-full border border-brand-red/35 bg-brand-red/10 px-3 py-1 font-semibold text-brand-red">
              Vermelho: urgência SOS
            </span>
          </div>
        </section>

        <section id="solicitar" className="lg:sticky lg:top-6">
          <div className="rounded-3xl border border-brand-yellow/35 bg-brand-yellow/10 p-2 shadow-soft">
            <div className="rounded-3xl bg-white p-2">
              <RequestForm />
            </div>
          </div>
        </section>

        <section className="space-y-4 lg:hidden">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-4">
              <div className="text-sm font-bold">1) Local</div>
              <div className="mt-1 text-sm text-brand-black/70">GPS, endereço ou mapa</div>
            </div>
            <div className="card p-4">
              <div className="text-sm font-bold">2) Propostas</div>
              <div className="mt-1 text-sm text-brand-black/70">Preço e tempo estimado</div>
            </div>
            <div className="card p-4">
              <div className="text-sm font-bold">3) Acompanhe</div>
              <div className="mt-1 text-sm text-brand-black/70">Rastreio ao vivo</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-brand-yellow/35 bg-brand-yellow/10 px-3 py-1 font-semibold text-brand-black">
              Amarelo: destaque de reboques
            </span>
            <span className="rounded-full border border-brand-red/35 bg-brand-red/10 px-3 py-1 font-semibold text-brand-red">
              Vermelho: urgência SOS
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
