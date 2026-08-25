import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1430,
    strictPort: true,
    host: host ?? false,
    ...(host ? { hmr: { protocol: "ws" as const, host, port: 1431 } } : {}),
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
