import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const context = vm.createContext({ globalThis: {} });
context.globalThis = context;
vm.runInContext(readFileSync("src/content/content-ui.js", "utf8"), context);
const UI = context.InlineAIContentUi;

test("interaction shell exposes direct sibling answer, input, annotation, and send units", () => {
  const html = UI.interactionShell("Dialog");
  const answerStart = html.indexOf('id="answer-surface"');
  const answerEnd = html.indexOf("</section>", answerStart);
  const composerStart = html.indexOf('id="composer-surface"');
  const composerEnd = html.indexOf("</section>", composerStart);
  const annotationStart = html.indexOf('id="annotation-action-surface"');
  const sendStart = html.indexOf('id="send-action-surface"');
  assert.ok(answerStart > -1);
  assert.ok(composerStart > answerEnd);
  assert.ok(annotationStart > composerEnd);
  assert.ok(sendStart > annotationStart);
  assert.match(html, /data-testid="answer-surface"/);
  assert.match(html, /data-testid="composer-surface"/);
});

test("composer markup contains only the independent input and close control", () => {
  const html = UI.composerMarkup({
    close: true,
    inputLabel: "自定义问题",
    placeholder: "问点什么",
    closeLabel: "关闭"
  });
  assert.match(html, /data-testid="composer-input"/);
  assert.doesNotMatch(html, /annotation-action|send-action/);
  assert.match(html, /aria-label="关闭"/);
});

test("standalone actions use separate icon markup", () => {
  assert.match(UI.annotationActionMarkup("批注"), /<svg[^>]+aria-hidden="true"/);
  assert.match(UI.annotationActionMarkup("批注"), /<span>批注<\/span>/);
  assert.match(UI.sendActionMarkup(), /<svg[^>]+aria-hidden="true"/);
});

test("loading composer disables the independent text input", () => {
  const html = UI.composerMarkup({ disabled: true });
  assert.match(html, /textarea[^>]+disabled/);
});
