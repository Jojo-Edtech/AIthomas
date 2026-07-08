const LEGACY_STORAGE_KEY = "ai-thomas-current-conversation-v2";
const ACTIVE_CONVERSATION_KEY = "ai-thomas-active-conversation-v1";
const DEFAULT_MESSAGES = [
  {
    role: "assistant",
    content: "你好，我是 AI Thomas。你可以直接把研究题目、段落、变量想法或追问发给我。"
  }
];

const WORKFLOW_TEMPLATES = {
  "research-matrix": {
    mode: "research-design",
    label: "研究矩阵",
    prompt: "请用 Thomas Reasoning，把下面的研究方向拆成“对象 × 产出类型”的研究矩阵。\n\n研究方向：\n\n输出请包括：一句话结论、研究矩阵表、3 个可写 paper 方向、下一步行动。"
  },
  "concept-boundary": {
    mode: "theory-frame",
    label: "概念边界",
    prompt: "请用 Thomas Reasoning，帮我区分下面概念的边界，并说明如何定义、测量和写进论文。\n\n概念：\n\n输出请包括：定义对照表、边界判断、测量建议、Thomas Reasoning 对应在哪里。"
  },
  "variable-model": {
    mode: "research-design",
    label: "变量模型",
    prompt: "请用 Thomas Reasoning，把下面的研究想法转成变量模型、机制路径、假设草案和方法建议。\n\n研究想法：\n\n输出请包括：变量表、机制路径、假设草案、方法建议、注意风险。"
  },
  "paper-pipeline": {
    mode: "literature-position",
    label: "论文序列",
    prompt: "请用 Thomas Reasoning，为下面的研究方向设计一个 1 年 / 3 年 / 5 年论文序列。\n\n研究方向：\n\n输出请包括：时间线表、每篇 paper 的理论/方法/贡献、可积累资产、证据边界。"
  },
  "paragraph-feedback": {
    mode: "writing-feedback",
    label: "段落反馈",
    prompt: "请用 Thomas Reasoning，诊断并改写下面的论文段落。请指出逻辑问题、哪些内容保留、哪些需要删改。\n\n段落：\n\n输出请包括：问题诊断表、改写版本、可保留内容、需删除或弱化内容。"
  }
};

const state = {
  user: null,
  authRequired: true,
  conversations: [],
  activeConversationId: loadActiveConversationId(),
  mode: "research-design",
  workflow: null,
  messages: [...DEFAULT_MESSAGES],
  busy: false
};

const loginScreen = document.querySelector("#loginScreen");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const loginUsername = document.querySelector("#loginUsername");
const loginPassword = document.querySelector("#loginPassword");
const loginError = document.querySelector("#loginError");
const userBadge = document.querySelector("#userBadge");
const logoutButton = document.querySelector("#logoutButton");
const conversationList = document.querySelector("#conversationList");
const newConversationButton = document.querySelector("#newConversationButton");
const messageList = document.querySelector("#messageList");
const composer = document.querySelector("#composer");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const modeGrid = document.querySelector("#modeGrid");
const workflowGrid = document.querySelector("#workflowGrid");
const workflowChip = document.querySelector("#workflowChip");
const quickRow = document.querySelector("#quickRow");
const clearButton = document.querySelector("#clearButton");
const corpusStatus = document.querySelector("#corpusStatus");
const paperCount = document.querySelector("#paperCount");
const missingCount = document.querySelector("#missingCount");
const chunkCount = document.querySelector("#chunkCount");
const modelName = document.querySelector("#modelName");
const keyStatus = document.querySelector("#keyStatus");
const statusDot = document.querySelector("#statusDot");

init();

async function init() {
  showAppShell(false);
  renderMessages();
  renderWorkflowButtons();
  await loadStatus();
  await refreshAuth();
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const username = loginUsername.value.trim();
  const password = loginPassword.value;
  if (!username || !password) {
    loginError.textContent = "请输入用户名和密码。";
    return;
  }

  const result = await apiJson("api/auth/login", {
    method: "POST",
    body: { username, password }
  });
  if (!result.ok) {
    loginError.textContent = result.data?.message || "登录失败。";
    return;
  }
  state.user = result.data.user;
  removeLegacyConversation();
  loginPassword.value = "";
  showAppShell(true);
  await loadConversations();
});

logoutButton?.addEventListener("click", async () => {
  await apiJson("api/auth/logout", { method: "POST" });
  state.user = null;
  state.conversations = [];
  state.activeConversationId = null;
  state.messages = [...DEFAULT_MESSAGES];
  saveActiveConversationId();
  renderConversationList();
  renderMessages();
  if (state.authRequired) showLogin();
  else await refreshAuth();
});

modeGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (!button) return;
  setMode(button.dataset.mode);
  state.workflow = null;
  renderWorkflowButtons();
});

workflowGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-workflow]");
  if (!button) return;
  const workflow = button.dataset.workflow;
  const template = WORKFLOW_TEMPLATES[workflow];
  if (!template) return;
  state.workflow = workflow;
  setMode(template.mode);
  renderWorkflowButtons();
  input.value = template.prompt;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
});

conversationList?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-conversation]");
  if (deleteButton) {
    event.stopPropagation();
    const conversationId = deleteButton.dataset.deleteConversation;
    const ok = window.confirm("删除这个会话？");
    if (!ok) return;
    await deleteConversation(conversationId);
    return;
  }

  const button = event.target.closest("[data-conversation-id]");
  if (!button) return;
  await loadConversation(button.dataset.conversationId);
});

newConversationButton?.addEventListener("click", () => createConversation());
clearButton.addEventListener("click", () => createConversation());

if (quickRow) {
  quickRow.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    input.value = button.textContent.trim();
    input.focus();
  });
}

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content || state.busy) return;
  input.value = "";
  state.messages.push({ role: "user", content });
  state.messages.push({ role: "assistant", content: "正在匹配本地论文语料，并生成研究分析...", loading: true });
  renderMessages();
  await sendMessage(content);
});

async function refreshAuth() {
  const result = await apiJson("api/auth/me");
  if (!result.ok || (result.data?.authRequired && !result.data?.authenticated)) {
    state.authRequired = Boolean(result.data?.authRequired ?? true);
    showLogin();
    return;
  }
  state.authRequired = Boolean(result.data.authRequired);
  state.user = result.data.user;
  removeLegacyConversation();
  showAppShell(true);
  await loadConversations();
}

function showLogin() {
  showAppShell(false);
  loginScreen.hidden = false;
  loginUsername?.focus();
}

function showAppShell(visible) {
  if (appShell) appShell.hidden = !visible;
  if (loginScreen) loginScreen.hidden = visible;
  if (userBadge) userBadge.textContent = state.user?.displayName || state.user?.username || "Not signed in";
}

async function loadStatus() {
  try {
    const response = await fetch(apiUrl("api/status"), { credentials: "include" });
    const status = await response.json();
    corpusStatus.textContent = `${status.paperCount} 篇 PDF · ${status.chunkCount} 个本地片段`;
    paperCount.textContent = status.paperCount;
    chunkCount.textContent = status.chunkCount;
    missingCount.textContent = status.missingCount;
    modelName.textContent = formatModelName(status.model);
    keyStatus.textContent = status.hasApiKey ? "DeepSeek API 已连接" : "DeepSeek API 未连接";
    keyStatus.classList.toggle("ok", status.hasApiKey);
    keyStatus.classList.toggle("missing", !status.hasApiKey);
    statusDot.classList.toggle("ok", status.hasApiKey);
    statusDot.classList.toggle("missing", !status.hasApiKey);
  } catch {
    corpusStatus.textContent = "服务未响应";
    keyStatus.textContent = "状态检查失败";
    keyStatus.classList.add("missing");
    statusDot.classList.add("missing");
  }
}

async function loadConversations() {
  const result = await apiJson("api/conversations");
  if (!result.ok) {
    if (result.status === 401) showLogin();
    return;
  }
  state.conversations = result.data.conversations || [];
  renderConversationList();
  const activeStillExists = state.conversations.some((item) => item.id === state.activeConversationId);
  if (activeStillExists) {
    await loadConversation(state.activeConversationId);
  } else if (state.conversations.length) {
    await loadConversation(state.conversations[0].id);
  } else {
    state.activeConversationId = null;
    state.messages = [...DEFAULT_MESSAGES];
    saveActiveConversationId();
    renderMessages();
  }
}

async function createConversation() {
  const result = await apiJson("api/conversations", {
    method: "POST",
    body: { title: "New conversation" }
  });
  if (!result.ok) {
    if (result.status === 401) showLogin();
    return;
  }
  state.conversations = result.data.conversations || [];
  state.activeConversationId = result.data.conversation.id;
  state.messages = result.data.conversation.messages?.length ? result.data.conversation.messages : [...DEFAULT_MESSAGES];
  saveActiveConversationId();
  renderConversationList();
  renderMessages();
}

