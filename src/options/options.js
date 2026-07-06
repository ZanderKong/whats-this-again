(function inlineAiOptions() {
  const C = globalThis.InlineAIConstants;
  const {
    STORAGE_KEYS,
    MESSAGE_TYPES,
    DEFAULT_SETTINGS,
    MODEL_PROVIDERS,
    THEME_COLORS,
    SAVE_SCOPES,
    mergeSettings,
    ensureStorageSchema
  } = C;

  const form = document.getElementById("settings-form");
  const status = document.getElementById("status");
  const memoryCount = document.getElementById("memory-count");
  const modelList = document.getElementById("model-list");
  const themePresets = document.getElementById("theme-presets");
  const fields = {
    modelProvider: document.getElementById("modelProvider"),
    apiBaseUrl: document.getElementById("apiBaseUrl"),
    apiKey: document.getElementById("apiKey"),
    model: document.getElementById("model"),
    defaultQuestion: document.getElementById("defaultQuestion"),
    includePageContext: document.getElementById("includePageContext"),
    defaultSaveScope: document.getElementById("defaultSaveScope"),
    hideReminders: document.getElementById("hideReminders"),
    highlightColor: document.getElementById("highlightColor")
  };

  let currentSettings = mergeSettings(DEFAULT_SETTINGS);
  let currentMemories = {};
  let autoSaveTimer = null;
  let suppressSettingsRender = false;

  init().catch((error) => {
    showStatus(`加载失败：${error.message || error}`, true);
  });

  async function init() {
    await ensureStorageSchema(chrome.storage.local);
    renderSelectOptions();

    const stored = await chrome.storage.local.get([STORAGE_KEYS.settings, STORAGE_KEYS.memories]);
    currentSettings = mergeSettings(stored[STORAGE_KEYS.settings]);
    currentMemories = stored[STORAGE_KEYS.memories] || {};

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

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }
      if (changes[STORAGE_KEYS.settings]) {
        currentSettings = mergeSettings(changes[STORAGE_KEYS.settings].newValue);
        if (!suppressSettingsRender) {
          renderForm();
        }
      }
      if (changes[STORAGE_KEYS.memories]) {
        currentMemories = changes[STORAGE_KEYS.memories].newValue || {};
        renderMemoryCount();
      }
    });
  }

  function renderSelectOptions() {
    fields.modelProvider.innerHTML = MODEL_PROVIDERS
      .map((provider) => `<option value="${provider.id}">${escapeHtml(provider.label)}</option>`)
      .join("");
    fields.defaultSaveScope.innerHTML = Object.entries(SAVE_SCOPES)
      .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
      .join("");
    themePresets.innerHTML = THEME_COLORS
      .map((color) => `<button class="swatch" type="button" data-color="${escapeHtml(color.value)}" title="${escapeHtml(color.label)}" aria-label="选择${escapeHtml(color.label)}色" style="--swatch:${escapeHtml(color.value)}"></button>`)
      .join("");
  }

  function renderForm() {
    fields.modelProvider.value = currentSettings.modelProvider;
    fields.apiBaseUrl.value = currentSettings.apiBaseUrl;
    fields.apiKey.value = currentSettings.apiKey;
    fields.model.value = currentSettings.model;
    fields.defaultQuestion.value = currentSettings.defaultQuestion;
    fields.includePageContext.checked = currentSettings.includePageContext !== false;
    fields.defaultSaveScope.value = currentSettings.defaultSaveScope;
    fields.hideReminders.checked = Boolean(currentSettings.hideReminders);
    fields.highlightColor.value = currentSettings.highlightColor;
    applyDocumentTheme(currentSettings.highlightColor);
  }

  function collectSettings() {
    return mergeSettings({
      apiBaseUrl: fields.apiBaseUrl.value.trim(),
      apiKey: fields.apiKey.value.trim(),
      modelProvider: fields.modelProvider.value,
      model: fields.model.value.trim(),
      defaultQuestion: fields.defaultQuestion.value.trim() || DEFAULT_SETTINGS.defaultQuestion,
      includePageContext: fields.includePageContext.checked,
      defaultSaveScope: fields.defaultSaveScope.value,
      hideReminders: fields.hideReminders.checked,
      highlightColor: fields.highlightColor.value || DEFAULT_SETTINGS.highlightColor
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    await persistSettings("已生效");
  }

  function handleFormChange(event) {
    if (event.target === fields.highlightColor) {
      applyDocumentTheme(fields.highlightColor.value);
    }
    scheduleSettingsSave();
  }

  function scheduleSettingsSave() {
    window.clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => {
      persistSettings("已生效").catch((error) => showStatus(error.message || String(error), true));
    }, 450);
  }

  async function persistSettings(message) {
    currentSettings = collectSettings();
    applyDocumentTheme(currentSettings.highlightColor);
    suppressSettingsRender = true;
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: currentSettings });
    showStatus(message || "已生效");
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
    showStatus("正在测试 API...");

    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.testApi,
      payload: { settingsOverride: settings }
    });

    if (response?.ok) {
      showStatus("连接成功。");
    } else {
      showStatus(response?.error || "连接失败。", true);
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
    showStatus(provider.supportsModelList ? "已套用厂商预设，可刷新模型列表。" : "已套用厂商预设，可手动填写模型名。");
    scheduleSettingsSave();
  }

  async function handleRefreshModels() {
    const settings = collectSettings();
    const provider = MODEL_PROVIDERS.find((item) => item.id === settings.modelProvider);
    if (provider && provider.supportsModelList === false) {
      showStatus("这个厂商暂不支持自动拉取模型列表，请手动填写模型名。", true);
      return;
    }

    showStatus("正在刷新模型列表...");
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.listModels,
      payload: { settingsOverride: settings }
    });

    if (!response?.ok) {
      modelList.innerHTML = "";
      showStatus(response?.error || "刷新失败，可手动填写模型名。", true);
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
    showStatus(`已读取 ${models.length} 个模型，可在 Model 中选择或手动输入。`);
  }

  async function handleClearMemories() {
    const total = Object.keys(currentMemories).length;
    if (!total) {
      showStatus("当前没有历史记忆。");
      return;
    }

    const confirmed = window.confirm(`确定清空 ${total} 条历史记忆？这个操作不可撤销。`);
    if (!confirmed) {
      return;
    }

    currentMemories = {};
    await chrome.storage.local.set({ [STORAGE_KEYS.memories]: {} });
    renderMemoryCount();
    showStatus("已清空所有历史记忆。");
  }

  function renderMemoryCount() {
    const memories = Object.values(currentMemories);
    const cardCount = memories.reduce((sum, memory) => sum + (memory.cards || []).length, 0);
    memoryCount.textContent = `已保存 ${memories.length} 条记忆，${cardCount} 张回答卡。`;
  }

  function openHistoryPage() {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/history/history.html") });
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
      status.textContent = isError ? "本地设置" : "已生效";
      status.style.color = "var(--accent-strong)";
    }, 3000);
  }
})();
