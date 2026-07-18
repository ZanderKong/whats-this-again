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
    return `<svg class="action-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4.25 3.75h8.5a2 2 0 0 1 2 2v4.5l-4.5 4.5h-6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><path d="M10.25 14.75v-3a1.5 1.5 0 0 1 1.5-1.5h3"/><path d="M5.75 7h5.5M5.75 9.75h3.5"/></svg>`;
  }

  function sendIcon() {
    return `<svg class="action-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h11M11 6l4 4-4 4"/></svg>`;
  }

  function interactionShell(dialogLabel) {
    return `<div id="interaction-stack" class="interaction-stack hidden" role="group" aria-label="${escapeHtml(dialogLabel)}">
      <section id="answer-surface" class="surface interaction-surface answer-surface hidden" data-testid="answer-surface" role="dialog" aria-modal="false"></section>
      <section id="composer-surface" class="composer-surface hidden" data-testid="composer-surface"></section>
      <button id="annotation-action-surface" class="standalone-action annotation-standalone hidden" type="button" data-testid="annotation-action"></button>
      <button id="send-action-surface" class="standalone-action send-standalone hidden" type="button" data-testid="send-action"></button>
      <div id="inlineai-error" class="notice error composer-error hidden" role="alert" aria-live="assertive"></div>
    </div>`;
  }

  function composerMarkup(options = {}) {
    const close = options.close
      ? `<button class="composer-close" type="button" data-action="close" title="${escapeHtml(options.closeLabel)}" aria-label="${escapeHtml(options.closeLabel)}">×</button>`
      : "";
    return `${close}<textarea id="inlineai-question" data-testid="composer-input" maxlength="${Number(options.maxLength) || 4000}" aria-label="${escapeHtml(options.inputLabel)}" placeholder="${escapeHtml(options.placeholder)}" rows="1" ${options.disabled ? "disabled" : ""}></textarea>`;
  }

  function annotationActionMarkup(label) {
    return `${annotationIcon()}<span>${escapeHtml(label)}</span>`;
  }

  function sendActionMarkup() {
    return sendIcon();
  }

  global.InlineAIContentUi = Object.freeze({
    interactionShell,
    composerMarkup,
    annotationActionMarkup,
    sendActionMarkup,
    annotationIcon,
    sendIcon
  });
})(globalThis);
