import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReboqueSOS",
    short_name: "ReboqueSOS",
    start_url: "/partner",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#E10600",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
