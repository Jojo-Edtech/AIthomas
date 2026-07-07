const STORAGE_KEY = "ai-thomas-current-conversation-v2";
const DEFAULT_MESSAGES = [
  {
    role: "assistant",
    content: "你好，我是 AI Thomas。你可以直接把研究题目、段落、变量想法或追问发给我。"
  }
];

const state = {
  mode: "research-design",
  messages: loadStoredMessages(),
  busy: false
};

const messageList = document.querySelector("#messageList");
const composer = document.querySelector("#composer");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const modeGrid = document.querySelector("#modeGrid");
const quickRow = document.querySelector("#quickRow");
const clearButton = document.querySelector("#clearButton");
const corpusStatus = document.querySelector("#corpusStatus");
const paperCount = document.querySelector("#paperCount");
const missingCount = document.querySelector("#missingCount");
const chunkCount = document.querySelector("#chunkCount");
const modelName = document.querySelector("#modelName");
const keyStatus = document.querySelector("#keyStatus");
const statusDot = document.querySelector("#statusDot");

renderMessages();
loadStatus();

modeGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (!button) return;
  state.mode = button.dataset.mode;
  for (const item of modeGrid.querySelectorAll(".mode-button")) {
    item.classList.toggle("active", item === button);
  }
});

if (quickRow) {
  quickRow.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    input.value = button.textContent.trim();
    input.focus();
  });
}

clearButton.addEventListener("click", () => {
  state.messages = [
    {
      role: "assistant",
      content: "新的对话已开始。"
    }
  ];
  persistConversation();
  renderMessages();
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content || state.busy) return;
  state.messages.push({ role: "user", content });
  persistConversation();
  input.value = "";
  renderMessages();
  await sendMessage();
});

async function loadStatus() {
  try {
    const response = await fetch(apiUrl("api/status"));
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

async function sendMessage() {
  state.busy = true;
  sendButton.disabled = true;
  const loadingMessage = { role: "assistant", content: "正在匹配本地论文语料，并生成研究分析..." };
  state.messages.push(loadingMessage);
  renderMessages();

  try {
    const response = await fetch(apiUrl("api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: state.mode,
        messages: state.messages.filter((message) => message !== loadingMessage)
      })
    });
    const data = await response.json();
    state.messages = state.messages.filter((message) => message !== loadingMessage);
    if (!response.ok) {
      state.messages.push({
        role: "system",
        content: data.message || "请求失败，请稍后再试。"
      });
      persistConversation();
    } else {
      state.messages.push({
        role: "assistant",
        content: data.answer || "DeepSeek 没有返回正文。",
        sources: data.sources || []
      });
      persistConversation();
    }
  } catch (error) {
    state.messages = state.messages.filter((message) => message !== loadingMessage);
    state.messages.push({
      role: "system",
      content: `本地服务请求失败：${error.message}`
    });
    persistConversation();
  } finally {
    state.busy = false;
    sendButton.disabled = false;
    renderMessages();
  }
}

function apiUrl(path) {
  const base = String(window.AI_THOMAS_API_BASE || "").replace(/\/+$/, "");
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return base ? `${base}/${cleanPath}` : cleanPath;
}

function loadStoredMessages() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_MESSAGES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_MESSAGES];
    return parsed
      .filter((message) => ["user", "assistant", "system"].includes(message.role))
      .map((message) => ({
        role: message.role,
        content: String(message.content || ""),
        sources: Array.isArray(message.sources) ? message.sources : undefined
      }))
      .filter((message) => message.content.trim());
  } catch {
    return [...DEFAULT_MESSAGES];
  }
}

function persistConversation() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages.slice(-40)));
  } catch {
    // If local storage is unavailable, the live conversation still works.
  }
}

function renderMessages() {
  messageList.innerHTML = "";
  for (const message of state.messages) {
    const article = document.createElement("article");
    article.className = `message ${message.role}`;

    const role = document.createElement("div");
    role.className = "message-role";
    role.textContent = roleLabel(message.role);

    const content = document.createElement("div");
    content.className = "message-content";
    content.innerHTML = formatMessage(message.content);

    article.append(role, content);

    if (message.sources?.length) {
      const sources = document.createElement("div");
      sources.className = "source-list";
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
  const escaped = escapeHtml(String(text || ""));
  return escaped
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
