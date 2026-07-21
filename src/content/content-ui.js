(function exposeInlineAIContentUi(global) {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function annotationIcon() {
    return `<svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 4.75h11a1.75 1.75 0 0 1 1.75 1.75v7.25a1.75 1.75 0 0 1-1.75 1.75h-6l-4.75 3v-3H6.5a1.75 1.75 0 0 1-1.75-1.75V6.5A1.75 1.75 0 0 1 6.5 4.75Z"/><path d="M8 9h8M8 12h5"/></svg>`;
  }

  function sendIcon() {
    return `<svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 18V6M7.5 10.5 12 6l4.5 4.5"/></svg>`;
  }

  function saveIcon() {
    return `<svg class="save-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 3.9 2.48 5.03 5.55.81-4.01 3.91.95 5.53L12 16.57 7.03 19.18l.95-5.53-4.01-3.91 5.55-.81L12 3.9Z"/></svg>`;
  }

  function interactionShell(dialogLabel, options = {}) {
    const instanceId = escapeHtml(options.instanceId || "");
    return `<div class="interaction-stack hidden" data-instance-id="${instanceId}" role="group" aria-label="${escapeHtml(dialogLabel)}">
      <div class="thread-header hidden" data-part="thread-header">
        <button class="quote-chip" type="button" data-action="toggle-answer-collapse" data-testid="quote-chip" data-part="quote-chip" aria-expanded="false" disabled><span class="quote-chip-label"></span><svg class="quote-chip-toggle-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4"/></svg></button>
        <button class="collapsed-thread-close hidden" type="button" data-action="close" data-testid="collapsed-thread-close" data-part="collapsed-thread-close">×</button>
      </div>
      <div class="input-row hidden" data-testid="input-row" data-part="input-row">
        <section class="input-shell" data-testid="composer-surface" data-part="composer-surface"></section>
        <button class="round-action annotate hidden" type="button" data-testid="annotation-action" data-part="annotation-action-surface">${annotationIcon()}</button>
        <button class="round-action send" type="button" data-testid="send-action" data-part="send-action-surface">${sendIcon()}</button>
      </div>
      <div class="interaction-hint error hidden" data-part="composer-error" role="alert" aria-live="assertive"></div>
      <section class="answer-surface response-stack hidden" data-testid="answer-surface" data-part="answer-surface" role="region" aria-live="polite"></section>
    </div>`;
  }

  function composerMarkup(options = {}) {
    return `<textarea class="inlineai-question" data-testid="composer-input" maxlength="${Number(options.maxLength) || 4000}" aria-label="${escapeHtml(options.inputLabel)}" placeholder="${escapeHtml(options.placeholder)}" rows="1" ${options.readOnly ? "readonly aria-readonly=\"true\"" : ""}></textarea>`;
  }

  function responseCardMarkup(options = {}) {
    const latest = options.latest ? " latest" : "";
    const saved = options.saved ? " active" : "";
    const messageData = options.messageId ? ` data-message-id="${escapeHtml(options.messageId)}"` : "";
    const question = `<div class="response-question" title="${escapeHtml(options.query)}">${escapeHtml(options.query)}</div>`;
    const memoryData = options.memoryId ? ` data-memory-id="${escapeHtml(options.memoryId)}"` : "";
    const cardData = options.cardId ? ` data-card-id="${escapeHtml(options.cardId)}"` : "";
    const saveButton = options.showSave
      ? `<button class="response-favourite${saved}" type="button" data-action="${escapeHtml(options.saved ? (options.savedAction || "unsave-answer") : (options.saveAction || "save-answer"))}"${messageData}${memoryData}${cardData} aria-pressed="${options.saved ? "true" : "false"}" title="${escapeHtml(options.saveLabel)}" aria-label="${escapeHtml(options.saveLabel)}" ${options.saveDisabled ? "disabled" : ""}>${saveIcon()}</button>`
      : "";
    return `<article class="response-card${latest}" data-testid="answer-card">
      <div class="response-meta">
        ${question}
        <button class="response-close" type="button" data-action="close" title="${escapeHtml(options.closeLabel)}" aria-label="${escapeHtml(options.closeLabel)}">×</button>
      </div>
      <div class="response-body"><div${messageData} class="response${options.loading ? " streaming" : ""}">${options.responseHtml || ""}</div></div>
      ${saveButton}
    </article>`;
  }

  function shouldCloseInteraction({ open = false, mode = "", collapsed = false, inside = false, now = 0, suppressUntil = 0 } = {}) {
    return Boolean(open && mode !== "annotations" && !collapsed && !inside && now >= suppressUntil);
  }

  function canShowHistoryHint({ annotationOpen = false, panels = [] } = {}) {
    if (annotationOpen) {
      return false;
    }
    return !panels.some((panel) => !panel?.collapsed || Boolean(panel?.streaming));
  }

  global.InlineAIContentUi = Object.freeze({
    interactionShell,
    composerMarkup,
    responseCardMarkup,
    shouldCloseInteraction,
    canShowHistoryHint,
    annotationIcon,
    sendIcon,
    saveIcon
  });
})(globalThis);
