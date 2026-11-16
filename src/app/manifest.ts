import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Istana Block Purwakarta",
    short_name: "Istana Block",
    description:
      "Pabrik paving block, kanstin, u-ditch, buis beton, dan panel operasional Istana Block Purwakarta.",
    start_url: "/",
    display: "standalone",
    background_color: "#F1F1EE",
    theme_color: "#0E2A6B",
    lang: "id",
    icons: [
      {
        src: "/icon-192.webp",
        sizes: "192x192",
        type: "image/webp",
      },
      {
        src: "/icon-512.webp",
        sizes: "512x512",
        type: "image/webp",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
