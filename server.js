const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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
const MAX_SELECTED_CHUNKS = 12;
const MAX_CHUNKS_PER_PAPER = 3;
const SYNTHETIC_CHUNK_MAX_CHARS = 900;
const PAPER_CHUNK_MAX_CHARS = 950;
const PAPER_CHUNK_MIN_CHARS = 360;
const PAPER_CHUNK_OVERLAP_CHARS = 180;
const MAX_BODY_BYTES = 1024 * 1024;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, ".data");
const USAGE_FILE = path.join(DATA_DIR, "usage-limits.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const CONVERSATIONS_DIR = path.join(DATA_DIR, "conversations");
const AUTH_REQUIRED = readBoolean("AUTH_REQUIRED", false);
const SESSION_COOKIE_NAME = "ai_thomas_session";
const SESSION_TTL_MS = readPositiveInt("SESSION_TTL_DAYS", 7) * 24 * 60 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || "ai-thomas-dev-session-secret";
const DEV_USER = {
  id: "local-dev",
  username: "local-dev",
  displayName: "Local dev"
};
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

function readBoolean(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
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

  chunks.push(...chunkSyntheticSource("distilled", "Thomas思维蒸馏_38篇版", distilled, SYNTHETIC_CHUNK_MAX_CHARS));
  chunks.push(...chunkSyntheticSource("matrix", "Thomas一作论文阅读矩阵_38篇PDF", matrix, SYNTHETIC_CHUNK_MAX_CHARS));

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
    if (paragraph.length > PAPER_CHUNK_MAX_CHARS) {
      if (buffer) {
        chunks.push(makePaperChunk(article, fileName, index, buffer));
        index += 1;
        buffer = "";
      }
      for (const slice of splitWithOverlap(paragraph, PAPER_CHUNK_MAX_CHARS, PAPER_CHUNK_OVERLAP_CHARS)) {
        chunks.push(makePaperChunk(article, fileName, index, slice));
        index += 1;
      }
      continue;
    }

    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (next.length > PAPER_CHUNK_MAX_CHARS && buffer.length > PAPER_CHUNK_MIN_CHARS) {
      chunks.push(makePaperChunk(article, fileName, index, buffer));
      index += 1;
      const carry = overlapTail(buffer, PAPER_CHUNK_OVERLAP_CHARS);
      buffer = carry ? `${carry}\n\n${paragraph}` : paragraph;
    } else {
      buffer = next;
    }
  }
  if (buffer) chunks.push(makePaperChunk(article, fileName, index, buffer));
  return chunks;
}

function splitWithOverlap(text, maxChars, overlapChars) {
  const clean = text.trim();
  const slices = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + maxChars);
    slices.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return slices.filter(Boolean);
}

