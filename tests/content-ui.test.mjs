import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const context = vm.createContext({ globalThis: {} });
context.globalThis = context;
vm.runInContext(readFileSync("src/content/content-ui.js", "utf8"), context);
const UI = context.InlineAIContentUi;

test("interaction shell groups quote, 44px input row, and answer stack per instance", () => {
  const html = UI.interactionShell("Dialog", { instanceId: "panel-a" });
  const quoteStart = html.indexOf('data-part="quote-chip"');
  const inputStart = html.indexOf('data-part="input-row"');
  const answerStart = html.indexOf('data-part="answer-surface"');
  assert.ok(quoteStart > -1 && inputStart > quoteStart && answerStart > inputStart);
  assert.match(html, /data-instance-id="panel-a"/);
  assert.match(html, /class="input-shell" data-testid="composer-surface" data-part="composer-surface"/);
  assert.match(html, /class="round-action annotate hidden"[^>]+data-part="annotation-action-surface"/);
  assert.match(html, /class="round-action send"[^>]+data-part="send-action-surface"/);
  assert.match(html, /class="thread-header hidden" data-part="thread-header"/);
  assert.match(html, /class="quote-chip" type="button" data-action="toggle-answer-collapse"/);
  assert.match(html, /data-testid="quote-chip"/);
  assert.match(html, /data-testid="collapsed-thread-close"/);
  assert.match(html, /data-testid="answer-surface"/);
  assert.match(html, /data-testid="composer-surface"/);
});

test("composer markup supports a solid read-only streaming state", () => {
  const html = UI.composerMarkup({
    inputLabel: "自定义问题",
    placeholder: "问点什么",
    readOnly: true
  });
  assert.match(html, /data-testid="composer-input"/);
  assert.match(html, /textarea[^>]+readonly/);
  assert.doesNotMatch(html, /disabled/);
  assert.doesNotMatch(html, /composer-close|annotation-action|send-action/);
});

test("round actions are icon-only and response cards keep question text non-interactive", () => {
  const shell = UI.interactionShell("Dialog");
  assert.match(shell, /<svg[^>]+aria-hidden="true"/);
  assert.doesNotMatch(shell, /<span>.*(?:批注|发送).*<\/span>/);

  const card = UI.responseCardMarkup({
    latest: true,
    query: "Why?",
    responseHtml: "<p>Because.</p>",
    showSave: true,
    closeLabel: "Close",
    saveLabel: "Save"
  });
  assert.match(card, /class="response-card latest" data-testid="answer-card"/);
  assert.match(card, /class="response-question" title="Why\?">Why\?<\/div>/);
  assert.doesNotMatch(card, /toggle-answer-collapse|response-collapsed-label/);
  assert.match(card, /class="response-close"[^>]+data-action="close"/);
  assert.match(card, /class="response-favourite"[^>]+data-action="save-answer"/);
  assert.match(card, /class="save-icon"/);
});

test("saved response cards make the star active and offer an unsave action", () => {
  const card = UI.responseCardMarkup({
    latest: true,
    query: "Saved",
    showSave: true,
    saved: true,
    memoryId: "mem-1",
    cardId: "card-1",
    closeLabel: "Close",
    saveLabel: "Saved"
  });
  assert.match(card, /response-favourite active/);
  assert.match(card, /data-action="unsave-answer"/);
  assert.match(card, /data-memory-id="mem-1"/);
  assert.match(card, /data-card-id="card-1"/);
  assert.match(card, /aria-pressed="true"/);
});

test("each response card carries a data identity without global ids", () => {
  const first = UI.responseCardMarkup({ latest: false, query: "First", showSave: true, messageId: "msg-1", closeLabel: "Close", saveLabel: "Save" });
  const second = UI.responseCardMarkup({ latest: true, query: "Second", showSave: true, messageId: "msg-2", closeLabel: "Close", saveLabel: "Save" });
  const streaming = UI.responseCardMarkup({ latest: true, query: "Waiting", loading: true, showSave: false, messageId: "msg-3", closeLabel: "Close", saveLabel: "Save" });
  assert.match(first, /data-message-id="msg-1"/);
  assert.match(second, /response-favourite[^>]+data-message-id="msg-2"/);
  assert.match(second, /data-message-id="msg-2" class="response/);
  assert.doesNotMatch(first, / id=/);
  assert.doesNotMatch(second, / id=/);
  assert.doesNotMatch(streaming, /response-favourite/);
});

test("interaction shell avoids global ids so multiple panels can coexist", () => {
  const first = UI.interactionShell("First", { instanceId: "one" });
  const second = UI.interactionShell("Second", { instanceId: "two" });
  assert.doesNotMatch(first, / id=/);
  assert.doesNotMatch(second, / id=/);
  assert.match(first, /data-instance-id="one"/);
  assert.match(second, /data-instance-id="two"/);
});

test("history hints coexist with collapsed panels but not obstructing surfaces", () => {
  assert.equal(UI.canShowHistoryHint(), true);
  assert.equal(UI.canShowHistoryHint({ panels: [{ collapsed: true, streaming: false }] }), true);
  assert.equal(UI.canShowHistoryHint({ panels: [{ collapsed: true }, { collapsed: true, streaming: false }] }), true);
  assert.equal(UI.canShowHistoryHint({ panels: [{ collapsed: false, streaming: false }] }), false);
  assert.equal(UI.canShowHistoryHint({ panels: [{ collapsed: true, streaming: true }] }), false);
  assert.equal(UI.canShowHistoryHint({ annotationOpen: true, panels: [{ collapsed: true, streaming: false }] }), false);
});
