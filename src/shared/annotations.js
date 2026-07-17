(function exposeInlineAIAnnotations(global) {
  "use strict";

  const STATUS = Object.freeze({
    collecting: "collecting",
    injecting: "injecting",
    copiedPendingPaste: "copied_pending_paste",
    injected: "injected",
    copiedManual: "copied_manual",
    pastedAfterFallback: "pasted_after_fallback"
  });

  const LIMITS = Object.freeze({
    maxSelectionLength: 2000,
    maxNoteLength: 4000,
    maxItemsPerBatch: 50,
    maxPayloadLength: 60000
  });

  const TERMINAL = new Set([STATUS.injected, STATUS.copiedManual, STATUS.pastedAfterFallback]);
  const TRANSITIONS = Object.freeze({
    [STATUS.collecting]: [STATUS.injecting, STATUS.copiedManual],
    [STATUS.injecting]: [STATUS.injected, STATUS.copiedPendingPaste, STATUS.collecting],
    [STATUS.copiedPendingPaste]: [STATUS.pastedAfterFallback, STATUS.collecting, STATUS.injecting, STATUS.copiedManual],
    [STATUS.injected]: [],
    [STATUS.copiedManual]: [],
    [STATUS.pastedAfterFallback]: []
  });

  function normalizeText(value) {
    return String(value || "")
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function comparableText(value) {
    return normalizeText(value).replace(/\s+/g, " ");
  }

  function hashText(value) {
    const input = comparableText(value);
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a_${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function pageKeyFor(locationLike) {
    const source = locationLike || global.location;
    if (!source) return "";
    const origin = String(source.origin || "");
    const pathname = String(source.pathname || "");
    const search = String(source.search || "");
    const hostname = String(source.hostname || "").toLowerCase();
    const hash = String(source.hash || "");
    const usesHashConversation = /(^|\.)(poe\.com|you\.com)$/i.test(hostname) && hash.length > 1;
    return `${origin}${pathname}${search}${usesHashConversation ? hash : ""}`;
  }

  function contextText(context) {
    if (!context) return "";
    return normalizeText([context.before, context.selected, context.after].filter(Boolean).join(" "));
  }

  function normalizeItem(item, index) {
    const now = Date.now();
    const quote = normalizeText(item?.quote || item?.anchor?.exact);
    const note = normalizeText(item?.note);
    return {
      id: item?.id || createId("annotation"),
      quote: quote.slice(0, LIMITS.maxSelectionLength),
      note: note.slice(0, LIMITS.maxNoteLength),
      context: item?.context ? {
        before: String(item.context.before || ""),
        selected: String(item.context.selected || quote),
        after: String(item.context.after || "")
      } : null,
      anchor: item?.anchor || null,
      anchorState: item?.anchorState === "missing" ? "missing" : "ready",
      matchCount: Number(item?.matchCount) || 1,
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
      createdAt: Number(item?.createdAt) || now,
      updatedAt: Number(item?.updatedAt) || Number(item?.createdAt) || now
    };
  }

  function sortItems(items) {
    return (items || []).map(normalizeItem).filter((item) => item.quote && item.note).sort((left, right) =>
      left.order - right.order || left.createdAt - right.createdAt || left.id.localeCompare(right.id)
    ).map((item, order) => ({ ...item, order }));
  }

  function normalizeBatch(batch) {
    const now = Date.now();
    const status = Object.values(STATUS).includes(batch?.status) ? batch.status : STATUS.collecting;
    return {
      id: batch?.id || createId("batch"),
      pageKey: String(batch?.pageKey || ""),
      pageUrl: String(batch?.pageUrl || batch?.pageKey || ""),
      pageTitle: String(batch?.pageTitle || ""),
      siteHost: String(batch?.siteHost || ""),
      status,
      items: sortItems(batch?.items),
      delivery: {
        method: String(batch?.delivery?.method || ""),
        attemptedAt: Number(batch?.delivery?.attemptedAt) || 0,
        completedAt: Number(batch?.delivery?.completedAt) || 0,
        payloadHash: String(batch?.delivery?.payloadHash || ""),
        failureReason: String(batch?.delivery?.failureReason || "")
      },
      createdAt: Number(batch?.createdAt) || now,
      updatedAt: Number(batch?.updatedAt) || Number(batch?.createdAt) || now,
      completedAt: Number(batch?.completedAt) || 0
    };
  }

  function createBatch(meta) {
    const now = Date.now();
    return normalizeBatch({
      id: createId("batch"),
      pageKey: meta?.pageKey,
      pageUrl: meta?.pageUrl,
      pageTitle: meta?.pageTitle,
      siteHost: meta?.siteHost,
      status: STATUS.collecting,
      items: [],
      createdAt: now,
      updatedAt: now
    });
  }

  function formatAnnotationBatch(batchInput, language) {
    const batch = normalizeBatch(batchInput);
    const items = batch.items;
    const english = String(language || "").toLowerCase().startsWith("en");
    return items.map((item) => {
      const context = contextText(item.context) || item.quote;
      return english
        ? `The user has a question about “${item.quote}” in “${context}”: ${item.note}`
        : `用户针对「${context}」中的「${item.quote}」提出疑问：${item.note}`;
    }).join("\n\n");
  }

  function payloadInfo(batch, language) {
    const text = formatAnnotationBatch(batch, language);
    return { text, hash: hashText(text), tooLong: text.length > LIMITS.maxPayloadLength, length: text.length };
  }

  function canTransition(from, to) {
    return Boolean(TRANSITIONS[from]?.includes(to));
  }

  function transitionBatch(batchInput, nextStatus, details) {
    const batch = normalizeBatch(batchInput);
    if (!canTransition(batch.status, nextStatus)) {
      throw new Error(`Illegal annotation transition: ${batch.status} -> ${nextStatus}`);
    }
    const now = Number(details?.at) || Date.now();
    batch.status = nextStatus;
    batch.updatedAt = now;
    batch.delivery = { ...batch.delivery, ...(details?.delivery || {}) };
    if (nextStatus === STATUS.injecting) batch.delivery.attemptedAt = now;
    if (TERMINAL.has(nextStatus)) {
      batch.completedAt = now;
      batch.delivery.completedAt = now;
    }
    return batch;
  }

  function resetAfterEdit(batchInput) {
    const batch = normalizeBatch(batchInput);
    batch.updatedAt = Date.now();
    if (batch.status === STATUS.copiedPendingPaste) {
      batch.status = STATUS.collecting;
      batch.delivery.payloadHash = "";
      batch.delivery.failureReason = "";
    }
    return batch;
  }

  function matchesPayload({ payload, pastedText, editorText, inputType, pasteEvent }) {
    if (!pasteEvent && inputType !== "insertFromPaste") return false;
    const expected = comparableText(payload);
    const pasted = comparableText(pastedText);
    const editor = comparableText(editorText);
    if (!expected) return false;
    const directMatch = pasted && hashText(pasted) === hashText(expected);
    const normalizedMatch = pasted === expected;
    return Boolean((directMatch || normalizedMatch) && editor.includes(expected));
  }

  function statusLabelKey(status) {
    return ({
      [STATUS.injected]: "history.annotationStatusInjected",
      [STATUS.copiedManual]: "history.annotationStatusCopied",
      [STATUS.copiedPendingPaste]: "history.annotationStatusPendingPaste",
      [STATUS.pastedAfterFallback]: "history.annotationStatusPasted",
      [STATUS.collecting]: "history.annotationStatusCollecting",
      [STATUS.injecting]: "history.annotationStatusInjecting"
    })[status] || "history.annotationStatusCollecting";
  }

  global.InlineAIAnnotations = Object.freeze({
    STATUS, LIMITS, TRANSITIONS, normalizeText, comparableText, hashText, pageKeyFor,
    normalizeItem, normalizeBatch, createBatch, sortItems, formatAnnotationBatch,
    payloadInfo, canTransition, transitionBatch, resetAfterEdit, matchesPayload,
    statusLabelKey, contextText, createId
  });
})(globalThis);
