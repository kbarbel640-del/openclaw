import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// Default dev token for local development (must match gateway config)
const DEV_TOKEN = "dev-token-local";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gatewayToken = env.OPENCLAW_GATEWAY_TOKEN || env.VITE_GATEWAY_TOKEN || DEV_TOKEN;
  const gatewayUrl = env.VITE_GATEWAY_URL || "http://127.0.0.1:18789";
  const gatewayWsUrl = gatewayUrl.replace(/^http/, "ws");

  return {
    plugins: [
      // TanStack Router must be before React plugin
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
      visualizer({
        filename: "./dist/stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@clawdbrain/vercel-ai-agent": path.resolve(__dirname, "../../packages/vercel-ai-agent/dist/index.js"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Split large vendor libraries into separate chunks
            if (id.includes('node_modules')) {
              // 3D rendering libraries (from reagraph)
              if (id.includes('three') || id.includes('@react-three/') || id.includes('@react-spring/three')) {
                return 'vendor-three';
              }
              // Terminal libraries
              if (id.includes('@xterm/xterm')) {
                return 'vendor-xterm';
              }
              if (id.includes('@xterm/addon-')) {
                return 'vendor-xterm-addons';
              }
              // Graph visualization
              if (id.includes('reagraph') || id.includes('graphology')) {
                return 'vendor-graph';
              }
              // React core
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              // Radix UI components
              if (id.includes('@radix-ui/')) {
                return 'vendor-radix';
              }
              // TanStack ecosystem
              if (id.includes('@tanstack/')) {
                return 'vendor-tanstack';
              }
              // Other vendor code
              return 'vendor';
            }
          },
        },
      },
    },
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      fs: {
        allow: [path.resolve(__dirname, "../..")],
      },
      proxy: {
        "/ws": {
          target: gatewayWsUrl,
          ws: true,
          rewrite: (p) => `${p}${p.includes("?") ? "&" : "?"}token=${encodeURIComponent(gatewayToken)}`,
        },
        "/api": {
          target: gatewayUrl,
          changeOrigin: true,
          headers: {
            Authorization: `Bearer ${gatewayToken}`,
          },
        },
      },
    },
  };
});
