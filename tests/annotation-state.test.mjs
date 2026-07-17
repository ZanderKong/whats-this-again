import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const context = vm.createContext({ globalThis: {}, Date, Math });
context.globalThis = context;
vm.runInContext(readFileSync("src/shared/annotations.js", "utf8"), context);
const A = context.InlineAIAnnotations;
const batch = () => A.normalizeBatch({ status: A.STATUS.collecting, items: [{ quote: "q", note: "n" }] });

test("collecting to injecting to injected", () => {
  const injecting = A.transitionBatch(batch(), A.STATUS.injecting);
  assert.equal(injecting.status, A.STATUS.injecting);
  assert.equal(A.transitionBatch(injecting, A.STATUS.injected).status, A.STATUS.injected);
});

test("injecting to copied pending paste to pasted", () => {
  const injecting = A.transitionBatch(batch(), A.STATUS.injecting);
  const copied = A.transitionBatch(injecting, A.STATUS.copiedPendingPaste);
  assert.equal(A.transitionBatch(copied, A.STATUS.pastedAfterFallback).status, A.STATUS.pastedAfterFallback);
});

test("manual copy completes", () => {
  assert.equal(A.transitionBatch(batch(), A.STATUS.copiedManual).status, A.STATUS.copiedManual);
});

test("illegal transition is rejected", () => {
  assert.throws(() => A.transitionBatch(batch(), A.STATUS.injected), /Illegal annotation transition/);
});

test("editing after fallback returns to collecting and clears old payload hash", () => {
  const injecting = A.transitionBatch(batch(), A.STATUS.injecting);
  const copied = A.transitionBatch(injecting, A.STATUS.copiedPendingPaste, { delivery: { payloadHash: "old", failureReason: "rollback" } });
  const edited = A.resetAfterEdit(copied);
  assert.equal(edited.status, A.STATUS.collecting);
  assert.equal(edited.delivery.payloadHash, "");
  assert.equal(edited.delivery.failureReason, "");
});
