(function inlineAiPopup() {
  const C = globalThis.InlineAIConstants;
  const {
    STORAGE_KEYS,
    MESSAGE_TYPES,
    DEFAULT_SETTINGS,
    THEME_COLORS,
    mergeSettings,
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
    memoryCount: document.getElementById("memory-count"),
    apiState: document.getElementById("api-state")
  };

  let activeTab = null;
  let settings = mergeSettings(DEFAULT_SETTINGS);
  let memories = {};

  init().catch((error) => {
    setStatus(error.message || String(error), "error");
  });

  async function init() {
    await ensureStorageSchema(chrome.storage.local);
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const stored = await chrome.storage.local.get([STORAGE_KEYS.settings, STORAGE_KEYS.memories]);
    settings = mergeSettings(stored[STORAGE_KEYS.settings]);
    memories = stored[STORAGE_KEYS.memories] || {};

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
    const cards = Object.values(memories).reduce((sum, memory) => sum + (memory.cards || []).length, 0);

    els.host.textContent = host;
    els.memoryCount.textContent = t("popup.memoryCount", { memories: Object.keys(memories).length, cards }, language);
    els.apiState.textContent = settings.apiKey && settings.model ? t("popup.apiConfigured", language) : t("popup.apiMissing", language);
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
    const themeColor = color || DEFAULT_SETTINGS.highlightColor;
    document.documentElement.style.setProperty("--accent", themeColor);
    document.documentElement.style.setProperty("--accent-strong", shadeHex(themeColor, -22));
    document.documentElement.style.setProperty("--accent-soft", hexToRgba(themeColor, 0.16));
    document.documentElement.style.setProperty("--accent-line", hexToRgba(themeColor, 0.32));
    els.themePresets.querySelectorAll(".swatch").forEach((button) => {
      button.classList.toggle("active", button.dataset.color?.toLowerCase() === themeColor.toLowerCase());
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
      return "#914a20";
    }
    const shift = (value) => Math.min(255, Math.max(0, Math.round(value + (percent / 100) * 255)));
    const rgb = [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16)
    ];
    return `#${rgb.map((value) => shift(value).toString(16).padStart(2, "0")).join("")}`;
  }
})();
