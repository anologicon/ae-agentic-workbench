import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:4317" },
      "/terminals": { target: "ws://127.0.0.1:4317", ws: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
