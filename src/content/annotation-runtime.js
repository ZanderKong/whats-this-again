(function exposeInlineAIAnnotationRuntime(global) {
  "use strict";

  const A = global.InlineAIAnnotations;
  if (!A) return;

  const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", ""]);

  function nodeText(root) {
    return String(root?.innerText || root?.textContent || "");
  }

  function anchorText(root) {
    return String(root?.textContent || "");
  }

  function findReadableRoot(node) {
    let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const selectors = [
      "[data-message-author-role]", "[data-testid*='conversation-turn']", "article",
      "[role='article']", "main p", "main li", "p", "li", "blockquote"
    ];
    while (element && element !== document.body) {
      if (selectors.some((selector) => element.matches?.(selector)) && nodeText(element).trim().length >= 16) return element;
      element = element.parentElement;
    }
    return node?.parentElement || document.body;
  }

  function textOffset(root, boundaryNode, boundaryOffset) {
    const range = document.createRange();
    range.selectNodeContents(root);
    try {
      range.setEnd(boundaryNode, boundaryOffset);
      return range.toString().length;
    } catch (_) {
      return -1;
    }
  }

  function createAnchor(range, exact) {
    const root = findReadableRoot(range.commonAncestorContainer);
    const text = anchorText(root);
    const start = textOffset(root, range.startContainer, range.startOffset);
    const end = textOffset(root, range.endContainer, range.endOffset);
    const rawExact = String(range.toString() || exact || "");
    const role = root.getAttribute?.("role") || "";
    const messageRole = root.getAttribute?.("data-message-author-role") || "";
    return {
      version: 1,
      exact: rawExact,
      prefix: start >= 0 ? text.slice(Math.max(0, start - 64), start) : "",
      suffix: end >= 0 ? text.slice(end, end + 64) : "",
      textStart: start,
      textEnd: end,
      rootHint: {
        tagName: root.tagName || "",
        role,
        messageRole,
        testId: root.getAttribute?.("data-testid") || ""
      }
    };
  }

  function textNodes(root, cache) {
    if (cache?.nodesByRoot?.has(root)) return cache.nodesByRoot.get(root);
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (parent?.closest?.("script,style,noscript,textarea,input,[contenteditable='true']")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    cache?.nodesByRoot?.set(root, nodes);
    return nodes;
  }

  function rangeFromOffsets(root, start, end, cache) {
    let cursor = 0;
    let startNode = null;
    let endNode = null;
    let startOffset = 0;
    let endOffset = 0;
    for (const node of textNodes(root, cache)) {
      const next = cursor + node.nodeValue.length;
      if (!startNode && start >= cursor && start <= next) {
        startNode = node;
        startOffset = Math.max(0, start - cursor);
      }
      if (end >= cursor && end <= next) {
        endNode = node;
        endOffset = Math.max(0, end - cursor);
        break;
      }
      cursor = next;
    }
    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode, Math.min(startOffset, startNode.nodeValue.length));
    range.setEnd(endNode, Math.min(endOffset, endNode.nodeValue.length));
    return range;
  }

  function rootText(root, cache) {
    if (cache?.textByRoot?.has(root)) return cache.textByRoot.get(root);
    const text = anchorText(root);
    cache?.textByRoot?.set(root, text);
    return text;
  }

  function rootsForAnchor(anchor, cache) {
    const hint = anchor?.rootHint || {};
    const selectors = [];
    if (hint.testId) selectors.push(`[data-testid="${CSS.escape(hint.testId)}"]`);
    if (hint.messageRole) selectors.push(`[data-message-author-role="${CSS.escape(hint.messageRole)}"]`);
    if (hint.role) selectors.push(`[role="${CSS.escape(hint.role)}"]`);
    if (/^[A-Za-z][A-Za-z0-9-]*$/.test(hint.tagName || "")) selectors.push(hint.tagName.toLowerCase());
    selectors.push("[data-message-author-role='assistant']", "article", "[role='article']", "main", "body");
    const seen = new Set();
    return selectors.flatMap((selector) => {
      if (!cache?.rootsBySelector?.has(selector)) cache?.rootsBySelector?.set(selector, Array.from(document.querySelectorAll(selector)));
      return cache?.rootsBySelector?.get(selector) || Array.from(document.querySelectorAll(selector));
    }).filter((root) => {
      if (seen.has(root) || !rootText(root, cache).includes(anchor.exact)) return false;
      seen.add(root);
      return true;
    });
  }

  function candidatesInRoot(root, anchor, cache) {
    const text = rootText(root, cache);
    const candidates = [];
    let offset = 0;
    while (offset <= text.length) {
      const index = text.indexOf(anchor.exact, offset);
      if (index < 0) break;
      const prefix = text.slice(Math.max(0, index - anchor.prefix.length), index);
      const suffix = text.slice(index + anchor.exact.length, index + anchor.exact.length + anchor.suffix.length);
      let score = Math.abs(index - Math.max(0, Number(anchor.textStart) || 0));
      if (anchor.prefix && prefix.endsWith(anchor.prefix)) score -= 10000;
      if (anchor.suffix && suffix.startsWith(anchor.suffix)) score -= 10000;
      candidates.push({ root, index, score });
      offset = index + Math.max(1, anchor.exact.length);
    }
    return candidates;
  }

  function exactMatchCount(text, exact) {
    if (!exact) return 0;
    let count = 0;
    let offset = 0;
    while (offset <= text.length) {
      const index = text.indexOf(exact, offset);
      if (index < 0) break;
      count += 1;
      offset = index + Math.max(1, exact.length);
    }
    return count;
  }

  function createRestoreCache() {
    return { rootsBySelector: new Map(), textByRoot: new WeakMap(), nodesByRoot: new WeakMap() };
  }

  function restoreAnchorWithCache(anchor, cache, bodyText) {
    if (!anchor?.exact) return { range: null, matchCount: 0 };
    const candidates = rootsForAnchor(anchor, cache).flatMap((root) => candidatesInRoot(root, anchor, cache));
    const pageMatchCount = exactMatchCount(bodyText, anchor.exact);
    candidates.sort((left, right) => left.score - right.score);
    for (const candidate of candidates) {
      const range = rangeFromOffsets(candidate.root, candidate.index, candidate.index + anchor.exact.length, cache);
      if (range && A.comparableText(range.toString()) === A.comparableText(anchor.exact)) {
        return { range, matchCount: Math.max(1, pageMatchCount) };
      }
    }
    return { range: null, matchCount: pageMatchCount };
  }

  function restoreAnchor(anchor) {
    return restoreAnchorWithCache(anchor, createRestoreCache(), anchorText(document.body));
  }

  function restoreAnchors(items) {
    const cache = createRestoreCache();
    const bodyText = anchorText(document.body);
    return new Map((items || []).map((item) => [item.id, restoreAnchorWithCache(item.anchor, cache, bodyText)]));
  }

  function isVisible(element) {
    if (!element?.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width >= 120 && rect.height >= 24;
  }

  function isSearchLike(element) {
    const description = `${element.type || ""} ${element.getAttribute?.("role") || ""} ${element.getAttribute?.("aria-label") || ""} ${element.getAttribute?.("placeholder") || ""}`.toLowerCase();
    return /(^|\s)search(\s|$)|搜索|find/.test(description) || Boolean(element.closest?.("nav,header,[role='navigation']"));
  }

  function isWritable(element) {
    return Boolean(element && !element.disabled && !element.readOnly && isVisible(element) && !isSearchLike(element));
  }

  function dispatchBeforeInput(element, text) {
    try {
      element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
    } catch (_) {
      element.dispatchEvent(new Event("beforeinput", { bubbles: true, cancelable: true }));
    }
  }

  function dispatchInput(element, text) {
    try {
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    } catch (_) {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function insertionWithSpacing(before, payload, after) {
    const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
    return `${prefix}${payload}${suffix}`;
  }

  function insertValue(element, payload) {
    const beforeValue = String(element.value || "");
    const start = Number.isFinite(element.selectionStart) ? element.selectionStart : beforeValue.length;
    const end = Number.isFinite(element.selectionEnd) ? element.selectionEnd : start;
    const insertionText = insertionWithSpacing(beforeValue.slice(0, start), payload, beforeValue.slice(end));
    const next = beforeValue.slice(0, start) + insertionText + beforeValue.slice(end);
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (!setter) return { ok: false, insertionText, beforeText: beforeValue };
    element.focus();
    dispatchBeforeInput(element, insertionText);
    setter.call(element, next);
    dispatchInput(element, insertionText);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    const cursor = start + insertionText.length;
    element.setSelectionRange?.(cursor, cursor);
    return { ok: true, insertionText, beforeText: beforeValue };
  }

  function activeRangeFor(element) {
    const selection = global.getSelection?.();
    if (selection?.rangeCount && element.contains(selection.anchorNode)) return selection.getRangeAt(0);
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    return range;
  }

  function insertEditable(element, payload) {
    const beforeText = nodeText(element);
    const range = activeRangeFor(element);
    const insertionText = insertionWithSpacing(beforeText.slice(0, range.startOffset), payload, "");
    element.focus();
    dispatchBeforeInput(element, insertionText);
    range.deleteContents();
    const fragment = document.createDocumentFragment();
    let lastNode = null;
    insertionText.split("\n").forEach((line, index) => {
      if (index > 0) {
        lastNode = document.createElement("br");
        fragment.appendChild(lastNode);
      }
      if (line) {
        lastNode = document.createTextNode(line);
        fragment.appendChild(lastNode);
      }
    });
    if (!lastNode) {
      lastNode = document.createTextNode("");
      fragment.appendChild(lastNode);
    }
    range.insertNode(fragment);
    range.setStartAfter(lastNode);
    range.collapse(true);
    const selection = global.getSelection?.();
    selection?.removeAllRanges();
    selection?.addRange(range);
    dispatchInput(element, insertionText);
    return { ok: true, insertionText, beforeText };
  }

  function verifyInsertedText({ afterText, payload }) {
    return A.comparableText(afterText).includes(A.comparableText(payload));
  }

  const valueAdapter = {
    id: "generic-value",
    canHandle(element) {
      return isWritable(element) && (element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type)));
    },
    getRoot: (element) => element,
    readText: (element) => String(element.value || ""),
    insertText: insertValue,
    focus: (element) => element.focus(),
    verify: (element, expected) => verifyInsertedText({ afterText: element.value, payload: expected })
  };

  const editableAdapter = {
    id: "generic-contenteditable",
    canHandle(element) {
      return isWritable(element) && (element.isContentEditable || element.getAttribute?.("role") === "textbox");
    },
    getRoot(element) {
      return element.closest?.("[contenteditable='true'],[contenteditable=''],[role='textbox']") || element;
    },
    readText: nodeText,
    insertText: insertEditable,
    focus: (element) => element.focus(),
    verify: (element, expected) => verifyInsertedText({ afterText: nodeText(element), payload: expected })
  };

  const siteAdapter = {
    id: "chatgpt-grok",
    canHandle(element) {
      if (!/(^|\.)(chatgpt\.com|chat\.openai\.com|grok\.com|x\.com)$/i.test(location.hostname)) return false;
      const root = element.closest?.("#prompt-textarea,[data-testid='textbox'],[contenteditable='true'][role='textbox']");
      return Boolean(root && isWritable(root));
    },
    getRoot(element) {
      return element.closest?.("#prompt-textarea,[data-testid='textbox'],[contenteditable='true'][role='textbox']") || element;
    },
    readText(element) {
      const root = this.getRoot(element);
      return "value" in root ? String(root.value || "") : nodeText(root);
    },
    insertText(element, text) {
      const root = this.getRoot(element);
      return "value" in root ? insertValue(root, text) : insertEditable(root, text);
    },
    focus(element) { this.getRoot(element).focus(); },
    verify(element, expected) { return verifyInsertedText({ afterText: this.readText(element), payload: expected }); }
  };

  const EDITOR_ADAPTERS = [siteAdapter, valueAdapter, editableAdapter];

  function findAdapter(element) {
    let candidate = element;
    while (candidate && candidate !== document.documentElement) {
      for (const adapter of EDITOR_ADAPTERS) {
        if (adapter.canHandle(candidate)) return { adapter, root: adapter.getRoot(candidate) };
      }
      candidate = candidate.parentElement;
    }
    return null;
  }

  function editorAtPoint(x, y) {
    return findAdapter(document.elementFromPoint(x, y));
  }

  function likelyEditor() {
    const selectors = [
      "#prompt-textarea", "[data-testid='textbox']", "textarea", "[contenteditable='true'][role='textbox']",
      "[contenteditable='true']", "[role='textbox']", "input[type='text']"
    ];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const found = findAdapter(element);
        if (found) return found;
      }
    }
    return null;
  }

  async function injectAndVerify(found, payload) {
    const { adapter, root } = found;
    const beforeText = adapter.readText(root);
    const result = adapter.insertText(root, payload);
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 140));
    const afterText = adapter.readText(root);
    return {
      ok: Boolean(result?.ok && verifyInsertedText({ beforeText, afterText, payload, insertionText: result.insertionText })),
      adapterId: adapter.id,
      beforeText,
      afterText,
      insertionText: result?.insertionText || payload
    };
  }

  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (primaryError) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("aria-hidden", "true");
        textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        textarea.remove();
        return ok ? { ok: true } : { ok: false, error: primaryError };
      } catch (error) {
        return { ok: false, error };
      }
    }
  }

  global.InlineAIAnnotationRuntime = Object.freeze({
    createAnchor, restoreAnchor, restoreAnchors, findReadableRoot, EDITOR_ADAPTERS, findAdapter,
    editorAtPoint, likelyEditor, injectAndVerify, verifyInsertedText, copyTextToClipboard,
    nodeText, isVisible
  });
})(globalThis);
