module.exports = {
  apps: [
    {
      name: 'rojoplus-server',
      cwd: '/var/www/rojoplus/server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      // Cargar archivo .env (PM2 >= 5.2.0)
      env_file: '/var/www/rojoplus/server/.env',
      env: {
        NODE_ENV: 'production',
        PORT: 5300,
      },
      error_file: '/var/log/rojoplus/backend-error.log',
      out_file: '/var/log/rojoplus/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'rojoplus-client',
      cwd: '/var/www/rojoplus/client',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --port 8090 --host',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      // Cargar archivo .env (PM2 >= 5.2.0)
      env_file: '/var/www/rojoplus/client/.env',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/rojoplus/frontend-error.log',
      out_file: '/var/log/rojoplus/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
