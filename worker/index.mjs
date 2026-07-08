import { BASE_SYSTEM_PROMPT, DISTILLED_KNOWLEDGE, MATRIX_SUMMARY } from "./knowledge.mjs";

const SESSION_COOKIE_NAME = "ai_thomas_guest";
const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2";
const MODELSCOPE_BASE_URL = "https://api-inference.modelscope.cn/v1";
const ANONYMOUS_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_HISTORY_MESSAGES = 10;

const DEFAULT_ALLOWED_ORIGINS = [
  "https://jojo-edtech.github.io",
  "http://localhost:8913",
  "http://127.0.0.1:8913"
];

const MODE_CONFIG = {
  "research-design": {
    label: "研究设计",
    instruction: "优先把研究想法拆成对象、变量、机制、方法路径和可执行下一步。"
  },
  "theory-frame": {
    label: "理论框架",
    instruction: "优先处理概念边界、理论机制、维度定义和测量逻辑。"
  },
  "literature-position": {
    label: "文献定位",
    instruction: "优先处理贡献、缺口、研究议程、paper pipeline 与文献定位。"
  },
  "writing-feedback": {
    label: "写作反馈",
    instruction: "优先给段落诊断、改写版本、可保留内容和需要弱化的内容。"
  }
};

const WORKFLOW_CONFIG = {
  "research-matrix": {
    label: "研究矩阵",
    instruction: `输出结构必须为：一句话结论；一个 Markdown 表格，按“研究对象 × 产出类型”组织；3 个可写 paper 方向；下一步行动；证据边界。`
  },
  "concept-boundary": {
    label: "概念边界",
    instruction: `输出结构必须为：一句话结论；定义对照表；边界判断；测量建议；导师反馈依据；证据边界。`
  },
  "variable-model": {
    label: "变量模型",
    instruction: `输出结构必须为：一句话结论；变量表；机制路径；假设草案；方法建议；注意风险。`
  },
  "paper-pipeline": {
    label: "论文序列",
    instruction: `输出结构必须为：一句话结论；时间线表；每篇 paper 的理论/方法/贡献；可积累资产；证据边界。`
  },
  "paragraph-feedback": {
    label: "段落反馈",
    instruction: `输出结构必须为：问题诊断表；改写版本；可保留内容；需删除或弱化内容；导师反馈依据。`
  }
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });

    const url = new URL(request.url);
    try {
      if (!url.pathname.startsWith("/api/")) {
        return json(request, env, { ok: true, service: "AI Thomas ModelScope Worker" });
      }
      return await handleApi(request, env, url);
    } catch (error) {
      return json(request, env, {
        error: "worker_error",
        message: error?.message || "Worker request failed."
      }, 500);
    }
  }
};

