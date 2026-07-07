const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const KNOWLEDGE_DIR = path.join(ROOT_DIR, "knowledge");
const PROJECT_DIR = path.resolve(ROOT_DIR, "..");
const NOTES_DIR = path.join(PROJECT_DIR, "notes");
const TEXT_DIRS = [
  path.join(KNOWLEDGE_DIR, "extracted_text"),
  path.join(NOTES_DIR, "extracted_text")
];

loadDotEnv(path.join(ROOT_DIR, ".env"));

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const HOST = process.env.HOST || "127.0.0.1";
const START_PORT = Number(process.env.PORT || 8787);
const MAX_CONTEXT_CHARS = 12000;
const MAX_BODY_BYTES = 1024 * 1024;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, ".data");
const USAGE_FILE = path.join(DATA_DIR, "usage-limits.json");
const LIMITS = {
  perHour: readPositiveInt("MAX_REQUESTS_PER_HOUR", 12),
  perDay: readPositiveInt("MAX_REQUESTS_PER_DAY", 40),
  globalPerDay: readPositiveInt("MAX_GLOBAL_REQUESTS_PER_DAY", 120),
  monthlyEstimatedTokens: readPositiveInt("MAX_ESTIMATED_TOKENS_PER_MONTH", 800000)
};
const DEFAULT_ALLOWED_ORIGINS = [
  "https://jojo-edtech.github.io",
  "https://c700f6574d53ae.lhr.life",
  "http://47.106.124.32"
];
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

let corpusCache = null;

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

function parseAllowedOrigins(value) {
  const configured = String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function readPositiveInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function readText(filePath, fallback = "") {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

function loadCorpus() {
  if (corpusCache) return corpusCache;

  const distilled = readText(path.join(KNOWLEDGE_DIR, "Thomas思维蒸馏_38篇版.md")) ||
    readText(path.join(NOTES_DIR, "Thomas思维蒸馏_38篇版.md"));
  const matrix = readText(path.join(KNOWLEDGE_DIR, "Thomas一作论文阅读矩阵_38篇PDF.md")) ||
    readText(path.join(NOTES_DIR, "Thomas一作论文阅读矩阵_38篇PDF.md"));
  const prompt = readText(path.join(KNOWLEDGE_DIR, "ai_thomas_system_prompt.md"));
  const articles = safeJson(readText(path.join(KNOWLEDGE_DIR, "articles.json")), []);
  const articleByRow = new Map(articles.map((article) => [String(article.row), article]));
  const chunks = [];

  chunks.push(...chunkSyntheticSource("distilled", "Thomas思维蒸馏_38篇版", distilled, 1200));
  chunks.push(...chunkSyntheticSource("matrix", "Thomas一作论文阅读矩阵_38篇PDF", matrix, 1200));

  const textDir = TEXT_DIRS.find((candidate) => fs.existsSync(candidate));
  if (textDir) {
    const textFiles = fs.readdirSync(textDir)
      .filter((name) => name.endsWith(".txt"))
      .sort((a, b) => a.localeCompare(b, "en"));
    for (const fileName of textFiles) {
      const rowMatch = fileName.match(/^([A-Za-z]*\d+)_/);
      const row = rowMatch
        ? (/^\d+$/.test(rowMatch[1]) ? Number(rowMatch[1]) : rowMatch[1])
        : null;
      const article = articleByRow.get(String(row)) || {
        row,
        title: fileName.replace(/\.txt$/, ""),
        year: "",
        type: "",
        position: "",
        reusable_action: ""
      };
      const text = readText(path.join(textDir, fileName));
      chunks.push(...chunkPaperText(article, fileName, text));
    }
  }

  corpusCache = {
    distilled,
    matrix,
    prompt,
    articles,
    chunks,
    paperCount: articles.length || countDownloadedRows(matrix),
    missingCount: 6
  };
  return corpusCache;
}

function safeJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function countDownloadedRows(matrix) {
  return (matrix.match(/^\| \d+ \|/gm) || []).length;
}

function chunkSyntheticSource(kind, title, text, maxChars) {
  const clean = normalizeWhitespace(text);
  if (!clean) return [];
  const chunks = [];
  for (let start = 0; start < clean.length; start += maxChars) {
    chunks.push({
      id: `${kind}-${chunks.length + 1}`,
      kind,
      row: null,
      year: "",
      type: "knowledge",
      title,
      text: clean.slice(start, start + maxChars),
      position: "",
      reusable_action: ""
    });
  }
  return chunks;
}

function chunkPaperText(article, fileName, rawText) {
  const text = normalizeWhitespace(rawText.replace(/\f/g, "\n\n"));
  if (!text) return [];
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let buffer = "";
  let index = 1;
  for (const paragraph of paragraphs) {
    if ((buffer + "\n\n" + paragraph).length > 1600 && buffer.length > 450) {
      chunks.push(makePaperChunk(article, fileName, index, buffer));
      index += 1;
      buffer = paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }
  if (buffer) chunks.push(makePaperChunk(article, fileName, index, buffer));
  return chunks;
}

function makePaperChunk(article, fileName, index, text) {
  return {
    id: `${article.row || "paper"}-${index}`,
    kind: "paper",
    row: article.row,
    year: article.year,
    type: article.type,
    title: article.title,
    fileName,
    text,
    position: article.position || "",
    reusable_action: article.reusable_action || ""
  };
}

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MODE_CONFIG = {
  "research-design": {
    label: "研究设计",
    keywords: "research model method methodology SEM CFA mediation moderation Delphi co-design interview experiment measurement scale framework SDT self-determination teacher support needs satisfaction autonomy competence relatedness"
  },
  "theory-frame": {
    label: "理论框架",
    keywords: "framework theory construct definition AI literacy AI competency I-TPACK human-centred AI motivation engagement teacher support well-being ethics"
  },
  "literature-position": {
    label: "文献定位",
    keywords: "literature review systematic review bibliometric trend research agenda contribution gap future research learning teaching assessment administration policy"
  },
  "writing-feedback": {
    label: "写作反馈",
    keywords: "abstract introduction discussion implication contribution concise academic writing revise paragraph claim logic"
  }
};

function selectContext(query, mode) {
  const corpus = loadCorpus();
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG["research-design"];
  const terms = extractTerms(`${query} ${modeConfig.keywords}`);
  const scored = corpus.chunks.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, terms, query)
  })).filter((item) => item.score > 0);

  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  const rowCounts = new Map();
  let totalChars = 0;

  for (const item of scored) {
    const chunk = item.chunk;
    const rowKey = chunk.row ? String(chunk.row) : chunk.kind;
    const currentCount = rowCounts.get(rowKey) || 0;
    if (chunk.kind === "paper" && currentCount >= 2) continue;
    if (selected.length >= 9) break;
    if (totalChars + chunk.text.length > MAX_CONTEXT_CHARS && selected.length >= 4) continue;
    selected.push(chunk);
    rowCounts.set(rowKey, currentCount + 1);
    totalChars += chunk.text.length;
  }

  if (!selected.some((chunk) => chunk.kind === "distilled")) {
    const distilled = corpus.chunks.find((chunk) => chunk.kind === "distilled");
    if (distilled) selected.unshift(distilled);
  }

  return selected.slice(0, 9);
}

