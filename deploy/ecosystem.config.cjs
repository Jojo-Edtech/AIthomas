const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env.production");

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, "")])
  );
}

module.exports = {
  apps: [
    {
      name: "ai-thomas",
      cwd: root,
      script: "server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "8787",
        ...loadEnv(envFile)
      },
      max_memory_restart: "384M",
      out_file: path.join(root, "logs", "ai-thomas.out.log"),
      error_file: path.join(root, "logs", "ai-thomas.err.log"),
      time: true
    }
  ]
};
