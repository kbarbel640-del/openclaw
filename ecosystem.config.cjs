module.exports = {
  apps: [
    {
      name: "openclaw",
      cwd: "/home/rocky/openclaw",
      script: "pnpm",
      args: "openclaw gateway --port 18789 --verbose",
      autorestart: true,
      watch: false, // Set true for hot-reload on file changes
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      },
      error_file: "/home/rocky/.openclaw/logs/error.log",
      out_file: "/home/rocky/.openclaw/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
