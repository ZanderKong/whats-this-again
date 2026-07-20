import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const context = vm.createContext({ globalThis: {} });
context.globalThis = context;
vm.runInContext(readFileSync("src/content/content-ui.js", "utf8"), context);
const UI = context.InlineAIContentUi;

test("interaction shell groups quote, 44px input row, and answer stack", () => {
  const html = UI.interactionShell("Dialog");
  const quoteStart = html.indexOf('id="quote-chip"');
  const inputStart = html.indexOf('id="input-row"');
  const answerStart = html.indexOf('id="answer-surface"');
  assert.ok(quoteStart > -1 && inputStart > quoteStart && answerStart > inputStart);
  assert.match(html, /id="composer-surface" class="input-shell"/);
  assert.match(html, /id="annotation-action-surface" class="round-action annotate hidden"/);
  assert.match(html, /id="send-action-surface" class="round-action send"/);
  assert.match(html, /data-testid="quote-chip"/);
  assert.match(html, /data-testid="answer-surface"/);
  assert.match(html, /data-testid="composer-surface"/);
});

test("composer markup contains only the text input", () => {
  const html = UI.composerMarkup({
    inputLabel: "自定义问题",
    placeholder: "问点什么",
    disabled: true
  });
  assert.match(html, /data-testid="composer-input"/);
  assert.match(html, /textarea[^>]+disabled/);
  assert.doesNotMatch(html, /composer-close|annotation-action|send-action/);
});

test("round actions are icon-only and response cards expose compact controls", () => {
  const shell = UI.interactionShell("Dialog");
  assert.match(shell, /<svg[^>]+aria-hidden="true"/);
  assert.doesNotMatch(shell, /<span>.*(?:批注|发送).*<\/span>/);

  const card = UI.responseCardMarkup({
    latest: true,
    query: "Why?",
    collapsedLabel: "DOM child node",
    collapsedTitle: "DOM child node",
    collapsedAriaLabel: "Expand answers about DOM child node",
    responseHtml: "<p>Because.</p>",
    showSave: true,
    closeLabel: "Close",
    saveLabel: "Save"
  });
  assert.match(card, /class="response-card latest" data-testid="answer-card"/);
  assert.match(card, /data-action="toggle-answer-collapse"/);
  assert.match(card, /class="response-collapsed-label"[^>]+title="DOM child node"[^>]+aria-label="Expand answers about DOM child node"/);
  assert.match(card, />DOM child node<\/button>/);
  assert.match(card, /class="response-close"[^>]+data-action="close"/);
  assert.match(card, /class="response-favourite"[^>]+data-action="save-answer"/);
  assert.match(card, /class="save-icon"/);
});

test("expanded and collapsed labels remain separate for the same response card", () => {
  const card = UI.responseCardMarkup({
    latest: true,
    query: "解释选中文字",
    collapsedLabel: "DOM 子节点",
    collapsedTitle: "DOM 子节点的完整原文",
    collapsedAriaLabel: "展开关于 DOM 子节点的回答",
    closeLabel: "关闭"
  });
  assert.match(card, /class="response-question"[^>]*>解释选中文字<\/button>/);
  assert.match(card, /class="response-collapsed-label"[^>]*>DOM 子节点<\/button>/);
  assert.match(card, /title="DOM 子节点的完整原文"/);
});

test("saved response cards make the star active without offering an unsave action", () => {
  const card = UI.responseCardMarkup({
    latest: true,
    query: "Saved",
    showSave: true,
    saved: true,
    closeLabel: "Close",
    saveLabel: "Saved"
  });
  assert.match(card, /response-favourite active/);
  assert.match(card, /aria-disabled="true"/);
  assert.doesNotMatch(card, /data-action="save-answer"/);
});

test("outside close guard respects annotation mode and opening-click suppression", () => {
  assert.equal(UI.shouldCloseInteraction({ open: true, mode: "question", inside: false, now: 20, suppressUntil: 10 }), true);
  assert.equal(UI.shouldCloseInteraction({ open: true, mode: "annotations", inside: false, now: 20, suppressUntil: 10 }), false);
  assert.equal(UI.shouldCloseInteraction({ open: true, mode: "question", inside: true, now: 20, suppressUntil: 10 }), false);
  assert.equal(UI.shouldCloseInteraction({ open: true, mode: "question", inside: false, now: 9, suppressUntil: 10 }), false);
});
