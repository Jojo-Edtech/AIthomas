const ROUTES = [
  {
    kind: "skill",
    id: "drawio-reconstruction",
    mode: "research-design",
    labelZh: "Draw.io 重构规划",
    labelEn: "Draw.io reconstruction",
    reasonZh: "识别到可编辑图表重构任务",
    reasonEn: "Matched an editable diagram reconstruction task",
    priority: 70,
    keywords: ["draw.io", "drawio", "可编辑重构", "重构成图", "重构图表", "xml 图"]
  },
  {
    kind: "skill",
    id: "ui-ux-reviewer",
    mode: "research-design",
    labelZh: "界面体验审查",
    labelEn: "UI/UX review",
    reasonZh: "识别到界面、交互或响应式设计任务",
    reasonEn: "Matched an interface, interaction, or responsive-design task",
    priority: 64,
    keywords: [
      "ui", "ux", "界面", "网页设计", "页面设计", "交互设计", "视觉设计", "布局", "响应式",
      "移动端", "手机端", "平板端", "按钮样式", "设计系统", "accessibility", "responsive"
    ]
  },
  {
    kind: "skill",
    id: "pre-submission-reviewer",
    mode: "writing-feedback",
    labelZh: "投稿前审查",
    labelEn: "Pre-submission review",
    reasonZh: "识别到投稿、审稿或全文风险检查任务",
    reasonEn: "Matched a submission, review, or manuscript-risk audit",
    priority: 58,
    keywords: [
      "投稿前", "投稿检查", "审稿", "审稿人", "模拟审稿", "全文审查", "manuscript review",
      "pre-submission", "reviewer comments", "critical major minor"
    ]
  },
  {
    kind: "skill",
    id: "paper-polish",
    mode: "writing-feedback",
    labelZh: "学术润色",
    labelEn: "Academic polishing",
    reasonZh: "识别到保留原意的语言润色任务",
    reasonEn: "Matched a meaning-preserving academic editing task",
    priority: 56,
    keywords: [
      "润色", "polish", "语法", "grammar", "去 ai 腔", "去ai腔", "academic tone", "语言修改",
      "表达更自然", "改成英文", "翻译成英文", "translate to english", "proofread"
    ]
  },
  {
    kind: "skill",
    id: "benchmark-paper-template",
    mode: "research-design",
    labelZh: "Benchmark 论文框架",
    labelEn: "Benchmark paper planning",
    reasonZh: "识别到 benchmark、数据集或评估框架任务",
    reasonEn: "Matched a benchmark, dataset, or evaluation-framework task",
    priority: 54,
    keywords: [
      "benchmark", "基准论文", "基准评测", "数据集构建", "evaluation framework", "construction pipeline",
      "评估框架", "基线模型", "empirical findings"
    ]
  },
  {
    kind: "skill",
    id: "intro-drafter",
    mode: "writing-feedback",
    labelZh: "Introduction 草拟",
    labelEn: "Introduction drafting",
    reasonZh: "识别到引言结构或 Introduction 写作任务",
    reasonEn: "Matched an Introduction structure or drafting task",
    priority: 52,
    keywords: [
      "introduction", "引言", "引言部分", "研究背景段", "motivation 段", "research gap 段", "引言逻辑"
    ]
  },
  {
    kind: "skill",
    id: "figure-designer",
    mode: "research-design",
    labelZh: "论文图表设计",
    labelEn: "Paper figure design",
    reasonZh: "识别到论文图、模型图或结果图设计任务",
    reasonEn: "Matched a paper figure, model diagram, or results-visual task",
    priority: 50,
    keywords: [
      "论文图", "模型图", "概念图", "流程图", "结果图", "figure design", "motivated example",
      "solution overview", "results figure", "图表设计", "画图方案"
    ]
  },
  {
    kind: "skill",
    id: "vibe-research-workflow",
    mode: "research-design",
    labelZh: "AI 辅助研究流程",
    labelEn: "AI-assisted research workflow",
    reasonZh: "识别到 AI 辅助研究流程设计任务",
    reasonEn: "Matched an AI-assisted research workflow task",
    priority: 50,
    keywords: [
      "vibe coding", "vibe figure", "vibe writing", "vibe research", "ai 辅助研究", "ai研究流程",
      "研究自动化", "学术诚信检查点"
    ]
  },
  {
    kind: "workflow",
    id: "concept-boundary",
    mode: "theory-frame",
    labelZh: "概念边界",
    labelEn: "Concept boundaries",
    reasonZh: "识别到概念定义、区分或测量边界问题",
    reasonEn: "Matched a concept definition, distinction, or measurement question",
    priority: 48,
    keywords: [
      "概念边界", "概念区别", "有什么区别", "如何区分", "定义区别", "定义对照", "概念辨析",
      "concept boundary", "conceptual distinction", "difference between", "literacy vs", "competency vs"
    ]
  },
  {
    kind: "workflow",
    id: "variable-model",
    mode: "research-design",
    labelZh: "变量与机制模型",
    labelEn: "Variable and mechanism model",
    reasonZh: "识别到变量、机制、假设或方法路径问题",
    reasonEn: "Matched a variables, mechanisms, hypotheses, or methods question",
    priority: 47,
    keywords: [
      "变量模型", "变量关系", "中介变量", "调节变量", "自变量", "因变量", "机制路径", "研究假设",
      "假设草案", "conceptual model", "mediation", "moderation", "hypothesis", "variable model"
    ]
  },
  {
    kind: "workflow",
    id: "paper-pipeline",
    mode: "literature-position",
    labelZh: "论文序列",
    labelEn: "Paper pipeline",
    reasonZh: "识别到多阶段论文规划或研究议程任务",
    reasonEn: "Matched a multi-stage paper plan or research-agenda task",
    priority: 46,
    keywords: [
      "论文序列", "paper pipeline", "发表计划", "研究议程", "一系列论文", "多篇论文", "未来三年",
      "1 年", "3 年", "5 年", "publication plan"
    ]
  },
  {
    kind: "workflow",
    id: "research-matrix",
    mode: "research-design",
    labelZh: "研究矩阵",
    labelEn: "Research matrix",
    reasonZh: "识别到研究方向展开或矩阵化规划任务",
    reasonEn: "Matched a research-direction expansion or matrix-planning task",
    priority: 44,
    keywords: [
      "研究矩阵", "对象 ×", "对象 x", "research matrix", "研究方向矩阵", "选题矩阵", "系列选题"
    ]
  },
  {
    kind: "workflow",
    id: "paragraph-feedback",
    mode: "writing-feedback",
    labelZh: "段落诊断与改写",
    labelEn: "Paragraph diagnosis",
    reasonZh: "识别到具体段落的逻辑诊断或改写任务",
    reasonEn: "Matched a paragraph-level diagnosis or rewrite task",
    priority: 42,
    keywords: [
      "这段", "下面这段", "论文段落", "段落反馈", "段落诊断", "改写这段", "rewrite this paragraph",
      "paragraph feedback", "段落逻辑"
    ]
  },
  {
    kind: "skill",
    id: "deep-research",
    mode: "literature-position",
    labelZh: "深度文献梳理",
    labelEn: "Deep literature synthesis",
    reasonZh: "识别到文献综述、证据综合或研究缺口任务",
    reasonEn: "Matched a literature review, evidence synthesis, or gap task",
    priority: 40,
    keywords: [
      "文献综述", "系统综述", "深度研究", "证据综合", "研究缺口", "研究现状", "literature review",
      "systematic review", "evidence synthesis", "state of the art", "research landscape", "taxonomy"
    ]
  },
  {
    kind: "skill",
    id: "tech-paper-template",
    mode: "research-design",
    labelZh: "技术论文框架",
    labelEn: "Technical paper planning",
    reasonZh: "识别到技术论文的挑战、方法和贡献链任务",
    reasonEn: "Matched a technical paper challenge-method-contribution task",
    priority: 38,
    keywords: [
      "技术论文", "technical paper", "算法论文", "系统论文", "method module", "技术贡献", "方法模块"
    ]
  },
  {
    kind: "skill",
    id: "paper-writer",
    mode: "writing-feedback",
    labelZh: "论文写作",
    labelEn: "Paper writing",
    reasonZh: "识别到论文正文或章节写作任务",
    reasonEn: "Matched a paper section or academic prose drafting task",
    priority: 36,
    keywords: [
      "写成论文", "写成段落", "论文写作", "写摘要", "写 discussion", "写 methods", "写 results",
      "paper writing", "draft the abstract", "draft this section", "academic prose", "discussion section"
    ]
  },
  {
    kind: "skill",
    id: "idea-evaluator",
    mode: "research-design",
    labelZh: "研究想法评估",
    labelEn: "Research idea evaluation",
    reasonZh: "识别到研究想法、贡献或可行性评估任务",
    reasonEn: "Matched a research idea, contribution, or feasibility evaluation",
    priority: 30,
    keywords: [
      "研究想法", "research idea", "这个 idea", "这个idea", "值得做", "可行性", "创新性", "潜在贡献",
      "致命缺陷", "选题怎么样", "研究问题怎么样", "idea 好不好", "feasibility"
    ]
  },
  {
    kind: "mode",
    id: "writing-feedback",
    mode: "writing-feedback",
    labelZh: "写作反馈",
    labelEn: "Writing feedback",
    reasonZh: "识别到一般学术表达或写作问题",
    reasonEn: "Matched a general academic writing question",
    priority: 16,
    keywords: ["写作", "表达", "标题", "摘要", "段落", "academic writing", "wording", "title"]
  },
  {
    kind: "mode",
    id: "literature-position",
    mode: "literature-position",
    labelZh: "文献定位",
    labelEn: "Literature positioning",
    reasonZh: "识别到贡献、缺口或文献定位问题",
    reasonEn: "Matched a contribution, gap, or literature-positioning question",
    priority: 14,
    keywords: ["文献", "贡献", "缺口", "research gap", "literature", "contribution", "positioning"]
  },
  {
    kind: "mode",
    id: "theory-frame",
    mode: "theory-frame",
    labelZh: "理论与概念",
    labelEn: "Theory and concepts",
    reasonZh: "识别到理论、概念或测量问题",
    reasonEn: "Matched a theory, concept, or measurement question",
    priority: 12,
    keywords: ["理论", "概念", "框架", "测量", "theory", "framework", "construct", "measurement"]
  },
  {
    kind: "mode",
    id: "research-design",
    mode: "research-design",
    labelZh: "研究设计",
    labelEn: "Research design",
    reasonZh: "识别到一般研究设计问题",
    reasonEn: "Matched a general research-design question",
    priority: 10,
    keywords: ["研究设计", "方法", "样本", "数据", "methodology", "research design", "sample", "data collection"]
  }
];

