module.exports = {
  apps: [
    {
      name: 'hepa-connect',
      script: 'server.mjs',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '3000',
      },
      max_memory_restart: '512M',
    },
  ],
};
