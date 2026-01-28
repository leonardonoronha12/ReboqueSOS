"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type ActiveTripResponse = {
  tripId?: string | null;
  requestId?: string | null;
  requestStatus?: string | null;
  tripStatus?: string | null;
  next?: string | null;
};

type TrackingResponse = {
  trip?: { id?: string; status?: string | null };
};

function isClientArea(pathname: string) {
  if (!pathname) return true;
  if (pathname.startsWith("/partner")) return false;
  if (pathname.startsWith("/admin")) return false;
  return true;
}

function shouldSkipRedirect(pathname: string, next: string) {
  if (!pathname) return false;
  if (pathname.startsWith("/trips/")) return true;
  if (next === pathname) return true;
  return false;
}

export function ClientActiveTripRedirector() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isClientArea(pathname)) return;
    let cancelled = false;

    async function run() {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const res = await fetch("/api/client/trips/active", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ActiveTripResponse | null;
        const next = json?.next ? String(json.next) : "";
        const tripStatus = json?.tripStatus ? String(json.tripStatus) : "";
        const requestStatus = json?.requestStatus ? String(json.requestStatus) : "";

        const canRedirectToTrip = next.startsWith("/trips/") && tripStatus && tripStatus !== "finalizado" && requestStatus !== "PAGO";
        if (canRedirectToTrip && !shouldSkipRedirect(pathname, next) && !cancelled) {
          router.replace(next);
          return;
        }

        const storedTripId = (() => {
          try {
            return window.localStorage.getItem("reboquesos_active_trip_id") ?? "";
          } catch {
            return "";
          }
        })();

        if (!next && storedTripId && !pathname.startsWith("/trips/")) {
          const trackingRes = await fetch(`/api/public/trips/${encodeURIComponent(storedTripId)}/tracking`, { cache: "no-store" });
          const trackingJson = (await trackingRes.json().catch(() => null)) as TrackingResponse | null;
          const ts = trackingJson?.trip?.status ? String(trackingJson.trip.status) : "";
          const active = ts && ts !== "finalizado" && ts !== "cancelado";
          if (active && !cancelled) router.replace(`/trips/${encodeURIComponent(storedTripId)}`);
        }
      } catch {
        return;
      } finally {
        runningRef.current = false;
      }
    }

    void run();

    const onVis = () => {
      if (document.visibilityState === "visible") void run();
    };
    const onFocus = () => void run();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname, router]);

  return null;
}

