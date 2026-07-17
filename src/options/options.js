(function inlineAiOptions() {
  const C = globalThis.InlineAIConstants;
  const {
    STORAGE_KEYS,
    MESSAGE_TYPES,
    DEFAULT_SETTINGS,
    LANGUAGES,
    MODEL_PROVIDERS,
    THEME_COLORS,
    SAVE_SCOPES,
    mergeSettings,
    ensureStorageSchema,
    getEffectiveLanguage,
    getDefaultQuestion,
    t,
    applyI18n,
    providerLabel,
    colorLabel,
    saveScopeLabel
  } = C;

  const form = document.getElementById("settings-form");
  const status = document.getElementById("status");
  const memoryCount = document.getElementById("memory-count");
  const annotationCount = document.getElementById("annotation-count");
  const modelList = document.getElementById("model-list");
  const themePresets = document.getElementById("theme-presets");
  const fields = {
    modelProvider: document.getElementById("modelProvider"),
    apiBaseUrl: document.getElementById("apiBaseUrl"),
    apiKey: document.getElementById("apiKey"),
    model: document.getElementById("model"),
    language: document.getElementById("language"),
    defaultQuestion: document.getElementById("defaultQuestion"),
    includePageContext: document.getElementById("includePageContext"),
    defaultSaveScope: document.getElementById("defaultSaveScope"),
    hideReminders: document.getElementById("hideReminders"),
    highlightColor: document.getElementById("highlightColor")
  };

  let currentSettings = mergeSettings(DEFAULT_SETTINGS);
  let currentMemories = {};
  let currentAnnotationBatches = {};
  let currentActiveAnnotationBatches = {};
  let autoSaveTimer = null;
  let suppressSettingsRender = false;

  init().catch((error) => {
    showStatus(t("options.loadFailed", { message: error.message || error }, currentLanguage()), true);
  });

  async function init() {
    await ensureStorageSchema(chrome.storage.local);

    const stored = await chrome.storage.local.get([STORAGE_KEYS.settings, STORAGE_KEYS.memories, STORAGE_KEYS.annotationBatches, STORAGE_KEYS.activeAnnotationBatches]);
    currentSettings = mergeSettings(stored[STORAGE_KEYS.settings]);
    currentMemories = stored[STORAGE_KEYS.memories] || {};
    currentAnnotationBatches = stored[STORAGE_KEYS.annotationBatches] || {};
    currentActiveAnnotationBatches = stored[STORAGE_KEYS.activeAnnotationBatches] || {};

    renderSelectOptions();
    applyPageLanguage();
    renderForm();
    renderMemoryCount();

    form.addEventListener("submit", handleSave);
    form.addEventListener("input", handleFormChange);
    form.addEventListener("change", handleFormChange);
    themePresets.addEventListener("click", handlePresetClick);
    fields.modelProvider.addEventListener("change", handleProviderChange);
    document.getElementById("refresh-models").addEventListener("click", handleRefreshModels);
    document.getElementById("test-api").addEventListener("click", handleTest);
    document.getElementById("clear-memories").addEventListener("click", handleClearMemories);
    document.getElementById("open-history").addEventListener("click", openHistoryPage);
    document.getElementById("open-annotation-history").addEventListener("click", () => openHistoryPage("annotations"));
    document.getElementById("clear-annotations").addEventListener("click", handleClearAnnotations);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }
      if (changes[STORAGE_KEYS.settings]) {
        currentSettings = mergeSettings(changes[STORAGE_KEYS.settings].newValue);
        renderSelectOptions();
        applyPageLanguage();
        if (!suppressSettingsRender) {
          renderForm();
        }
      }
      if (changes[STORAGE_KEYS.memories]) {
        currentMemories = changes[STORAGE_KEYS.memories].newValue || {};
        renderMemoryCount();
      }
      if (changes[STORAGE_KEYS.annotationBatches]) {
        currentAnnotationBatches = changes[STORAGE_KEYS.annotationBatches].newValue || {};
        renderMemoryCount();
      }
      if (changes[STORAGE_KEYS.activeAnnotationBatches]) {
        currentActiveAnnotationBatches = changes[STORAGE_KEYS.activeAnnotationBatches].newValue || {};
        renderMemoryCount();
      }
    });
  }

  function renderSelectOptions() {
    const language = currentLanguage();
    fields.language.innerHTML = Object.values(LANGUAGES)
      .map((item) => `<option value="${item.id}">${escapeHtml(t(item.labelKey, language))}</option>`)
      .join("");
    fields.modelProvider.innerHTML = MODEL_PROVIDERS
      .map((provider) => `<option value="${provider.id}">${escapeHtml(providerLabel(provider, language))}</option>`)
      .join("");
    fields.defaultSaveScope.innerHTML = Object.entries(SAVE_SCOPES)
      .map(([value]) => `<option value="${value}">${escapeHtml(saveScopeLabel(value, language))}</option>`)
      .join("");
    themePresets.innerHTML = THEME_COLORS
      .map((color) => {
        const label = colorLabel(color, language);
        return `<button class="swatch" type="button" data-color="${escapeHtml(color.value)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(t("popup.selectColor", { color: label }, language))}" style="--swatch:${escapeHtml(color.value)}"></button>`;
      })
      .join("");
  }

  function renderForm() {
    fields.modelProvider.value = currentSettings.modelProvider;
    fields.apiBaseUrl.value = currentSettings.apiBaseUrl;
    fields.apiKey.value = currentSettings.apiKey;
    fields.model.value = currentSettings.model;
    fields.language.value = currentSettings.language;
    fields.defaultQuestion.value = currentSettings.defaultQuestion;
    fields.defaultQuestion.placeholder = getDefaultQuestion(currentSettings.language);
    fields.includePageContext.checked = currentSettings.includePageContext !== false;
    fields.defaultSaveScope.value = currentSettings.defaultSaveScope;
    fields.hideReminders.checked = Boolean(currentSettings.hideReminders);
    fields.highlightColor.value = currentSettings.highlightColor;
    applyDocumentTheme(currentSettings.highlightColor);
  }

  function collectSettings() {
    const language = fields.language.value;
    return mergeSettings({
      apiBaseUrl: fields.apiBaseUrl.value.trim(),
      apiKey: fields.apiKey.value.trim(),
      modelProvider: fields.modelProvider.value,
      model: fields.model.value.trim(),
      language,
      defaultQuestion: getDefaultQuestion(language),
      includePageContext: fields.includePageContext.checked,
      defaultSaveScope: fields.defaultSaveScope.value,
      hideReminders: fields.hideReminders.checked,
      highlightColor: fields.highlightColor.value || DEFAULT_SETTINGS.highlightColor
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    await persistSettings(t("options.statusReady", currentLanguage()));
  }

  function handleFormChange(event) {
    if (event.target === fields.language) {
      const nextSettings = mergeSettings({ ...currentSettings, language: fields.language.value });
      currentSettings = nextSettings;
      renderSelectOptions();
      applyPageLanguage();
      fields.language.value = currentSettings.language;
      fields.modelProvider.value = currentSettings.modelProvider;
      fields.defaultSaveScope.value = currentSettings.defaultSaveScope;
      fields.defaultQuestion.value = getDefaultQuestion(currentSettings.language);
      fields.defaultQuestion.placeholder = getDefaultQuestion(currentSettings.language);
      applyDocumentTheme(fields.highlightColor.value);
      renderMemoryCount();
    }
    if (event.target === fields.defaultQuestion) {
      fields.defaultQuestion.value = getDefaultQuestion(fields.language.value);
    }
    if (event.target === fields.highlightColor) {
      applyDocumentTheme(fields.highlightColor.value);
    }
    scheduleSettingsSave();
  }

  function scheduleSettingsSave() {
    window.clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => {
      persistSettings(t("options.statusReady", currentLanguage())).catch((error) => showStatus(error.message || String(error), true));
    }, 450);
  }

  async function persistSettings(message) {
    currentSettings = collectSettings();
    applyDocumentTheme(currentSettings.highlightColor);
    suppressSettingsRender = true;
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: currentSettings });
    showStatus(message || t("options.statusReady", currentLanguage()));
    window.setTimeout(() => {
      suppressSettingsRender = false;
    }, 100);
  }

  function handlePresetClick(event) {
    const button = event.target.closest("[data-color]");
    if (!button) {
      return;
    }
    fields.highlightColor.value = button.dataset.color;
    applyDocumentTheme(fields.highlightColor.value);
    scheduleSettingsSave();
  }

  async function handleTest() {
    const settings = collectSettings();
    showStatus(t("options.testingApi", currentLanguage()));

    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.testApi,
      payload: { settingsOverride: settings }
    });

    if (response?.ok) {
      showStatus(t("options.connected", currentLanguage()));
    } else {
      showStatus(response?.error || t("options.connectionFailed", currentLanguage()), true);
    }
  }

  function handleProviderChange() {
    const provider = MODEL_PROVIDERS.find((item) => item.id === fields.modelProvider.value);
    if (!provider || provider.id === "custom") {
      return;
    }
    fields.apiBaseUrl.value = provider.apiBaseUrl;
    if (provider.defaultModel) {
      fields.model.value = provider.defaultModel;
    }
    modelList.innerHTML = "";
    showStatus(provider.supportsModelList ? t("options.providerAppliedRefresh", currentLanguage()) : t("options.providerAppliedManual", currentLanguage()));
    scheduleSettingsSave();
  }

  async function handleRefreshModels() {
    const settings = collectSettings();
    const provider = MODEL_PROVIDERS.find((item) => item.id === settings.modelProvider);
    if (provider && provider.supportsModelList === false) {
      showStatus(t("options.modelListUnsupported", currentLanguage()), true);
      return;
    }

    showStatus(t("options.refreshingModels", currentLanguage()));
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.listModels,
      payload: { settingsOverride: settings }
    });

    if (!response?.ok) {
      modelList.innerHTML = "";
      showStatus(response?.error || t("options.refreshFailed", currentLanguage()), true);
      return;
    }

    const models = response.models || [];
    modelList.innerHTML = models
      .map((model) => `<option value="${escapeHtml(model)}"></option>`)
      .join("");
    if (!fields.model.value && models[0]) {
      fields.model.value = models[0];
      scheduleSettingsSave();
    }
    showStatus(t("options.modelsLoaded", { count: models.length }, currentLanguage()));
  }

  async function handleClearMemories() {
    const total = Object.keys(currentMemories).length;
    if (!total) {
      showStatus(t("options.noMemories", currentLanguage()));
      return;
    }

    const confirmed = window.confirm(t("options.clearConfirm", { count: total }, currentLanguage()));
    if (!confirmed) {
      return;
    }

    currentMemories = {};
    await chrome.storage.local.set({ [STORAGE_KEYS.memories]: {} });
    renderMemoryCount();
    showStatus(t("options.memoriesCleared", currentLanguage()));
  }

  function renderMemoryCount() {
    const memories = Object.values(currentMemories);
    const cardCount = memories.reduce((sum, memory) => sum + (memory.cards || []).length, 0);
    memoryCount.textContent = t("options.memoryCount", { memories: memories.length, cards: cardCount }, currentLanguage());
    const active = new Set(Object.values(currentActiveAnnotationBatches));
    const activeItems = Array.from(active).reduce((sum, id) => sum + (currentAnnotationBatches[id]?.items?.length || 0), 0);
    annotationCount.textContent = t("options.annotationCount", { history: Object.keys(currentAnnotationBatches).length, active: activeItems }, currentLanguage());
  }

  async function handleClearAnnotations() {
    const total = Object.keys(currentAnnotationBatches).length;
    if (!total || !window.confirm(t("options.clearAnnotationsConfirm", { count: total }, currentLanguage()))) return;
    currentAnnotationBatches = {};
    currentActiveAnnotationBatches = {};
    await chrome.storage.local.set({ [STORAGE_KEYS.annotationBatches]: {}, [STORAGE_KEYS.activeAnnotationBatches]: {} });
    renderMemoryCount();
    showStatus(t("options.annotationsCleared", currentLanguage()));
  }

  function openHistoryPage(tab) {
    chrome.tabs.create({ url: chrome.runtime.getURL(`src/history/history.html${tab === "annotations" ? "?tab=annotations" : ""}`) });
  }

  function currentLanguage() {
    return getEffectiveLanguage(currentSettings);
  }

  function applyPageLanguage() {
    applyI18n(document, currentLanguage());
    document.title = t("app.settingsTitle", currentLanguage());
  }

  function applyDocumentTheme(color) {
    const themeColor = color || DEFAULT_SETTINGS.highlightColor;
    document.documentElement.style.setProperty("--accent", themeColor);
    document.documentElement.style.setProperty("--accent-strong", shadeHex(themeColor, -22));
    document.documentElement.style.setProperty("--accent-soft", hexToRgba(themeColor, 0.16));
    document.documentElement.style.setProperty("--accent-line", hexToRgba(themeColor, 0.32));
    themePresets?.querySelectorAll(".swatch").forEach((button) => {
      button.classList.toggle("active", button.dataset.color?.toLowerCase() === themeColor.toLowerCase());
    });
  }

  function hexToRgba(hex, alpha) {
    const normalized = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
      return `rgba(201, 130, 87, ${alpha})`;
    }
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function shadeHex(hex, percent) {
    const normalized = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
      return "#9a4f2e";
    }
    const shift = (value) => Math.min(255, Math.max(0, Math.round(value + (percent / 100) * 255)));
    const rgb = [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16)
    ];
    return `#${rgb.map((value) => shift(value).toString(16).padStart(2, "0")).join("")}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showStatus(message, isError) {
    status.textContent = message;
    status.style.color = isError ? "#b42318" : "var(--accent-strong)";
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => {
      status.textContent = isError ? t("options.localSettings", currentLanguage()) : t("options.statusReady", currentLanguage());
      status.style.color = "var(--accent-strong)";
    }, 3000);
  }
})();