function extractTerms(text) {
  const lower = String(text || "").toLowerCase();
  const english = lower.match(/[a-z][a-z0-9-]{2,}/g) || [];
  const cjk = lower.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const cjkBigrams = cjk.flatMap((segment) => {
    const grams = [];
    for (let i = 0; i < segment.length - 1; i += 1) grams.push(segment.slice(i, i + 2));
    return grams;
  });
  const important = [
    "sdt", "ai", "genai", "tpack", "i-tpack", "literacy", "competency",
    "teacher", "student", "support", "motivation", "engagement", "ethics",
    "well-being", "curriculum", "framework", "scale", "identity"
  ].filter((term) => lower.includes(term));
  return Array.from(new Set([...english, ...cjk, ...cjkBigrams, ...important]))
    .filter((term) => term.length >= 2)
    .slice(0, 80);
}

function scoreChunk(chunk, terms, rawQuery) {
  const haystack = `${chunk.title}\n${chunk.position}\n${chunk.reusable_action}\n${chunk.text}`.toLowerCase();
  const title = String(chunk.title || "").toLowerCase();
  const position = `${chunk.position || ""} ${chunk.reusable_action || ""}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const safeTerm = term.toLowerCase();
    if (!safeTerm) continue;
    if (title.includes(safeTerm)) score += 8;
    if (position.includes(safeTerm)) score += 5;
    const firstIndex = haystack.indexOf(safeTerm);
    if (firstIndex >= 0) {
      score += 1;
      const matches = haystack.split(safeTerm).length - 1;
      score += Math.min(matches, 6) * 0.8;
    }
  }
  const query = String(rawQuery || "").toLowerCase();
  if (query.includes("sdt") && /self-determination|autonomy|competence|relatedness/i.test(haystack)) score += 7;
  if (/ai literacy|人工智能素养|ai 素养/i.test(query) && /literacy|competency|i-tpack/i.test(haystack)) score += 7;
  if (/teacher|教师/i.test(query) && /teacher|professional development|school support/i.test(haystack)) score += 5;
  if (/well-?being|幸福|福祉/i.test(query) && /well-being|flourishing|digital drain/i.test(haystack)) score += 5;
  if (chunk.kind === "distilled") score += 3;
  if (chunk.kind === "matrix") score += 1.5;
  return score;
}

function buildSystemPrompt(mode, selectedChunks) {
  const corpus = loadCorpus();
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG["research-design"];
  const selectedContext = selectedChunks.map((chunk, index) => {
    const source = chunk.row ? `#${chunk.row} ${chunk.year || ""} ${chunk.title}` : chunk.title;
    return [
      `Source ${index + 1}: ${source}`,
      chunk.position ? `Position: ${chunk.position}` : "",
      chunk.reusable_action ? `Reusable action: ${chunk.reusable_action}` : "",
      `Content for private grounding, paraphrase rather than quote:\n${chunk.text.slice(0, 1800)}`
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n");

  return `${corpus.prompt}

当前回答模式：${modeConfig.label}
语料边界：核心语料为已下载并抽取的 38 篇 Thomas K. F. Chiu 一作 PDF；扩展语料为 12 篇 WoS Reprint Addresses 标记 Thomas K. F. Chiu 为通讯作者的 PDF。另有 6 篇 Thomas 一作论文和 22 篇通讯作者候选文献暂不在知识底座中，不能编造其细节。REL01 Fu (2025)、REL02 Liu et al. (2025) 与 M01 AERE reviewer 稿件是本地隔离材料，不属于 AI Thomas 证据。回答时要区分“一作核心语料”和“通讯作者扩展语料”。

核心蒸馏：
${corpus.distilled.slice(0, 9000)}

本轮检索到的相关来源：
${selectedContext}

回答要求：
- 用中文回答，除非用户明确要求英文。
- 不冒充 Thomas 本人；使用“基于 Thomas 一作论文的思维模式”这类表述。
- 主要转述和综合，不大段引用论文原文。
- 对研究问题给出可执行框架：教育问题、对象、机制、变量/维度、方法、伦理/well-being/policy。
- 如果用户给论文段落，直接给更清晰、更像学术写作的版本。`;
}

function publicSources(selectedChunks) {
  const seen = new Set();
  const sources = [];
  for (const chunk of selectedChunks) {
    const key = chunk.row ? `row-${chunk.row}` : chunk.kind;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      row: chunk.row,
      year: chunk.year,
      type: chunk.type,
      title: chunk.title
    });
  }
  return sources.slice(0, 8);
}

