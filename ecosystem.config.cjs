module.exports = {
  apps: [
    {
      name: "dreamspace-api",
      script: "./server/dist/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
