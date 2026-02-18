module.exports = {
  apps: [
    {
      name: "td2-api",
      cwd: "/var/www/td2-builder",
      script: "npm",
      args: "-w apps/api run start:prod",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      time: true,
      out_file: "/var/log/td2-api.out.log",
      error_file: "/var/log/td2-api.err.log",
      merge_logs: true,
    },
  ],
};

