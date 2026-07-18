(function exposeInlineAISettingsForm(global) {
  const C = global.InlineAIConstants;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createConnectionController(options = {}) {
    const root = options.root;
    if (!root || !C) throw new Error("Connection form root is required.");
    const fields = Object.fromEntries(["modelProvider", "apiBaseUrl", "apiKey", "model"].map((name) => [
      name,
      root.querySelector(`[data-connection-field="${name}"]`)
    ]));
    const modelList = root.querySelector("[data-connection-model-list]");
    const refreshButton = root.querySelector('[data-connection-action="refresh-models"]');
    const testButton = root.querySelector('[data-connection-action="test"]');
    let language = options.language || "zh";
    let settings = C.mergeSettings(options.settings);

    if (Object.values(fields).some((field) => !field)) throw new Error("Connection form fields are incomplete.");

    function translate(key, params) {
      return C.t(key, params, language);
    }

    function render(nextSettings = settings) {
      settings = C.mergeSettings(nextSettings);
      fields.modelProvider.innerHTML = C.MODEL_PROVIDERS
        .map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(C.providerLabel(provider, language))}</option>`)
        .join("");
      fields.modelProvider.value = settings.modelProvider;
      fields.apiBaseUrl.value = settings.apiBaseUrl;
      fields.apiKey.value = settings.apiKey;
      fields.model.value = settings.model;
    }

    function collect(base = settings) {
      return C.mergeSettings({
        ...base,
        modelProvider: fields.modelProvider.value,
        apiBaseUrl: fields.apiBaseUrl.value.trim(),
        apiKey: fields.apiKey.value.trim(),
        model: fields.model.value.trim()
      });
    }

    function emitChange() {
      settings = collect(settings);
      options.onChange?.(settings);
    }

    function handleProviderChange() {
      const provider = C.MODEL_PROVIDERS.find((item) => item.id === fields.modelProvider.value);
      if (provider && provider.id !== "custom") {
        fields.apiBaseUrl.value = provider.apiBaseUrl;
        if (provider.defaultModel) fields.model.value = provider.defaultModel;
        if (modelList) modelList.innerHTML = "";
        options.onStatus?.(translate(provider.supportsModelList ? "options.providerAppliedRefresh" : "options.providerAppliedManual"), false);
      }
      emitChange();
    }

    async function handleRefreshModels() {
      const draft = collect(settings);
      const provider = C.MODEL_PROVIDERS.find((item) => item.id === draft.modelProvider);
      if (provider?.supportsModelList === false) {
        options.onStatus?.(translate("options.modelListUnsupported"), true);
        return;
      }
      options.onStatus?.(translate("options.refreshingModels"), false);
      const response = await chrome.runtime.sendMessage({ type: C.MESSAGE_TYPES.listModels, payload: { settingsOverride: draft } });
      if (!response?.ok) {
        if (modelList) modelList.innerHTML = "";
        options.onStatus?.(response?.error || translate("options.refreshFailed"), true);
        return;
      }
      const models = response.models || [];
      if (modelList) modelList.innerHTML = models.map((model) => `<option value="${escapeHtml(model)}"></option>`).join("");
      if (!fields.model.value && models[0]) fields.model.value = models[0];
      emitChange();
      options.onStatus?.(translate("options.modelsLoaded", { count: models.length }), false);
    }

    async function handleTest() {
      const draft = collect(settings);
      options.onStatus?.(translate("options.testingApi"), false);
      const response = await chrome.runtime.sendMessage({ type: C.MESSAGE_TYPES.testApi, payload: { settingsOverride: draft } });
      options.onStatus?.(response?.ok ? translate("options.connected") : (response?.error || translate("options.connectionFailed")), !response?.ok);
    }

    fields.modelProvider.addEventListener("change", handleProviderChange);
    [fields.apiBaseUrl, fields.apiKey, fields.model].forEach((field) => field.addEventListener("input", emitChange));
    refreshButton?.addEventListener("click", handleRefreshModels);
    testButton?.addEventListener("click", handleTest);
    render(settings);

    return Object.freeze({
      collect,
      render,
      setLanguage(nextLanguage) { language = nextLanguage || language; render(collect(settings)); },
      test: handleTest,
      refreshModels: handleRefreshModels
    });
  }

  global.InlineAISettingsForm = Object.freeze({ createConnectionController });
})(globalThis);
