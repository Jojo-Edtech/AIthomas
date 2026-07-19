(function () {
  const LANG_KEY = "ai-thomas-lang-v1";

  const dict = {
    zh: {
      langToggle: "EN",
      headerTitle: "AI Thomas 科研导师",
      statusHeading: "运行状态",
      checkingModel: "正在检查模型连接",
      loadingCorpus: "正在读取本地论文语料",
      statusCorpus: "{p} 篇 PDF · {c} 个本地片段",
      freeQuota: " · 免费额度保护",
      apiConnected: "{label} API 已连接{quota}",
      apiNotConnected: "{label} API 未连接",
      noService: "服务未响应",
      statusFailed: "状态检查失败",
      workspaceHeading: "当前工作区",
      resetGuest: "重置访客身份",
      signOut: "退出登录",
      conversationsHeading: "会话记录",
      newConversationAria: "新建会话",
      noConversations: "还没有会话",
      modesHeading: "研究模式",
      modeResearchDesign: "研究设计",
      modeResearchDesignCopy: "变量、模型、方法路径",
      modeTheoryFrame: "理论框架",
      modeTheoryFrameCopy: "概念边界与机制",
      modeLiterature: "文献定位",
      modeLiteratureCopy: "贡献、缺口、议程",
      modeWriting: "写作反馈",
      modeWritingCopy: "段落、标题、表达",
      toolkitHeading: "研究工具包",
      wfMatrix: "研究矩阵",
      wfMatrixCopy: "对象 × 产出类型",
      wfBoundary: "概念边界",
      wfBoundaryCopy: "定义、区分、测量",
      wfVariable: "变量模型",
      wfVariableCopy: "机制、假设、方法",
      wfPipeline: "论文序列",
      wfPipelineCopy: "1/3/5 年 pipeline",
      wfParagraph: "段落反馈",
      wfParagraphCopy: "诊断、改写、保留",
      knowledgeHeading: "知识底座",
      newChat: "新建会话",
      clearAria: "清空当前对话",
      chatAria: "与 AI Thomas 持续讨论科研问题",
      composerPlaceholder: "输入研究 idea、段落或追问",
      send: "发送",
      panelHide: "收起",
      panelTools: "工具",
      activeTool: "当前工具：",
      confirmDelete: "删除这个会话？",
      loginMissing: "请输入用户名和密码。",
      loginFailed: "登录失败。",
      requestFailed: "请求失败，请稍后再试。",
      localServiceFailed: "本地服务请求失败：{message}",
      greeting:
        "你好，我是 AI Thomas，一个基于本地论文语料的科研导师助手。你可以把研究 idea、论文段落、变量想法或追问发给我。",
      loadingMsg: "正在匹配本地论文语料，并生成研究分析...",
      wfMatrixPrompt:
        "请作为科研导师助手，把下面的研究方向拆成“对象 × 产出类型”的研究矩阵。\n\n研究方向：\n\n输出请包括：一句话结论、研究矩阵表、3 个可写 paper 方向、下一步行动、证据边界。",
      wfBoundaryPrompt:
        "请作为科研导师助手，帮我区分下面概念的边界，并说明如何定义、测量和写进论文。\n\n概念：\n\n输出请包括：定义对照表、边界判断、测量建议、导师反馈依据、证据边界。",
      wfVariablePrompt:
        "请作为科研导师助手，把下面的研究想法转成变量模型、机制路径、假设草案和方法建议。\n\n研究想法：\n\n输出请包括：变量表、机制路径、假设草案、方法建议、注意风险。",
      wfPipelinePrompt:
        "请作为科研导师助手，为下面的研究方向设计一个 1 年 / 3 年 / 5 年论文序列。\n\n研究方向：\n\n输出请包括：时间线表、每篇 paper 的理论/方法/贡献、可积累资产、证据边界。",
      wfParagraphPrompt:
        "请作为科研导师助手，诊断并改写下面的论文段落。请指出逻辑问题、哪些内容保留、哪些需要删改。\n\n段落：\n\n输出请包括：问题诊断表、改写版本、可保留内容、需删除或弱化内容。"
    },
    en: {
      langToggle: "中文",
      headerTitle: "AI Thomas Research Mentor",
      statusHeading: "System status",
      checkingModel: "Checking model connection",
      loadingCorpus: "Loading local paper corpus",
      statusCorpus: "{p} PDFs · {c} local chunks",
      freeQuota: " · free-quota protection",
      apiConnected: "{label} API connected{quota}",
      apiNotConnected: "{label} API not connected",
      noService: "Service not responding",
      statusFailed: "Status check failed",
      workspaceHeading: "Current workspace",
      resetGuest: "Reset guest identity",
      signOut: "Sign out",
      conversationsHeading: "Conversations",
      newConversationAria: "New conversation",
      noConversations: "No conversations yet",
      modesHeading: "Research modes",
      modeResearchDesign: "Research design",
      modeResearchDesignCopy: "Variables, models, method paths",
      modeTheoryFrame: "Theoretical framing",
      modeTheoryFrameCopy: "Concept boundaries & mechanisms",
      modeLiterature: "Literature positioning",
      modeLiteratureCopy: "Contribution, gaps, agenda",
      modeWriting: "Writing feedback",
      modeWritingCopy: "Paragraphs, titles, expression",
      toolkitHeading: "Research toolkit",
      wfMatrix: "Research matrix",
      wfMatrixCopy: "Objects × output types",
      wfBoundary: "Concept boundary",
      wfBoundaryCopy: "Define, distinguish, measure",
      wfVariable: "Variable model",
      wfVariableCopy: "Mechanisms, hypotheses, methods",
      wfPipeline: "Paper pipeline",
      wfPipelineCopy: "1/3/5-year pipeline",
      wfParagraph: "Paragraph feedback",
      wfParagraphCopy: "Diagnose, rewrite, keep",
      knowledgeHeading: "Knowledge base",
      newChat: "New chat",
      clearAria: "Clear current conversation",
      chatAria: "Discuss research questions with AI Thomas",
      composerPlaceholder: "Type a research idea, a paragraph, or a follow-up",
      send: "Send",
      panelHide: "Hide",
      panelTools: "Tools",
      activeTool: "Active tool: ",
      confirmDelete: "Delete this conversation?",
      loginMissing: "Please enter a username and password.",
      loginFailed: "Sign-in failed.",
      requestFailed: "Request failed. Please try again later.",
      localServiceFailed: "Local service request failed: {message}",
      greeting:
        "Hi, I'm AI Thomas, a research mentor assistant grounded in a local corpus of published papers. Send me your research ideas, paper paragraphs, variable models, or follow-up questions.",
      loadingMsg: "Matching local paper evidence and drafting the analysis...",
      wfMatrixPrompt:
        "As a research mentor assistant, break the research direction below into a research matrix of \"objects × output types\".\n\nResearch direction:\n\nPlease include: a one-sentence takeaway, the research matrix table, 3 paper-ready directions, next actions, and evidence boundaries.",
      wfBoundaryPrompt:
        "As a research mentor assistant, help me distinguish the boundaries of the concepts below, and explain how to define them, measure them, and write them into a paper.\n\nConcepts:\n\nPlease include: a definition comparison table, boundary judgments, measurement suggestions, the rationale behind the feedback, and evidence boundaries.",
      wfVariablePrompt:
        "As a research mentor assistant, turn the research idea below into a variable model, mechanism paths, draft hypotheses, and method suggestions.\n\nResearch idea:\n\nPlease include: a variable table, mechanism paths, draft hypotheses, method suggestions, and risks to watch.",
      wfPipelinePrompt:
        "As a research mentor assistant, design a 1-year / 3-year / 5-year paper pipeline for the research direction below.\n\nResearch direction:\n\nPlease include: a timeline table, the theory/method/contribution of each paper, reusable assets, and evidence boundaries.",
      wfParagraphPrompt:
        "As a research mentor assistant, diagnose and rewrite the paper paragraph below. Point out logic issues, what to keep, and what to cut or revise.\n\nParagraph:\n\nPlease include: an issue diagnosis table, a rewritten version, content to keep, and content to delete or soften."
    }
  };

  function detectLang() {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved === "zh" || saved === "en") return saved;
    } catch {
      // Fall through to browser language detection.
    }
    return /^zh/i.test(navigator.language || "") ? "zh" : "en";
  }

  function saveLang(lang) {
    try {
      window.localStorage.setItem(LANG_KEY, lang);
    } catch {
      // The toggle still works for the current page without local storage.
    }
  }

  window.AI_THOMAS_I18N = { dict, detectLang, saveLang };
})();
