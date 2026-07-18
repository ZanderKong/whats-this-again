(function exposeInlineAIOnboarding(global) {
  const VERSION = 1;
  const STEP_COUNT = 8;

  function normalizeState(input = {}) {
    const version = Number(input.version) === VERSION ? VERSION : VERSION;
    const lastStep = Math.min(STEP_COUNT - 1, Math.max(0, Number(input.lastStep) || 0));
    return { completed: input.completed === true, version, lastStep };
  }

  function move(stateInput, direction) {
    const state = normalizeState(stateInput);
    return { ...state, lastStep: Math.min(STEP_COUNT - 1, Math.max(0, state.lastStep + Number(direction || 0))) };
  }

  function finish(stateInput) {
    return { ...normalizeState(stateInput), completed: true, version: VERSION, lastStep: STEP_COUNT - 1 };
  }

  global.InlineAIOnboarding = Object.freeze({ VERSION, STEP_COUNT, normalizeState, move, finish });
})(globalThis);
