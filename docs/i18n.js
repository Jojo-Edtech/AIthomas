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
      supervisorHeading: "科研指导技能",
      supervisorSelectLabel: "选择一个指导协议",
      supervisorNone: "不使用特定技能",
      supervisorDefaultDescription: "选择后会自动填入起始提示，并在当前会话中持续使用。",
      supervisorSource: "方法来源：HKUST DIAL Supervisor-Skills",
      activeSkill: "当前技能：",
      skillIdea: "研究想法评估",
      skillIdeaDesc: "审查贡献、可行性、致命缺陷与最小验证路径。",
      skillDeepResearch: "深度文献梳理",
      skillDeepResearchDesc: "冻结研究问题，用现有语料做可追溯的证据综合。",
      skillIntro: "Introduction 草拟",
      skillIntroDesc: "按研究范式组织问题、缺口、目标与贡献。",
      skillWriter: "论文写作",
      skillWriterDesc: "把已有材料写成证据强度匹配的学术文本。",
      skillPolish: "学术润色",
      skillPolishDesc: "保留原意，修复逻辑、语气、语法与 AI 腔。",
      skillReview: "投稿前审查",
      skillReviewDesc: "按严重程度检查逻辑、写作、格式与图表风险。",
      skillTechTemplate: "技术论文框架",
      skillTechTemplateDesc: "搭建背景、限制、核心想法、挑战与贡献链。",
      skillBenchmark: "Benchmark 论文框架",
      skillBenchmarkDesc: "审查研究缺口、构建流程、评估框架与发现。",
      skillFigure: "论文图表设计",
      skillFigureDesc: "规划核心图、布局、标注、工具与质量检查。",
      skillDrawio: "Draw.io 重构规划",
      skillDrawioDesc: "把参考图拆成可编辑重构规范，不虚报文件产出。",
      skillVibe: "AI 辅助研究流程",
      skillVibeDesc: "规划 coding、figure、writing 流程与学术诚信检查。",
      skillUiUx: "界面体验审查",
      skillUiUxDesc: "检查信息层级、控件一致性、响应式与可访问性，并给出可验收的修改规格。",
      uiuxSource: "方法来源：UI/UX Pro Max（MIT）",
      knowledgeHeading: "知识底座",
      newChat: "新建会话",
      clearAria: "新建空白会话",
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
        "请作为科研导师助手，诊断并改写下面的论文段落。请指出逻辑问题、哪些内容保留、哪些需要删改。\n\n段落：\n\n输出请包括：问题诊断表、改写版本、可保留内容、需删除或弱化内容。",
      skillIdeaPrompt:
        "请用研究想法评估协议审查下面的 idea。判断研究类型与核心主张，检查致命缺陷、可行性、潜在贡献和最小验证路径；无法由本地语料确认的新颖性请标注“需外部检索验证”。\n\n我的研究想法：\n",
      skillDeepResearchPrompt:
        "请先把下面主题冻结成 2-3 个可回答的研究问题，再仅基于当前论文语料做深度文献梳理：给出主题分类、支持与反对证据、关键张力、缺口和对每个 RQ 的回答。语料不足处请明确列出，不要补造引用。\n\n研究主题：\n",
      skillIntroPrompt:
        "请根据下面材料草拟或重构 Introduction。先判断研究范式；技术研究可用六段逻辑，教育或社会科学研究请改用合适的引言结构。只使用我提供的材料和可追溯语料，不补造事实或引用。\n\n材料：\n",
      skillWriterPrompt:
        "请把下面材料写成可用于论文的学术文本。先确认目标章节和论证目的，让每个事实性主张都能追溯到我的材料或当前语料，并区分真实结果与计划/预期结果。\n\n材料与目标章节：\n",
      skillPolishPrompt:
        "请润色下面的学术文本：保留原意和术语，修复逻辑、语法、衔接与过强表述，去掉 AI 腔。请先给润色版本，再简要标出任何可能改变原意的修改。\n\n原文：\n",
      skillReviewPrompt:
        "请对下面的稿件内容做投稿前审查。问题优先，按 CRITICAL / MAJOR / MINOR 排序，并给出可直接执行的修复建议；证据不足的判断要明确说明。\n\n稿件或章节：\n",
      skillTechTemplatePrompt:
        "请把下面的技术研究想法整理成完整论文逻辑骨架：背景、现有限制、核心想法或目标、关键挑战、方法模块和贡献，并检查这些部分是否一一对应。\n\n研究想法：\n",
      skillBenchmarkPrompt:
        "请按 Benchmark 论文协议审查下面的研究：研究缺口、构建流程、评估框架、经验发现和可选 companion method。请给完整性表、Introduction 逻辑链和章节骨架。\n\nBenchmark 想法：\n",
      skillFigurePrompt:
        "请为下面的论文图表任务做设计方案。先判断是 motivated example、solution overview 还是 results figure，再给布局、标签、配色、工具和质量检查；未看到图片的项目请标注“需要用户验证”。\n\n图表目的与材料：\n",
      skillDrawioPrompt:
        "请把下面的参考图或描述拆成 Draw.io 重构规范：画布、区域、元素、连接线、文字、样式和可编辑实现方式。这里只输出重构计划或 XML 结构建议，不要声称已经导出或视觉验收文件。\n\n参考图说明：\n",
      skillVibePrompt:
        "请为下面的研究任务设计 AI 辅助工作流。判断它属于 Vibe Coding、Vibe Figure、Vibe Writing 或混合流程，列出工具、里程碑、人工判断点、验证步骤和学术诚信边界。\n\n研究任务：\n",
      skillUiUxPrompt:
        "请用界面体验审查协议评估下面的页面或组件。先说明目标用户、核心任务和主要操作，再检查信息层级、间距、排版、控件一致性、响应式、可访问性和关键状态。请给出按 P1 / P2 / P3 排序的问题表、具体修改规格，以及桌面端和移动端验收清单。若只有文字描述，请把问题写成‘待验证风险’，不要断言已经发生；看不到的状态请标注‘需要实际页面验证’。\n\n页面、截图说明或代码：\n"
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
      supervisorHeading: "Supervisor Skills",
      supervisorSelectLabel: "Choose a guidance protocol",
      supervisorNone: "No specific skill",
      supervisorDefaultDescription: "Selecting a skill fills a starter prompt and keeps the protocol active in this conversation.",
      supervisorSource: "Method source: HKUST DIAL Supervisor-Skills",
      activeSkill: "Active skill: ",
      skillIdea: "Research idea evaluation",
      skillIdeaDesc: "Audit contribution, feasibility, fatal flaws, and the smallest validation path.",
      skillDeepResearch: "Deep literature synthesis",
      skillDeepResearchDesc: "Freeze research questions and synthesize traceable evidence from the available corpus.",
      skillIntro: "Introduction drafting",
      skillIntroDesc: "Organize the problem, gap, goal, and contribution for the research paradigm.",
      skillWriter: "Paper writing",
      skillWriterDesc: "Turn supplied material into academic prose calibrated to the evidence.",
      skillPolish: "Academic polishing",
      skillPolishDesc: "Preserve meaning while repairing logic, tone, grammar, and AI-like phrasing.",
      skillReview: "Pre-submission review",
      skillReviewDesc: "Prioritize logic, writing, formatting, and figure risks by severity.",
      skillTechTemplate: "Technical paper template",
      skillTechTemplateDesc: "Connect background, limitations, key idea, challenges, and contributions.",
      skillBenchmark: "Benchmark paper template",
      skillBenchmarkDesc: "Audit the gap, construction pipeline, evaluation framework, and findings.",
      skillFigure: "Paper figure design",
      skillFigureDesc: "Plan core figures, layout, labels, tools, and quality checks.",
      skillDrawio: "Draw.io reconstruction plan",
      skillDrawioDesc: "Turn a reference into an editable reconstruction specification without false delivery claims.",
      skillVibe: "AI-assisted research workflow",
      skillVibeDesc: "Plan coding, figure, and writing flows with integrity checkpoints.",
      skillUiUx: "UI/UX review",
      skillUiUxDesc: "Audit hierarchy, control consistency, responsiveness, and accessibility with testable change specifications.",
      uiuxSource: "Method source: UI/UX Pro Max (MIT)",
      knowledgeHeading: "Knowledge base",
      newChat: "New chat",
      clearAria: "Start a blank conversation",
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
        "As a research mentor assistant, diagnose and rewrite the paper paragraph below. Point out logic issues, what to keep, and what to cut or revise.\n\nParagraph:\n\nPlease include: an issue diagnosis table, a rewritten version, content to keep, and content to delete or soften.",
      skillIdeaPrompt:
        "Use the research idea evaluation protocol on the idea below. Identify the research type and core claim, audit fatal flaws, feasibility, potential contribution, and the smallest validation path. Mark novelty judgments that the local corpus cannot verify as requiring an external literature search.\n\nMy research idea:\n",
      skillDeepResearchPrompt:
        "Turn the topic below into 2-3 answerable research questions, then synthesize only the available paper corpus: taxonomy, supporting and opposing evidence, tensions, gaps, and an answer to each RQ. List coverage gaps explicitly and do not invent references.\n\nResearch topic:\n",
      skillIntroPrompt:
        "Draft or restructure an Introduction from the material below. First identify the research paradigm; use the six-part technical logic only when it fits, and use an appropriate education or social-science structure otherwise. Use only supplied or traceable evidence.\n\nMaterial:\n",
      skillWriterPrompt:
        "Turn the material below into paper-ready academic prose. Confirm the target section and argumentative purpose, keep every factual claim traceable to supplied or available evidence, and distinguish observed results from planned or expected results.\n\nMaterial and target section:\n",
      skillPolishPrompt:
        "Polish the academic text below while preserving its meaning and terminology. Repair logic, grammar, flow, and overclaiming, and remove AI-like phrasing. Give the polished version first, then flag any edit that may change meaning.\n\nOriginal text:\n",
      skillReviewPrompt:
        "Run a pre-submission review on the material below. Lead with findings ordered as CRITICAL, MAJOR, and MINOR, and give directly actionable fixes. State clearly when the available evidence is insufficient for a judgment.\n\nManuscript or section:\n",
      skillTechTemplatePrompt:
        "Turn the technical research idea below into a complete paper logic skeleton: background, existing limitations, key idea or goal, challenges, method modules, and contributions. Audit whether these elements map to one another.\n\nResearch idea:\n",
      skillBenchmarkPrompt:
        "Audit the benchmark idea below across the research gap, construction pipeline, evaluation framework, empirical findings, and optional companion method. Provide a completeness table, Introduction logic chain, and section skeleton.\n\nBenchmark idea:\n",
      skillFigurePrompt:
        "Design the paper figure task below. Identify whether it is a motivated example, solution overview, or results figure, then specify layout, labels, palette, tool, and quality checks. Mark image-dependent checks as requiring user verification when no image is available.\n\nFigure goal and material:\n",
      skillDrawioPrompt:
        "Turn the reference image or description below into a Draw.io reconstruction specification covering canvas, regions, elements, connectors, text, style, and editable implementation. Provide only a plan or XML structure guidance; do not claim that a file was exported or visually verified.\n\nReference description:\n",
      skillVibePrompt:
        "Design an AI-assisted research workflow for the task below. Classify it as Vibe Coding, Vibe Figure, Vibe Writing, or a mixed flow, then specify tools, milestones, human judgment points, verification, and academic-integrity boundaries.\n\nResearch task:\n",
      skillUiUxPrompt:
        "Use the UI/UX review protocol on the page or component below. First state the target user, core job, and primary action, then audit information hierarchy, spacing, typography, control consistency, responsive behavior, accessibility, and key states. Provide a P1 / P2 / P3 findings table, concrete change specifications, and desktop/mobile acceptance checks. If the input is text-only, label issues as risks to verify rather than observed defects, and mark unseen states as requiring live-page verification.\n\nPage, screenshot description, or code:\n"
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
