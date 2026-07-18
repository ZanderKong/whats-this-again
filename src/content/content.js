(function inlineAiContent() {
  if (globalThis.__INLINEAI_CONTENT_LOADED__ || globalThis.__INLINEAI_CONTENT_LOADING__) {
    return;
  }

  const C = globalThis.InlineAIConstants;
  const A = globalThis.InlineAIAnnotations;
  const AR = globalThis.InlineAIAnnotationRuntime;
  const UI = globalThis.InlineAIContentUi;
  if (!C || !A || !AR || !UI) {
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
    getThemePreset,
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
  let interactionStack = null;
  let answerSurface = null;
  let composerSurface = null;
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
  let annotationBatches = {};
  let activeAnnotationBatches = {};
  let activeAnnotationBatch = null;
  let annotationRanges = new Map();
  let annotationRectCache = [];
  let annotationBasket = null;
  let annotationHighlightLayer = null;
  let editorDropTarget = null;
  let annotationBasketTimer = null;
  let annotationBasketCompactTimer = null;
  let annotationFrame = 0;
  let annotationObserver = null;
  let annotationResizeObserver = null;
  let annotationInteraction = null;
  let annotationDropEditor = null;
  let annotationViewportListenersBound = false;
  let annotationDragListenersBound = false;
  let annotationPasteListenersBound = false;
  let lastKnownHref = location.href;
  let pendingPasteSignal = null;

  init().catch((error) => {
    console.warn("[这是啥来着] Init failed:", error);
    globalThis.__INLINEAI_CONTENT_LOADING__ = false;
  });

  async function init() {
    await ensureStorageSchema(chrome.storage.local);
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.settings, STORAGE_KEYS.memories,
      STORAGE_KEYS.annotationBatches, STORAGE_KEYS.activeAnnotationBatches
    ]);
    settings = mergeSettings(stored[STORAGE_KEYS.settings]);
    memories = stored[STORAGE_KEYS.memories] || {};
    annotationBatches = stored[STORAGE_KEYS.annotationBatches] || {};
    activeAnnotationBatches = stored[STORAGE_KEYS.activeAnnotationBatches] || {};

    globalThis.__INLINEAI_CONTENT_LOADED__ = true;
    globalThis.__INLINEAI_CONTENT_LOADING__ = false;

    createShadowUi();
    injectMemoryStyle();
    bindEvents();
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.openOnboarding }).catch(() => {});
    scheduleHighlight();
    await loadActiveAnnotationBatch();
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
        .interaction-stack {
          position: fixed;
          display: grid;
          gap: 8px;
          width: min(540px, calc(100vw - 24px));
          min-width: min(300px, calc(100vw - 24px));
          max-height: calc(100vh - 24px);
          pointer-events: none;
        }
        .interaction-stack > * { pointer-events: auto; }
        .interaction-stack .interaction-surface {
          position: relative;
          inset: auto;
          width: 100%;
          min-width: 0;
          max-height: min(610px, calc(100vh - 112px));
          border-radius: 5px;
          background: linear-gradient(180deg, var(--iai-paper) 0%, #fbf8ef 100%);
          box-shadow: 0 2px 7px rgba(44, 36, 22, 0.1), 0 12px 34px rgba(44, 36, 22, 0.12);
        }
        .interaction-stack .answer-surface .surface-header {
          min-height: 42px;
          background: rgba(var(--iai-accent-rgb), 0.06);
        }
        .interaction-stack .answer-surface .surface-body {
          max-height: calc(min(610px, 100vh - 112px) - 44px);
          font-family: ui-serif, "Songti SC", "Noto Serif CJK SC", STSong, Georgia, serif;
        }
        .composer-surface {
          position: relative;
          width: 100%;
          border: 1px solid rgba(44, 36, 22, 0.2);
          border-radius: 5px;
          padding: 8px 9px;
          background: linear-gradient(180deg, #fffef9 0%, #fbf7ed 100%);
          box-shadow: 0 2px 6px rgba(44, 36, 22, 0.08), 0 9px 24px rgba(44, 36, 22, 0.1);
        }
        .composer-inner {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: end;
        }
        .composer-surface textarea {
          min-height: 36px;
          max-height: 88px;
          border: 0;
          padding: 8px 7px;
          background: transparent;
          box-shadow: none;
          color: var(--iai-ink);
          font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
        }
        .composer-surface textarea:focus { outline: none; }
        .composer-surface:focus-within {
          border-color: var(--iai-accent);
          box-shadow: 0 0 0 3px var(--iai-accent-soft), 0 9px 24px rgba(44, 36, 22, 0.1);
        }
        .composer-actions {
          display: flex;
          gap: 7px;
          align-items: center;
          padding-bottom: 1px;
        }
        .composer-annotation,
        .composer-send,
        .composer-close {
          border: 1px solid rgba(var(--iai-accent-rgb), 0.38);
          background: transparent;
          color: var(--iai-accent-strong);
          cursor: pointer;
          font: 700 12px/1 ui-sans-serif, system-ui, sans-serif;
          transition: background 140ms ease, color 140ms ease, transform 120ms ease, box-shadow 140ms ease;
        }
        .composer-annotation {
          display: inline-flex;
          min-height: 34px;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 0 10px;
        }
        .composer-send {
          display: grid;
          width: 34px;
          height: 34px;
          place-items: center;
          border-radius: 50%;
          padding: 0;
        }
        .composer-close {
          position: absolute;
          top: -9px;
          right: -9px;
          z-index: 1;
          display: grid;
          width: 24px;
          height: 24px;
          place-items: center;
          border-color: var(--iai-line);
          border-radius: 50%;
          background: var(--iai-paper);
          color: var(--iai-muted);
          font-size: 17px;
        }
        .composer-annotation:hover,
        .composer-annotation:focus-visible,
        .composer-send:hover,
        .composer-send:focus-visible {
          outline: none;
          background: var(--iai-accent-strong);
          color: #fff;
          box-shadow: 0 6px 16px rgba(var(--iai-accent-rgb), 0.22);
          transform: translateY(-1px);
        }
        .composer-close:hover,
        .composer-close:focus-visible {
          outline: none;
          color: var(--iai-warn);
          box-shadow: 0 4px 12px rgba(44, 36, 22, 0.14);
        }
        .composer-annotation:active,
        .composer-send:active { transform: scale(0.96); }
        .composer-annotation:disabled,
        .composer-send:disabled,
        .composer-surface textarea:disabled { cursor: default; opacity: 0.48; }
        .action-icon {
          width: 16px;
          height: 16px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.6;
          stroke-linecap: round;
          stroke-linejoin: round;
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
        #annotation-highlight-layer,
        #editor-drop-target {
          position: fixed;
          inset: 0;
          pointer-events: none;
        }
        .annotation-highlight {
          position: fixed;
          border-radius: 3px;
          background: rgba(var(--iai-accent-rgb), 0.2);
          box-shadow: inset 0 -2px 0 rgba(var(--iai-accent-rgb), 0.58);
          pointer-events: none;
        }
        #annotation-basket {
          position: fixed;
          right: 16px;
          bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          max-width: min(390px, calc(100vw - 32px));
          min-width: 40px;
          height: 40px;
          border: 0;
          border-radius: 999px;
          padding: 0 14px;
          overflow: hidden;
          background: var(--iai-accent-strong);
          color: #fff;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.24), 0 2px 7px rgba(var(--iai-accent-rgb), 0.22);
          cursor: grab;
          pointer-events: auto;
          font: 750 13px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          white-space: nowrap;
          transform-origin: right center;
          transition: padding 180ms ease, border-radius 180ms ease, transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease;
        }
        #annotation-basket:hover {
          box-shadow: 0 15px 34px rgba(15, 23, 42, 0.28), 0 3px 9px rgba(var(--iai-accent-rgb), 0.26);
          transform: translateY(-1px);
        }
        .annotation-basket-count,
        .annotation-basket-label,
        .annotation-basket-check {
          display: inline-block;
          flex: 0 0 auto;
        }
        .annotation-basket-label {
          max-width: 250px;
          margin-left: 4px;
          overflow: hidden;
          opacity: 1;
          transform: translateX(0);
          transition: max-width 180ms ease, margin-left 180ms ease, opacity 130ms ease, transform 180ms ease;
        }
        .annotation-basket-check {
          margin-left: 7px;
          color: #fff;
          font-size: 14px;
        }
        #annotation-basket.compacting {
          transform: scale(0.94);
        }
        #annotation-basket.compacting .annotation-basket-label,
        #annotation-basket.compact .annotation-basket-label {
          max-width: 0;
          margin-left: 0;
          opacity: 0;
          transform: translateX(8px);
        }
        #annotation-basket.compact {
          width: 40px;
          min-width: 40px;
          height: 40px;
          padding: 0;
          border-radius: 50%;
          font-size: 14px;
          animation: annotation-basket-settle 220ms cubic-bezier(.2, .8, .2, 1);
        }
        #annotation-basket.copied {
          padding-inline: 15px;
        }
        #annotation-basket.copied .annotation-basket-label {
          margin-left: 0;
        }
        #annotation-basket.dragging { cursor: grabbing; transform: scale(0.96); opacity: 0.72; }
        #annotation-basket:focus-visible { outline: 3px solid rgba(var(--iai-accent-rgb), 0.32); outline-offset: 3px; }
        @keyframes annotation-basket-settle {
          0% { transform: scale(0.94); }
          62% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        #editor-drop-target {
          inset: auto;
          z-index: 3;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          border: 3px solid var(--iai-accent);
          border-radius: 12px;
          background: rgba(var(--iai-accent-rgb), 0.08);
          box-shadow: 0 0 0 5px rgba(var(--iai-accent-rgb), 0.12);
        }
        #editor-drop-target span {
          margin: 0 0 8px;
          border-radius: 999px;
          padding: 6px 10px;
          background: var(--iai-accent-strong);
          color: white;
          font: 700 12px/1.2 ui-sans-serif, system-ui, sans-serif;
        }
        .annotation-list { display: grid; gap: 12px; }
        .annotation-card { position: relative; border: 1px solid var(--iai-line); border-radius: 12px; padding: 14px 42px 14px 14px; background: rgba(255,255,255,.72); }
        .annotation-delete { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: var(--iai-muted); font: 400 20px/1 ui-serif, Georgia, serif; cursor: pointer; }
        .annotation-delete:hover { background: rgba(var(--iai-accent-rgb),.08); color: var(--iai-accent-strong); }
        .annotation-delete:focus-visible { outline: 2px solid rgba(var(--iai-accent-rgb),.32); outline-offset: 1px; }
        .annotation-quote { margin: 0 0 11px; border-left: 2px solid rgba(var(--iai-accent-rgb),.28); padding-left: 10px; color: #9a9489; font: 13px/1.65 ui-serif, Georgia, "Songti SC", serif; white-space: pre-wrap; }
        .annotation-quote strong { color: var(--iai-accent-strong); font-weight: 750; }
        .annotation-location-note { display: block; margin-top: 5px; color: #a34f3d; font: 600 11px/1.4 ui-sans-serif, system-ui, sans-serif; }
        .annotation-note-button { display: block; width: 100%; margin: 0; border: 0; border-radius: 8px; padding: 7px 8px; background: transparent; color: var(--iai-ink); text-align: left; font: 600 14px/1.55 ui-sans-serif, system-ui, sans-serif; white-space: pre-wrap; cursor: text; }
        .annotation-note-button:hover { background: rgba(var(--iai-accent-rgb),.06); }
        .annotation-note-button:focus-visible { outline: 2px solid rgba(var(--iai-accent-rgb),.3); outline-offset: 1px; }
        .annotation-edit-area { width: 100%; min-height: 72px; margin: 0; border: 1px solid rgba(var(--iai-accent-rgb),.36); border-radius: 8px; padding: 8px; color: var(--iai-ink); background: rgba(255,255,255,.88); font: 600 14px/1.55 ui-sans-serif, system-ui, sans-serif; resize: vertical; }
        .annotation-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
        .annotation-panel .term-title {
          display: inline-flex;
          width: fit-content;
          max-width: min(430px, calc(100vw - 112px));
          min-height: 30px;
          align-items: center;
          border-radius: 999px;
          padding: 6px 11px;
          background: var(--iai-accent-strong);
          color: #fff;
          font-size: 14px;
          font-weight: 750;
        }
        .annotation-panel .annotation-footer .button.primary {
          min-height: 36px;
          border: 0;
          border-radius: 999px;
          padding-inline: 16px;
          background: var(--iai-accent-strong);
          box-shadow: 0 7px 18px rgba(var(--iai-accent-rgb), 0.2);
        }
        .annotation-panel .annotation-footer .button.primary:hover,
        .annotation-panel .annotation-footer .button.primary:focus-visible {
          box-shadow: 0 9px 22px rgba(var(--iai-accent-rgb), 0.27);
        }
        .prompt-composer.annotation-enabled { grid-template-columns: minmax(0, 1fr) auto auto; }
        .annotation-action { color: var(--iai-accent-strong); border-color: rgba(var(--iai-accent-rgb), .32); }
        @media (max-width: 520px) {
          .surface { width: calc(100vw - 18px); }
          .interaction-stack { width: calc(100vw - 18px); min-width: 0; }
          .term-title { max-width: calc(100vw - 120px); font-size: 16px; }
          .surface-body { padding: 10px; }
          .composer-surface { padding: 7px; }
          .composer-annotation span { display: none; }
          .composer-annotation { width: 34px; padding: 0; justify-content: center; }
        }
        @media (prefers-reduced-motion: reduce) {
          #annotation-basket,
          .annotation-basket-label {
            animation: none !important;
            transition-duration: 1ms !important;
          }
          #annotation-basket.compacting { transform: none; }
          .composer-annotation,
          .composer-send,
          .composer-close { transition-duration: 1ms !important; }
        }
      </style>
      <button id="bubble" class="hidden" type="button" title="${escapeHtml(t("content.bubbleTitle", currentLanguage()))}" aria-label="${escapeHtml(t("content.bubbleTitle", currentLanguage()))}"></button>
      <div id="history-hint-line" class="hidden"></div>
      <button id="history-hint" class="hidden" type="button" data-action="open-hover-memory" title="${escapeHtml(t("content.historyHintTitle", currentLanguage()))}" aria-label="${escapeHtml(t("content.historyHintTitle", currentLanguage()))}"></button>
      <div id="annotation-highlight-layer" aria-hidden="true"></div>
      <div id="editor-drop-target" class="hidden" aria-hidden="true"><span></span></div>
      <button id="annotation-basket" class="hidden" draggable="true" type="button" data-action="open-annotation-basket" aria-live="polite"></button>
      ${UI.interactionShell(t("app.dialogLabel", currentLanguage()))}
      <section id="panel" class="surface hidden" role="dialog" aria-modal="false" aria-label="${escapeHtml(t("app.dialogLabel", currentLanguage()))}"></section>
      <div id="toast" class="hidden"></div>
    `;

    bubble = shadow.getElementById("bubble");
    panel = shadow.getElementById("panel");
    interactionStack = shadow.getElementById("interaction-stack");
    answerSurface = shadow.getElementById("answer-surface");
    composerSurface = shadow.getElementById("composer-surface");
    toast = shadow.getElementById("toast");
    historyHint = shadow.getElementById("history-hint");
    historyHintLine = shadow.getElementById("history-hint-line");
    annotationBasket = shadow.getElementById("annotation-basket");
    annotationHighlightLayer = shadow.getElementById("annotation-highlight-layer");
    editorDropTarget = shadow.getElementById("editor-drop-target");
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
    window.addEventListener("popstate", checkAnnotationPageChange);
    window.addEventListener("hashchange", checkAnnotationPageChange);
    window.addEventListener("focus", checkAnnotationPageChange);
    document.addEventListener("visibilitychange", checkAnnotationPageChange);
    window.setInterval(() => {
      if (!document.hidden && location.href !== lastKnownHref) checkAnnotationPageChange();
    }, 1000);
    shadow.addEventListener("click", handleShadowClick);
    shadow.addEventListener("keydown", handleShadowKeydown);
    shadow.addEventListener("input", handleShadowInput);
    shadow.addEventListener("mousedown", handleDragStart);
    shadow.addEventListener("mouseup", updateSelectionActions);
    shadow.addEventListener("keyup", updateSelectionActions);
    shadow.addEventListener("focusout", handleShadowFocusOut);
    bubble.addEventListener("pointerdown", handleBubblePointerDown);
    bubble.addEventListener("pointerup", handleBubblePointerUp);
    bubble.addEventListener("pointerleave", cancelBubblePress);
    bubble.addEventListener("pointercancel", cancelBubblePress);
    annotationBasket.addEventListener("dragstart", handleAnnotationBasketDragStart);
    annotationBasket.addEventListener("dragend", endAnnotationDrag);

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
    if (changes[STORAGE_KEYS.annotationBatches]) {
      annotationBatches = changes[STORAGE_KEYS.annotationBatches].newValue || {};
      void loadActiveAnnotationBatch();
    }
    if (changes[STORAGE_KEYS.activeAnnotationBatches]) {
      activeAnnotationBatches = changes[STORAGE_KEYS.activeAnnotationBatches].newValue || {};
      void loadActiveAnnotationBatch();
    }
  }

  function handleSelection() {
    checkAnnotationPageChange();
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
      annotationContext: extractSelectionContext(range, term, true),
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
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        const hit = annotationRectCache.find((entry) => entry.rects.some((rect) =>
          event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
        ));
        if (hit) {
          event.preventDefault();
          event.stopPropagation();
          openAnnotationPanel(hit.annotationId);
        }
      }
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
    } else if (action === "save-annotation") {
      saveAnnotationFromPanel();
    } else if (action === "open-annotation-basket") {
      if (!annotationInteraction?.dragged) openAnnotationPanel();
    } else if (action === "edit-annotation") {
      renderAnnotationPanel(button.dataset.annotationId);
    } else if (action === "delete-annotation") {
      deleteAnnotation(button.dataset.annotationId);
    } else if (action === "copy-annotation-batch") {
      copyAnnotationBatchManually();
    } else if (action === "close-annotation-panel") {
      closePanel();
    }
  }

  function handleShadowKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }

    if (event.key === "Enter" && event.target?.matches?.(".annotation-edit-area")) {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        saveAnnotationEdit(event.target.dataset.annotationEdit, { rerender: true });
      }
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229 && event.target?.matches?.("textarea")) {
      event.preventDefault();
      sendQuestion({ followup: Boolean(panelState?.currentCard) });
    }
  }

  function handleShadowFocusOut(event) {
    const editor = event.target?.matches?.(".annotation-edit-area") ? event.target : null;
    if (editor && panelState?.editingAnnotationId === editor.dataset.annotationEdit) {
      saveAnnotationEdit(editor.dataset.annotationEdit, { rerender: false });
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
      const motionTarget = surface.closest(".interaction-stack") || surface;
      const rect = motionTarget.getBoundingClientRect();
      const heightRect = surface.getBoundingClientRect();
      resizeState = {
        surface: motionTarget,
        heightTarget: motionTarget === interactionStack ? surface : motionTarget,
        corner: resizeHandle.dataset.resize,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: heightRect.height
      };
      event.preventDefault();
      return;
    }

    const header = event.target?.closest?.(".surface-header");
    if (!header || event.target?.closest?.("button,select")) {
      return;
    }

    const surface = header.closest(".surface");
    const motionTarget = surface.closest(".interaction-stack") || surface;
    const rect = motionTarget.getBoundingClientRect();
    dragState = {
      surface: motionTarget,
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
    state.heightTarget.style.height = `${height}px`;
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
    try {
      bubble.setPointerCapture?.(event.pointerId);
    } catch (_) {
      // Synthetic pointer events and a few embedded browsers do not establish capture.
    }

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
    showInteractionSurfaces({ answer: false, composer: true });
    renderComposerSurface({ followup: false, annotation: true, close: true });
    focusQuestionSoon();
  }

  function renderAnswerPanel({ loading = false } = {}) {
    panelState.mode = loading ? "answerLoading" : (panelState.savedMemoryId || panelState.currentCard?.memory ? "savedThread" : "answerReady");
    showInteractionSurfaces({ answer: true, composer: true });
    answerSurface.className = answerSurfaceClass();
    answerSurface.innerHTML = surfaceShell(panelState.term, "", `
      ${renderThread(panelState.currentCard, { loading })}
      <div id="inlineai-actions-after" class="actions">${loading ? "" : answerActions()}</div>
    `);
    renderComposerSurface({ followup: true, disabled: loading });
    updateSelectionActions();
  }

  function renderFollowupPanel() {
    panelState.mode = "followupInput";
    showInteractionSurfaces({ answer: true, composer: true });
    answerSurface.className = answerSurfaceClass();
    answerSurface.innerHTML = surfaceShell(panelState.term, "", `
      ${renderThread(panelState.currentCard)}
    `);
    renderComposerSurface({ followup: true });
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

    showInteractionSurfaces({ answer: true, composer: false });
    answerSurface.className = answerSurfaceClass();
    answerSurface.innerHTML = surfaceShell(panelState.term, "", `
      ${renderMemoryCards(cards)}
    `);
    showPanel(anchorRect);
  }

  function showInteractionSurfaces(visible) {
    panel?.classList.add("hidden");
    interactionStack?.classList.remove("hidden");
    answerSurface?.classList.toggle("hidden", !visible.answer);
    composerSurface?.classList.toggle("hidden", !visible.composer);
  }

  function renderComposerSurface({ followup = false, annotation = false, close = false, disabled = false } = {}) {
    composerSurface.innerHTML = UI.composerMarkup({
      action: followup ? "send-followup" : "send-new",
      annotation,
      close,
      disabled,
      maxLength: LIMITS.maxAnnotationNoteLength,
      annotationText: t("content.annotation", currentLanguage()),
      annotationLabel: t("content.saveAnnotation", currentLanguage()),
      inputLabel: t(followup ? "content.followupAria" : "content.customQuestionAria", currentLanguage()),
      placeholder: t(followup ? "content.followupComposerPlaceholder" : "content.askPlaceholder", currentLanguage()),
      sendLabel: t(followup ? "content.sendFollowup" : "content.sendQuestion", currentLanguage()),
      closeLabel: t("content.close", currentLanguage())
    });
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

    panelState.pendingQuery = question;
    panelState.pendingQueryKind = queryKind;
    renderAnswerPanel({ loading: true });
    const responseNode = ensureResponseNode();
    const controls = Array.from(interactionStack.querySelectorAll("button,select,textarea"));
    const previousResponse = threadToText(panelState.currentCard);
    let answer = "";

    panelState.retry = { questionOverride: question, followup, queryKind };
    clearError();
    responseNode.classList.remove("hidden");
    responseNode.innerHTML = "";
    controls.forEach((control) => {
      if (control.dataset.action !== "close") {
        control.disabled = true;
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
      interactionStack.querySelectorAll("button,select,textarea").forEach((control) => {
        control.disabled = false;
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
      renderHistoryPanel([memories[memoryId]], rectToObject(interactionStack.getBoundingClientRect()));
      return;
    }
    if (panelState) {
      panelState.currentCard = null;
      panelState.savedMemoryId = "";
      showInteractionSurfaces({ answer: true, composer: false });
      answerSurface.className = answerSurfaceClass();
      answerSurface.innerHTML = surfaceShell(panelState.term, "", `
        <div class="notice">${escapeHtml(t("content.recordDeleted", currentLanguage()))}</div>
      `);
    }
  }

  function toggleSurfaceCollapse(surface) {
    if (!surface) {
      return;
    }
    if ((surface.id === "panel" || surface.id === "answer-surface") && panelState) {
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

  function answerSurfaceClass() {
    return [
      "surface",
      "interaction-surface",
      "answer-surface",
      panelState?.collapsed ? "collapsed" : ""
    ].filter(Boolean).join(" ");
  }

  function applyThemeVars() {
    if (!host) {
      return;
    }
    const preset = getThemePreset(settings.highlightColor);
    host.style.setProperty("--iai-orange", preset.value);
    host.style.setProperty("--iai-accent", preset.value);
    host.style.setProperty("--iai-accent-strong", preset.strong);
    host.style.setProperty("--iai-accent-rgb", preset.rgb);
    host.style.setProperty("--iai-accent-soft", preset.soft);
    host.style.setProperty("--iai-accent-foreground", preset.foreground);
    host.style.setProperty("--iai-accent-border", preset.border);
    host.style.setProperty("--iai-accent-shadow", preset.shadow);
  }

  function panelIsOpen() {
    return Boolean(
      (panel && !panel.classList.contains("hidden")) ||
      (interactionStack && !interactionStack.classList.contains("hidden"))
    );
  }

  function pinCurrentPanelSnapshot() {
    if (!panelIsOpen() || !panelState?.currentCard) {
      return;
    }

    const source = answerSurface && !answerSurface.classList.contains("hidden") ? answerSurface : panel;
    const sourceRect = source === answerSurface ? interactionStack.getBoundingClientRect() : source.getBoundingClientRect();
    const snapshot = source.cloneNode(true);
    snapshot.id = createId("pinned");
    snapshot.dataset.inlineaiPinnedPanel = String(++pinnedPanelCounter);
    snapshot.classList.remove("hidden", "interaction-surface", "answer-surface");
    snapshot.style.left = `${sourceRect.left}px`;
    snapshot.style.top = `${sourceRect.top}px`;
    snapshot.style.width = `${sourceRect.width}px`;
    snapshot.style.height = `${Math.min(sourceRect.height, window.innerHeight - 24)}px`;
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
    shadow.insertBefore(snapshot, interactionStack);
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
    const target = panelState?.mode === "annotations" ? panel : interactionStack;
    target.classList.remove("hidden");
    window.requestAnimationFrame(() => positionElement(target, anchorRect, { mode: "panel" }));
  }

  function closePanel() {
    if (activePort) {
      activePort.disconnect();
      activePort = null;
    }
    panel?.classList.add("hidden");
    panel?.classList.remove("collapsed");
    interactionStack?.classList.add("hidden");
    answerSurface?.classList.add("hidden");
    answerSurface?.classList.remove("collapsed");
    composerSurface?.classList.add("hidden");
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

  function extractSelectionContext(range, term, force) {
    if (!force && !settings.includePageContext) {
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
      const body = answerSurface.querySelector(".surface-body");
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
    interactionStack?.setAttribute("aria-label", t("app.dialogLabel", currentLanguage()));
    if (activeAnnotationBatch) {
      renderAnnotationBasket(false);
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

  function annotationPageKey() {
    return A.pageKeyFor(location);
  }

  async function loadActiveAnnotationBatch() {
    const id = activeAnnotationBatches[annotationPageKey()];
    activeAnnotationBatch = id && annotationBatches[id] ? A.normalizeBatch(annotationBatches[id]) : null;
    annotationRanges.clear();
    if (activeAnnotationBatch?.items?.length) {
      for (const item of activeAnnotationBatch.items) {
        const restored = AR.restoreAnchor(item.anchor);
        if (restored.range) annotationRanges.set(item.id, restored.range);
        item.anchorState = restored.range ? "ready" : "missing";
        item.matchCount = Math.max(item.matchCount || 1, restored.matchCount || 0);
      }
      bindAnnotationObservers();
      renderAnnotationBasket(false);
      scheduleAnnotationHighlights();
    } else {
      clearAnnotationUi();
    }
  }

  async function saveActiveAnnotationBatch() {
    if (!activeAnnotationBatch) return;
    activeAnnotationBatch = A.normalizeBatch(activeAnnotationBatch);
    activeAnnotationBatch.updatedAt = Date.now();
    annotationBatches[activeAnnotationBatch.id] = activeAnnotationBatch;
    if (!A.canTransition(activeAnnotationBatch.status, A.STATUS.collecting) &&
        [A.STATUS.injected, A.STATUS.copiedManual, A.STATUS.pastedAfterFallback].includes(activeAnnotationBatch.status)) {
      delete activeAnnotationBatches[activeAnnotationBatch.pageKey];
    } else {
      activeAnnotationBatches[activeAnnotationBatch.pageKey] = activeAnnotationBatch.id;
    }
    await chrome.storage.local.set({
      [STORAGE_KEYS.annotationBatches]: annotationBatches,
      [STORAGE_KEYS.activeAnnotationBatches]: activeAnnotationBatches
    });
    syncAnnotationPasteListeners();
  }

  async function saveAnnotationFromPanel() {
    const input = shadow.getElementById("inlineai-question");
    const note = String(input?.value || "").trim();
    if (!note) return showError(t("content.annotationNeedNote", currentLanguage()));
    if (!selectionState?.range || selectionState.term.length > LIMITS.maxAnnotationSelectionLength) {
      return showError(t("content.annotationSelectionTooLong", currentLanguage()));
    }
    if (note.length > LIMITS.maxAnnotationNoteLength) return showError(t("content.annotationTooLong", currentLanguage()));
    if (activeAnnotationBatch?.items?.length >= LIMITS.maxAnnotationsPerBatch) {
      return showError(t("content.annotationLimit", currentLanguage()));
    }

    const pageKey = annotationPageKey();
    if (!activeAnnotationBatch || activeAnnotationBatch.pageKey !== pageKey) {
      activeAnnotationBatch = A.createBatch({
        pageKey,
        pageUrl: location.href,
        pageTitle: document.title || location.href,
        siteHost: location.hostname
      });
    }
    if (activeAnnotationBatch.status === A.STATUS.copiedPendingPaste) activeAnnotationBatch = A.resetAfterEdit(activeAnnotationBatch);
    const now = Date.now();
    const item = A.normalizeItem({
      id: A.createId("annotation"),
      quote: selectionState.term,
      note,
      context: selectionState.annotationContext,
      anchor: AR.createAnchor(selectionState.range, selectionState.term),
      order: activeAnnotationBatch.items.length,
      createdAt: now,
      updatedAt: now
    }, activeAnnotationBatch.items.length);
    activeAnnotationBatch.items.push(item);
    annotationRanges.set(item.id, selectionState.range.cloneRange());
    await saveActiveAnnotationBatch();
    closePanel();
    hideBubble();
    window.getSelection()?.removeAllRanges();
    bindAnnotationObservers();
    scheduleAnnotationHighlights();
    renderAnnotationBasket(true);
  }

  function renderAnnotationBasket(expanded) {
    if (!activeAnnotationBatch?.items?.length) return clearAnnotationUi();
    const count = activeAnnotationBatch.items.length;
    const copied = activeAnnotationBatch.status === A.STATUS.copiedPendingPaste;
    const showExpanded = copied || expanded;
    clearAnnotationBasketTimers();
    annotationBasket.classList.remove("hidden", "dragging", "compacting");
    annotationBasket.classList.toggle("compact", !showExpanded);
    annotationBasket.classList.toggle("copied", copied);
    if (copied) {
      annotationBasket.innerHTML = `<span class="annotation-basket-label">${escapeHtml(t("content.annotationCopied", currentLanguage()))}</span><span class="annotation-basket-check" aria-hidden="true">✓</span>`;
    } else {
      const labelKey = count === 1 ? "content.annotationBasketLabelOne" : "content.annotationBasketLabelMany";
      annotationBasket.innerHTML = `<span class="annotation-basket-count">${count}</span><span class="annotation-basket-label">${escapeHtml(t(labelKey, currentLanguage()))}</span>`;
    }
    const basketAria = t("content.annotationBasketAria", { count }, currentLanguage());
    annotationBasket.setAttribute("aria-label", copied ? `${t("content.annotationCopied", currentLanguage())}. ${basketAria}` : basketAria);
    annotationBasket.setAttribute("title", t("content.annotationSaved", { count }, currentLanguage()));
    if (showExpanded && !copied) {
      annotationBasketTimer = window.setTimeout(() => {
        annotationBasket.classList.add("compacting");
        annotationBasketCompactTimer = window.setTimeout(() => renderAnnotationBasket(false), 180);
      }, 4000);
    }
  }

  function clearAnnotationBasketTimers() {
    window.clearTimeout(annotationBasketTimer);
    window.clearTimeout(annotationBasketCompactTimer);
    annotationBasketTimer = null;
    annotationBasketCompactTimer = null;
  }

  function openAnnotationPanel(annotationId) {
    if (!activeAnnotationBatch?.items?.length) return;
    panelState = { mode: "annotations", editingAnnotationId: annotationId || "", collapsed: false };
    renderAnnotationPanel(annotationId || "");
    showPanel({ left: Math.max(12, innerWidth - 560), right: innerWidth - 16, top: Math.max(24, innerHeight - 500), bottom: innerHeight - 24, width: 520, height: 32 });
  }

  function renderAnnotationPanel(editingId) {
    if (!activeAnnotationBatch) return closePanel();
    interactionStack?.classList.add("hidden");
    const items = A.sortItems(activeAnnotationBatch.items);
    const info = A.payloadInfo(activeAnnotationBatch, currentLanguage());
    panelState = { mode: "annotations", editingAnnotationId: editingId || "", collapsed: false };
    const cards = items.map((item) => {
      const editing = item.id === editingId;
      const preview = annotationPreviewParts(item);
      return `<article class="annotation-card" data-annotation-id="${escapeHtml(item.id)}">
        <button class="annotation-delete" type="button" data-action="delete-annotation" data-annotation-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(t("content.annotationDelete", currentLanguage()))}">×</button>
        <blockquote class="annotation-quote"><span>${escapeHtml(preview.before)}</span><strong>${escapeHtml(item.quote)}</strong><span>${escapeHtml(preview.after)}</span>${item.anchorState === "missing" ? `<small class="annotation-location-note">${escapeHtml(t("content.annotationAnchorMissing", currentLanguage()))}</small>` : ""}</blockquote>
        ${editing ? `<textarea class="annotation-edit-area" data-annotation-edit="${escapeHtml(item.id)}" maxlength="${LIMITS.maxAnnotationNoteLength}" aria-label="${escapeHtml(t("content.annotationEdit", currentLanguage()))}">${escapeHtml(item.note)}</textarea>` : `<button class="annotation-note-button" type="button" data-action="edit-annotation" data-annotation-id="${escapeHtml(item.id)}">${escapeHtml(item.note)}</button>`}
      </article>`;
    }).join("");
    panel.className = `${panelClass()} annotation-panel`;
    panel.innerHTML = surfaceShell(t("content.annotationPanelTitle", { count: items.length }, currentLanguage()), "", `
      ${info.tooLong ? `<div class="notice error">${escapeHtml(t("content.annotationTooLong", currentLanguage()))}</div>` : ""}
      <div class="annotation-list">${cards}</div>
      <div class="annotation-footer"><button class="button primary" type="button" data-action="copy-annotation-batch" ${info.tooLong ? "disabled" : ""}>${escapeHtml(t("content.annotationCopyAll", currentLanguage()))}</button></div>
    `, { closeAction: "close-annotation-panel" });
    if (editingId) window.setTimeout(() => {
      const editor = findAnnotationEditArea(editingId);
      editor?.focus();
      editor?.setSelectionRange?.(editor.value.length, editor.value.length);
    }, 0);
  }

  function annotationPreviewParts(item) {
    const sideLimit = 44;
    const rawBefore = A.normalizeText(item.context?.before || "");
    const rawAfter = A.normalizeText(item.context?.after || "");
    const before = rawBefore.length > sideLimit ? `…${rawBefore.slice(-sideLimit)}` : rawBefore;
    const after = rawAfter.length > sideLimit ? `${rawAfter.slice(0, sideLimit)}…` : rawAfter;
    return {
      before: before ? `${before} ` : "",
      after: after ? ` ${after}` : ""
    };
  }

  async function saveAnnotationEdit(id, { rerender = true } = {}) {
    const item = activeAnnotationBatch?.items.find((entry) => entry.id === id);
    const textarea = findAnnotationEditArea(id);
    const note = String(textarea?.value || "").trim();
    if (!item || !note) return showToast(t("content.annotationNeedNote", currentLanguage()));
    item.note = note.slice(0, LIMITS.maxAnnotationNoteLength);
    item.updatedAt = Date.now();
    const wasPending = activeAnnotationBatch.status === A.STATUS.copiedPendingPaste;
    activeAnnotationBatch = A.resetAfterEdit(activeAnnotationBatch);
    await saveActiveAnnotationBatch();
    if (rerender && activeAnnotationBatch) renderAnnotationPanel("");
    renderAnnotationBasket(true);
    if (wasPending) showToast(t("content.annotationChangedAfterCopy", currentLanguage()));
  }

  function findAnnotationEditArea(id) {
    return Array.from(panel?.querySelectorAll?.("[data-annotation-edit]") || [])
      .find((element) => element.dataset.annotationEdit === id) || null;
  }

  async function deleteAnnotation(id) {
    if (!activeAnnotationBatch) return;
    activeAnnotationBatch.items = activeAnnotationBatch.items.filter((item) => item.id !== id);
    annotationRanges.delete(id);
    if (!activeAnnotationBatch.items.length) {
      delete annotationBatches[activeAnnotationBatch.id];
      delete activeAnnotationBatches[activeAnnotationBatch.pageKey];
      activeAnnotationBatch = null;
      await chrome.storage.local.set({ [STORAGE_KEYS.annotationBatches]: annotationBatches, [STORAGE_KEYS.activeAnnotationBatches]: activeAnnotationBatches });
      closePanel();
      clearAnnotationUi();
      showToast(t("content.annotationEmptyAfterDelete", currentLanguage()));
      return;
    }
    activeAnnotationBatch.items = A.sortItems(activeAnnotationBatch.items);
    activeAnnotationBatch = A.resetAfterEdit(activeAnnotationBatch);
    await saveActiveAnnotationBatch();
    renderAnnotationPanel("");
    renderAnnotationBasket(true);
    scheduleAnnotationHighlights();
  }

  function bindAnnotationObservers() {
    if (annotationObserver || !activeAnnotationBatch) return;
    bindAnnotationViewportListeners();
    syncAnnotationPasteListeners();
    annotationObserver = new MutationObserver(scheduleAnnotationHighlights);
    annotationObserver.observe(document.body, { childList: true, subtree: true });
    if (globalThis.ResizeObserver) {
      annotationResizeObserver = new ResizeObserver(scheduleAnnotationHighlights);
      annotationResizeObserver.observe(document.documentElement);
    }
  }

  function scheduleAnnotationHighlights() {
    if (!activeAnnotationBatch || annotationFrame) return;
    annotationFrame = requestAnimationFrame(() => {
      annotationFrame = 0;
      renderAnnotationHighlights();
    });
  }

  function renderAnnotationHighlights() {
    if (!activeAnnotationBatch) return clearAnnotationUi();
    annotationHighlightLayer.innerHTML = "";
    annotationRectCache = [];
    for (const item of activeAnnotationBatch.items) {
      let range = annotationRanges.get(item.id);
      if (!range || !range.startContainer?.isConnected || A.comparableText(range.toString()) !== A.comparableText(item.quote)) {
        const restored = AR.restoreAnchor(item.anchor);
        range = restored.range;
        item.anchorState = range ? "ready" : "missing";
        item.matchCount = Math.max(item.matchCount || 1, restored.matchCount || 0);
        if (range) annotationRanges.set(item.id, range);
      }
      if (!range) continue;
      const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 1 && rect.height > 1).map(rectToObject);
      annotationRectCache.push({ annotationId: item.id, rects });
      rects.forEach((rect) => {
        const mark = document.createElement("span");
        mark.className = "annotation-highlight";
        mark.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`;
        annotationHighlightLayer.appendChild(mark);
      });
    }
  }

  function clearAnnotationUi() {
    clearAnnotationBasketTimers();
    annotationBasket?.classList.add("hidden");
    annotationHighlightLayer && (annotationHighlightLayer.innerHTML = "");
    editorDropTarget?.classList.add("hidden");
    annotationRectCache = [];
    annotationObserver?.disconnect();
    annotationObserver = null;
    annotationResizeObserver?.disconnect();
    annotationResizeObserver = null;
    unbindAnnotationViewportListeners();
    unbindAnnotationDragListeners();
    unbindAnnotationPasteListeners();
  }

  function handleAnnotationViewportChange() {
    hideHistoryHint();
    scheduleAnnotationHighlights();
  }

  function bindAnnotationViewportListeners() {
    if (annotationViewportListenersBound) return;
    document.addEventListener("scroll", handleAnnotationViewportChange, true);
    window.addEventListener("resize", handleAnnotationViewportChange, { passive: true });
    annotationViewportListenersBound = true;
  }

  function unbindAnnotationViewportListeners() {
    if (!annotationViewportListenersBound) return;
    document.removeEventListener("scroll", handleAnnotationViewportChange, true);
    window.removeEventListener("resize", handleAnnotationViewportChange);
    annotationViewportListenersBound = false;
  }

  function bindAnnotationDragListeners() {
    if (annotationDragListenersBound) return;
    document.addEventListener("dragover", handleAnnotationDragOver, true);
    document.addEventListener("drop", handleAnnotationDrop, true);
    document.addEventListener("dragend", endAnnotationDrag, true);
    annotationDragListenersBound = true;
  }

  function unbindAnnotationDragListeners() {
    if (!annotationDragListenersBound) return;
    document.removeEventListener("dragover", handleAnnotationDragOver, true);
    document.removeEventListener("drop", handleAnnotationDrop, true);
    document.removeEventListener("dragend", endAnnotationDrag, true);
    annotationDragListenersBound = false;
  }

  function syncAnnotationPasteListeners() {
    if (activeAnnotationBatch?.status === A.STATUS.copiedPendingPaste) {
      if (annotationPasteListenersBound) return;
      document.addEventListener("paste", handleAnnotationPaste, true);
      document.addEventListener("beforeinput", handleAnnotationBeforeInput, true);
      document.addEventListener("input", handleAnnotationInput, true);
      annotationPasteListenersBound = true;
      return;
    }
    unbindAnnotationPasteListeners();
  }

  function unbindAnnotationPasteListeners() {
    if (!annotationPasteListenersBound) return;
    document.removeEventListener("paste", handleAnnotationPaste, true);
    document.removeEventListener("beforeinput", handleAnnotationBeforeInput, true);
    document.removeEventListener("input", handleAnnotationInput, true);
    annotationPasteListenersBound = false;
    pendingPasteSignal = null;
  }

  async function checkAnnotationPageChange() {
    if (location.href === lastKnownHref) return;
    lastKnownHref = location.href;
    if (activeAnnotationBatch) await saveActiveAnnotationBatch();
    clearAnnotationUi();
    await loadActiveAnnotationBatch();
  }

  function handleAnnotationBasketDragStart(event) {
    if (!activeAnnotationBatch) return event.preventDefault();
    const info = A.payloadInfo(activeAnnotationBatch, currentLanguage());
    if (info.tooLong) {
      event.preventDefault();
      showToast(t("content.annotationTooLong", currentLanguage()));
      return;
    }
    annotationInteraction = { startedAt: Date.now(), dragged: true, payload: info.text, payloadHash: info.hash };
    bindAnnotationDragListeners();
    event.dataTransfer.setData("text/plain", info.text);
    event.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.textContent = `${activeAnnotationBatch.items.length}`;
    ghost.style.cssText = "position:fixed;top:-100px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#1d4ed8;color:white;font:bold 15px sans-serif;";
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 22, 22);
    setTimeout(() => ghost.remove(), 0);
    annotationBasket.classList.add("dragging");
  }

  function handleAnnotationDragOver(event) {
    if (!annotationInteraction?.dragged) return;
    const found = AR.editorAtPoint(event.clientX, event.clientY);
    if (!found) {
      annotationDropEditor = null;
      editorDropTarget.classList.add("hidden");
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    annotationDropEditor = found;
    const rect = found.root.getBoundingClientRect();
    editorDropTarget.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`;
    editorDropTarget.querySelector("span").textContent = t("content.annotationDrop", { count: activeAnnotationBatch.items.length }, currentLanguage());
    editorDropTarget.classList.remove("hidden");
  }

  async function handleAnnotationDrop(event) {
    if (!annotationInteraction?.dragged || !annotationDropEditor || !activeAnnotationBatch) return;
    event.preventDefault();
    const found = annotationDropEditor;
    const payload = annotationInteraction.payload;
    activeAnnotationBatch = A.transitionBatch(activeAnnotationBatch, A.STATUS.injecting, {
      delivery: { method: "drag", payloadHash: annotationInteraction.payloadHash, failureReason: "" }
    });
    await saveActiveAnnotationBatch();
    const result = await AR.injectAndVerify(found, payload);
    if (result.ok) {
      activeAnnotationBatch = A.transitionBatch(activeAnnotationBatch, A.STATUS.injected, { delivery: { method: "drag" } });
      await completeAnnotationBatch(t("content.annotationInserted", currentLanguage()));
    } else {
      await fallbackCopyAnnotation(payload, `verification_failed:${result.adapterId}`);
    }
    endAnnotationDrag();
  }

  function endAnnotationDrag() {
    annotationBasket?.classList.remove("dragging");
    editorDropTarget?.classList.add("hidden");
    annotationDropEditor = null;
    unbindAnnotationDragListeners();
    if (annotationInteraction) setTimeout(() => { annotationInteraction = null; }, 80);
  }

  async function fallbackCopyAnnotation(payload, reason) {
    const copied = await AR.copyTextToClipboard(payload);
    if (copied.ok) {
      activeAnnotationBatch = A.transitionBatch(activeAnnotationBatch, A.STATUS.copiedPendingPaste, {
        delivery: { method: "clipboard_fallback", payloadHash: A.hashText(payload), failureReason: reason }
      });
      await saveActiveAnnotationBatch();
      syncAnnotationPasteListeners();
      renderAnnotationBasket(true);
      showToast(t("content.annotationFallbackCopied", currentLanguage()));
    } else {
      activeAnnotationBatch = A.transitionBatch(activeAnnotationBatch, A.STATUS.collecting, { delivery: { failureReason: String(copied.error || reason) } });
      await saveActiveAnnotationBatch();
      syncAnnotationPasteListeners();
      renderAnnotationBasket(true);
      showToast(t("content.annotationFallbackFailed", currentLanguage()));
    }
  }

  async function copyAnnotationBatchManually() {
    if (!activeAnnotationBatch) return;
    const visibleEditor = panel?.querySelector?.(".annotation-edit-area");
    if (visibleEditor) await saveAnnotationEdit(visibleEditor.dataset.annotationEdit, { rerender: false });
    if (!activeAnnotationBatch) return;
    const info = A.payloadInfo(activeAnnotationBatch, currentLanguage());
    if (info.tooLong) return showToast(t("content.annotationTooLong", currentLanguage()));
    const copied = await AR.copyTextToClipboard(info.text);
    if (!copied.ok) return showToast(t("content.annotationCopyFailed", currentLanguage()));
    activeAnnotationBatch = A.transitionBatch(activeAnnotationBatch, A.STATUS.copiedManual, {
      delivery: { method: "clipboard_manual", payloadHash: info.hash, failureReason: "" }
    });
    const found = AR.likelyEditor();
    await completeAnnotationBatch(found ? t("content.annotationPasteHere", currentLanguage()) : t("content.annotationPasteToAi", currentLanguage()));
  }

  async function completeAnnotationBatch(message) {
    const completed = activeAnnotationBatch;
    await saveActiveAnnotationBatch();
    delete activeAnnotationBatches[completed.pageKey];
    await chrome.storage.local.set({ [STORAGE_KEYS.activeAnnotationBatches]: activeAnnotationBatches });
    activeAnnotationBatch = null;
    annotationRanges.clear();
    closePanel();
    clearAnnotationUi();
    showToast(`${message} ${t("content.annotationHistoryHint", currentLanguage())}`);
  }

  function handleAnnotationPaste(event) {
    if (activeAnnotationBatch?.status !== A.STATUS.copiedPendingPaste) return;
    const pastedText = event.clipboardData?.getData("text/plain") || "";
    pendingPasteSignal = { target: event.target, pastedText, pasteEvent: true, inputType: "insertFromPaste", at: Date.now() };
    setTimeout(checkPendingAnnotationPaste, 0);
  }

  function handleAnnotationBeforeInput(event) {
    if (activeAnnotationBatch?.status !== A.STATUS.copiedPendingPaste || event.inputType !== "insertFromPaste") return;
    pendingPasteSignal = { target: event.target, pastedText: event.data || pendingPasteSignal?.pastedText || "", pasteEvent: Boolean(pendingPasteSignal?.pasteEvent), inputType: event.inputType, at: Date.now() };
  }

  function handleAnnotationInput(event) {
    if (activeAnnotationBatch?.status !== A.STATUS.copiedPendingPaste || event.inputType !== "insertFromPaste") return;
    if (pendingPasteSignal) pendingPasteSignal.target = event.target;
    setTimeout(checkPendingAnnotationPaste, 0);
  }

  async function checkPendingAnnotationPaste() {
    if (!pendingPasteSignal || !activeAnnotationBatch || Date.now() - pendingPasteSignal.at > 1500) return;
    const found = AR.findAdapter(pendingPasteSignal.target);
    if (!found) return;
    const payload = A.buildAnnotationPrompt(activeAnnotationBatch, currentLanguage());
    const editorText = found.adapter.readText(found.root);
    if (!A.matchesPayload({ payload, pastedText: pendingPasteSignal.pastedText, editorText, inputType: pendingPasteSignal.inputType, pasteEvent: pendingPasteSignal.pasteEvent })) return;
    activeAnnotationBatch = A.transitionBatch(activeAnnotationBatch, A.STATUS.pastedAfterFallback, { delivery: { method: "paste_after_fallback" } });
    pendingPasteSignal = null;
    await completeAnnotationBatch(t("content.annotationPasteComplete", currentLanguage()));
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
    if (!term || term.length > LIMITS.maxAnnotationSelectionLength) {
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
