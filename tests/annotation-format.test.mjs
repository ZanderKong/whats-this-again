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
  const output = A.formatAnnotationBatch({ items: [item("第一版暂时不做账号系统。", "保留邮箱登录。")] }, "zh");
  assert.equal(output, "用户针对「前文 第一版暂时不做账号系统。 后文」中的「第一版暂时不做账号系统。」提出疑问：保留邮箱登录。");
});

test("formats multiple annotations in their stored order", () => {
  const output = A.formatAnnotationBatch({ items: [item("第二条唯一原文", "B", 2), item("第一条唯一原文", "A", 0)] }, "zh");
  assert.ok(output.indexOf("第一条唯一原文") < output.indexOf("第二条唯一原文"));
});

test("uses English template", () => {
  const output = A.formatAnnotationBatch({ items: [item("Original sentence", "Change it")] }, "en");
  assert.equal(output, "The user has a question about “Original sentence” in “前文 Original sentence 后文”: Change it");
});

test("keeps each duplicate annotation as a separate concise statement", () => {
  const output = A.formatAnnotationBatch({ items: [item("重复", "A", 0), item("重复", "B", 1)] }, "zh");
  assert.equal(output.split("\n\n").length, 2);
  assert.match(output, /提出疑问：A/);
  assert.match(output, /提出疑问：B/);
});

test("filters empty annotations", () => {
  const output = A.formatAnnotationBatch({ items: [item("有效", "意见"), item("", "空")] }, "zh");
  assert.equal((output.match(/提出疑问/g) || []).length, 1);
});

test("detects oversized payloads", () => {
  const info = A.payloadInfo({ items: Array.from({ length: 20 }, (_, index) => item(`原文${index}`, "x".repeat(4000), index)) }, "zh");
  assert.equal(info.tooLong, true);
});