function overlapTail(text, maxChars) {
  const clean = text.trim();
  if (!clean || maxChars <= 0) return "";
  if (clean.length <= maxChars) return clean;
  const tail = clean.slice(-maxChars);
  const boundary = tail.search(/[.!?。！？]\s+/);
  return boundary >= 0 ? tail.slice(boundary + 1).trim() : tail.trim();
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

const WORKFLOW_CONFIG = {
  "research-matrix": {
    label: "研究矩阵",
    keywords: "matrix research agenda object output framework scale mechanism intervention paper pipeline contribution",
    instruction: `本轮工作流：研究矩阵。
输出结构必须为：
1. 一句话结论。
2. 一个 Markdown 表格，按“研究对象 × 产出类型”组织，列包含：研究对象、框架/定义、测量/量表、机制检验、课程/干预、可写 paper。
3. 3 个可写 paper 方向，每个方向说明理论入口、方法、贡献。
4. 下一步行动，用 3-5 条 bullet。
5. 证据边界：说明哪些判断来自 Thomas 一作核心语料，哪些只是迁移建议。`
  },
  "concept-boundary": {
    label: "概念边界",
    keywords: "definition construct boundary literacy competency framework measurement validity scale self-efficacy",
    instruction: `本轮工作流：概念边界。
输出结构必须为：
1. 一句话结论。
2. 一个 Markdown 定义对照表，列包含：概念、核心定义、边界、行动要求、测量指标、常见误区。
3. 边界判断：什么情况应使用概念 A，什么情况应使用概念 B。
4. 测量建议：维度、条目来源、验证方法。
5. Thomas Reasoning 对应在哪里：说明定义、框架、测量三步如何体现。
6. 证据边界。`
  },
  "variable-model": {
    label: "变量模型",
    keywords: "variable model hypothesis mediation moderation SEM CFA method mechanism autonomy competence relatedness",
    instruction: `本轮工作流：变量模型。
输出结构必须为：
1. 一句话结论。
2. 一个 Markdown 变量表，列包含：变量角色、变量名称、理论依据、测量方式、预期方向。
3. 机制路径，用文本箭头或代码块表示。
4. 3-6 条假设草案，必须可直接改写进论文。
5. 方法建议：样本、设计、分析方法、稳健性检查。
6. Thomas Reasoning 对应在哪里与证据边界。`
  },
  "paper-pipeline": {
    label: "论文序列",
    keywords: "pipeline publication sequence year plan paper contribution agenda framework scale mechanism intervention",
    instruction: `本轮工作流：论文序列。
输出结构必须为：
1. 一句话结论。
2. 一个 Markdown 时间线表，列包含：时间、paper、核心问题、理论/框架、方法、预期贡献、可积累资产。
3. 说明 1 年、3 年、5 年阶段目标。
4. 说明哪些资产会复用，例如量表、框架、数据集、课程材料。
5. Thomas Reasoning 对应在哪里与证据边界。`
  },
  "paragraph-feedback": {
    label: "段落反馈",
    keywords: "paragraph abstract introduction discussion revision writing claim contribution implication concise academic",
    instruction: `本轮工作流：段落反馈。
输出结构必须为：
1. 一个 Markdown 问题诊断表，列包含：问题类型、原文表现、为什么影响论文、修改策略。
2. 改写版本，保持学术表达清晰直接。
3. 可保留内容。
4. 需要删除、弱化或移动的内容。
5. Thomas Reasoning 对应在哪里：说明如何回到教育问题、机制、贡献和制度含义。
6. 如用户没有给段落，先要求用户贴段落，但仍可给出需要检查的维度表。`
  }
};

function selectContext(query, mode, workflow) {
  const corpus = loadCorpus();
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG["research-design"];
  const workflowConfig = WORKFLOW_CONFIG[workflow] || null;
  const terms = extractTerms(`${query} ${modeConfig.keywords} ${workflowConfig?.keywords || ""}`);
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
    if (chunk.kind === "paper" && currentCount >= MAX_CHUNKS_PER_PAPER) continue;
    if (selected.length >= MAX_SELECTED_CHUNKS) break;
    if (totalChars + chunk.text.length > MAX_CONTEXT_CHARS && selected.length >= 4) continue;
    selected.push(chunk);
    rowCounts.set(rowKey, currentCount + 1);
    totalChars += chunk.text.length;
  }

  if (!selected.some((chunk) => chunk.kind === "distilled")) {
    const distilled = corpus.chunks.find((chunk) => chunk.kind === "distilled");
    if (distilled) selected.unshift(distilled);
  }

  return selected.slice(0, MAX_SELECTED_CHUNKS);
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

function buildSystemPrompt(mode, selectedChunks, workflow) {
  const corpus = loadCorpus();
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG["research-design"];
  const workflowConfig = WORKFLOW_CONFIG[workflow] || null;
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
${workflowConfig ? `当前研究工具：${workflowConfig.label}\n${workflowConfig.instruction}` : ""}
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
- 回答要像研究工作台输出，不要像长篇散文。优先使用清楚的小标题、短段落、项目符号和 Markdown 表格。
- 当用户询问路径、策略、比较、概念边界、变量设计、论文结构、研究计划或“可复制做法”时，必须给出至少一个 Markdown 表格。
- 表格要有实用列名，例如：模式、Thomas 式做法、为什么有效、可复制动作、注意风险；不要只放空泛标签。
- 复杂回答建议结构：一句话结论 -> 表格/矩阵 -> 3-5 条行动步骤 -> 证据边界或注意事项。
- 如果回答超过 5 个要点，优先压缩成表格；避免连续 4 段以上的大段文字。
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

async function callDeepSeek(messages, mode, workflow) {
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
  const selectedChunks = selectContext(latestUser, mode, workflow);
  const systemPrompt = buildSystemPrompt(mode, selectedChunks, workflow);
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
        max_tokens: 2400,
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
        sources: publicSources(selectedChunks),
        workflow: WORKFLOW_CONFIG[workflow] ? workflow : null
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
  fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDataDir();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
}

function readJsonFile(filePath, fallback) {
  const data = safeJson(readText(filePath), null);
  return data && typeof data === "object" ? data : fallback;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username
  };
}

function readUsersStore() {
  ensureDataDir();
  const store = readJsonFile(USERS_FILE, null);
  if (store && Array.isArray(store.users)) return store;
  return { users: [] };
}

function writeUsersStore(store) {
  writeJson(USERS_FILE, {
    users: Array.isArray(store.users) ? store.users : []
  });
}

function readSessionsStore() {
  ensureDataDir();
  const store = readJsonFile(SESSIONS_FILE, null);
  if (store && Array.isArray(store.sessions)) return store;
  return { sessions: [] };
}

function writeSessionsStore(store) {
  writeJson(SESSIONS_FILE, {
    sessions: Array.isArray(store.sessions) ? store.sessions : []
  });
}

function findUserByUsername(username) {
  const normalized = normalizeUsername(username);
  const store = readUsersStore();
  return store.users.find((user) => user.username === normalized && !user.disabled) || null;
}

function findUserById(userId) {
  if (userId === DEV_USER.id && !AUTH_REQUIRED) return DEV_USER;
  const store = readUsersStore();
  return store.users.find((user) => user.id === userId && !user.disabled) || null;
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

function verifyPassword(password, passwordRecord) {
  if (!passwordRecord || passwordRecord.algorithm !== "pbkdf2-sha256") return false;
  const iterations = Number(passwordRecord.iterations);
  const salt = Buffer.from(String(passwordRecord.salt || ""), "base64");
  const expected = Buffer.from(String(passwordRecord.hash || ""), "base64");
  if (!Number.isFinite(iterations) || iterations <= 0 || !salt.length || !expected.length) return false;
  const actual = crypto.pbkdf2Sync(String(password || ""), salt, iterations, expected.length, "sha256");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function hashSessionToken(token) {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(String(token || ""))
    .digest("base64url");
}

function createSession(user, req) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const sessions = readSessionsStore();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 160);
  sessions.sessions = sessions.sessions
    .filter((session) => Date.parse(session.expiresAt) > now.getTime())
    .filter((session) => session.userId !== user.id || Date.parse(session.expiresAt) > now.getTime());
  sessions.sessions.push({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashSessionToken(token),
    createdAt: now.toISOString(),
    expiresAt,
    lastSeenAt: now.toISOString(),
    userAgentHash: crypto.createHash("sha256").update(userAgent).digest("base64url")
  });
  writeSessionsStore(sessions);
  return { token, expiresAt };
}

function destroySession(req) {
  const token = readCookie(req, SESSION_COOKIE_NAME);
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  const sessions = readSessionsStore();
  sessions.sessions = sessions.sessions.filter((session) => session.tokenHash !== tokenHash);
  writeSessionsStore(sessions);
}

function currentUser(req) {
  const token = readCookie(req, SESSION_COOKIE_NAME);
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const now = Date.now();
  const sessions = readSessionsStore();
  let changed = false;
  sessions.sessions = sessions.sessions.filter((session) => {
    const keep = Date.parse(session.expiresAt) > now;
    if (!keep) changed = true;
    return keep;
  });
  const session = sessions.sessions.find((item) => item.tokenHash === tokenHash);
  if (!session) {
    if (changed) writeSessionsStore(sessions);
    return null;
  }
  session.lastSeenAt = new Date().toISOString();
  changed = true;
  const user = findUserById(session.userId);
  if (!user) {
    sessions.sessions = sessions.sessions.filter((item) => item !== session);
  }
  if (changed) writeSessionsStore(sessions);
  return user || null;
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (user) return user;
  if (!AUTH_REQUIRED) return DEV_USER;
  sendJson(res, 401, {
    error: "auth_required",
    message: "请先登录 AI Thomas。"
  });
  return null;
}

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(/;\s*/).filter(Boolean);
  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    if (index < 0) continue;
    const key = cookie.slice(0, index);
    if (key === name) return decodeURIComponent(cookie.slice(index + 1));
  }
  return "";
}

