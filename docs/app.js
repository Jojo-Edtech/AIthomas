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
