import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
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
