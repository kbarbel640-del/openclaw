import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron", "dockerode", "electron-store", "better-sqlite3"],
    },
  },
  resolve: {
    conditions: ["node"],
  },
});
