const RESTRICTED_EVIDENCE = /\b(?:REL01|REL02|M01)\b|AERE\s+reviewer|reviewer\s*稿件|本地隔离材料|未公开稿件/i;
const UNSUPPORTED_PAPER_REFERENCE = /第\s*\d+(?:\s*[、,，和及-]\s*\d+)*\s*篇|#\s*\d+(?:\s*[-–—、,，]\s*#?\s*\d+)*/i;

export function sanitizeSystemPrompt(value) {
  return String(value || "")
    .split("\n")
    .filter((line) => !RESTRICTED_EVIDENCE.test(line))
    .join("\n")
    .trim();
}

export function sanitizeModelAnswer(value) {
  const cleaned = String(value || "")
    .split("\n")
    .filter((line) => !RESTRICTED_EVIDENCE.test(line) && !UNSUPPORTED_PAPER_REFERENCE.test(line))
    .join("\n")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u2600-\u27BF\u{1F000}-\u{1FAFF}]/gu, "")
    .replace(/[\uFE0E\uFE0F]/g, "")
    .replace(/[→⇒➜➝]/g, "->")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned || "当前回答触发了证据边界保护，请换一种表述后重试。";
}
