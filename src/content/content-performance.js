(function exposeInlineAIPerformance(global) {
  "use strict";

  function createLatestThrottle({ delay = 0, callback, setTimer = global.setTimeout, clearTimer = global.clearTimeout }) {
    let timer = null;
    let latest = null;
    return Object.freeze({
      push(value) {
        latest = value;
        if (timer !== null) return;
        timer = setTimer(() => {
          timer = null;
          const valueToProcess = latest;
          latest = null;
          callback(valueToProcess);
        }, delay);
      },
      cancel() {
        if (timer !== null) clearTimer(timer);
        timer = null;
        latest = null;
      },
      pending() { return timer !== null; }
    });
  }

  function createFrameBatcher({ commit, requestFrame = global.requestAnimationFrame, cancelFrame = global.cancelAnimationFrame }) {
    let frame = 0;
    let latest = "";
    function flush() {
      if (!frame && latest === "") return;
      if (frame) cancelFrame(frame);
      frame = 0;
      const value = latest;
      latest = "";
      commit(value);
    }
    return Object.freeze({
      push(value) {
        latest = value;
        if (frame) return;
        frame = requestFrame(() => flush());
      },
      flush,
      cancel() {
        if (frame) cancelFrame(frame);
        frame = 0;
        latest = "";
      },
      pending() { return Boolean(frame); }
    });
  }

  function buildMemoryIndex(memories, isApplicable, hasCards, normalizeTerm) {
    const groups = new Map();
    Object.values(memories || {}).forEach((memory) => {
      if (!isApplicable(memory) || !hasCards(memory)) return;
      const key = memory.termKey || normalizeTerm(memory.term);
      if (!key) return;
      const group = groups.get(key) || { term: memory.term || "", termKey: key, memories: [] };
      group.memories.push(memory);
      groups.set(key, group);
    });
    const candidates = Array.from(groups.values()).filter((group) => group.term)
      .sort((left, right) => right.term.length - left.term.length);
    return Object.freeze({ groups, candidates, hasCandidates: candidates.length > 0 });
  }

  global.InlineAIContentPerformance = Object.freeze({
    createLatestThrottle,
    createFrameBatcher,
    buildMemoryIndex
  });
})(globalThis);
