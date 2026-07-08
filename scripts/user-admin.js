#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
loadDotEnv(path.join(ROOT_DIR, ".env"));

const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PASSWORD_ITERATIONS = 600000;
const PASSWORD_KEY_LENGTH = 32;

const [command, usernameArg, ...rest] = process.argv.slice(2);

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  if (!command || command === "help" || command === "--help") {
    printUsage();
    return;
  }

  if (command === "list") {
    const store = readUsersStore();
    if (!store.users.length) {
      console.log("No users yet.");
      return;
    }
    for (const user of store.users) {
      console.log(`${user.username}\t${user.displayName || user.username}\t${user.disabled ? "disabled" : "active"}`);
    }
    return;
  }

  if (!["add", "reset-password"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  const username = normalizeUsername(usernameArg);
  if (!username) throw new Error("A username is required.");

  const store = readUsersStore();
  const existing = store.users.find((user) => user.username === username);

  if (command === "add") {
    if (existing) throw new Error(`User already exists: ${username}`);
    const password = await readPassword();
    const now = new Date().toISOString();
    const displayName = rest.join(" ").trim() || username;
    store.users.push({
      id: crypto.randomUUID(),
      username,
      displayName,
      password: hashPassword(password),
      disabled: false,
      createdAt: now,
      updatedAt: now
    });
    writeUsersStore(store);
    console.log(`Created user: ${username}`);
    return;
  }

  if (!existing) throw new Error(`User not found: ${username}`);
  const password = await readPassword();
  existing.password = hashPassword(password);
  existing.disabled = false;
  existing.updatedAt = new Date().toISOString();
  writeUsersStore(store);
  console.log(`Reset password for: ${username}`);
}

function printUsage() {
  console.log(`Usage:
  node scripts/user-admin.js add <username> [display name]
  node scripts/user-admin.js reset-password <username>
  node scripts/user-admin.js list

For non-interactive setup, pass AI_THOMAS_PASSWORD in the environment.`);
}

async function readPassword() {
  const envPassword = process.env.AI_THOMAS_PASSWORD;
  if (envPassword) return validatePassword(envPassword);
  const password = await promptHidden("Password: ");
  const confirmation = await promptHidden("Confirm password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  return validatePassword(password);
}

function validatePassword(password) {
  if (String(password || "").length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return String(password);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256");
  return {
    algorithm: "pbkdf2-sha256",
    iterations: PASSWORD_ITERATIONS,
    salt: salt.toString("base64"),
    hash: hash.toString("base64"),
    keyLength: PASSWORD_KEY_LENGTH
  };
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function readUsersStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const store = safeJson(readText(USERS_FILE), null);
  if (store && Array.isArray(store.users)) return store;
  return { users: [] };
}

function writeUsersStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpPath = `${USERS_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ users: store.users || [] }, null, 2));
  fs.renameSync(tmpPath, USERS_FILE);
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function safeJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function promptHidden(label) {
  if (!process.stdin.isTTY) {
    return new Promise((resolve) => {
      process.stdout.write(label);
      let value = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        value += chunk;
        if (value.includes("\n")) {
          resolve(value.split(/\r?\n/)[0]);
        }
      });
    });
  }

  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (char) => {
      if (char === "\u0003") {
        cleanup();
        reject(new Error("Cancelled."));
        return;
      }
      if (char === "\r" || char === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
    }

    process.stdin.on("data", onData);
  });
}