function isSecureRequest(req) {
  return req.socket.encrypted ||
    String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https" ||
    readBoolean("COOKIE_SECURE", false);
}

function setSessionCookie(req, res, token, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(req, res) {
  setSessionCookie(req, res, "", 0);
}

function userConversationDir(userId) {
  return path.join(CONVERSATIONS_DIR, safePathSegment(userId));
}

function conversationPath(userId, conversationId) {
  return path.join(userConversationDir(userId), `${safePathSegment(conversationId)}.json`);
}

function safePathSegment(value) {
  const segment = String(value || "").replace(/[^A-Za-z0-9._-]/g, "");
  if (!segment) throw new Error("Invalid path segment.");
  return segment;
}

function createConversation(user, title = "New conversation") {
  const now = new Date().toISOString();
  const conversation = {
    id: crypto.randomUUID(),
    userId: user.id,
    title: normalizeTitle(title) || "New conversation",
    createdAt: now,
    updatedAt: now,
    mode: "research-design",
    workflow: null,
    messages: []
  };
  writeConversation(conversation);
  return conversation;
}

function readConversation(user, conversationId) {
  if (!conversationId) return null;
  const filePath = conversationPath(user.id, conversationId);
  const conversation = readJsonFile(filePath, null);
  if (!conversation || conversation.userId !== user.id || conversation.deletedAt) return null;
  conversation.messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  return conversation;
}

function writeConversation(conversation) {
  writeJson(conversationPath(conversation.userId, conversation.id), conversation);
}

function deleteConversation(user, conversationId) {
  const conversation = readConversation(user, conversationId);
  if (!conversation) return false;
  conversation.deletedAt = new Date().toISOString();
  conversation.updatedAt = conversation.deletedAt;
  writeConversation(conversation);
  return true;
}

function listConversations(user) {
  ensureDataDir();
  const dir = userConversationDir(user.id);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => readJsonFile(path.join(dir, fileName), null))
    .filter((conversation) => conversation && conversation.userId === user.id && !conversation.deletedAt)
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title || "New conversation",
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: Array.isArray(conversation.messages) ? conversation.messages.length : 0
    }))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function serializeConversation(conversation) {
  return {
    id: conversation.id,
    title: conversation.title || "New conversation",
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    mode: conversation.mode || "research-design",
    workflow: conversation.workflow || null,
    messages: Array.isArray(conversation.messages) ? conversation.messages : []
  };
}