async function handleApi(request, env, url) {
  const pathname = url.pathname;

  if (request.method === "GET" && pathname === "/api/status") {
    const usage = await readUsage(env);
    const limits = readLimits(env);
    return json(request, env, {
      ok: true,
      provider: "modelscope",
      accessMode: "anonymous",
      authRequired: false,
      authenticated: false,
      allowCrossOriginApp: true,
      user: null,
      hasApiKey: Boolean(env.MODELSCOPE_API_KEY),
      model: modelName(env),
      paperCount: 50,
      chunkCount: 4081,
      missingCount: 6,
      freeQuotaProtected: true,
      limits: {
        perHour: limits.perHour,
        perDay: limits.perDay,
        globalPerDay: limits.globalPerDay,
        modelScopeFreeDailyCalls: limits.modelScopeFreeDailyCalls
      },
      usage: {
        globalToday: usage.globalDayCount || 0,
        remainingToday: Math.max(0, limits.globalCap - (usage.globalDayCount || 0))
      }
    });
  }

  if (request.method === "GET" && pathname === "/api/auth/me") {
    const user = currentUser(request);
    return withGuestCookie(request, env, user.id, json(request, env, {
      accessMode: "anonymous",
      authRequired: false,
      authenticated: true,
      allowCrossOriginApp: true,
      user: publicUser(user)
    }));
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    const response = json(request, env, { ok: true });
    response.headers.append("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`);
    return response;
  }

  if (pathname === "/api/conversations") {
    const user = currentUser(request);
    if (request.method === "GET") {
      return withGuestCookie(request, env, user.id, json(request, env, {
        conversations: await listConversations(env, user.id)
      }));
    }
    if (request.method === "POST") {
      const payload = await readJson(request);
      const conversation = await createConversation(env, user.id, payload.title || "New conversation");
      return withGuestCookie(request, env, user.id, json(request, env, {
        conversation: serializeConversation(conversation),
        conversations: await listConversations(env, user.id)
      }, 201));
    }
  }

  if (pathname.startsWith("/api/conversations/")) {
    const user = currentUser(request);
    const conversationId = decodeURIComponent(pathname.replace("/api/conversations/", ""));
    const conversation = await readConversation(env, user.id, conversationId);
    if (!conversation) return json(request, env, { error: "not_found" }, 404);

    if (request.method === "GET") {
      return withGuestCookie(request, env, user.id, json(request, env, { conversation: serializeConversation(conversation) }));
    }
    if (request.method === "PATCH") {
      const payload = await readJson(request);
      const title = normalizeTitle(payload.title);
      if (title) conversation.title = title;
      conversation.updatedAt = new Date().toISOString();
      await writeConversation(env, conversation);
      return withGuestCookie(request, env, user.id, json(request, env, {
        conversation: serializeConversation(conversation),
        conversations: await listConversations(env, user.id)
      }));
    }
    if (request.method === "DELETE") {
      await deleteConversation(env, user.id, conversationId);
      return withGuestCookie(request, env, user.id, json(request, env, {
        ok: true,
        conversations: await listConversations(env, user.id)
      }));
    }
  }

  if (request.method === "POST" && pathname === "/api/chat") {
    return await handleChat(request, env);
  }

  return json(request, env, { error: "not_found" }, 404);
}

async function handleChat(request, env) {
  if (!env.MODELSCOPE_API_KEY) {
    return json(request, env, {
      error: "missing_key",
      message: "ModelScope token 还没有配置到 Worker。"
    }, 400);
  }

  const payload = await readJson(request);
  const user = currentUser(request);
  const message = String(payload.message || "").trim();
  if (!message) {
    return json(request, env, {
      error: "empty_message",
      message: "请输入要发送给 AI Thomas 的内容。"
    }, 400);
  }

  let conversation = payload.conversationId
    ? await readConversation(env, user.id, payload.conversationId)
    : null;
  if (payload.conversationId && !conversation) return json(request, env, { error: "not_found" }, 404);
  if (!conversation) conversation = await createConversation(env, user.id, titleFromMessage(message));

  const mode = MODE_CONFIG[payload.mode] ? payload.mode : "research-design";
  const workflow = WORKFLOW_CONFIG[payload.workflow] ? payload.workflow : null;
  const userMessage = makeMessage("user", message);
  const modelMessages = [...conversation.messages, userMessage]
    .filter((item) => ["user", "assistant"].includes(item.role))
    .slice(-MAX_HISTORY_MESSAGES);

  const usage = await checkAndRecordUsage(env, user.id);
  if (!usage.ok) {
    return json(request, env, {
      error: "usage_limit_reached",
      message: usage.message
    }, 429);
  }

  conversation.messages.push(userMessage);
  if (!conversation.title || conversation.title === "New conversation") conversation.title = titleFromMessage(message);
  conversation.mode = mode;
  conversation.workflow = workflow;
  conversation.updatedAt = userMessage.createdAt;
  await writeConversation(env, conversation);

  const modelResult = await callModelScope(env, modelMessages, mode, workflow);
  if (!modelResult.ok) {
    return json(request, env, {
      error: modelResult.error || "modelscope_error",
      message: modelResult.message,
      conversation: serializeConversation(conversation)
    }, modelResult.status || 500);
  }

  const assistantMessage = makeMessage("assistant", modelResult.answer, {
    sources: [{ title: "AI Thomas compact research mentor corpus", type: "distilled" }],
    workflow
  });
  conversation.messages.push(assistantMessage);
  conversation.updatedAt = assistantMessage.createdAt;
  await writeConversation(env, conversation);

  return withGuestCookie(request, env, user.id, json(request, env, {
    answer: modelResult.answer,
    model: modelName(env),
    provider: "modelscope",
    sources: assistantMessage.sources,
    workflow,
    conversation: serializeConversation(conversation),
    conversations: await listConversations(env, user.id)
  }));
}

async function callModelScope(env, messages, mode, workflow) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readInt(env.MODELSCOPE_TIMEOUT_MS, 55000));
  try {
    const response = await fetch(`${MODELSCOPE_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${env.MODELSCOPE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName(env),
        messages: [
          { role: "system", content: buildSystemPrompt(mode, workflow) },
          ...messages.map((item) => ({
            role: item.role,
            content: String(item.content || "").slice(0, 5000)
          }))
        ],
        temperature: 0.35,
        max_tokens: readInt(env.MODELSCOPE_MAX_TOKENS, 1800),
        stream: false
      })
    });
    const text = await response.text();
    const data = safeJson(text, {});
    if (!response.ok) {
      const message = data?.error?.message || data?.message || text.slice(0, 500) || `ModelScope returned ${response.status}`;
      return {
        ok: false,
        status: response.status,
        error: response.status === 429 ? "modelscope_quota_exhausted" : "modelscope_error",
        message: response.status === 429
          ? "ModelScope 免费额度已用完，为避免继续消耗已暂停。明天额度刷新后会自动恢复。"
          : message
      };
    }
    const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
    const answer = String(choice?.message?.content || choice?.text || "").trim();
    if (!answer) {
      return {
        ok: false,
        status: 502,
        error: "empty_model_response",
        message: "ModelScope 返回了空内容。请稍后再试，或切换模型。"
      };
    }
    return { ok: true, answer };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: "request_failed",
      message: error?.name === "AbortError" ? "ModelScope 响应超时。" : error?.message || "ModelScope 请求失败。"
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildSystemPrompt(mode, workflow) {
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG["research-design"];
  const workflowConfig = WORKFLOW_CONFIG[workflow] || null;
  return `${BASE_SYSTEM_PROMPT}

当前回答模式：${modeConfig.label}
${modeConfig.instruction}
${workflowConfig ? `当前研究工具：${workflowConfig.label}\n${workflowConfig.instruction}` : ""}

压缩知识底座：
${DISTILLED_KNOWLEDGE.slice(0, 9000)}

论文矩阵摘要：
${MATRIX_SUMMARY.slice(0, 7000)}

回答要求：
- 用中文回答，除非用户明确要求英文。
- 不冒充导师本人，不使用个人崇拜式表述。
- 定位是 24 小时科研导师助手：基于本地论文语料、教育研究规范和课题组常见讨论方式，帮助用户回应 research idea、拆问题、给写作和方法反馈。
- 优先使用清楚的小标题、短段落、项目符号和 Markdown 表格。
- 当用户询问路径、策略、比较、概念边界、变量设计、论文结构、研究计划或可复制做法时，必须给出至少一个 Markdown 表格。
- 复杂回答建议结构：一句话结论 -> 表格/矩阵 -> 3-5 条行动步骤 -> 证据边界或注意事项。
- 明确说明证据边界：哪些来自压缩语料，哪些只是迁移建议。`;
}

function currentUser(request) {
  const cookieUser = readCookie(request, SESSION_COOKIE_NAME);
  const headerUser = request.headers.get("X-AI-Thomas-Visitor");
  const id = isAnonymousUserId(cookieUser) ? cookieUser : isAnonymousUserId(headerUser) ? headerUser : newAnonymousId();
  return {
    id,
    username: "anonymous",
    displayName: "Guest workspace",
    anonymous: true
  };
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    anonymous: true
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request, env),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  const allowOrigin = origin && (allowed.includes("*") || allowed.includes(origin)) ? origin : "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-AI-Thomas-Visitor",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

function allowedOrigins(env) {
  const configured = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function withGuestCookie(request, env, userId, response) {
  if (!isAnonymousUserId(userId)) return response;
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(userId)}; Path=/; Max-Age=${ANONYMOUS_TTL_SECONDS}; HttpOnly; Secure; SameSite=None`
  );
  return response;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const item of header.split(/;\s*/)) {
    const index = item.indexOf("=");
    if (index < 0) continue;
    if (item.slice(0, index) === name) return decodeURIComponent(item.slice(index + 1));
  }
  return "";
}

