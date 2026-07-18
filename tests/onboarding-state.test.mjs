import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const context = vm.createContext({ globalThis: {} });
context.globalThis = context;
vm.runInContext(readFileSync("src/shared/onboarding.js", "utf8"), context);
const O = context.InlineAIOnboarding;

test("normalizes onboarding progress into the supported range", () => {
  assert.deepEqual({ ...O.normalizeState({ completed: false, version: 99, lastStep: -4 }) }, { completed: false, version: 1, lastStep: 0 });
  assert.equal(O.normalizeState({ lastStep: 99 }).lastStep, 7);
});

test("moves forward and backward without leaving the walkthrough", () => {
  assert.equal(O.move({ lastStep: 0 }, -1).lastStep, 0);
  assert.equal(O.move({ lastStep: 2 }, 1).lastStep, 3);
  assert.equal(O.move({ lastStep: 7 }, 1).lastStep, 7);
});

test("skip and completion share the same terminal state", () => {
  const finished = O.finish({ completed: false, lastStep: 3 });
  assert.equal(finished.completed, true);
  assert.equal(finished.version, 1);
  assert.equal(finished.lastStep, 7);
});