const DEFAULT_ROUTE = {
  kind: "general",
  id: "research-guidance",
  mode: "research-design",
  labelZh: "科研讨论",
  labelEn: "Research discussion",
  reasonZh: "使用通用科研导师对话",
  reasonEn: "Using general research mentor dialogue"
};

export function resolveGuidanceRoute(message, previousRouting = null) {
  const text = normalize(message);
  const candidates = ROUTES
    .map((route, index) => ({ route, index, score: scoreRoute(route, text) }))
    .filter((item) => item.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (candidates.length) return toRouting(candidates[0].route, true);

  if (isContinuation(text)) {
    const previous = routeFromRouting(previousRouting);
    if (previous) {
      return {
        ...toRouting(previous, true),
        reasonZh: "承接上一轮的研究方法",
        reasonEn: "Continuing the previous turn's research method"
      };
    }
  }

  return toRouting(DEFAULT_ROUTE, true);
}

export function describeGuidanceRoute({ mode, workflow, supervisorSkill, automatic = false } = {}) {
  const route = supervisorSkill
    ? ROUTES.find((item) => item.kind === "skill" && item.id === supervisorSkill)
    : workflow
      ? ROUTES.find((item) => item.kind === "workflow" && item.id === workflow)
      : ROUTES.find((item) => item.kind === "mode" && item.mode === mode);
  return toRouting(route || DEFAULT_ROUTE, automatic);
}

function routeFromRouting(routing) {
  if (!routing || typeof routing !== "object") return null;
  return ROUTES.find((item) => item.kind === routing.kind && item.id === routing.id) || null;
}

function toRouting(route, automatic) {
  return {
    automatic: Boolean(automatic),
    kind: route.kind,
    id: route.id,
    labelZh: route.labelZh,
    labelEn: route.labelEn,
    reasonZh: route.reasonZh,
    reasonEn: route.reasonEn,
    mode: route.mode || "research-design",
    workflow: route.kind === "workflow" ? route.id : null,
    supervisorSkill: route.kind === "skill" ? route.id : null
  };
}

function scoreRoute(route, text) {
  let score = 0;
  let matches = 0;
  for (const keyword of route.keywords || []) {
    if (!containsKeyword(text, keyword)) continue;
    matches += 1;
    score += keywordWeight(keyword);
  }
  return matches ? Number(route.priority || 0) + score + Math.min(matches - 1, 3) * 3 : null;
}

function keywordWeight(keyword) {
  const value = normalize(keyword);
  if (/[\u4e00-\u9fff]/.test(value)) return Math.min(10, Math.max(3, value.length));
  const words = value.split(/\s+/).filter(Boolean).length;
  return words > 1 ? Math.min(10, words * 3) : 3;
}

function containsKeyword(text, keyword) {
  const value = normalize(keyword);
  if (!value) return false;
  if (/^[a-z0-9-]+$/.test(value)) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(value);
}

function isContinuation(text) {
  if (!text || text.length > 48) return false;
  return /^(继续|接着|再来|然后呢|展开|详细一点|简短一点|改一下|重写|为什么|怎么说|what about|continue|go on|expand|rewrite|shorter|why|how)(吧|呢|一下|一点| please)?[?？。.!！]*$/i.test(text)
    || /^(这个|上面|刚才|前面|that|this|above|previous)/i.test(text);
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[\u3000\t\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export const GUIDANCE_ROUTE_COUNT = ROUTES.length;