function newAnonymousId() {
  return `anon_${crypto.randomUUID().replace(/-/g, "")}`;
}

function isAnonymousUserId(value) {
  return /^anon_[A-Za-z0-9_-]{16,}$/.test(String(value || ""));
}

function conversationIndexKey(userId) {
  return `conv-index:${userId}`;
}

function conversationKey(userId, conversationId) {
  return `conversation:${userId}:${conversationId}`;
}

async function listConversations(env, userId) {
  const ids = await readConversationIndex(env, userId);
  const rows = [];
  for (const id of ids.slice(0, 50)) {
    const conversation = await readConversation(env, userId, id);
    if (!conversation) continue;
    rows.push({
      id: conversation.id,
      title: conversation.title || "New conversation",
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: Array.isArray(conversation.messages) ? conversation.messages.length : 0
    });
  }
  return rows.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

async function readConversationIndex(env, userId) {
  const value = await env.AI_THOMAS_KV.get(conversationIndexKey(userId), "json");
  return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
}

async function writeConversationIndex(env, userId, ids) {
  const unique = Array.from(new Set(ids)).slice(0, 50);
  await env.AI_THOMAS_KV.put(conversationIndexKey(userId), JSON.stringify(unique), { expirationTtl: ANONYMOUS_TTL_SECONDS });
}

async function createConversation(env, userId, title = "New conversation") {
  const now = new Date().toISOString();
  const conversation = {
    id: crypto.randomUUID(),
    userId,
    title: normalizeTitle(title) || "New conversation",
    createdAt: now,
    updatedAt: now,
    mode: "research-design",
    workflow: null,
    messages: []
  };
  await writeConversation(env, conversation);
  return conversation;
}

async function readConversation(env, userId, conversationId) {
  if (!conversationId) return null;
  const conversation = await env.AI_THOMAS_KV.get(conversationKey(userId, conversationId), "json");
  if (!conversation || conversation.userId !== userId || conversation.deletedAt) return null;
  conversation.messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  return conversation;
}

async function writeConversation(env, conversation) {
  await env.AI_THOMAS_KV.put(conversationKey(conversation.userId, conversation.id), JSON.stringify(conversation), {
    expirationTtl: ANONYMOUS_TTL_SECONDS
  });
  const ids = await readConversationIndex(env, conversation.userId);
  await writeConversationIndex(env, conversation.userId, [conversation.id, ...ids]);
}

async function deleteConversation(env, userId, conversationId) {
  await env.AI_THOMAS_KV.delete(conversationKey(userId, conversationId));
  const ids = await readConversationIndex(env, userId);
  await writeConversationIndex(env, userId, ids.filter((id) => id !== conversationId));
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

function makeMessage(role, content, extra = {}) {
  return {
    id: crypto.randomUUID(),
    role,
    content: String(content || ""),
    createdAt: new Date().toISOString(),
    ...extra
  };
}

function titleFromMessage(message) {
  return normalizeTitle(message).slice(0, 36) || "New conversation";
}

function normalizeTitle(title) {
  return String(title || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

async function readUsage(env) {
  const windows = usageWindow();
  const global = await env.AI_THOMAS_KV.get(`usage:global:${windows.day}`, "json");
  return global && typeof global === "object" ? global : {};
}

async function checkAndRecordUsage(env, userId) {
  const limits = readLimits(env);
  const windows = usageWindow();
  const userHourKey = `usage:user:${userId}:${windows.hour}`;
  const userDayKey = `usage:user:${userId}:${windows.day}`;
  const globalDayKey = `usage:global:${windows.day}`;
  const [userHour, userDay, globalDay] = await Promise.all([
    env.AI_THOMAS_KV.get(userHourKey, "json"),
    env.AI_THOMAS_KV.get(userDayKey, "json"),
    env.AI_THOMAS_KV.get(globalDayKey, "json")
  ]);
  const userHourCount = Number(userHour?.count || 0);
  const userDayCount = Number(userDay?.count || 0);
  const globalDayCount = Number(globalDay?.globalDayCount || 0);

  if (userHourCount >= limits.perHour) {
    return { ok: false, message: `这个访客每小时最多 ${limits.perHour} 次请求。请稍后再试。` };
  }
  if (userDayCount >= limits.perDay) {
    return { ok: false, message: `这个访客每天最多 ${limits.perDay} 次请求。明天会自动恢复。` };
  }
  if (globalDayCount >= limits.globalCap) {
    return { ok: false, message: "ModelScope 免费额度保护已触发。为避免继续消耗，AI Thomas 今天已暂停调用，明天会自动恢复。" };
  }

  const now = new Date().toISOString();
  await Promise.all([
    env.AI_THOMAS_KV.put(userHourKey, JSON.stringify({ count: userHourCount + 1, updatedAt: now }), { expirationTtl: 2 * 60 * 60 }),
    env.AI_THOMAS_KV.put(userDayKey, JSON.stringify({ count: userDayCount + 1, updatedAt: now }), { expirationTtl: 2 * 24 * 60 * 60 }),
    env.AI_THOMAS_KV.put(globalDayKey, JSON.stringify({ globalDayCount: globalDayCount + 1, updatedAt: now }), { expirationTtl: 2 * 24 * 60 * 60 })
  ]);

  return { ok: true };
}

function readLimits(env) {
  const modelScopeFreeDailyCalls = readInt(env.MODELSCOPE_FREE_DAILY_CALLS, 2000);
  const globalPerDay = readInt(env.MAX_GLOBAL_REQUESTS_PER_DAY, 300);
  return {
    perHour: readInt(env.MAX_REQUESTS_PER_HOUR, 8),
    perDay: readInt(env.MAX_REQUESTS_PER_DAY, 20),
    globalPerDay,
    modelScopeFreeDailyCalls,
    globalCap: Math.min(globalPerDay, modelScopeFreeDailyCalls)
  };
}

function usageWindow(now = new Date()) {
  const iso = now.toISOString();
  return {
    hour: iso.slice(0, 13),
    day: iso.slice(0, 10)
  };
}

function modelName(env) {
  return env.MODELSCOPE_MODEL || DEFAULT_MODEL;
}

function readInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function safeJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
