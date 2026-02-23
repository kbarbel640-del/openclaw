import { defineConfig } from "vite";

export default defineConfig({
  // React JSX transform handled by tsconfig "react-jsx"
  esbuild: {
    jsx: "automatic",
  },
});
