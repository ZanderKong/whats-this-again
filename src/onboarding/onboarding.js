(function inlineAiOnboardingPage() {
  const C = globalThis.InlineAIConstants;
  const O = globalThis.InlineAIOnboarding;
  const SettingsForm = globalThis.InlineAISettingsForm;
  const stepKeys = ["welcome", "model", "selection", "custom", "save", "annotation", "basket", "done"];
  const elements = {
    title: document.getElementById("step-title"),
    body: document.getElementById("step-body"),
    progress: document.getElementById("progress-text"),
    dots: document.getElementById("progress-dots"),
    connection: document.getElementById("connection-panel"),
    connectionStatus: document.getElementById("connection-status"),
    back: document.getElementById("back"),
    next: document.getElementById("next"),
    skip: document.getElementById("skip")
  };
  let settings = C.mergeSettings();
  let state = O.normalizeState();
  let language = "zh";
  let connectionController = null;
  let saveTimer = null;

  init().catch((error) => showConnectionStatus(error.message || String(error), true));

  async function init() {
    await C.ensureStorageSchema(chrome.storage.local);
    const stored = await chrome.storage.local.get([
      C.STORAGE_KEYS.settings,
      C.STORAGE_KEYS.onboardingCompleted,
      C.STORAGE_KEYS.onboardingVersion,
      C.STORAGE_KEYS.onboardingLastStep
    ]);
    settings = C.mergeSettings(stored[C.STORAGE_KEYS.settings]);
    language = C.getEffectiveLanguage(settings);
    state = O.normalizeState({
      completed: stored[C.STORAGE_KEYS.onboardingCompleted],
      version: stored[C.STORAGE_KEYS.onboardingVersion],
      lastStep: new URLSearchParams(location.search).has("restart") ? 0 : stored[C.STORAGE_KEYS.onboardingLastStep]
    });
    applyTheme();
    localizeStaticControls();
    connectionController = SettingsForm.createConnectionController({
      root: elements.connection,
      settings,
      language,
      onChange(next) {
        settings = next;
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => chrome.storage.local.set({ [C.STORAGE_KEYS.settings]: settings }), 350);
      },
      onStatus: showConnectionStatus
    });
    elements.back.addEventListener("click", () => move(-1));
    elements.next.addEventListener("click", handleNext);
    elements.skip.addEventListener("click", finish);
    render();
  }

  function translate(key, params) { return C.t(key, params, language); }

  function localizeStaticControls() {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    document.title = translate("app.onboardingTitle");
    document.querySelector('[data-label="app-name"]').textContent = translate("app.name");
    elements.skip.textContent = translate("onboarding.skip");
    elements.back.textContent = translate("onboarding.back");
    document.getElementById("provider-label").textContent = translate("options.modelProvider");
    document.getElementById("refresh-models").textContent = translate("options.refreshModels");
    document.getElementById("test-connection").textContent = translate("options.testConnection");
    elements.connection.setAttribute("aria-label", translate("onboarding.modelTitle"));
  }

  function applyTheme() {
    const preset = C.getThemePreset(settings.highlightColor);
    const root = document.documentElement.style;
    root.setProperty("--accent", preset.value);
    root.setProperty("--accent-strong", preset.strong);
    root.setProperty("--accent-soft", preset.soft);
    root.setProperty("--accent-line", preset.border);
    root.setProperty("--accent-shadow", preset.shadow);
  }

  function render() {
    const key = stepKeys[state.lastStep];
    elements.title.textContent = translate(`onboarding.${key}Title`);
    elements.body.textContent = translate(`onboarding.${key}Body`);
    elements.progress.textContent = translate("onboarding.progress", { current: state.lastStep + 1, total: O.STEP_COUNT });
    elements.dots.innerHTML = Array.from({ length: O.STEP_COUNT }, (_, index) => `<span class="${index <= state.lastStep ? "active" : ""}"></span>`).join("");
    elements.connection.classList.toggle("hidden", state.lastStep !== 1);
    elements.back.disabled = state.lastStep === 0;
    elements.next.textContent = translate(state.lastStep === O.STEP_COUNT - 1 ? "onboarding.start" : "onboarding.next");
    elements.title.focus({ preventScroll: true });
  }

  async function persistState() {
    await chrome.storage.local.set({
      [C.STORAGE_KEYS.onboardingCompleted]: state.completed,
      [C.STORAGE_KEYS.onboardingVersion]: O.VERSION,
      [C.STORAGE_KEYS.onboardingLastStep]: state.lastStep
    });
  }

  async function move(direction) {
    state = O.move(state, direction);
    await persistState();
    render();
  }

  async function handleNext() {
    if (state.lastStep === 1) {
      settings = connectionController.collect(settings);
      await chrome.storage.local.set({ [C.STORAGE_KEYS.settings]: settings });
    }
    if (state.lastStep === O.STEP_COUNT - 1) return finish();
    await move(1);
  }

  async function finish() {
    state = O.finish(state);
    await chrome.storage.local.set({
      [C.STORAGE_KEYS.settings]: connectionController?.collect(settings) || settings,
      [C.STORAGE_KEYS.onboardingCompleted]: true,
      [C.STORAGE_KEYS.onboardingVersion]: O.VERSION,
      [C.STORAGE_KEYS.onboardingLastStep]: O.STEP_COUNT - 1
    });
    elements.back.disabled = true;
    elements.next.disabled = true;
    elements.skip.disabled = true;
    window.setTimeout(() => window.close(), 120);
  }

  function showConnectionStatus(message, isError) {
    elements.connectionStatus.textContent = message || "";
    elements.connectionStatus.classList.toggle("error", Boolean(isError));
  }
})();