function normalizeTitle(title) {
  return String(title || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function titleFromMessage(message) {
  const clean = normalizeTitle(message);
  return clean ? clean.slice(0, 36) : "New conversation";
}

function makeMessage(role, content, extra = {}) {
  return {
    id: crypto.randomUUID(),
    role,
    content: String(content || ""),
    createdAt: new Date().toISOString(),
    ...extra
  };
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

function checkAndRecordUsage(req, messages, user = null) {
  const store = readUsageStore();
  const windows = usageWindow();
  const key = user ? `user:${user.id}` : `client:${clientKey(req)}`;
  const estimate = estimateTokensForRequest(messages);

  const client = store.clients[key] || {};
  const global = store.global || {};

  const clientHour = client.hour === windows.hour ? client.hourCount || 0 : 0;
  const clientDay = client.day === windows.day ? client.dayCount || 0 : 0;
  const globalDay = global.day === windows.day ? global.dayCount || 0 : 0;
  const globalMonthTokens = global.month === windows.month ? global.monthEstimatedTokens || 0 : 0;

  const retryMessage = "AI Thomas 今天的安全使用额度已到。为了保护 DeepSeek API key，请稍后再试。";
  if (clientHour >= LIMITS.perHour) {
    return { ok: false, status: 429, message: `这个账号每小时最多 ${LIMITS.perHour} 次请求。请稍后再试。` };
  }
  if (clientDay >= LIMITS.perDay) {
    return { ok: false, status: 429, message: `这个账号每天最多 ${LIMITS.perDay} 次请求。明天会自动恢复。` };
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
    userId: user?.id || null,
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
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/status") {
    const corpus = loadCorpus();
    const user = currentUser(req) || (!AUTH_REQUIRED ? DEV_USER : null);
    return sendJson(res, 200, {
      ok: true,
      authRequired: AUTH_REQUIRED,
      authenticated: Boolean(user),
      user: publicUser(user),
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

  if (req.method === "GET" && pathname === "/api/auth/me") {
    const user = currentUser(req) || (!AUTH_REQUIRED ? DEV_USER : null);
    return sendJson(res, 200, {
      authRequired: AUTH_REQUIRED,
      authenticated: Boolean(user),
      user: publicUser(user)
    });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readRequestBody(req);
    const payload = safeJson(body, {});
    const username = normalizeUsername(payload.username);
    const password = String(payload.password || "");
    const user = findUserByUsername(username);
    if (!user || !verifyPassword(password, user.password)) {
      return sendJson(res, 401, {
        error: "invalid_credentials",
        message: "用户名或密码不正确。"
      });
    }
    const session = createSession(user, req);
    setSessionCookie(req, res, session.token, SESSION_TTL_MS / 1000);
    return sendJson(res, 200, {
      ok: true,
      user: publicUser(user),
      expiresAt: session.expiresAt
    });
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    destroySession(req);
    clearSessionCookie(req, res);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/articles") {
    const corpus = loadCorpus();
    return sendJson(res, 200, { articles: corpus.articles });
  }

  if (pathname === "/api/conversations") {
    const user = requireUser(req, res);
    if (!user) return;

    if (req.method === "GET") {
      return sendJson(res, 200, { conversations: listConversations(user) });
    }

    if (req.method === "POST") {
      const body = await readRequestBody(req);
      const payload = safeJson(body, {});
      const conversation = createConversation(user, payload.title);
      return sendJson(res, 201, {
        conversation: serializeConversation(conversation),
        conversations: listConversations(user)
      });
    }
  }

  if (pathname.startsWith("/api/conversations/")) {
    const user = requireUser(req, res);
    if (!user) return;

    const conversationId = decodeURIComponent(pathname.replace("/api/conversations/", ""));
    let conversation = null;
    try {
      conversation = readConversation(user, conversationId);
    } catch {
      conversation = null;
    }

    if (!conversation) {
      return sendJson(res, 404, { error: "not_found" });
    }

    if (req.method === "GET") {
      return sendJson(res, 200, { conversation: serializeConversation(conversation) });
    }

    if (req.method === "PATCH") {
      const body = await readRequestBody(req);
      const payload = safeJson(body, {});
      const title = normalizeTitle(payload.title);
      if (title) conversation.title = title;
      conversation.updatedAt = new Date().toISOString();
      writeConversation(conversation);
      return sendJson(res, 200, {
        conversation: serializeConversation(conversation),
        conversations: listConversations(user)
      });
    }

    if (req.method === "DELETE") {
      deleteConversation(user, conversationId);
      return sendJson(res, 200, { ok: true, conversations: listConversations(user) });
    }
  }

  if (req.method === "POST" && pathname === "/api/chat") {
    const body = await readRequestBody(req);
    const payload = safeJson(body, {});
    const mode = payload.mode || "research-design";
    const workflow = WORKFLOW_CONFIG[payload.workflow] ? payload.workflow : null;

    if (!AUTH_REQUIRED && Array.isArray(payload.messages) && !payload.message && !payload.conversationId) {
      const messages = payload.messages;
      const usage = checkAndRecordUsage(req, messages, null);
      if (!usage.ok) {
        return sendJson(res, usage.status, { error: "usage_limit_reached", message: usage.message });
      }
      const result = await callDeepSeek(messages, mode, workflow);
      return sendJson(res, result.status, result.body);
    }

    const user = requireUser(req, res);
    if (!user) return;

    const message = String(payload.message || "").trim();
    if (!message) {
      return sendJson(res, 400, {
        error: "empty_message",
        message: "请输入要发送给 AI Thomas 的内容。"
      });
    }

    let conversation = null;
    try {
      conversation = payload.conversationId ? readConversation(user, payload.conversationId) : null;
    } catch {
      conversation = null;
    }
    if (payload.conversationId && !conversation) {
      return sendJson(res, 404, { error: "not_found" });
    }
    if (!conversation) {
      conversation = createConversation(user, titleFromMessage(message));
    }

    const userMessage = makeMessage("user", message);
    const messages = [...conversation.messages, userMessage]
      .filter((item) => ["user", "assistant"].includes(item.role));

    const usage = checkAndRecordUsage(req, messages, user);
    if (!usage.ok) {
      return sendJson(res, usage.status, { error: "usage_limit_reached", message: usage.message });
    }

    conversation.messages.push(userMessage);
    if (!conversation.title || conversation.title === "New conversation") {
      conversation.title = titleFromMessage(message);
    }
    conversation.mode = mode;
    conversation.workflow = workflow;
    conversation.updatedAt = new Date().toISOString();
    writeConversation(conversation);

    const result = await callDeepSeek(messages, mode, workflow);
    if (result.status === 200) {
      const assistantMessage = makeMessage("assistant", result.body.answer || "", {
        sources: result.body.sources || [],
        workflow: result.body.workflow || null
      });
      conversation.messages.push(assistantMessage);
      conversation.updatedAt = assistantMessage.createdAt;
      writeConversation(conversation);
      return sendJson(res, 200, {
        ...result.body,
        conversation: serializeConversation(conversation),
        conversations: listConversations(user)
      });
    }
    return sendJson(res, result.status, {
      ...result.body,
      conversation: serializeConversation(conversation)
    });
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
  if (!ALLOWED_ORIGINS.includes("*")) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
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
    console.log(`Auth required: ${AUTH_REQUIRED ? "yes" : "no"}`);
    if (AUTH_REQUIRED && !process.env.SESSION_SECRET) {
      console.warn("AUTH_REQUIRED=true but SESSION_SECRET is not set. Set a long random SESSION_SECRET before production use.");
    }
  });
}

start(START_PORT);