async function loadConversation(conversationId) {
  if (!conversationId) return;
  const result = await apiJson(`api/conversations/${encodeURIComponent(conversationId)}`);
  if (!result.ok) {
    if (result.status === 401) showLogin();
    if (result.status === 404 && state.activeConversationId === conversationId) {
      state.activeConversationId = null;
      saveActiveConversationId();
      await loadConversations();
    }
    return;
  }
  const conversation = result.data.conversation;
  state.activeConversationId = conversation.id;
  state.mode = conversation.mode || state.mode;
  state.workflow = conversation.workflow || state.workflow;
  state.messages = conversation.messages?.length ? conversation.messages : [...DEFAULT_MESSAGES];
  saveActiveConversationId();
  setMode(state.mode);
  renderWorkflowButtons();
  renderConversationList();
  renderMessages();
}

async function deleteConversation(conversationId) {
  const result = await apiJson(`api/conversations/${encodeURIComponent(conversationId)}`, {
    method: "DELETE"
  });
  if (!result.ok) {
    if (result.status === 401) showLogin();
    return;
  }
  state.conversations = result.data.conversations || [];
  if (state.activeConversationId === conversationId) {
    state.activeConversationId = state.conversations[0]?.id || null;
  }
  saveActiveConversationId();
  renderConversationList();
  if (state.activeConversationId) await loadConversation(state.activeConversationId);
  else {
    state.messages = [...DEFAULT_MESSAGES];
    renderMessages();
  }
}

async function sendMessage(content) {
  state.busy = true;
  sendButton.disabled = true;

  try {
    const result = await apiJson("api/chat", {
      method: "POST",
      body: {
        conversationId: state.activeConversationId,
        message: content,
        mode: state.mode,
        workflow: state.workflow
      }
    });
    state.messages = state.messages.filter((message) => !message.loading);
    if (!result.ok) {
      if (result.status === 401) {
        showLogin();
        return;
      }
      state.messages.push({
        role: "system",
        content: result.data?.message || "请求失败，请稍后再试。"
      });
    } else {
      state.activeConversationId = result.data.conversation.id;
      state.conversations = result.data.conversations || state.conversations;
      state.messages = result.data.conversation.messages || [];
      saveActiveConversationId();
      renderConversationList();
    }
  } catch (error) {
    state.messages = state.messages.filter((message) => !message.loading);
    state.messages.push({
      role: "system",
      content: `本地服务请求失败：${error.message}`
    });
  } finally {
    state.busy = false;
    sendButton.disabled = false;
    renderMessages();
  }
}

