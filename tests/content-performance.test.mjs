import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

function loadPerformance() {
  const context = vm.createContext({ globalThis: {}, setTimeout, clearTimeout, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
  context.globalThis = context;
  vm.runInContext(readFileSync("src/content/content-performance.js", "utf8"), context);
  return context.InlineAIContentPerformance;
}

test("latest throttle keeps one pending task and processes the newest point", () => {
  const P = loadPerformance();
  const pending = [];
  const seen = [];
  const throttle = P.createLatestThrottle({
    delay: 110,
    callback: (value) => seen.push(value),
    setTimer: (callback) => { pending.push(callback); return pending.length; },
    clearTimer() {}
  });
  throttle.push({ x: 1 });
  throttle.push({ x: 2 });
  assert.equal(pending.length, 1);
  pending.shift()();
  assert.deepEqual(seen, [{ x: 2 }]);
});

test("frame batcher commits only the latest streamed value per frame and flushes once", () => {
  const P = loadPerformance();
  const frames = [];
  const committed = [];
  const batcher = P.createFrameBatcher({
    commit: (value) => committed.push(value),
    requestFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelFrame() {}
  });
  batcher.push("a");
  batcher.push("ab");
  batcher.push("abc");
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.deepEqual(committed, ["abc"]);
  batcher.push("abcd");
  batcher.flush();
  assert.deepEqual(committed, ["abc", "abcd"]);
});

test("memory index contains only applicable records with answer cards and sorts longest terms first", () => {
  const P = loadPerformance();
  const index = P.buildMemoryIndex({
    a: { id: "a", term: "AI", saved: true, cards: [{}] },
    b: { id: "b", term: "Artificial intelligence", saved: true, cards: [{}] },
    c: { id: "c", term: "hidden", saved: false, cards: [{}] },
    d: { id: "d", term: "empty", saved: true, cards: [] }
  }, (memory) => memory.saved, (memory) => memory.cards.length > 0, (term) => term.toLowerCase());
  assert.equal(index.hasCandidates, true);
  assert.deepEqual(Array.from(index.candidates, (group) => group.term), ["Artificial intelligence", "AI"]);
});
