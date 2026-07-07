(function inlineAiContent() {
  if (globalThis.__INLINEAI_CONTENT_LOADED__ || globalThis.__INLINEAI_CONTENT_LOADING__) {
    return;
  }

  const C = globalThis.InlineAIConstants;
  if (!C) {
    console.warn("[这是啥来着] Missing shared constants.");
    return;
  }

  globalThis.__INLINEAI_CONTENT_LOADING__ = true;

  const {
    STORAGE_KEYS,
    MESSAGE_TYPES,
    CSS,
    PORTS,
    LIMITS,
    mergeSettings,
    ensureStorageSchema,
    getEffectiveLanguage,
    t,
    isDefaultPromptQuestion
  } = C;

  const ROOT_ID = "inlineai-shadow-host";
  const STYLE_ID = "inlineai-page-highlight-style";
  const MEMORY_ID_ATTR = "data-inlineai-memory-id";
  const CARD_ID_ATTR = "data-inlineai-card-id";
  const TERM_KEY_ATTR = CSS.highlightAttribute;
  const MEMORY_SELECTOR = `mark.${CSS.highlightClass}, mark.${CSS.localHighlightClass}`;
  const LONG_PRESS_MS = 430;

  let settings = mergeSettings();
  let memories = {};
  let host = null;
  let shadow = null;
  let bubble = null;
  let panel = null;
  let toast = null;
  let historyHint = null;
  let historyHintLine = null;
  let selectionState = null;
  let panelState = null;
  let activePort = null;
  let highlightTimer = null;
  let hoverHintTimer = null;
  let hoverHintHideTimer = null;
  let hoverHintState = null;
  let bubblePressState = null;
  let dragState = null;
  let resizeState = null;
  let suppressPanelHeaderClick = false;
  let pinnedPanelCounter = 0;

  init().catch((error) => {
    console.warn("[这是啥来着] Init failed:", error);
    globalThis.__INLINEAI_CONTENT_LOADING__ = false;
  });

  async function init() {
    await ensureStorageSchema(chrome.storage.local);
    const stored = await chrome.storage.local.get([STORAGE_KEYS.settings, STORAGE_KEYS.memories]);
    settings = mergeSettings(stored[STORAGE_KEYS.settings]);
    memories = stored[STORAGE_KEYS.memories] || {};

    globalThis.__INLINEAI_CONTENT_LOADED__ = true;
    globalThis.__INLINEAI_CONTENT_LOADING__ = false;

    createShadowUi();
    injectMemoryStyle();
    bindEvents();
    scheduleHighlight();
  }

  function createShadowUi() {
    host = document.getElementById(ROOT_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = ROOT_ID;
      host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
      document.documentElement.appendChild(host);
    }

    shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          color-scheme: light;
          --iai-panel-x: 16px;
          --iai-ink: #1f2937;
          --iai-muted: #667085;
          --iai-line: rgba(31, 41, 55, 0.12);
          --iai-paper: #ffffff;
          --iai-wash: #f6f8fb;
          --iai-accent: #2563eb;
          --iai-accent-strong: #1d4ed8;
          --iai-accent-rgb: 37, 99, 235;
          --iai-accent-soft: rgba(37, 99, 235, 0.14);
          --iai-orange: #f97316;
          --iai-blue: #dbeafe;
          --iai-warn: #b42318;
          --iai-shadow: 0 20px 56px rgba(15, 23, 42, 0.16), 0 3px 12px rgba(15, 23, 42, 0.1);
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
        }
        * { box-sizing: border-box; }
        .hidden { display: none !important; }
        #bubble {
          position: fixed;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 253, 247, 0.92);
          border-radius: 50%;
          background: var(--iai-accent);
          color: transparent;
          cursor: pointer;
          box-shadow: 0 0 0 5px rgba(var(--iai-accent-rgb), 0.16), 0 8px 18px rgba(61, 50, 42, 0.22);
          pointer-events: auto;
          transform-origin: center;
          animation: dot-rise 150ms ease-out;
          transition: width 180ms ease, border-radius 180ms ease, transform 130ms ease, box-shadow 130ms ease;
        }
        #bubble:hover,
        #bubble:focus-visible {
          outline: 2px solid rgba(var(--iai-accent-rgb), 0.26);
          outline-offset: 3px;
          transform: translateY(-1px) scale(1.12);
        }
        #bubble.press-hold {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: var(--iai-accent);
          border-color: rgba(255, 253, 247, 0.95);
          transform: translateY(-2px) scale(1.24);
        }
        #bubble.press-hold::before {
          content: "";
          position: absolute;
          inset: -8px;
          border: 2px solid rgba(var(--iai-accent-rgb), 0.18);
          border-radius: 50%;
          animation: dot-hold 430ms linear forwards;
        }
        #bubble.press-hold::after {
          content: none;
        }
        @keyframes dot-rise {
          from { opacity: 0; transform: translate(4px, 5px) scale(0.55); }
          to { opacity: 1; transform: translate(0, 0) scale(1); }
        }
        @keyframes dot-hold {
          from { transform: scale(0.65); opacity: 0.35; }
          to { transform: scale(1.2); opacity: 0.9; }
        }
        .surface {
          position: fixed;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          width: min(540px, calc(100vw - 24px));
          min-width: min(320px, calc(100vw - 24px));
          min-height: 120px;
          max-height: min(680px, calc(100vh - 24px));
          border: 1px solid var(--iai-line);
          border-radius: 8px;
          background: linear-gradient(180deg, #ffffff 0%, var(--iai-wash) 100%);
          background-color: var(--iai-paper);
          box-shadow: var(--iai-shadow);
          overflow: hidden;
          pointer-events: auto;
        }
        .surface.collapsed {
          width: auto !important;
          min-width: 150px;
          height: auto !important;
          min-height: 0;
          grid-template-rows: auto;
        }
        .surface.collapsed .surface-body,
        .surface.collapsed .resize-handle {
          display: none;
        }
        .surface-header {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
          border-bottom: 1px solid var(--iai-line);
          min-height: 44px;
          padding: 8px var(--iai-panel-x);
          cursor: grab;
          user-select: none;
        }
        .surface-header:active { cursor: grabbing; }
        .eyebrow {
          display: block;
          margin-bottom: 3px;
          color: var(--iai-accent-strong);
          font: 700 11px/1.2 ui-sans-serif, system-ui, sans-serif;
        }
        .term-title {
          max-width: min(430px, calc(100vw - 112px));
          margin: 0;
          color: var(--iai-ink);
          font: 650 16px/1.3 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          letter-spacing: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .header-actions,
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .surface-body {
          display: grid;
          gap: 12px;
          max-height: calc(min(680px, 100vh - 24px) - 56px);
          overflow: auto;
          padding: 14px var(--iai-panel-x) 16px;
        }
        .button,
        .icon-button,
        .scope-select {
          border: 1px solid rgba(31, 41, 55, 0.14);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.84);
          color: var(--iai-ink);
          cursor: pointer;
          font: 650 13px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          letter-spacing: 0;
          transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, color 140ms ease, transform 140ms ease;
        }
        .button {
          min-height: 34px;
          padding: 8px 12px;
        }
        .button.primary {
          border-color: rgba(var(--iai-accent-rgb), 0.34);
          background: var(--iai-accent);
          color: white;
        }
        .button.danger { color: var(--iai-warn); }
        .button:hover,
        .button:focus-visible,
        .icon-button:hover,
        .icon-button:focus-visible {
          outline: none;
          border-color: rgba(var(--iai-accent-rgb), 0.28);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
          transform: translateY(-1px);
        }
        .button.primary:hover,
        .button.primary:focus-visible {
          background: var(--iai-accent-strong);
        }
        .icon-button {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-color: transparent;
          background: transparent;
          color: var(--iai-muted);
          font-size: 20px;
          line-height: 1;
        }
        .scope-select {
          min-height: 34px;
          padding: 0 8px;
        }
        .prompt-composer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 36px;
          gap: 10px;
          align-items: center;
          border: 1px solid rgba(31, 41, 55, 0.14);
          border-radius: 8px;
          min-height: 50px;
          padding: 6px 8px 6px 14px;
          background: var(--iai-paper);
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .prompt-composer:focus-within {
          border-color: rgba(var(--iai-accent-rgb), 0.46);
          box-shadow: 0 0 0 3px var(--iai-accent-soft), inset 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .prompt-composer.compact textarea {
          min-height: 24px;
        }
        textarea {
          width: 100%;
          min-height: 24px;
          max-height: 60px;
          resize: none;
          overflow: auto;
          border: 0;
          border-radius: 0;
          padding: 4px 0;
          background: transparent;
          color: var(--iai-ink);
          font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          letter-spacing: 0;
        }
        textarea::placeholder {
          color: #8a94a6;
        }
        textarea:focus { outline: none; }
        .send-round {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          min-height: 36px;
          border-radius: 50%;
          padding: 0;
          border-color: rgba(var(--iai-accent-rgb), 0.28);
          background: var(--iai-accent);
          color: white;
          font: 800 17px/1 ui-sans-serif, system-ui, sans-serif;
        }
        .answer-card-list {
          display: grid;
          gap: 0;
          border: 0;
          border-radius: 8px;
          background: transparent;
          overflow: hidden;
        }
        .answer-card {
          display: grid;
          gap: 10px;
          padding: 12px 0;
          background: transparent;
        }
        .answer-card + .answer-card { border-top: 1px solid rgba(122, 101, 86, 0.18); }
        .answer-card header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: start;
        }
        .answer-card h3 {
          margin: 0;
          color: var(--iai-accent-strong);
          font: 650 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
        }
        .card-actions {
          display: flex;
          gap: 6px;
        }
        .delete-answer {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          min-height: 24px;
          border-color: transparent;
          border-radius: 50%;
          padding: 0;
          background: transparent;
          color: rgba(180, 35, 24, 0.76);
          font: 900 16px/1 ui-sans-serif, system-ui, sans-serif;
        }
        .delete-answer:hover,
        .delete-answer:focus-visible {
          background: rgba(180, 35, 24, 0.08);
          box-shadow: none;
          transform: none;
        }
        .response {
          border: 1px solid var(--iai-line);
          border-radius: 8px;
          padding: 12px;
          background: #ffffff;
          color: var(--iai-ink);
          font: 14px/1.7 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }
        .answer-card .response,
        .thread-message .response {
          border: 0;
          padding: 0;
          background: transparent;
        }
        .thread-list {
          display: grid;
          gap: 12px;
        }
        .thread-message {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 6px;
        }
        .thread-message h3 {
          grid-column: 1;
          margin: 0;
          color: var(--iai-accent-strong);
          font: 650 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          letter-spacing: 0;
        }
        .thread-message .response {
          grid-column: 1 / -1;
        }
        .thread-message .delete-answer {
          grid-column: 2;
          grid-row: 1;
          align-self: start;
        }
        .more-wrap {
          position: relative;
        }
        .more-menu {
          position: absolute;
          right: 0;
          bottom: calc(100% + 6px);
          display: grid;
          gap: 6px;
          min-width: 176px;
          border: 1px solid var(--iai-line);
          border-radius: 8px;
          padding: 8px;
          background: var(--iai-paper);
          box-shadow: 0 12px 28px rgba(23, 23, 23, 0.16);
          z-index: 2;
        }
        .response:empty::before {
          content: var(--iai-waiting-text);
          color: var(--iai-muted);
        }
        .response p { margin: 0 0 9px; }
        .response p:last-child { margin-bottom: 0; }
        .response ul { margin: 6px 0 10px 18px; padding: 0; }
        .response li { margin: 4px 0; }
        .response code {
          border-radius: 5px;
          padding: 1px 4px;
          background: rgba(23, 23, 23, 0.08);
          font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        .response pre {
          margin: 8px 0;
          overflow: auto;
          border-radius: 8px;
          padding: 9px;
          background: #111827;
          color: #f9fafb;
        }
        .notice {
          border-left: 3px solid var(--iai-accent);
          padding: 8px 10px;
          background: rgba(var(--iai-accent-rgb), 0.08);
          color: var(--iai-muted);
          font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
        }
        .error {
          border-left-color: var(--iai-warn);
          background: rgba(180, 35, 24, 0.08);
          color: #7a271a;
        }
        .resize-handle {
          position: absolute;
          width: 16px;
          height: 16px;
          pointer-events: auto;
        }
        .resize-handle[data-resize="nw"] { left: 0; top: 0; cursor: nwse-resize; }
        .resize-handle[data-resize="ne"] { right: 0; top: 0; cursor: nesw-resize; }
        .resize-handle[data-resize="sw"] { left: 0; bottom: 0; cursor: nesw-resize; }
        .resize-handle[data-resize="se"] { right: 0; bottom: 0; cursor: nwse-resize; }
        #toast {
          position: fixed;
          right: 16px;
          bottom: 16px;
          max-width: min(320px, calc(100vw - 32px));
          border: 1px solid rgba(var(--iai-accent-rgb), 0.25);
          border-radius: 8px;
          padding: 10px 12px;
          background: var(--iai-paper);
          box-shadow: 0 12px 32px rgba(23, 23, 23, 0.18);
          color: var(--iai-ink);
          font: 13px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          pointer-events: none;
        }
        #history-hint-line {
          position: fixed;
          height: 2px;
          min-width: 12px;
          border-radius: 999px;
          background-image: repeating-linear-gradient(90deg, rgba(94, 94, 94, 0.62) 0 2px, transparent 2px 6px);
          pointer-events: none;
        }
        #history-hint {
          position: fixed;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          max-width: min(160px, calc(100vw - 24px));
          border: 1px solid rgba(var(--iai-accent-rgb), 0.26);
          border-radius: 999px;
          padding: 5px 9px;
          background: var(--iai-paper);
          color: var(--iai-ink);
          box-shadow: 0 10px 26px rgba(23, 23, 23, 0.14);
          cursor: pointer;
          pointer-events: auto;
          font: 650 12px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          letter-spacing: 0;
        }
        #history-hint::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--iai-accent);
          margin-right: 6px;
          flex: 0 0 auto;
        }
        #history-hint span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        #history-hint:hover,
        #history-hint:focus-visible {
          outline: 3px solid rgba(var(--iai-accent-rgb), 0.18);
          outline-offset: 2px;
        }
        @media (max-width: 520px) {
          .surface { width: calc(100vw - 18px); }
          .term-title { max-width: calc(100vw - 120px); font-size: 16px; }
          .surface-body { padding: 10px; }
        }
      </style>
      <button id="bubble" class="hidden" type="button" title="${escapeHtml(t("content.bubbleTitle", currentLanguage()))}" aria-label="${escapeHtml(t("content.bubbleTitle", currentLanguage()))}"></button>
      <div id="history-hint-line" class="hidden"></div>
      <button id="history-hint" class="hidden" type="button" data-action="open-hover-memory" title="${escapeHtml(t("content.historyHintTitle", currentLanguage()))}" aria-label="${escapeHtml(t("content.historyHintTitle", currentLanguage()))}"></button>
      <section id="panel" class="surface hidden" role="dialog" aria-modal="false" aria-label="${escapeHtml(t("app.dialogLabel", currentLanguage()))}"></section>
      <div id="toast" class="hidden"></div>
    `;

    bubble = shadow.getElementById("bubble");
    panel = shadow.getElementById("panel");
    toast = shadow.getElementById("toast");
    historyHint = shadow.getElementById("history-hint");
    historyHintLine = shadow.getElementById("history-hint-line");
    applyThemeVars();
    updateLocalizedShellLabels();
  }

  function bindEvents() {
    document.addEventListener("mouseup", () => window.setTimeout(handleSelection, 24), true);
    document.addEventListener("keyup", (event) => {
      if (["Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        window.setTimeout(handleSelection, 24);
      }
    }, true);
    ["keydown", "keyup", "keypress", "beforeinput", "input", "compositionstart", "compositionupdate", "compositionend"].forEach((type) => {
      host.addEventListener(type, stopInlineAiInputLeak);
    });
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("keydown", handleDocumentKeydown, true);
    document.addEventListener("mousemove", handleDragMove, true);
    document.addEventListener("mouseup", handleDragEnd, true);
    document.addEventListener("scroll", hideHistoryHint, true);

    shadow.addEventListener("click", handleShadowClick);
    shadow.addEventListener("keydown", handleShadowKeydown);
    shadow.addEventListener("input", handleShadowInput);
    shadow.addEventListener("mousedown", handleDragStart);
    shadow.addEventListener("mouseup", updateSelectionActions);
    shadow.addEventListener("keyup", updateSelectionActions);
    bubble.addEventListener("pointerdown", handleBubblePointerDown);
    bubble.addEventListener("pointerup", handleBubblePointerUp);
    bubble.addEventListener("pointerleave", cancelBubblePress);
    bubble.addEventListener("pointercancel", cancelBubblePress);

    chrome.storage.onChanged.addListener(handleStorageChange);
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === MESSAGE_TYPES.showReady) {
        showToast(t("content.readyToast", currentLanguage()));
      } else if (message?.type === MESSAGE_TYPES.openMemory) {
        const memory = memories[message.memoryId];
        if (memory) {
          openMemoryList([memory], {
            left: Math.max(24, window.innerWidth - 560),
            right: Math.max(24, window.innerWidth - 24),
            top: 96,
            bottom: 128,
            width: 520,
            height: 32
          });
        }
      }
    });
  }

  function stopInlineAiInputLeak(event) {
    if (!isInlineAiComposedEvent(event)) {
      return;
    }
    event.stopPropagation();
  }

  function isInlineAiComposedEvent(event) {
    const path = event.composedPath?.() || [];
    return path.includes(host) || path.includes(shadow);
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "local") {
      return;
    }

    if (changes[STORAGE_KEYS.settings]) {
      settings = mergeSettings(changes[STORAGE_KEYS.settings].newValue);
      applyThemeVars();
      updateLocalizedShellLabels();
      injectMemoryStyle();
      scheduleHighlight();
    }

    if (changes[STORAGE_KEYS.memories]) {
      memories = changes[STORAGE_KEYS.memories].newValue || {};
      scheduleHighlight();
    }
  }

  function handleSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      hideBubble();
      return;
    }

    const range = selection.getRangeAt(0);
    if (isInsideInlineAi(range.commonAncestorContainer) || isInsideEditable(range.commonAncestorContainer)) {
      hideBubble();
      return;
    }

    const term = normalizeVisibleText(selection.toString());
    if (!isSelectableTerm(term)) {
      hideBubble();
      return;
    }

    const rect = lastUsableRect(range);
    if (!rect) {
      hideBubble();
      return;
    }

    selectionState = {
      term,
      termKey: termKeyFor(term),
      rect: rectToObject(rect),
      range: range.cloneRange(),
      context: extractSelectionContext(range, term),
      sourceUrl: currentPageUrl(),
      pageTitle: document.title || location.href,
      siteHost: location.hostname,
      memories: applicableMemories().filter((memory) => memory.termKey === termKeyFor(term))
    };

    bubble.classList.remove("hidden");
    bubble.title = selectionState.memories.length
      ? t("content.bubbleExistingTitle", currentLanguage())
      : t("content.bubbleTitle", currentLanguage());
    bubble.setAttribute("aria-label", bubble.title);
    positionElement(bubble, selectionState.rect, { mode: "bubble" });
  }

  function handleDocumentClick(event) {
    const target = event.target;
    const memoryMark = target?.closest ? target.closest(MEMORY_SELECTOR) : null;

    if (!memoryMark) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openMemoryFromMark(memoryMark);
  }

  function handleDocumentKeydown(event) {
    if (event.key === "Escape") {
      hideBubble();
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && event.target?.closest?.(MEMORY_SELECTOR)) {
      event.preventDefault();
      event.stopPropagation();
      openMemoryFromMark(event.target.closest(MEMORY_SELECTOR));
    }
  }

  function handleShadowClick(event) {
    const button = event.target?.closest?.("[data-action]");
    const action = button?.dataset.action;

    if (!action) {
      const header = event.target?.closest?.(".surface-header");
      if (header && !event.target?.closest?.("button,select")) {
        if (suppressPanelHeaderClick) {
          suppressPanelHeaderClick = false;
          return;
        }
        toggleSurfaceCollapse(header.closest(".surface"));
      }
      return;
    }

    if (action === "close-pinned") {
      closePinnedPanel(button);
    } else if (action === "close") {
      closePanel();
    } else if (action === "send-new") {
      sendQuestion({ followup: false });
    } else if (action === "send-followup") {
      sendQuestion({ followup: true });
    } else if (action === "show-followup") {
      selectCardFromButton(button);
      renderFollowupPanel();
    } else if (action === "save-answer") {
      saveCurrentAnswer({ kind: "full" });
    } else if (action === "save-excerpt") {
      saveCurrentAnswer({ kind: "excerpt" });
    } else if (action === "retry-request") {
      retryLastRequest();
    } else if (action === "delete-card") {
      selectCardFromButton(button);
      deleteMemoryCard(button.dataset.memoryId, button.dataset.cardId);
    } else if (action === "open-hover-memory") {
      openHoverMemory();
    }
  }

  function handleShadowKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && event.target?.matches?.("textarea")) {
      event.preventDefault();
      sendQuestion({ followup: Boolean(panelState?.currentCard) });
    }
  }

  function handleShadowInput(event) {
    if (event.target?.matches?.("textarea")) {
      autoGrowTextarea(event.target);
    }
  }

  function handleDragStart(event) {
    const resizeHandle = event.target?.closest?.(".resize-handle");
    if (resizeHandle) {
      const surface = resizeHandle.closest(".surface");
      const rect = surface.getBoundingClientRect();
      resizeState = {
        surface,
        corner: resizeHandle.dataset.resize,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
      event.preventDefault();
      return;
    }

    const header = event.target?.closest?.(".surface-header");
    if (!header || event.target?.closest?.("button,select")) {
      return;
    }

    const surface = header.closest(".surface");
    const rect = surface.getBoundingClientRect();
    dragState = {
      surface,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false
    };
    event.preventDefault();
  }

  function handleDragMove(event) {
    if (resizeState) {
      hideHistoryHint();
      resizeSurface(event);
      return;
    }

    if (!dragState) {
      scheduleHistoryHint(event);
      return;
    }

    hideHistoryHint();
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (Math.hypot(deltaX, deltaY) > 3) {
      dragState.moved = true;
    }
    const rect = dragState.surface.getBoundingClientRect();
    const left = clamp(dragState.left + deltaX, 8, window.innerWidth - rect.width - 8);
    const top = clamp(dragState.top + deltaY, 8, window.innerHeight - rect.height - 8);
    dragState.surface.style.left = `${left}px`;
    dragState.surface.style.top = `${top}px`;
  }

  function handleDragEnd() {
    const moved = Boolean(dragState?.moved);
    dragState = null;
    resizeState = null;
    if (moved) {
      suppressPanelHeaderClick = true;
      window.setTimeout(() => {
        suppressPanelHeaderClick = false;
      }, 0);
    }
  }

  function resizeSurface(event) {
    const state = resizeState;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    let left = state.left;
    let top = state.top;
    let width = state.width;
    let height = state.height;

    if (state.corner.includes("e")) {
      width = state.width + dx;
    }
    if (state.corner.includes("s")) {
      height = state.height + dy;
    }
    if (state.corner.includes("w")) {
      width = state.width - dx;
      left = state.left + dx;
    }
    if (state.corner.includes("n")) {
      height = state.height - dy;
      top = state.top + dy;
    }

    width = clamp(width, 300, window.innerWidth - 16);
    height = clamp(height, 120, window.innerHeight - 16);
    left = clamp(left, 8, window.innerWidth - width - 8);
    top = clamp(top, 8, window.innerHeight - height - 8);

    state.surface.style.left = `${left}px`;
    state.surface.style.top = `${top}px`;
    state.surface.style.width = `${width}px`;
    state.surface.style.height = `${height}px`;
  }

  function handleBubblePointerDown(event) {
    if (event.button && event.button !== 0) {
      return;
    }

    window.clearTimeout(handleBubblePointerDown.timer);
    bubblePressState = {
      pointerId: event.pointerId,
      longPressOpened: false
    };
    bubble.setPointerCapture?.(event.pointerId);

    const rect = bubble.getBoundingClientRect();
    bubble.classList.add("press-hold");

    handleBubblePointerDown.timer = window.setTimeout(() => {
      if (!bubblePressState || bubblePressState.pointerId !== event.pointerId) {
        return;
      }
      bubblePressState.longPressOpened = true;
      const promptAnchor = rectToObject(bubble.getBoundingClientRect());
      openCustomQuestionPanel(promptAnchor);
    }, LONG_PRESS_MS);
  }

  function handleBubblePointerUp(event) {
    const state = bubblePressState;
    cancelBubblePress(event);

    if (!state || state.longPressOpened) {
      return;
    }

    explainSelectionFromDot();
  }

  function cancelBubblePress(event) {
    window.clearTimeout(handleBubblePointerDown.timer);
    bubblePressState = null;
    bubble?.classList.remove("press-hold");
    if (event?.pointerId !== undefined) {
      try {
        bubble.releasePointerCapture?.(event.pointerId);
      } catch (_) {
        // Pointer capture may already be gone.
      }
    }
  }

  function explainSelectionFromDot() {
    if (!selectionState) {
      return;
    }

    pinCurrentPanelSnapshot();
    prepareTemporaryPanelState();
    hideBubble();
    panelState.pendingQueryKind = "default";
    panelState.pendingQuery = defaultQuestionFor(panelState.term);
    renderAnswerPanel({ loading: true });
    showPanel(selectionState.rect);
    window.setTimeout(() => {
      sendQuestion({ questionOverride: panelState.pendingQuery, followup: false, queryKind: "default" });
    }, 30);
  }

  function openCustomQuestionPanel(anchorRect) {
    if (!selectionState) {
      return;
    }

    pinCurrentPanelSnapshot();
    prepareTemporaryPanelState();
    hideBubble();
    renderQuestionPanel();
    showPanel(anchorRect || selectionState.rect);
  }

  function scheduleHistoryHint(event) {
    if (isInsideInlineAi(event.target)) {
      window.clearTimeout(hoverHintHideTimer);
      return;
    }

    window.clearTimeout(hoverHintTimer);
    const point = { x: event.clientX, y: event.clientY, target: event.target };
    hoverHintTimer = window.setTimeout(() => updateHistoryHint(point), 110);
  }

  function updateHistoryHint(point) {
    if (settings.hideReminders || !point || panelIsOpen() || isInsideEditable(point.target)) {
      hideHistoryHint();
      return;
    }

    if (hoverHintState && pointInHoverKeepArea(point.x, point.y)) {
      window.clearTimeout(hoverHintHideTimer);
      return;
    }

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      hideHistoryHint();
      return;
    }

    const range = rangeFromPoint(point.x, point.y);
    const textNode = range?.startContainer;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE || isInsideInlineAi(textNode) || isInsideEditable(textNode)) {
      hideHistoryHint();
      return;
    }

    const match = findMemoryAtTextOffset(textNode, range.startOffset);
    if (!match) {
      scheduleHideHistoryHint();
      return;
    }

    showHistoryHint(match);
  }

  function rangeFromPoint(x, y) {
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(x, y);
    }
    const position = document.caretPositionFromPoint?.(x, y);
    if (!position?.offsetNode) {
      return null;
    }
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  function findMemoryAtTextOffset(textNode, offset) {
    const text = textNode.nodeValue || "";
    if (!text.trim()) {
      return null;
    }

    const groups = groupApplicableMemoriesByTerm();
    const candidates = Object.values(groups)
      .filter((group) => group.term)
      .sort((a, b) => b.term.length - a.term.length);
    if (!candidates.length) {
      return null;
    }

    const haystack = settings.caseSensitive ? text : text.toLowerCase();
    for (const group of candidates) {
      const needle = settings.caseSensitive ? group.term : group.term.toLowerCase();
      let index = haystack.indexOf(needle);
      while (index !== -1) {
        const end = index + group.term.length;
        if (offset >= index && offset <= end) {
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, end);
          const rect = lastUsableRect(range);
          range.detach?.();
          if (rect) {
            return {
              term: group.term,
              termKey: group.termKey,
              memories: group.memories,
              rect: rectToObject(rect)
            };
          }
        }
        index = haystack.indexOf(needle, index + Math.max(1, needle.length));
      }
    }

    return null;
  }

  function groupApplicableMemoriesByTerm() {
    return applicableMemories()
      .filter(hasSyncedCards)
      .reduce((groups, memory) => {
        const key = memory.termKey || termKeyFor(memory.term);
        if (!groups[key]) {
          groups[key] = {
            term: memory.term || "",
            termKey: key,
            memories: []
          };
        }
        groups[key].memories.push(memory);
        return groups;
      }, {});
  }

  function showHistoryHint(match) {
    window.clearTimeout(hoverHintHideTimer);
    hoverHintState = match;
    const rect = match.rect;
    historyHintLine.classList.add("hidden");

    const count = historyRecordCount(match.memories);
    historyHint.innerHTML = `<span>${escapeHtml(t("content.savedRecordCount", { count }, currentLanguage()))}</span>`;
    historyHint.classList.remove("hidden");
    window.requestAnimationFrame(() => positionHistoryHint(rect));
  }

  function historyRecordCount(memoryList) {
    return memoryList.reduce((sum, memory) => sum + (memory.cards || []).length, 0);
  }

  function positionHistoryHint(anchorRect) {
    const hintRect = historyHint.getBoundingClientRect();
    const margin = 8;
    let left = anchorRect.right + margin;
    let top = anchorRect.top + (anchorRect.height - hintRect.height) / 2;

    if (left + hintRect.width > window.innerWidth - margin) {
      left = anchorRect.left - hintRect.width - margin;
    }
    if (left < margin) {
      left = anchorRect.left;
      top = anchorRect.bottom + margin;
    }
    if (top + hintRect.height > window.innerHeight - margin) {
      top = anchorRect.top - hintRect.height - margin;
    }

    historyHint.style.left = `${Math.round(clamp(left, margin, window.innerWidth - hintRect.width - margin))}px`;
    historyHint.style.top = `${Math.round(clamp(top, margin, window.innerHeight - hintRect.height - margin))}px`;
  }

  function pointInHoverKeepArea(x, y) {
    const rects = [
      hoverHintState?.rect,
      historyHint && !historyHint.classList.contains("hidden") ? rectToObject(historyHint.getBoundingClientRect()) : null
    ].filter(Boolean);

    return rects.some((rect) =>
      x >= rect.left - 18 &&
      x <= rect.right + 18 &&
      y >= rect.top - 18 &&
      y <= rect.bottom + 18
    );
  }

  function scheduleHideHistoryHint() {
    window.clearTimeout(hoverHintHideTimer);
    hoverHintHideTimer = window.setTimeout(hideHistoryHint, 650);
  }

  function hideHistoryHint() {
    window.clearTimeout(hoverHintTimer);
    window.clearTimeout(hoverHintHideTimer);
    hoverHintState = null;
    historyHint?.classList.add("hidden");
    historyHintLine?.classList.add("hidden");
  }

  function openHoverMemory() {
    if (!hoverHintState?.memories?.length) {
      return;
    }
    const { memories: memoryList, rect } = hoverHintState;
    hideHistoryHint();
    openMemoryList(memoryList, rect);
  }

  function prepareTemporaryPanelState() {
    panelState = {
      mode: "temp",
      id: createId("tmp"),
      term: selectionState.term,
      termKey: selectionState.termKey,
      threadId: createId("thread"),
      highlightId: createId("hl"),
      sourceUrl: selectionState.sourceUrl,
      pageTitle: selectionState.pageTitle,
      siteHost: selectionState.siteHost,
      context: selectionState.context,
      cards: [],
      currentCard: null,
      savedMemoryId: "",
      collapsed: false,
      retry: null
    };
  }

  function renderQuestionPanel() {
    panelState.mode = "inputReady";
    panel.className = panelClass();
    panel.innerHTML = surfaceShell(panelState.term, "", `
      <div class="prompt-composer">
        <textarea id="inlineai-question" aria-label="${escapeHtml(t("content.customQuestionAria", currentLanguage()))}" placeholder="${escapeHtml(t("content.askPlaceholder", currentLanguage()))}" rows="1"></textarea>
        <button class="button send-round" type="button" data-action="send-new" title="${escapeHtml(t("content.send", currentLanguage()))}" aria-label="${escapeHtml(t("content.send", currentLanguage()))}">↑</button>
      </div>
      <div id="inlineai-error" class="notice error hidden"></div>
      <div id="inlineai-response" class="response hidden"></div>
    `);
    focusQuestionSoon();
  }

  function renderAnswerPanel({ loading = false } = {}) {
    panelState.mode = loading ? "answerLoading" : (panelState.savedMemoryId || panelState.currentCard?.memory ? "savedThread" : "answerReady");
    panel.className = panelClass();
    panel.innerHTML = surfaceShell(panelState.term, "", `
      ${renderThread(panelState.currentCard, { loading })}
      ${!loading && panelState.currentCard ? renderFollowupComposer() : ""}
      <div id="inlineai-error" class="notice error hidden"></div>
      <div id="inlineai-actions-after" class="actions">${loading ? "" : answerActions()}</div>
    `);
    updateSelectionActions();
  }

  function renderFollowupPanel() {
    panelState.mode = "followupInput";
    panel.className = panelClass();
    panel.innerHTML = surfaceShell(panelState.term, "", `
      ${renderThread(panelState.currentCard)}
      <div class="prompt-composer">
        <textarea id="inlineai-question" aria-label="${escapeHtml(t("content.followupAria", currentLanguage()))}" placeholder="${escapeHtml(t("content.followupPlaceholder", currentLanguage()))}" rows="1"></textarea>
        <button class="button send-round" type="button" data-action="send-followup" title="${escapeHtml(t("content.send", currentLanguage()))}" aria-label="${escapeHtml(t("content.send", currentLanguage()))}">↑</button>
      </div>
      <div id="inlineai-error" class="notice error hidden"></div>
      <div id="inlineai-response" class="response hidden"></div>
    `);
    focusQuestionSoon();
  }

  function renderHistoryPanel(memoryList, anchorRect) {
    const cards = memoryList.flatMap((memory) =>
      (memory.cards || []).map((card) => ({ ...card, memory }))
    );
    const first = memoryList[0];
    panelState = {
      mode: "historyThreadOpen",
      term: first?.term || "",
      termKey: first?.termKey || "",
      threadId: first?.threadId || createId("thread"),
      highlightId: first?.highlightId || createId("hl"),
      memories: memoryList,
      cards,
      currentCard: cards[0] || null,
      savedMemoryId: first?.id || "",
      collapsed: false
    };

    panel.className = panelClass();
    panel.innerHTML = surfaceShell(panelState.term, "", `
      ${renderMemoryCards(cards)}
      <div id="inlineai-error" class="notice error hidden"></div>
    `);
    showPanel(anchorRect);
  }

  function surfaceShell(term, _eyebrow, body, options = {}) {
    const closeAction = options.closeAction || "close";
    const closeButton = options.close === false
      ? ""
      : `<button class="icon-button" type="button" data-action="${escapeHtml(closeAction)}" title="${escapeHtml(t("content.close", currentLanguage()))}" aria-label="${escapeHtml(t("content.close", currentLanguage()))}">×</button>`;
    const title = normalizeVisibleText(term);

    return `
      <header class="surface-header">
        <div>
          <h2 class="term-title" title="${escapeHtml(title)}">${escapeHtml(truncateTitle(title))}</h2>
        </div>
        <div class="header-actions">
          ${closeButton}
        </div>
      </header>
      <div class="surface-body">${body}</div>
      ${resizeHandles()}
    `;
  }

  function answerActions() {
    const excerpt = getSelectedResponseExcerpt();
    const isSaved = Boolean(panelState?.savedMemoryId || panelState?.currentCard?.memory);
    if (!panelState?.currentCard) {
      return "";
    }
    if (!isSaved) {
      const saveAction = excerpt ? "save-excerpt" : "save-answer";
      return `
        <button class="button primary" id="inlineai-save-button" type="button" data-action="${saveAction}">${escapeHtml(excerpt ? t("content.saveExcerpt", currentLanguage()) : t("content.save", currentLanguage()))}</button>
      `;
    }

    return "";
  }

  function renderMemoryCards(cards) {
    if (!cards.length) {
      return `<div class="notice">${escapeHtml(t("content.noSavedAnswers", currentLanguage()))}</div>`;
    }

    return `
      <div class="answer-card-list">
        ${cards.map((card) => `
          <article class="answer-card" data-memory-id="${escapeHtml(card.memory.id)}" data-card-id="${escapeHtml(card.id)}">
            ${renderThread(card)}
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderThread(card, { loading = false } = {}) {
    if (!card) {
      if (loading) {
        const query = displayQuery({ query: panelState?.pendingQuery || "", queryKind: panelState?.pendingQueryKind || "default" }, panelState?.term || "");
        return `<article class="thread-message"><h3>${escapeHtml(query)}</h3><div id="inlineai-response" class="response"></div></article>`;
      }
      return `<div id="inlineai-response" class="response ${loading ? "" : "hidden"}"></div>`;
    }
    const followups = card.followups || [];
    const messages = [
      ...followups.map((item) => ({
        query: displayQuery(item, card.term || card.memory?.term),
        response: item.response || "",
        createdAt: item.createdAt || 0
      })),
      {
        query: displayQuery(card, card.term || card.memory?.term),
        response: card.response || "",
        createdAt: card.createdAt || 0,
        memoryId: card.memory?.id || "",
        cardId: card.id || ""
      }
    ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return `
      <div class="thread-list">
        ${loading ? `<article class="thread-message"><h3>${escapeHtml(t("content.answering", currentLanguage()))}</h3><div id="inlineai-response" class="response"></div></article>` : ""}
        ${messages.map((item) => `
          <article class="thread-message">
            <h3>${escapeHtml(item.query)}</h3>
            ${item.memoryId && item.cardId ? `<button class="button delete-answer" type="button" data-action="delete-card" data-memory-id="${escapeHtml(item.memoryId)}" data-card-id="${escapeHtml(item.cardId)}" title="${escapeHtml(t("content.delete", currentLanguage()))}" aria-label="${escapeHtml(t("content.deleteSavedAnswer", currentLanguage()))}">×</button>` : ""}
            <div class="response">${renderMarkdown(item.response || "")}</div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderFollowupComposer() {
    return `
      <div class="prompt-composer compact">
        <textarea id="inlineai-question" aria-label="${escapeHtml(t("content.followupAria", currentLanguage()))}" placeholder="${escapeHtml(t("content.followupComposerPlaceholder", currentLanguage()))}" rows="1"></textarea>
        <button class="button send-round" type="button" data-action="send-followup" title="${escapeHtml(t("content.send", currentLanguage()))}" aria-label="${escapeHtml(t("content.send", currentLanguage()))}">↑</button>
      </div>
    `;
  }

  function displayQuery(item, term) {
    const query = typeof item === "string" ? item : item?.query;
    const normalized = normalizeVisibleText(query);
    if (item?.queryKind === "default" || isDefaultPromptQuestion(normalized, term)) {
      return t("content.defaultQueryTitle", currentLanguage());
    }
    if (!normalized || normalized === "节选回答" || normalized === "完整回答") {
      return t("content.explain", currentLanguage());
    }
    return normalized;
  }

  function resizeHandles() {
    return `
      <div class="resize-handle" data-resize="nw" aria-hidden="true"></div>
      <div class="resize-handle" data-resize="ne" aria-hidden="true"></div>
      <div class="resize-handle" data-resize="sw" aria-hidden="true"></div>
      <div class="resize-handle" data-resize="se" aria-hidden="true"></div>
    `;
  }

  async function sendQuestion({ questionOverride = "", followup = false, queryKind = "custom" } = {}) {
    if (!panelState) {
      return;
    }

    const textarea = shadow.getElementById("inlineai-question");
    const question = normalizeVisibleText(questionOverride || textarea?.value || "");
    if (!question) {
      showError(t("content.needQuestion", currentLanguage()));
      return;
    }

    if (followup && panelState.currentCard) {
      renderAnswerPanel({ loading: true });
    }
    const responseNode = ensureResponseNode();
    const buttons = Array.from(panel.querySelectorAll("button,select"));
    const previousResponse = threadToText(panelState.currentCard);
    let answer = "";

    panelState.retry = { questionOverride: question, followup, queryKind };
    clearError();
    responseNode.classList.remove("hidden");
    responseNode.innerHTML = "";
    buttons.forEach((button) => {
      if (button.dataset.action !== "close") {
        button.disabled = true;
      }
    });

    try {
      await streamApi({
        messages: buildMessages(panelState.term, question, previousResponse, panelState.context, panelState.currentCard?.query),
        onChunk(chunk) {
          answer += chunk;
          responseNode.innerHTML = renderMarkdown(answer);
          responseNode.scrollIntoView({ block: "nearest" });
        }
      });

      if (followup && panelState.currentCard) {
        const followupEntry = { id: createId("follow"), query: question, queryKind: "custom", response: answer, createdAt: Date.now() };
        panelState.currentCard.followups = [...(panelState.currentCard.followups || []), followupEntry];
        await persistFollowupIfSaved(followupEntry);
      } else {
        panelState.currentCard = {
          id: createId("card"),
          messageId: createId("msg"),
          query: question,
          queryKind,
          response: answer,
          kind: "full",
          createdAt: Date.now(),
          synced: false,
          followups: []
        };
        panelState.cards = [panelState.currentCard];
      }

      renderAnswerPanel();
      showToast(t("content.temporaryAnswer", currentLanguage()));
    } catch (error) {
      showError(humanizeContentError(error), true);
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  }

  async function saveCurrentAnswer({ kind }) {
    if (!panelState?.currentCard) {
      showError(t("content.noAnswerToSave", currentLanguage()));
      return;
    }

    const excerpt = kind === "excerpt" ? getSelectedResponseExcerpt() : "";
    if (kind === "excerpt" && !excerpt) {
      showError(t("content.selectAnswerFirst", currentLanguage()));
      return;
    }

    const scope = settings.defaultSaveScope || "all";
    const now = Date.now();
    const memory = findOrCreateMemory(scope, now);
    const card = {
      id: kind === "excerpt" ? createId("card") : panelState.currentCard.id,
      messageId: panelState.currentCard.messageId || createId("msg"),
      query: panelState.currentCard.query,
      queryKind: panelState.currentCard.queryKind || "custom",
      response: kind === "excerpt" ? excerpt : panelState.currentCard.response,
      kind: kind === "excerpt" ? "excerpt" : "full",
      createdAt: now,
      synced: true,
      followups: panelState.currentCard.followups || []
    };

    memory.cards = [...(memory.cards || []), card];
    memory.updatedAt = now;
    memories = { ...memories, [memory.id]: memory };
    panelState.savedMemoryId = memory.id;
    panelState.currentCard = { ...card, memory };
    panelState.cards = [panelState.currentCard];

    await chrome.storage.local.set({ [STORAGE_KEYS.memories]: memories });
    renderAnswerPanel();
    showToast(kind === "excerpt" ? t("content.excerptSaved", currentLanguage()) : t("content.savedToHistory", currentLanguage()));
  }

  function findOrCreateMemory(scope, now) {
    const existing = Object.values(memories).find((memory) => {
      if (memory.termKey !== panelState.termKey || memory.scope !== scope) {
        return false;
      }
      if (scope === "page") {
        return memory.pageUrl === currentPageUrl();
      }
      if (scope === "site") {
        return domainsOverlap(memory.siteDomains || domainFamily(memory.siteHost), domainFamily(location.hostname));
      }
      return true;
    });

    if (existing) {
      return { ...existing, cards: [...(existing.cards || [])] };
    }

    const id = createId("mem");
    return {
      id,
      threadId: panelState.threadId || createId("thread"),
      highlightId: panelState.highlightId || createId("hl"),
      term: panelState.term,
      termKey: panelState.termKey,
      pageTitle: document.title || location.href,
      pageUrl: currentPageUrl(),
      siteHost: location.hostname,
      siteDomains: domainFamily(location.hostname),
      savedAt: now,
      updatedAt: now,
      saved: true,
      scope,
      reminder: settings.defaultReminder || "hoverWeak",
      cards: []
    };
  }

  async function persistFollowupIfSaved(followupEntry) {
    const memoryId = panelState.currentCard?.memory?.id || panelState.savedMemoryId;
    if (!memoryId || !memories[memoryId]) {
      return;
    }

    const memory = memories[memoryId];
    const cards = (memory.cards || []).map((card) => {
      if (card.id !== panelState.currentCard.id) {
        return card;
      }
      return {
        ...card,
        followups: [...(card.followups || []), followupEntry]
      };
    });
    memories = { ...memories, [memoryId]: { ...memory, cards, updatedAt: Date.now() } };
    await chrome.storage.local.set({ [STORAGE_KEYS.memories]: memories });
  }

  async function deleteMemoryCard(memoryId, cardId) {
    const memory = memories[memoryId];
    if (!memory) {
      return;
    }
    const confirmed = window.confirm(t("content.deleteCardConfirm", { term: memory.term }, currentLanguage()));
    if (!confirmed) {
      return;
    }

    const cards = (memory.cards || []).filter((card) => card.id !== cardId);
    if (!cards.length) {
      const next = { ...memories };
      delete next[memoryId];
      memories = next;
    } else {
      memories = { ...memories, [memoryId]: { ...memory, cards, updatedAt: Date.now() } };
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.memories]: memories });
    removeLocalMarksForMemory(memoryId);
    scheduleHighlight();
    if (memories[memoryId]) {
      renderHistoryPanel([memories[memoryId]], rectToObject(panel.getBoundingClientRect()));
      return;
    }
    if (panelState) {
      panelState.currentCard = null;
      panelState.savedMemoryId = "";
      panel.className = panelClass();
      panel.innerHTML = surfaceShell(panelState.term, "", `
        <div class="notice">${escapeHtml(t("content.recordDeleted", currentLanguage()))}</div>
      `);
    }
  }

  function toggleSurfaceCollapse(surface) {
    if (!surface) {
      return;
    }
    if (surface.id === "panel" && panelState) {
      panelState.collapsed = !panelState.collapsed;
      surface.classList.toggle("collapsed", panelState.collapsed);
      return;
    }
    surface.classList.toggle("collapsed");
  }

  function openMemoryFromMark(mark) {
    const key = mark.getAttribute(TERM_KEY_ATTR) || termKeyFor(mark.textContent);
    const isLocalSavedMark = mark.classList.contains(CSS.localHighlightClass);
    const memoryIds = (mark.getAttribute(MEMORY_ID_ATTR) || "").split(",").filter(Boolean);
    const list = memoryIds
      .map((id) => memories[id])
      .filter(Boolean)
      .filter((memory) => isMemoryApplicable(memory) && (isLocalSavedMark || hasSyncedCards(memory)));
    const fallback = applicableMemories().filter((memory) => memory.termKey === key && hasSyncedCards(memory));
    const memoryList = list.length ? list : fallback;
    if (!memoryList.length) {
      return;
    }
    openMemoryList(memoryList, rectToObject(mark.getBoundingClientRect()));
  }

  function openMemoryList(memoryList, anchorRect) {
    hideHistoryHint();
    hideBubble();
    pinCurrentPanelSnapshot();
    renderHistoryPanel(memoryList, anchorRect);
  }

  function panelClass() {
    return [
      "surface",
      panelState?.collapsed ? "collapsed" : ""
    ].filter(Boolean).join(" ");
  }

  function applyThemeVars() {
    if (!host) {
      return;
    }
    const color = settings.highlightColor || "#c98257";
    const rgb = hexToRgb(color) || { r: 201, g: 130, b: 87 };
    const strong = shadeHex(color, -22);
    host.style.setProperty("--iai-orange", color);
    host.style.setProperty("--iai-accent", color);
    host.style.setProperty("--iai-accent-strong", strong);
    host.style.setProperty("--iai-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    host.style.setProperty("--iai-accent-soft", hexToRgba(color, 0.24));
  }

  function panelIsOpen() {
    return Boolean(panel && !panel.classList.contains("hidden"));
  }

  function pinCurrentPanelSnapshot() {
    if (!panelIsOpen() || !panelState?.currentCard) {
      return;
    }

    const snapshot = panel.cloneNode(true);
    snapshot.id = createId("pinned");
    snapshot.dataset.inlineaiPinnedPanel = String(++pinnedPanelCounter);
    snapshot.classList.remove("hidden");
    snapshot.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    snapshot.querySelectorAll("textarea,input,select").forEach((node) => {
      node.disabled = true;
    });
    snapshot.querySelectorAll("[data-action]").forEach((node) => {
      if (node.dataset.action === "close") {
        node.dataset.action = "close-pinned";
        return;
      }
      node.removeAttribute("data-action");
      if ("disabled" in node) {
        node.disabled = true;
      }
      node.setAttribute("aria-disabled", "true");
    });
    shadow.insertBefore(snapshot, panel);
  }

  function closePinnedPanel(button) {
    button.closest("[data-inlineai-pinned-panel]")?.remove();
  }

  function selectCardFromButton(button) {
    const memoryId = button?.dataset?.memoryId;
    const cardId = button?.dataset?.cardId;
    if (!memoryId || !cardId || !panelState) {
      return;
    }
    const memory = memories[memoryId];
    const card = memory?.cards?.find((item) => item.id === cardId);
    if (!memory || !card) {
      return;
    }
    panelState.currentCard = { ...card, memory };
    panelState.savedMemoryId = memory.id;
  }

  function retryLastRequest() {
    if (!panelState?.retry) {
      return;
    }
    sendQuestion(panelState.retry);
  }

  function threadToText(card) {
    if (!card) {
      return "";
    }
    return [
      t("content.threadQuestion", { query: card.query || "" }, currentLanguage()),
      t("content.threadAnswer", { answer: card.response || "" }, currentLanguage()),
      ...(card.followups || []).flatMap((item) => [
        t("content.threadFollowup", { query: item.query || "" }, currentLanguage()),
        t("content.threadAnswer", { answer: item.response || "" }, currentLanguage())
      ])
    ].join("\n");
  }

  function humanizeContentError(error) {
    const message = String(error?.message || error || t("content.requestFailed", currentLanguage()));
    if (/extension context invalidated/i.test(message)) {
      return t("content.contextInvalidated", currentLanguage());
    }
    return message;
  }

  function buildMessages(term, question, previousResponse, context, previousQuestion = "") {
    const system = [
      t("content.system.1", currentLanguage()),
      t("content.system.2", currentLanguage()),
      t("content.system.3", currentLanguage()),
      t("content.system.4", currentLanguage()),
      t("content.system.5", currentLanguage())
    ].join("\n");
    const contextBlock = formatContextBlock(context);

    if (previousResponse) {
      const previousPrompt = previousQuestion || defaultQuestionFor(term);
      return [
        { role: "system", content: system },
        { role: "user", content: `${t("content.selectedText", currentLanguage())}: ${term}${contextBlock}\n\n${t("content.question", currentLanguage())}: ${previousPrompt}` },
        { role: "assistant", content: previousResponse },
        { role: "user", content: `${t("content.continueAround", { term, question }, currentLanguage())}${contextBlock}` }
      ];
    }

    return [
      { role: "system", content: system },
      { role: "user", content: `${t("content.selectedText", currentLanguage())}: ${term}${contextBlock}\n\n${t("content.question", currentLanguage())}: ${question}` }
    ];
  }

  function streamApi({ messages, onChunk }) {
    if (activePort) {
      activePort.disconnect();
      activePort = null;
    }

    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      activePort = chrome.runtime.connect({ name: PORTS.stream });
    } catch (error) {
      return Promise.reject(error);
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      function finish(callback, value) {
        if (settled) {
          return;
        }
        settled = true;
        const port = activePort;
        activePort = null;
        try {
          port?.disconnect();
        } catch (_) {
          // The port may already be closed.
        }
        callback(value);
      }

      activePort.onMessage.addListener((message) => {
        if (message?.requestId !== requestId) {
          return;
        }
        if (message.type === MESSAGE_TYPES.apiChunk) {
          onChunk(message.chunk || "");
        } else if (message.type === MESSAGE_TYPES.apiDone) {
          finish(resolve);
        } else if (message.type === MESSAGE_TYPES.apiError) {
          finish(reject, new Error(message.error || t("content.apiFailed", currentLanguage())));
        }
      });

      activePort.onDisconnect.addListener(() => {
        if (!settled) {
          finish(reject, new Error(t("content.backgroundDisconnected", currentLanguage())));
        }
      });

      activePort.postMessage({
        type: MESSAGE_TYPES.apiCall,
        requestId,
        payload: { messages }
      });
    });
  }

  function scheduleHighlight() {
    window.clearTimeout(highlightTimer);
    highlightTimer = window.setTimeout(runHighlight, 80);
  }

  function runHighlight() {
    removeAllHighlights();
    removeAllLocalHighlights();
  }

  function removeAllHighlights() {
    document.querySelectorAll(`mark.${CSS.highlightClass}`).forEach((mark) => {
      const text = document.createTextNode(mark.textContent || "");
      mark.replaceWith(text);
      text.parentNode?.normalize();
    });
  }

  function removeLocalMarksForMemory(memoryId) {
    document.querySelectorAll(`mark.${CSS.localHighlightClass}`).forEach((mark) => {
      const ids = (mark.getAttribute(MEMORY_ID_ATTR) || "").split(",").filter(Boolean);
      if (!ids.includes(memoryId)) {
        return;
      }
      const text = document.createTextNode(mark.textContent || "");
      mark.replaceWith(text);
      text.parentNode?.normalize();
    });
  }

  function removeAllLocalHighlights() {
    document.querySelectorAll(`mark.${CSS.localHighlightClass}`).forEach((mark) => {
      const text = document.createTextNode(mark.textContent || "");
      mark.replaceWith(text);
      text.parentNode?.normalize();
    });
  }

  function applicableMemories() {
    return Object.values(memories).filter(isMemoryApplicable);
  }

  function isMemoryApplicable(memory) {
    if (!memory?.saved) {
      return false;
    }
    if (memory.scope === "page") {
      return memory.pageUrl === currentPageUrl();
    }
    if (memory.scope === "site") {
      return domainsOverlap(memory.siteDomains || domainFamily(memory.siteHost), domainFamily(location.hostname));
    }
    return memory.scope === "all";
  }

  function hasSyncedCards(memory) {
    return (memory.cards || []).length > 0;
  }

  function injectMemoryStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    const weakColor = "rgba(115, 115, 115, 0.55)";

    style.textContent = `
      mark.${CSS.highlightClass},
      mark.${CSS.localHighlightClass} {
        background: transparent;
        color: inherit;
        cursor: pointer;
        border-radius: 3px;
        padding: 0;
        text-decoration: none;
        -webkit-box-decoration-break: clone;
        box-decoration-break: clone;
      }
      mark.${CSS.highlightClass}:hover,
      mark.${CSS.highlightClass}:focus,
      mark.${CSS.localHighlightClass}:hover,
      mark.${CSS.localHighlightClass}:focus {
        background-image: repeating-linear-gradient(90deg, ${weakColor} 0 2px, transparent 2px 6px);
        background-position: left calc(100% - 0.02em);
        background-size: 100% 2px;
        background-repeat: no-repeat;
      }
      mark.${CSS.highlightClass}:focus,
      mark.${CSS.localHighlightClass}:focus {
        outline: 2px solid rgba(var(--iai-accent-rgb), 0.32);
        outline-offset: 2px;
      }
    `;
  }

  function showPanel(anchorRect) {
    hideHistoryHint();
    panel.classList.remove("hidden");
    window.requestAnimationFrame(() => positionElement(panel, anchorRect, { mode: "panel" }));
  }

  function closePanel() {
    if (activePort) {
      activePort.disconnect();
      activePort = null;
    }
    panel?.classList.add("hidden");
    panel?.classList.remove("collapsed");
    panelState = null;
  }

  function hideBubble() {
    cancelBubblePress();
    bubble?.classList.add("hidden");
  }

  function positionElement(element, anchorRect, options) {
    const margin = 12;
    const rect = element.getBoundingClientRect();
    const width = rect.width || (options.mode === "bubble" ? 16 : 540);
    const height = rect.height || (options.mode === "bubble" ? 16 : 280);

    if (options.mode === "bubble") {
      let left = anchorRect.right + 8;
      let top = anchorRect.bottom + 8;
      if (left + width > window.innerWidth - margin) {
        left = anchorRect.right - width;
      }
      if (top + height > window.innerHeight - margin) {
        top = anchorRect.top - height - 8;
      }
      element.style.left = `${Math.round(clamp(left, margin, window.innerWidth - width - margin))}px`;
      element.style.top = `${Math.round(clamp(top, margin, window.innerHeight - height - margin))}px`;
      return;
    }

    const center = anchorRect.left + anchorRect.width / 2;
    let left = center - width / 2;
    let top = anchorRect.bottom + 10;
    if (top + height > window.innerHeight - margin) {
      top = anchorRect.top - height - 10;
    }
    if (top + height > window.innerHeight - margin) {
      top = window.innerHeight - height - margin;
    }
    if (top < margin) {
      top = margin;
    }
    element.style.left = `${Math.round(clamp(left, margin, window.innerWidth - width - margin))}px`;
    element.style.top = `${Math.round(top)}px`;
  }

  function lastUsableRect(range) {
    const rects = Array.from(range.getClientRects()).filter((item) => item.width > 0 && item.height > 0);
    if (rects.length) {
      return rects[rects.length - 1];
    }
    const rect = range.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  }

  function extractSelectionContext(range, term) {
    if (!settings.includePageContext) {
      return null;
    }

    const root = findReadableContextRoot(range.commonAncestorContainer);
    if (!root) {
      return null;
    }

    try {
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(root);
      beforeRange.setEnd(range.startContainer, range.startOffset);

      const afterRange = document.createRange();
      afterRange.selectNodeContents(root);
      afterRange.setStart(range.endContainer, range.endOffset);

      return {
        before: normalizeVisibleText(beforeRange.toString()).slice(-180),
        selected: normalizeVisibleText(term),
        after: normalizeVisibleText(afterRange.toString()).slice(0, 180)
      };
    } catch (error) {
      console.warn("[这是啥来着] Could not extract context:", error);
      return null;
    }
  }

  function findReadableContextRoot(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!element) {
      return null;
    }
    return element.closest?.("p, li, blockquote, article, section, main, [data-message-author-role], [class*='message'], [class*='markdown']") || element;
  }

  function ensureResponseNode() {
    let responseNode = shadow.getElementById("inlineai-response");
    if (!responseNode) {
      const body = panel.querySelector(".surface-body");
      responseNode = document.createElement("div");
      responseNode.id = "inlineai-response";
      responseNode.className = "response";
      body.appendChild(responseNode);
    }
    return responseNode;
  }

  function updateSelectionActions() {
    const excerpt = getSelectedResponseExcerpt();
    const save = shadow.getElementById("inlineai-save-button");
    if (save) {
      save.textContent = excerpt ? t("content.saveExcerpt", currentLanguage()) : t("content.save", currentLanguage());
      save.dataset.action = excerpt ? "save-excerpt" : "save-answer";
    }
  }

  function getSelectedResponseExcerpt() {
    const selection = shadow.getSelection?.() || document.getSelection();
    const text = normalizeVisibleText(selection?.toString() || "");
    if (!text) {
      return "";
    }
    const range = selection.rangeCount ? selection.getRangeAt(0) : null;
    const container = range?.commonAncestorContainer;
    const element = container?.nodeType === Node.ELEMENT_NODE ? container : container?.parentElement;
    if (!element?.closest?.(".response")) {
      return "";
    }
    return text.slice(0, 1200);
  }

  function showError(message, retryable = false) {
    const node = shadow.getElementById("inlineai-error");
    if (node) {
      node.classList.add("error");
      node.innerHTML = `
        <span>${escapeHtml(message)}</span>
        ${retryable ? `<button class="button" type="button" data-action="retry-request">${escapeHtml(t("content.retry", currentLanguage()))}</button>` : ""}
      `;
      node.classList.remove("hidden");
    }
  }

  function clearError() {
    const node = shadow.getElementById("inlineai-error");
    if (node) {
      node.textContent = "";
      node.classList.add("error");
      node.classList.add("hidden");
    }
  }

  function focusQuestionSoon() {
    window.setTimeout(() => {
      const textarea = shadow.getElementById("inlineai-question");
      if (!textarea || textarea.closest(".hidden")) {
        return;
      }
      textarea.focus();
      textarea.select();
      autoGrowTextarea(textarea);
    }, 40);
  }

  function autoGrowTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 60)}px`;
  }

  function showToast(message) {
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.classList.remove("hidden");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2600);
  }

  function defaultQuestionFor(term) {
    return String(settings.defaultQuestion || "").replaceAll("{{term}}", term);
  }

  function formatContextBlock(context) {
    if (!settings.includePageContext || !context || (!context.before && !context.after)) {
      return "";
    }
    return `\n\n${t("content.contextTitle", currentLanguage())}:\n${t("content.contextBefore", currentLanguage())}: ${context.before || t("content.none", currentLanguage())}\n${t("content.contextSelected", currentLanguage())}: ${context.selected || t("content.none", currentLanguage())}\n${t("content.contextAfter", currentLanguage())}: ${context.after || t("content.none", currentLanguage())}`;
  }

  function currentLanguage() {
    return getEffectiveLanguage(settings);
  }

  function updateLocalizedShellLabels() {
    if (!host) {
      return;
    }
    host.style.setProperty("--iai-waiting-text", JSON.stringify(t("content.waiting", currentLanguage())));
    if (bubble) {
      const bubbleLabel = selectionState?.memories?.length
        ? t("content.bubbleExistingTitle", currentLanguage())
        : t("content.bubbleTitle", currentLanguage());
      bubble.title = bubbleLabel;
      bubble.setAttribute("aria-label", bubbleLabel);
    }
    if (historyHint) {
      historyHint.title = t("content.historyHintTitle", currentLanguage());
      historyHint.setAttribute("aria-label", historyHint.title);
    }
    if (panel) {
      panel.setAttribute("aria-label", t("app.dialogLabel", currentLanguage()));
    }
  }

  function renderMarkdown(text) {
    const escaped = escapeHtml(text || "");
    return escaped
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^(.+)$/s, "<p>$1</p>");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeVisibleText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function truncateTitle(value, limit = 42) {
    const text = normalizeVisibleText(value);
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
  }

  function hexToRgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      return `rgba(201, 130, 87, ${alpha})`;
    }
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function hexToRgb(hex) {
    const normalized = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
      return null;
    }
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  function shadeHex(hex, percent) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      return "#914a20";
    }
    const shift = (value) => clamp(Math.round(value + (percent / 100) * 255), 0, 255);
    return `#${[shift(rgb.r), shift(rgb.g), shift(rgb.b)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  function termKeyFor(term) {
    const normalized = normalizeVisibleText(term);
    return (settings.caseSensitive ? normalized : normalized.toLowerCase()).slice(0, LIMITS.maxTermKeyLength);
  }

  function currentPageUrl() {
    return `${location.origin}${location.pathname}${location.search}`;
  }

  function domainFamily(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/^\.+|\.+$/g, "");
    if (!host) {
      return [];
    }
    if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return [host];
    }
    const parts = host.split(".").filter(Boolean);
    const domains = new Set([host]);
    for (let index = 0; index <= parts.length - 2; index += 1) {
      domains.add(parts.slice(index).join("."));
    }
    return Array.from(domains);
  }

  function domainsOverlap(left, right) {
    const leftSet = new Set((left || []).map((item) => String(item).toLowerCase()));
    return (right || []).some((item) => leftSet.has(String(item).toLowerCase()));
  }

  function rectToObject(rect) {
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }

  function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function isSelectableTerm(term) {
    if (!term || term.length > LIMITS.maxSelectionLength) {
      return false;
    }
    if (/[\u3400-\u9fff]/.test(term)) {
      return term.length >= 1;
    }
    return term.length >= 2;
  }

  function isInsideInlineAi(node) {
    if (!node) {
      return false;
    }
    const root = node.getRootNode?.();
    if (root === shadow) {
      return true;
    }
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return Boolean(element?.closest?.(`#${ROOT_ID}`));
  }

  function isInsideEditable(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return Boolean(element?.closest?.("input, textarea, select, button, [contenteditable='true'], [contenteditable='']"));
  }

})();