async function callDeepSeek(messages, mode) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      status: 400,
      body: {
        error: "missing_key",
        message: "还没有检测到 DEEPSEEK_API_KEY。设置后刷新页面即可调用 DeepSeek。"
      }
    };
  }

  const latestUser = [...messages].reverse().find((message) => message.role === "user")?.content || "";
  const selectedChunks = selectContext(latestUser, mode);
  const systemPrompt = buildSystemPrompt(mode, selectedChunks);
  const safeMessages = messages
    .filter((message) => ["user", "assistant"].includes(message.role))
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").slice(0, 6000)
    }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...safeMessages
        ],
        temperature: 0.35,
        max_tokens: 1800,
        thinking: { type: "disabled" },
        stream: false
      })
    });

    const raw = await response.text();
    const data = safeJson(raw, null);
    if (!response.ok) {
      return {
        status: response.status,
        body: {
          error: "deepseek_error",
          message: data?.error?.message || raw.slice(0, 500) || `DeepSeek returned ${response.status}`
        }
      };
    }

    const answer = data?.choices?.[0]?.message?.content || "";
    return {
      status: 200,
      body: {
        answer,
        model: MODEL,
        sources: publicSources(selectedChunks)
      }
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        error: "request_failed",
        message: error.name === "AbortError" ? "DeepSeek 响应超时。" : error.message
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readUsageStore() {
  ensureDataDir();
  const store = safeJson(readText(USAGE_FILE), null);
  if (store && typeof store === "object") return store;
  return { clients: {}, global: {} };
}

function writeUsageStore(store) {
  ensureDataDir();
  fs.writeFileSync(USAGE_FILE, JSON.stringify(store, null, 2));
}

function usageWindow(now = new Date()) {
  const iso = now.toISOString();
  return {
    hour: iso.slice(0, 13),
    day: iso.slice(0, 10),
    month: iso.slice(0, 7)
  };
}

function clientKey(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket.remoteAddress || "unknown";
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 120);
  return `${ip}|${userAgent}`;
}

