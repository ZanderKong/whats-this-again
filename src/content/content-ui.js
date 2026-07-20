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

  function interactionShell(dialogLabel) {
    return `<div id="interaction-stack" class="interaction-stack hidden" role="group" aria-label="${escapeHtml(dialogLabel)}">
      <div id="quote-chip" class="quote-chip hidden" data-testid="quote-chip"></div>
      <div id="input-row" class="input-row hidden" data-testid="input-row">
        <section id="composer-surface" class="input-shell" data-testid="composer-surface"></section>
        <button id="annotation-action-surface" class="round-action annotate hidden" type="button" data-testid="annotation-action">${annotationIcon()}</button>
        <button id="send-action-surface" class="round-action send" type="button" data-testid="send-action">${sendIcon()}</button>
      </div>
      <div id="inlineai-error" class="interaction-hint error hidden" role="alert" aria-live="assertive"></div>
      <section id="answer-surface" class="answer-surface response-stack hidden" data-testid="answer-surface" role="region" aria-live="polite"></section>
    </div>`;
  }

  function composerMarkup(options = {}) {
    return `<textarea id="inlineai-question" data-testid="composer-input" maxlength="${Number(options.maxLength) || 4000}" aria-label="${escapeHtml(options.inputLabel)}" placeholder="${escapeHtml(options.placeholder)}" rows="1" ${options.disabled ? "disabled" : ""}></textarea>`;
  }

  function responseCardMarkup(options = {}) {
    const latest = options.latest ? " latest" : "";
    const saved = options.saved ? " active" : "";
    const responseId = options.responseId ? ` id="${escapeHtml(options.responseId)}"` : "";
    const question = options.latest
      ? `<button class="response-question" type="button" data-action="toggle-answer-collapse" title="${escapeHtml(options.query)}">${escapeHtml(options.query)}</button>`
      : `<div class="response-question" title="${escapeHtml(options.query)}">${escapeHtml(options.query)}</div>`;
    const saveButton = options.showSave
      ? `<button id="${escapeHtml(options.saveId || "inlineai-save-button")}" class="response-favourite${saved}" type="button" ${options.saved ? `aria-disabled="true" aria-pressed="true"` : `data-action="${escapeHtml(options.saveAction || "save-answer")}" aria-pressed="false"`} title="${escapeHtml(options.saveLabel)}" aria-label="${escapeHtml(options.saveLabel)}">${saveIcon()}</button>`
      : "";
    return `<article class="response-card${latest}" data-testid="answer-card">
      <div class="response-meta">
        ${question}
        <button class="response-close" type="button" data-action="close" title="${escapeHtml(options.closeLabel)}" aria-label="${escapeHtml(options.closeLabel)}">×</button>
      </div>
      <div class="response-body"><div${responseId} class="response${options.loading ? " streaming" : ""}">${options.responseHtml || ""}</div></div>
      ${saveButton}
    </article>`;
  }

  function shouldCloseInteraction({ open = false, mode = "", inside = false, now = 0, suppressUntil = 0 } = {}) {
    return Boolean(open && mode !== "annotations" && !inside && now >= suppressUntil);
  }

  global.InlineAIContentUi = Object.freeze({
    interactionShell,
    composerMarkup,
    responseCardMarkup,
    shouldCloseInteraction,
    annotationIcon,
    sendIcon,
    saveIcon
  });
})(globalThis);
