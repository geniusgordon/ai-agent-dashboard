// PM2 ecosystem config for production server
module.exports = {
  apps: [
    {
      name: "agent-dashboard",
      script: "node",
      args: ".output/server/index.mjs",
      cwd: "/Users/gordon/Playground/ai-agent-dashboard/main",
      instances: 1,
      autorestart: true,
      watch: false, // Don't use PM2's file watching, we use git hooks
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Logs
      error_file: ".pm2/logs/error.log",
      out_file: ".pm2/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
