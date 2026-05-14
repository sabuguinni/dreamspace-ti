module.exports = {
  apps: [{
    name: 'dreams-staging',
    script: 'npm',
    args: 'start',
    cwd: '/opt/dreamspace-ti-staging',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: '/var/log/pm2/dreams-staging-error.log',
    out_file: '/var/log/pm2/dreams-staging-out.log',
    time: true
  }]
}
