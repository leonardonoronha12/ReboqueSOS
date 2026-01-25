import { getOptionalEnv } from "@/lib/env";

type GoogleGeocodeResult = {
  formatted_address?: string;
  address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
  geometry: { location: { lat: number; lng: number } };
};

function getGoogleMapsKey() {
  return getOptionalEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY") ?? getOptionalEnv("GOOGLE_MAPS_API_KEY") ?? "";
}

function extractCityFromComponents(components: GoogleGeocodeResult["address_components"]) {
  const list = components ?? [];
  const byType = (type: string) => list.find((c) => c.types.includes(type))?.long_name ?? null;
  return byType("locality") || byType("administrative_area_level_2") || byType("sublocality") || null;
}

function buildGeocodeError(input: { resOk: boolean; httpStatus?: number; status: string; errorMessage?: string }) {
  const status = String(input.status ?? "").trim();
  const lower = status.toLowerCase();

  const base =
    lower === "zero_results"
      ? "Endereço não encontrado. Tente informar rua, número, bairro e cidade (ou CEP)."
      : lower === "invalid_request"
        ? "Endereço inválido. Verifique o texto informado."
        : lower === "request_denied"
          ? "Acesso ao Google Geocoding negado. Verifique a API key e as permissões."
          : lower === "over_query_limit" || lower === "over_daily_limit"
            ? "Limite do Google Geocoding excedido. Tente novamente em instantes."
            : lower === "unknown_error"
              ? "Erro temporário no Google Geocoding. Tente novamente."
              : "Falha ao buscar o endereço no Google Geocoding.";

  const details: string[] = [];
  if (!input.resOk && input.httpStatus) details.push(`HTTP ${input.httpStatus}`);
  if (status) details.push(`código: ${status}`);
  if (input.errorMessage) details.push(String(input.errorMessage));

  return details.length ? `${base} (${details.join(" • ")})` : base;
}

export async function geocodeAddress(input: { address: string }) {
  const key = getGoogleMapsKey();
  if (!key) {
    throw new Error("Google Maps API key não configurada.");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", input.address);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as {
    status: string;
    results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    error_message?: string;
  };

  if (!res.ok || json.status !== "OK" || !json.results?.[0]) {
    throw new Error(
      buildGeocodeError({
        resOk: res.ok,
        httpStatus: res.status,
        status: json.status,
        errorMessage: json.error_message,
      }),
    );
  }

  return json.results[0].geometry.location;
}

export async function geocodeAddressDetails(input: { address: string }) {
  const key = getGoogleMapsKey();
  if (!key) {
    throw new Error("Google Maps API key não configurada.");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", input.address);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as {
    status: string;
    results?: GoogleGeocodeResult[];
    error_message?: string;
  };

  if (!res.ok || json.status !== "OK" || !json.results?.[0]) {
    throw new Error(
      buildGeocodeError({
        resOk: res.ok,
        httpStatus: res.status,
        status: json.status,
        errorMessage: json.error_message,
      }),
    );
  }

  const first = json.results[0];
  return {
    location: first.geometry.location,
    formattedAddress: first.formatted_address ?? null,
    cidade: extractCityFromComponents(first.address_components),
  };
}

export async function reverseGeocodeCoords(input: { lat: number; lng: number }) {
  const key = getGoogleMapsKey();
  if (!key) {
    throw new Error("Google Maps API key não configurada.");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${input.lat},${input.lng}`);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as {
    status: string;
    results?: GoogleGeocodeResult[];
    error_message?: string;
  };

  if (!res.ok || json.status !== "OK" || !json.results?.[0]) {
    throw new Error(
      buildGeocodeError({
        resOk: res.ok,
        httpStatus: res.status,
        status: json.status,
        errorMessage: json.error_message,
      }),
    );
  }

  const first = json.results[0];
  return {
    formattedAddress: first.formatted_address ?? null,
    cidade: extractCityFromComponents(first.address_components),
  };
}
