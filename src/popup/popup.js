(function inlineAiPopup() {
  const C = globalThis.InlineAIConstants;
  const {
    STORAGE_KEYS,
    MESSAGE_TYPES,
    DEFAULT_SETTINGS,
    THEME_COLORS,
    mergeSettings,
    getThemePreset,
    MODEL_PROVIDERS,
    ensureStorageSchema,
    getEffectiveLanguage,
    t,
    applyI18n,
    colorLabel
  } = C;

  const els = {
    host: document.getElementById("host"),
    status: document.getElementById("status"),
    refreshPage: document.getElementById("refresh-page"),
    toggleHighlights: document.getElementById("toggle-highlights"),
    openOptions: document.getElementById("open-options"),
    openHistory: document.getElementById("open-history"),
    themePresets: document.getElementById("theme-presets"),
    apiState: document.getElementById("api-state")
  };

  let activeTab = null;
  let settings = mergeSettings(DEFAULT_SETTINGS);

  init().catch((error) => {
    setStatus(error.message || String(error), "error");
  });

  async function init() {
    await ensureStorageSchema(chrome.storage.local);
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const stored = await chrome.storage.local.get([STORAGE_KEYS.settings]);
    settings = mergeSettings(stored[STORAGE_KEYS.settings]);

    applyPageLanguage();
    renderColorPresets();
    render();
    els.refreshPage.addEventListener("click", refreshCurrentPage);
    els.toggleHighlights.addEventListener("click", toggleHighlights);
    els.themePresets.addEventListener("click", handlePresetClick);
    els.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
    els.openHistory.addEventListener("click", openHistoryPage);
  }

  function render() {
    const pageUrl = safeUrl(activeTab?.url);
    const language = currentLanguage();
    const host = pageUrl?.hostname || t("popup.nonWebPage", language);

    els.host.textContent = host;
    const provider = MODEL_PROVIDERS.find((item) => item.id === settings.provider);
    els.apiState.textContent = settings.apiKey && settings.model
      ? (provider ? (provider.labelKey ? t(provider.labelKey, language) : provider.label) : settings.model)
      : t("popup.apiMissing", language);
    els.toggleHighlights.textContent = settings.hideReminders ? t("popup.showReminders", language) : t("popup.hideReminders", language);
    applyDocumentTheme(settings.highlightColor);

    if (!pageUrl) {
      els.refreshPage.disabled = true;
      setStatus(t("popup.internalPage", language), "error");
      return;
    }

    setStatus(t("popup.ready", language), "ok");
  }

  async function refreshCurrentPage() {
    if (!activeTab?.id || !safeUrl(activeTab.url)) {
      return;
    }

    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: MESSAGE_TYPES.showReady });
      setStatus(t("popup.refreshed", currentLanguage()), "ok");
    } catch (_) {
      await chrome.tabs.reload(activeTab.id);
      setStatus(t("popup.pageReloaded", currentLanguage()), "ok");
    }
  }

  async function toggleHighlights() {
    settings = mergeSettings({ ...settings, hideReminders: !settings.hideReminders });
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
    render();
  }

  function renderColorPresets() {
    const language = currentLanguage();
    els.themePresets.innerHTML = THEME_COLORS
      .map((color) => {
        const label = colorLabel(color, language);
        return `<button class="swatch" type="button" data-color="${escapeHtml(color.value)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(t("popup.selectColor", { color: label }, language))}" style="--swatch:${escapeHtml(color.value)}"></button>`;
      })
      .join("");
  }

  async function handlePresetClick(event) {
    const button = event.target.closest("[data-color]");
    if (!button) {
      return;
    }
    settings = mergeSettings({ ...settings, highlightColor: button.dataset.color });
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
    render();
  }

  function applyDocumentTheme(color) {
    const preset = getThemePreset(color);
    document.documentElement.style.setProperty("--accent", preset.value);
    document.documentElement.style.setProperty("--accent-strong", preset.strong);
    document.documentElement.style.setProperty("--accent-soft", preset.soft);
    document.documentElement.style.setProperty("--accent-line", preset.border);
    document.documentElement.style.setProperty("--accent-shadow", preset.shadow);
    els.themePresets.querySelectorAll(".swatch").forEach((button) => {
      button.classList.toggle("active", button.dataset.color?.toLowerCase() === preset.value.toLowerCase());
    });
  }

  function openHistoryPage() {
    const pageUrl = safeUrl(activeTab?.url);
    const params = new URLSearchParams();
    if (pageUrl) {
      params.set("page", `${pageUrl.origin}${pageUrl.pathname}${pageUrl.search}`);
      params.set("host", pageUrl.hostname);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    chrome.tabs.create({ url: chrome.runtime.getURL(`src/history/history.html${suffix}`) });
  }

  function currentLanguage() {
    return getEffectiveLanguage(settings);
  }

  function applyPageLanguage() {
    applyI18n(document, currentLanguage());
    document.title = t("app.name", currentLanguage());
  }

  function safeUrl(url) {
    try {
      const parsed = new URL(url);
      return /^https?:$/i.test(parsed.protocol) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function setStatus(message, tone) {
    els.status.textContent = message;
    els.status.classList.toggle("ok", tone === "ok");
    els.status.classList.toggle("error", tone === "error");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

})();
