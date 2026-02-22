import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      allowedHosts: env.VITE_ALLOWED_HOSTS?.split(",") ?? [],
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [
      devtools(),
      VitePWA({
        registerType: "prompt",
        includeAssets: [
          "favicon.svg",
          "apple-touch-icon.png",
          "logo192.png",
          "logo512.png",
        ],
        manifest: {
          short_name: "Agent Dash",
          name: "AI Agent Dashboard",
          icons: [
            {
              src: "favicon.svg",
              type: "image/svg+xml",
              sizes: "any",
            },
            {
              src: "logo192.png",
              type: "image/png",
              sizes: "192x192",
            },
            {
              src: "logo512.png",
              type: "image/png",
              sizes: "512x512",
            },
          ],
          start_url: "/",
          display: "standalone",
          theme_color: "#0a0a0a",
          background_color: "#0a0a0a",
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2}"],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
      }),
      nitro(),
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact({
        babel: {
          plugins: ["babel-plugin-react-compiler"],
        },
      }),
    ],
  };
});
