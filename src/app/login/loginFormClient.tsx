"use client";

import { useEffect, useState } from "react";

function Icon(props: { name: "mail" | "lock" | "eye" | "eyeOff" | "key"; className?: string }) {
  const cls = props.className ?? "h-5 w-5";
  if (props.name === "mail") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm2 0 6 5 6-5H6Zm12 2.3-6 5-6-5V18h12V8.3Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (props.name === "lock") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 4a2 2 0 0 0-1 3.732V19h2v-1.268A2 2 0 0 0 12 14Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (props.name === "eye") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 5c5.5 0 9.5 5.2 10 6-.5.8-4.5 6-10 6S2.5 11.8 2 11c.5-.8 4.5-6 10-6Zm0 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (props.name === "eyeOff") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3.3 2 22 20.7l-1.3 1.3-2.3-2.3c-1.8.9-3.9 1.3-6.4 1.3-5.5 0-9.5-5.2-10-6 .3-.5 2-3.1 4.6-4.8L2 3.3 3.3 2Zm6.3 6.3 6.1 6.1A4 4 0 0 1 9.6 8.3Zm-1.8-1.8A6 6 0 0 1 12 5c5.5 0 9.5 5.2 10 6-.3.5-1.7 2.6-3.9 4.2l-1.5-1.5c1.3-1 2.3-2.3 2.8-2.7-.5-.8-4-5-9.4-5-1.3 0-2.4.2-3.4.5Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.2-2.6 5.4V20a2 2 0 0 1-2 2H9.6a2 2 0 0 1-2-2v-5.6C6.2 13.2 5 11.4 5 9a7 7 0 0 1 7-7Zm-2.4 18h4.8v-6.6l.4-.3c1.1-.9 2.2-2.2 2.2-4.1a5 5 0 0 0-10 0c0 1.9 1.1 3.2 2.2 4.1l.4.3V20Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Field(props: {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  type: string;
  placeholder?: string;
  required?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-brand-black">{props.label}</span>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-brand-black/60">
          <Icon name={props.icon} className="h-5 w-5" />
        </div>
        <input
          className="w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 pl-11 text-brand-black placeholder:text-brand-text2 focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
          name={props.name}
          type={props.type}
          placeholder={props.placeholder}
          required={props.required}
        />
        {props.right ? <div className="absolute inset-y-0 right-2 flex items-center">{props.right}</div> : null}
      </div>
    </label>
  );
}

export function LoginFormClient(props: { initialError?: string | null }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [nearbyCount, setNearbyCount] = useState<number | null>(null);
  const [nearbyStatus, setNearbyStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let alive = true;
    const timeouts: number[] = [];
    const defer = (fn: () => void) => {
      const id = window.setTimeout(() => {
        if (!alive) return;
        fn();
      }, 0);
      timeouts.push(id);
    };

    if (!navigator.geolocation) {
      defer(() => setNearbyStatus("error"));
      return () => {
        alive = false;
        for (const id of timeouts) window.clearTimeout(id);
      };
    }

    defer(() => setNearbyStatus("loading"));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const res = await fetch(
            `/api/partners/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&radius_km=20&only_count=1`,
          );
          const json = (await res.json()) as { count_nearby?: number };
          if (!alive) return;
          setNearbyCount(Number.isFinite(json.count_nearby) ? Number(json.count_nearby) : 0);
          setNearbyStatus("ready");
        } catch {
          if (!alive) return;
          setNearbyStatus("error");
        }
      },
      () => {
        if (!alive) return;
        setNearbyStatus("error");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );

    return () => {
      alive = false;
      for (const id of timeouts) window.clearTimeout(id);
    };
  }, []);

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-brand-black">
          <Icon name="key" className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-white">Entrar</h1>
          <p className="mt-1 text-sm text-white/70">Acesse o painel do parceiro reboque.</p>
        </div>
      </div>

      {props.initialError ? (
        <div className="mt-4 rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm font-semibold text-brand-red">
          {props.initialError}
        </div>
      ) : null}

      <form
        className="mt-5 space-y-4"
        action="/auth/login"
        method="post"
        onSubmit={() => setIsSubmitting(true)}
      >
        <div className="rounded-2xl border border-brand-border/20 bg-white p-4">
          <div className="grid gap-4">
            <Field name="email" label="Email" icon="mail" type="email" placeholder="voce@empresa.com" required />
            <Field
              name="password"
              label="Senha"
              icon="lock"
              type={showPassword ? "text" : "password"}
              placeholder="Sua senha"
              required
              right={
                <button
                  type="button"
                  className="rounded-xl border border-brand-border/20 bg-white px-3 py-2 text-xs font-semibold text-brand-black hover:bg-brand-yellow/10"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <span className="sr-only">{showPassword ? "Ocultar senha" : "Mostrar senha"}</span>
                  <Icon name={showPassword ? "eyeOff" : "eye"} className="h-4 w-4" />
                </button>
              }
            />
          </div>
        </div>

        <button className="btn-primary w-full disabled:opacity-50" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>

        <div className="rounded-2xl border border-brand-border/20 bg-white/5 p-3 text-xs font-semibold text-white/70">
          <span className="text-white">
            {nearbyStatus === "ready" ? String(nearbyCount ?? 0) : nearbyStatus === "loading" ? "…" : "—"}
          </span>{" "}
          reboques próximos ativos para atender seu chamado agora
        </div>
      </form>
    </div>
  );
}
