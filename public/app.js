const LEGACY_STORAGE_KEY = "ai-thomas-current-conversation-v2";
const ACTIVE_CONVERSATION_KEY = "ai-thomas-active-conversation-v1";
const API_VISITOR_KEY = "ai-thomas-api-visitor-v1";
const MOBILE_PANEL_KEY = "ai-thomas-mobile-panel-collapsed-v1";
const DEFAULT_MESSAGES = [
  {
    role: "assistant",
    i18nKey: "greeting"
  }
];

const WORKFLOW_TEMPLATES = {
  "research-matrix": { mode: "research-design", labelKey: "wfMatrix", promptKey: "wfMatrixPrompt" },
  "concept-boundary": { mode: "theory-frame", labelKey: "wfBoundary", promptKey: "wfBoundaryPrompt" },
  "variable-model": { mode: "research-design", labelKey: "wfVariable", promptKey: "wfVariablePrompt" },
  "paper-pipeline": { mode: "literature-position", labelKey: "wfPipeline", promptKey: "wfPipelinePrompt" },
  "paragraph-feedback": { mode: "writing-feedback", labelKey: "wfParagraph", promptKey: "wfParagraphPrompt" }
};

let lang = window.AI_THOMAS_I18N.detectLang();

function t(key, vars) {
  const table = window.AI_THOMAS_I18N.dict;
  let text = table[lang]?.[key] ?? table.zh[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

function messageContent(message) {
  return message.i18nKey ? t(message.i18nKey) : String(message.content || "");
}

const state = {
  user: null,
  accessMode: "anonymous",
  authRequired: true,
  conversations: [],
  activeConversationId: loadActiveConversationId(),
  mode: "research-design",
  workflow: null,
  messages: [...DEFAULT_MESSAGES],
  mobilePanelCollapsed: loadMobilePanelCollapsed(),
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
const mobilePanelToggle = document.querySelector("#mobilePanelToggle");
const langToggle = document.querySelector("#langToggle");

init();

async function init() {
  hidePrimaryScreens();
  applyI18n();
  renderMessages();
  renderWorkflowButtons();
  await loadStatus();
  await refreshAuth();
}

langToggle?.addEventListener("click", () => {
  setLang(lang === "zh" ? "en" : "zh");
});

function setLang(nextLang) {
  lang = nextLang === "en" ? "en" : "zh";
  window.AI_THOMAS_I18N.saveLang(lang);
  applyI18n();
  renderMessages();
  renderWorkflowButtons();
  renderConversationList();
}

function applyI18n() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  }
  for (const element of document.querySelectorAll("[data-i18n-aria]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  }
  if (langToggle) langToggle.textContent = t("langToggle");
  updateLogoutButton();
  applyMobilePanelState();
  renderStatus();
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const username = loginUsername.value.trim();
  const password = loginPassword.value;
  if (!username || !password) {
    loginError.textContent = t("loginMissing");
    return;
  }

  const result = await apiJson("api/auth/login", {
    method: "POST",
    body: { username, password }
  });
  if (!result.ok) {
    loginError.textContent = result.data?.message || t("loginFailed");
    return;
  }
  state.user = result.data.user;
  removeLegacyConversation();
  loginPassword.value = "";
  showAppShell(true);
  await loadConversations();
});

logoutButton?.addEventListener("click", async () => {
  forgetApiVisitorId();
  await apiJson("api/auth/logout", { method: "POST", skipVisitor: true });
  state.user = null;
  state.conversations = [];
  state.activeConversationId = null;
  state.messages = [...DEFAULT_MESSAGES];
  saveActiveConversationId();
  renderConversationList();
  renderMessages();
  if (state.accessMode === "login") showLogin();
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
  input.value = t(template.promptKey);
  resizeInput();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
});

conversationList?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-conversation]");
  if (deleteButton) {
    event.stopPropagation();
    const conversationId = deleteButton.dataset.deleteConversation;
    const ok = window.confirm(t("confirmDelete"));
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
mobilePanelToggle?.addEventListener("click", () => {
  setMobilePanelCollapsed(!state.mobilePanelCollapsed);
});

if (quickRow) {
  quickRow.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    input.value = button.textContent.trim();
    resizeInput();
    input.focus();
  });
}

