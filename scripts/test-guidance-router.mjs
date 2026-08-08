import assert from "node:assert/strict";
import { describeGuidanceRoute, resolveGuidanceRoute } from "../worker/guidance-router.mjs";
import { sanitizeModelAnswer, sanitizeSystemPrompt } from "../worker/output-safety.mjs";

const cases = [
  ["帮我看看这个移动端 UI 的布局和响应式问题", "ui-ux-reviewer"],
  ["请润色这段英文，保留原意并修复语法", "paper-polish"],
  ["AI literacy 和 AI competency 有什么区别？", "concept-boundary"],
  ["请把这个想法转成中介变量、机制路径和研究假设", "variable-model"],
  ["帮我设计未来三年的 paper pipeline", "paper-pipeline"],
  ["请把这个方向做成对象 × 产出类型的研究矩阵", "research-matrix"],
  ["请诊断下面这段论文段落的逻辑并改写这段", "paragraph-feedback"],
  ["我的研究想法值得做吗？请检查可行性和潜在贡献", "idea-evaluator"],
  ["请写一个 Introduction 并梳理引言逻辑", "intro-drafter"],
  ["请对整篇稿件做投稿前审查", "pre-submission-reviewer"],
  ["请做一份系统综述和 evidence synthesis", "deep-research"],
  ["请把这些材料写成论文的 discussion section", "paper-writer"],
  ["请搭建一篇技术论文的挑战、方法模块和贡献链", "tech-paper-template"],
  ["请设计一个 benchmark 的数据集构建与评估框架", "benchmark-paper-template"],
  ["帮我设计论文的 solution overview figure", "figure-designer"],
  ["把这张图规划成可编辑的 Draw.io 重构", "drawio-reconstruction"],
  ["帮我设计一个 Vibe Writing 的 AI 辅助研究流程", "vibe-research-workflow"],
  ["你好", "research-guidance"]
];

for (const [message, expectedId] of cases) {
  const route = resolveGuidanceRoute(message);
  assert.equal(route.id, expectedId, `${message} should route to ${expectedId}, received ${route.id}`);
  assert.equal(route.automatic, true);
}

const previous = resolveGuidanceRoute("请润色这段英文");
const followUp = resolveGuidanceRoute("继续", previous);
assert.equal(followUp.id, "paper-polish");
assert.equal(followUp.reasonZh, "承接上一轮的研究方法");

const manual = describeGuidanceRoute({ supervisorSkill: "deep-research", automatic: false });
assert.equal(manual.id, "deep-research");
assert.equal(manual.automatic, false);

const unsafeAnswer = "结论\n> ✅ 可执行建议\n- M01 reviewer 稿件提供证据\n- 本地论文第7、13、24篇提供支持\n- 保留内容";
const safeAnswer = sanitizeModelAnswer(unsafeAnswer);
assert.equal(safeAnswer.includes("✅"), false);
assert.equal(safeAnswer.includes("M01"), false);
assert.equal(safeAnswer.includes("第7"), false);
assert.equal(safeAnswer.includes("保留内容"), true);

const safePrompt = sanitizeSystemPrompt("保留规则\n- REL01 属于本地隔离材料\n继续规则");
assert.equal(safePrompt.includes("REL01"), false);
assert.equal(safePrompt.includes("继续规则"), true);

console.log(`Guidance router and output safety: ${cases.length + 8} assertions passed.`);
