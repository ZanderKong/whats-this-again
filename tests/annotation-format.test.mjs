import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const context = vm.createContext({ globalThis: {}, Date, Math });
context.globalThis = context;
vm.runInContext(readFileSync("src/shared/annotations.js", "utf8"), context);
const A = context.InlineAIAnnotations;
const item = (quote, note, order = 0, extra = {}) => ({ quote, note, order, context: { before: "前文", selected: quote, after: "后文" }, ...extra });

test("formats one annotation in Chinese", () => {
  const output = A.buildAnnotationPrompt({ items: [item("第一版暂时不做账号系统。", "保留邮箱登录。")] }, "zh");
  assert.equal(output, "我对上面的回答有几处批注，请结合对应原文逐条回应：\n\n- 原文：「第一版暂时不做账号系统。」\n  我的批注：保留邮箱登录。");
  assert.doesNotMatch(output, /用户针对|提出疑问/);
});

test("formats multiple annotations in their stored order", () => {
  const output = A.buildAnnotationPrompt({ items: [item("第二条唯一原文足够长", "B", 2), item("第一条唯一原文足够长", "A", 0)] }, "zh");
  assert.ok(output.indexOf("第一条唯一原文") < output.indexOf("第二条唯一原文"));
});

test("uses English template", () => {
  const output = A.buildAnnotationPrompt({ items: [item("Original sentence", "Change it")] }, "en");
  assert.equal(output, "I have several annotations on the response above. Please address each one in relation to the quoted text:\n\n- Original: “Original sentence”\n  My annotation: Change it");
});

test("keeps each duplicate annotation as a separate concise statement", () => {
  const output = A.buildAnnotationPrompt({ items: [item("重复", "A", 0), item("重复", "B", 1)] }, "zh");
  assert.equal((output.match(/- 原文/g) || []).length, 2);
  assert.match(output, /我的批注：A/);
  assert.match(output, /我的批注：B/);
  assert.equal((output.match(/相关上下文/g) || []).length, 2);
});

test("filters empty annotations", () => {
  const output = A.buildAnnotationPrompt({ items: [item("有效", "意见"), item("", "空")] }, "zh");
  assert.equal((output.match(/- 原文/g) || []).length, 1);
});

test("preserves line breaks, code, emoji, and statement-like notes", () => {
  const output = A.buildAnnotationPrompt({ items: [item("const value = 1;\nreturn value;", "这里保持陈述，不要改成问句。 ✅")] }, "zh");
  assert.match(output, /const value = 1;\n  return value;/);
  assert.match(output, /这里保持陈述，不要改成问句。 ✅/);
});

test("includes context only for short, ambiguous, or missing anchors", () => {
  const clear = A.buildAnnotationPrompt({ items: [item("这是一段长度足够而且定位明确的原文", "意见")] }, "zh");
  const missing = A.buildAnnotationPrompt({ items: [item("这是一段长度足够但位置已经失效的原文", "意见", 0, { anchorState: "missing" })] }, "zh");
  assert.doesNotMatch(clear, /相关上下文/);
  assert.match(missing, /相关上下文/);
});

test("legacy formatter is an alias of the single prompt builder", () => {
  const batch = { items: [item("兼容别名使用的足够长原文", "意见")] };
  assert.equal(A.formatAnnotationBatch(batch, "zh"), A.buildAnnotationPrompt(batch, "zh"));
});

test("detects oversized payloads", () => {
  const info = A.payloadInfo({ items: Array.from({ length: 20 }, (_, index) => item(`原文${index}`, "x".repeat(4000), index)) }, "zh");
  assert.equal(info.tooLong, true);
});
