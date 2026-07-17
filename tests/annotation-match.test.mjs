import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const context = vm.createContext({ globalThis: {}, Date, Math });
context.globalThis = context;
vm.runInContext(readFileSync("src/shared/annotations.js", "utf8"), context);
const A = context.InlineAIAnnotations;
const payload = "批注一\n\n原文 A";
const match = (overrides = {}) => A.matchesPayload({ payload, pastedText: payload, editorText: payload, pasteEvent: true, inputType: "insertFromPaste", ...overrides });

test("matches exact and whitespace-normalized paste", () => {
  assert.equal(match(), true);
  assert.equal(match({ pastedText: "批注一  原文 A", editorText: `existing\n${payload}` }), true);
});

test("ordinary keyboard input cannot complete", () => {
  assert.equal(match({ pasteEvent: false, inputType: "insertText" }), false);
});

test("partial paste cannot complete", () => {
  assert.equal(match({ pastedText: "批注一", editorText: payload }), false);
});

test("full payload inside existing editor content matches", () => {
  assert.equal(match({ editorText: `draft before\n\n${payload}\n\nafter` }), true);
});
