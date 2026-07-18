import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const context = vm.createContext({ globalThis: {} });
context.globalThis = context;
vm.runInContext(readFileSync("src/content/content-ui.js", "utf8"), context);
const UI = context.InlineAIContentUi;

test("interaction shell exposes sibling answer and composer surfaces", () => {
  const html = UI.interactionShell("Dialog");
  const answerStart = html.indexOf('id="answer-surface"');
  const answerEnd = html.indexOf("</section>", answerStart);
  const composerStart = html.indexOf('id="composer-surface"');
  assert.ok(answerStart > -1);
  assert.ok(composerStart > answerEnd);
  assert.match(html, /data-testid="answer-surface"/);
  assert.match(html, /data-testid="composer-surface"/);
});

test("initial composer has annotation and send actions with stable labels", () => {
  const html = UI.composerMarkup({
    annotation: true,
    close: true,
    annotationText: "批注",
    annotationLabel: "保存这条批注",
    inputLabel: "自定义问题",
    placeholder: "问点什么",
    sendLabel: "发送问题"
  });
  assert.match(html, /data-testid="composer-input"/);
  assert.match(html, /data-testid="annotation-action"/);
  assert.match(html, /data-testid="send-action"/);
  assert.match(html, /aria-label="保存这条批注"/);
  assert.match(html, /aria-label="发送问题"/);
  assert.match(html, /<svg[^>]+aria-hidden="true"/);
});

test("loading composer disables text and actions", () => {
  const html = UI.composerMarkup({ disabled: true, action: "send-followup", sendLabel: "Continue" });
  assert.match(html, /textarea[^>]+disabled/);
  assert.match(html, /data-action="send-followup"[^>]+disabled/);
});