async function apiJson(path, options = {}) {
  const request = {
    method: options.method || "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  };
  if (options.body !== undefined) request.body = JSON.stringify(options.body);
  const response = await fetch(apiUrl(path), request);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  return { ok: response.ok, status: response.status, data };
}

function apiUrl(path) {
  const base = String(window.AI_THOMAS_API_BASE || "").replace(/\/+$/, "");
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return base ? `${base}/${cleanPath}` : cleanPath;
}

function setMode(mode) {
  state.mode = mode || "research-design";
  for (const item of modeGrid.querySelectorAll(".mode-button")) {
    item.classList.toggle("active", item.dataset.mode === state.mode);
  }
}

function renderWorkflowButtons() {
  if (workflowGrid) {
    for (const item of workflowGrid.querySelectorAll(".workflow-button")) {
      item.classList.toggle("active", item.dataset.workflow === state.workflow);
    }
  }

  if (workflowChip) {
    const workflow = WORKFLOW_TEMPLATES[state.workflow];
    workflowChip.hidden = !workflow;
    workflowChip.textContent = workflow ? `当前工具：${workflow.label}` : "";
  }
}

function renderConversationList() {
  if (!conversationList) return;
  conversationList.innerHTML = "";
  if (!state.conversations.length) {
    const empty = document.createElement("p");
    empty.className = "conversation-empty";
    empty.textContent = "还没有会话";
    conversationList.appendChild(empty);
    return;
  }

  for (const conversation of state.conversations) {
    const item = document.createElement("button");
    item.className = "conversation-button";
    item.type = "button";
    item.dataset.conversationId = conversation.id;
    item.classList.toggle("active", conversation.id === state.activeConversationId);

    const title = document.createElement("span");
    title.className = "conversation-title";
    title.textContent = conversation.title || "New conversation";

    const meta = document.createElement("span");
    meta.className = "conversation-meta";
    meta.textContent = `${conversation.messageCount || 0} messages`;

    const deleteButton = document.createElement("span");
    deleteButton.className = "conversation-delete";
    deleteButton.dataset.deleteConversation = conversation.id;
    deleteButton.textContent = "Delete";

    item.append(title, meta, deleteButton);
    conversationList.appendChild(item);
  }
}

function renderMessages() {
  messageList.innerHTML = "";
  const messages = state.messages.length ? state.messages : DEFAULT_MESSAGES;
  for (const message of messages) {
    const article = document.createElement("article");
    article.className = `message ${message.role}`;

    const header = document.createElement("div");
    header.className = "message-header";

    const role = document.createElement("div");
    role.className = "message-role";
    role.textContent = roleLabel(message.role);

    header.appendChild(role);

    if (message.role === "assistant" && !message.loading) {
      const copyButton = document.createElement("button");
      copyButton.className = "copy-button";
      copyButton.type = "button";
      copyButton.textContent = "Copy";
      copyButton.addEventListener("click", async () => {
        try {
          await copyToClipboard(String(message.content || ""));
          copyButton.textContent = "Copied";
          setTimeout(() => {
            copyButton.textContent = "Copy";
          }, 1300);
        } catch {
          copyButton.textContent = "Copy failed";
          setTimeout(() => {
            copyButton.textContent = "Copy";
          }, 1300);
        }
      });
      header.appendChild(copyButton);
    }

    const content = document.createElement("div");
    content.className = "message-content";
    content.innerHTML = formatMessage(message.content);

    article.append(header, content);

    if (message.sources?.length) {
      const sources = document.createElement("div");
      sources.className = "source-list";
      const sourceLabel = document.createElement("span");
      sourceLabel.className = "source-label";
      sourceLabel.textContent = "Evidence used";
      sources.appendChild(sourceLabel);
      for (const source of message.sources) {
        const chip = document.createElement("span");
        chip.className = "source-chip";
        chip.textContent = source.row
          ? `#${source.row} · ${source.year || ""} · ${source.title}`
          : source.title;
        sources.appendChild(chip);
      }
      article.appendChild(sources);
    }

    messageList.appendChild(article);
  }
  messageList.scrollTop = messageList.scrollHeight;
}

function loadActiveConversationId() {
  try {
    return window.localStorage.getItem(ACTIVE_CONVERSATION_KEY) || null;
  } catch {
    return null;
  }
}

function saveActiveConversationId() {
  try {
    if (state.activeConversationId) {
      window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, state.activeConversationId);
    } else {
      window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    }
  } catch {
    // The live session still works without local storage.
  }
}

function removeLegacyConversation() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command failed");
}

function roleLabel(role) {
  if (role === "user") return "You";
  if (role === "system") return "System";
  return "AI Thomas";
}

function formatModelName(model) {
  if (!model) return "DeepSeek";
  return model
    .replace("deepseek-", "DeepSeek ")
    .replace("v4", "V4")
    .replace("-pro", " Pro")
    .replace("-flash", " Flash");
}

function formatMessage(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      html.push("<hr>");
      index += 1;
      continue;
    }

    if (/^#{2,4}\s+/.test(line)) {
      const level = Math.min(line.match(/^#+/)[0].length, 4);
      html.push(`<h${level}>${formatInline(line.replace(/^#{2,4}\s+/, ""))}</h${level}>`);
      index += 1;
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const tableRows = [];
      tableRows.push(splitTableRow(lines[index]));
      index += 2;
      while (index < lines.length && isTableRow(lines[index])) {
        tableRows.push(splitTableRow(lines[index]));
        index += 1;
      }
      html.push(renderTable(tableRows));
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^---+$/.test(lines[index].trim()) &&
      !/^```/.test(lines[index].trim()) &&
      !/^#{2,4}\s+/.test(lines[index].trim()) &&
      !isMarkdownTableStart(lines, index) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim())
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${formatInline(paragraph.join(" "))}</p>`);
  }

  return html.join("");
}

function isMarkdownTableStart(lines, index) {
  return isTableRow(lines[index]) && index + 1 < lines.length && isTableSeparator(lines[index + 1]);
}

function isTableRow(line) {
  return /^\s*\|.+\|\s*$/.test(line || "");
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line || "");
}

function splitTableRow(line) {
  return String(line || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(rows) {
  if (!rows.length) return "";
  const [header, ...body] = rows;
  const head = header.map((cell) => `<th>${formatInline(cell)}</th>`).join("");
  const rowsHtml = body
    .map((row) => `<tr>${row.map((cell) => `<td>${formatInline(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

function formatInline(text) {
  return escapeHtml(String(text || ""))
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
