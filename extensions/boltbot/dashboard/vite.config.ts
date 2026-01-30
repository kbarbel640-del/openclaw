import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/boltbot/dashboard/",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/boltbot/receipts": "http://localhost:18789",
      "/boltbot/receipt": "http://localhost:18789",
      "/boltbot/stats": "http://localhost:18789",
    },
  },
});