input.addEventListener("input", resizeInput);
window.addEventListener("resize", () => {
  resizeInput();
  applyMobilePanelState();
});

input.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  if (!input.value.trim() || state.busy) return;
  composer.requestSubmit();
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content || state.busy) return;
  input.value = "";
  resizeInput();
  state.messages.push({ role: "user", content });
  state.messages.push({ role: "assistant", i18nKey: "loadingMsg", loading: true });
  renderMessages();
  await sendMessage(content);
});

function resizeInput() {
  if (!input) return;
  input.style.height = "auto";
  const maxHeight = Number.parseFloat(getComputedStyle(input).maxHeight) || 132;
  input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
}

async function refreshAuth() {
  const result = await apiJson("api/auth/me");
  if (result.data?.accessMode !== "open" && isCrossOriginApi() && !result.data?.allowCrossOriginApp) {
    window.location.href = appBaseUrl();
    return;
  }
  state.accessMode = result.data?.accessMode || "anonymous";
  if (!result.ok) {
    state.authRequired = Boolean(result.data?.authRequired ?? true);
    if (state.accessMode === "login") showLogin();
    else hidePrimaryScreens();
    return;
  }
  if (state.accessMode === "login" && !result.data?.authenticated) {
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
  hidePrimaryScreens();
  loginScreen.hidden = false;
  loginUsername?.focus();
}

function hidePrimaryScreens() {
  if (appShell) appShell.hidden = true;
  if (loginScreen) loginScreen.hidden = true;
}

function showAppShell(visible) {
  if (!visible) {
    hidePrimaryScreens();
    return;
  }
  if (appShell) appShell.hidden = false;
  if (loginScreen) loginScreen.hidden = true;
  if (userBadge) userBadge.textContent = state.user?.displayName || state.user?.username || "Not signed in";
  updateLogoutButton();
  applyMobilePanelState();
}

function updateLogoutButton() {
  if (!logoutButton) return;
  logoutButton.textContent = state.user && !state.user.anonymous ? t("signOut") : t("resetGuest");
}

function setMobilePanelCollapsed(collapsed) {
  state.mobilePanelCollapsed = Boolean(collapsed);
  try {
    window.localStorage.setItem(MOBILE_PANEL_KEY, state.mobilePanelCollapsed ? "true" : "false");
  } catch {
    // The toggle still works for the current page without local storage.
  }
  applyMobilePanelState();
}

function applyMobilePanelState() {
  if (!appShell) return;
  appShell.classList.toggle("mobile-panel-collapsed", state.mobilePanelCollapsed);
  if (mobilePanelToggle) {
    mobilePanelToggle.textContent = state.mobilePanelCollapsed ? t("panelTools") : t("panelHide");
    mobilePanelToggle.setAttribute("aria-expanded", state.mobilePanelCollapsed ? "false" : "true");
  }
}

async function handleUnauthorized() {
  if (state.accessMode === "login") {
    showLogin();
    return;
  }
  await refreshAuth();
}

let lastStatus = null;
let statusError = false;

async function loadStatus() {
  try {
    const response = await fetch(apiUrl("api/status"), {
      credentials: "include",
      headers: apiHeaders()
    });
    lastStatus = await response.json();
    statusError = false;
  } catch {
    statusError = true;
  }
  renderStatus();
}

function renderStatus() {
  if (statusError) {
    corpusStatus.textContent = t("noService");
    keyStatus.textContent = t("statusFailed");
    keyStatus.classList.add("missing");
    statusDot.classList.add("missing");
    return;
  }
  if (!lastStatus) {
    keyStatus.textContent = t("checkingModel");
    corpusStatus.textContent = t("loadingCorpus");
    return;
  }
  const status = lastStatus;
  corpusStatus.textContent = t("statusCorpus", { p: status.paperCount, c: status.chunkCount });
  paperCount.textContent = status.paperCount;
  chunkCount.textContent = status.chunkCount;
  missingCount.textContent = status.missingCount;
  modelName.textContent = formatModelName(status.model);
  const providerLabel = formatProviderName(status.provider);
  const quotaLabel = status.freeQuotaProtected ? t("freeQuota") : "";
  keyStatus.textContent = status.hasApiKey
    ? t("apiConnected", { label: providerLabel, quota: quotaLabel })
    : t("apiNotConnected", { label: providerLabel });
  keyStatus.classList.toggle("ok", status.hasApiKey);
  keyStatus.classList.toggle("missing", !status.hasApiKey);
  statusDot.classList.toggle("ok", status.hasApiKey);
  statusDot.classList.toggle("missing", !status.hasApiKey);
}

async function loadConversations() {
  const result = await apiJson("api/conversations");
  if (!result.ok) {
    if (result.status === 401) await handleUnauthorized();
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
    if (result.status === 401) await handleUnauthorized();
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
    if (result.status === 401) await handleUnauthorized();
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
    if (result.status === 401) await handleUnauthorized();
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
        await handleUnauthorized();
        return;
      }
      state.messages.push({
        role: "system",
        content: result.data?.message || t("requestFailed")
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
      content: t("localServiceFailed", { message: error.message })
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
    headers: apiHeaders(options)
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

function apiHeaders(options = {}) {
  const headers = { "Content-Type": "application/json" };
  const visitorId = options.skipVisitor ? "" : getApiVisitorId();
  if (visitorId) headers["X-AI-Thomas-Visitor"] = visitorId;
  return headers;
}

function getApiVisitorId() {
  try {
    let visitorId = window.localStorage.getItem(API_VISITOR_KEY);
    if (!isVisitorId(visitorId)) {
      visitorId = createVisitorId();
      window.localStorage.setItem(API_VISITOR_KEY, visitorId);
    }
    return visitorId;
  } catch {
    return "";
  }
}

function forgetApiVisitorId() {
  try {
    window.localStorage.removeItem(API_VISITOR_KEY);
  } catch {
    // Reset still works when local storage is unavailable.
  }
}

function createVisitorId() {
  if (window.crypto?.randomUUID) return `anon_${window.crypto.randomUUID().replace(/-/g, "")}`;
  const random = Array.from(window.crypto?.getRandomValues?.(new Uint8Array(18)) || [])
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `anon_${random || `${Date.now()}${Math.random().toString(16).slice(2)}`}`;
}

function isVisitorId(value) {
  return /^anon_[A-Za-z0-9_-]{16,}$/.test(String(value || ""));
}

function apiUrl(path) {
  const base = String(window.AI_THOMAS_API_BASE || "").replace(/\/+$/, "");
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return base ? `${base}/${cleanPath}` : cleanPath;
}

function appBaseUrl() {
  const base = String(window.AI_THOMAS_API_BASE || "").replace(/\/+$/, "");
  return base ? `${base}/` : "/";
}

function isCrossOriginApi() {
  const base = String(window.AI_THOMAS_API_BASE || "");
  if (!base) return false;
  try {
    return new URL(base, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
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
    workflowChip.textContent = workflow ? `${t("activeTool")}${t(workflow.labelKey)}` : "";
  }
}

function renderConversationList() {
  if (!conversationList) return;
  conversationList.innerHTML = "";
  if (!state.conversations.length) {
    const empty = document.createElement("p");
    empty.className = "conversation-empty";
    empty.textContent = t("noConversations");
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
          await copyToClipboard(messageContent(message));
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
    content.innerHTML = formatMessage(messageContent(message));

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

function loadMobilePanelCollapsed() {
  try {
    const saved = window.localStorage.getItem(MOBILE_PANEL_KEY);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
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
  const shortName = String(model).includes("/") ? String(model).split("/").pop() : String(model);
  return shortName
    .replace("deepseek-", "DeepSeek ")
    .replace("v4", "V4")
    .replace("-pro", " Pro")
    .replace("-flash", " Flash");
}

function formatProviderName(provider) {
  if (provider === "modelscope") return "ModelScope";
  if (provider === "deepseek") return "DeepSeek";
  return "AI";
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
