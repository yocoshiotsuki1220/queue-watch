import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "行列ウォッチ",
    short_name: "行列",
    description: "見かけたら、教えてね",
    start_url: "/",
    display: "standalone",
    background_color:#E8E0D4",
    theme_color: "#0A0A0C",
    icons: [
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