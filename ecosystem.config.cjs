module.exports = {
  apps: [
    {
      name: 'xmarks-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
      },
      autorestart: true,
      watch: false,
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'xmarks-api',
      script: 'server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        MEDIA_DIR: './media',
        API_PORT: 3001,
      },
      max_memory_restart: '100M',
      autorestart: true,
      watch: false,
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
