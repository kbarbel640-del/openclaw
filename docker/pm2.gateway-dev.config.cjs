module.exports = {
  apps: [
    {
      name: "openclaw-gateway-dev",
      cwd: "/app",
      script: "pnpm",
      args: "exec tsx watch --clear-screen=false src/entry.ts gateway --tailscale serve --verbose",
      interpreter: "none",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 1000,
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "openclaw-ui-dev",
      cwd: "/app",
      script: "pnpm",
      args: "--dir ui dev --host 0.0.0.0 --port 5173 --strictPort",
      interpreter: "none",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 1000,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
