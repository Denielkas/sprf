import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
  ],

  base: "./",

  server: {
    host: "0.0.0.0",

    port: 5174,

    proxy: {
      /* ===============================================
         PYTHON / FASTAPI
         
         PRECISA VIR ANTES DO /api
      =============================================== */

      "/apiFace": {
        target: "http://127.0.0.1:8000",

        changeOrigin: true,

        secure: false,

        rewrite: (path) =>
          path.replace(
            /^\/apiFace/,
            ""
          ),
      },

      /* ===============================================
         NODE.JS
      =============================================== */

      "/api": {
        target: "http://127.0.0.1:4000",

        changeOrigin: true,

        secure: false,
      },
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});