function estimateTokensForRequest(messages) {
  const text = messages.map((message) => String(message.content || "")).join("\n");
  return Math.ceil((text.length + MAX_CONTEXT_CHARS + 9000) / 3.5) + 1800;
}

function checkAndRecordUsage(req, messages) {
  const store = readUsageStore();
  const windows = usageWindow();
  const key = clientKey(req);
  const estimate = estimateTokensForRequest(messages);

  const client = store.clients[key] || {};
  const global = store.global || {};

  const clientHour = client.hour === windows.hour ? client.hourCount || 0 : 0;
  const clientDay = client.day === windows.day ? client.dayCount || 0 : 0;
  const globalDay = global.day === windows.day ? global.dayCount || 0 : 0;
  const globalMonthTokens = global.month === windows.month ? global.monthEstimatedTokens || 0 : 0;

  const retryMessage = "AI Thomas 今天的安全使用额度已到。为了保护 DeepSeek API key，请稍后再试。";
  if (clientHour >= LIMITS.perHour) {
    return { ok: false, status: 429, message: `这台设备每小时最多 ${LIMITS.perHour} 次请求。请稍后再试。` };
  }
  if (clientDay >= LIMITS.perDay) {
    return { ok: false, status: 429, message: `这台设备每天最多 ${LIMITS.perDay} 次请求。明天会自动恢复。` };
  }
  if (globalDay >= LIMITS.globalPerDay) {
    return { ok: false, status: 429, message: retryMessage };
  }
  if (globalMonthTokens + estimate > LIMITS.monthlyEstimatedTokens) {
    return { ok: false, status: 429, message: "AI Thomas 本月 DeepSeek 估算 token 安全额度已到。需要管理员调高额度后继续。" };
  }

  store.clients[key] = {
    hour: windows.hour,
    hourCount: clientHour + 1,
    day: windows.day,
    dayCount: clientDay + 1,
    lastSeenAt: new Date().toISOString()
  };
  store.global = {
    day: windows.day,
    dayCount: globalDay + 1,
    month: windows.month,
    monthEstimatedTokens: globalMonthTokens + estimate,
    updatedAt: new Date().toISOString()
  };
  writeUsageStore(store);
  return { ok: true };
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/status") {
    const corpus = loadCorpus();
    return sendJson(res, 200, {
      ok: true,
      hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY),
      model: MODEL,
      paperCount: corpus.paperCount,
      chunkCount: corpus.chunks.length,
      missingCount: corpus.missingCount,
      limits: {
        perHour: LIMITS.perHour,
        perDay: LIMITS.perDay,
        globalPerDay: LIMITS.globalPerDay,
        monthlyEstimatedTokens: LIMITS.monthlyEstimatedTokens
      }
    });
  }

  if (req.method === "GET" && req.url === "/api/articles") {
    const corpus = loadCorpus();
    return sendJson(res, 200, { articles: corpus.articles });
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    const body = await readRequestBody(req);
    const payload = safeJson(body, {});
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const mode = payload.mode || "research-design";
    const usage = checkAndRecordUsage(req, messages);
    if (!usage.ok) {
      return sendJson(res, usage.status, { error: "usage_limit_reached", message: usage.message });
    }
    const result = await callDeepSeek(messages, mode);
    return sendJson(res, result.status, result.body);
  }

  return sendJson(res, 404, { error: "not_found" });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const requestedPath = decodeURIComponent(url.pathname);
  const relative = requestedPath === "/" ? "index.html" : requestedPath.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
        } else {
          res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
          res.end(fallback);
        }
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (!ALLOWED_ORIGINS.includes("*") && !ALLOWED_ORIGINS.includes(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.includes("*") ? "*" : origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith("/api/")) {
        applyCors(req, res);
        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }
        await handleApi(req, res);
      } else {
        serveStatic(req, res);
      }
    } catch (error) {
      sendJson(res, 500, { error: "server_error", message: error.message });
    }
  });
}

function start(port, attemptsLeft = 12) {
  const server = createServer();
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      start(port + 1, attemptsLeft - 1);
      return;
    }
    console.error(error);
    process.exit(1);
  });
  server.listen(port, HOST, () => {
    loadCorpus();
    console.log(`AI Thomas is running at http://${HOST}:${port}`);
    console.log(`Corpus: ${corpusCache.paperCount} downloaded papers, ${corpusCache.chunks.length} local chunks`);
    console.log(`DeepSeek model: ${MODEL}; API key: ${process.env.DEEPSEEK_API_KEY ? "detected" : "missing"}`);
  });
}

start(START_PORT);
