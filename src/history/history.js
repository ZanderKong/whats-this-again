(function inlineAiHistory() {
  const C = globalThis.InlineAIConstants;
  const {
    STORAGE_KEYS,
    MESSAGE_TYPES,
    mergeSettings,
    ensureStorageSchema,
    getEffectiveLanguage,
    t,
    applyI18n
  } = C;

  const els = {
    search: document.getElementById("search"),
    scopeFilter: document.getElementById("scope-filter"),
    summary: document.getElementById("summary"),
    list: document.getElementById("history-list"),
    openOptions: document.getElementById("open-options")
  };

  let memories = {};
  let settings = mergeSettings();
  let activePageUrl = "";
  let activeHost = "";
  let groups = [];
  const expandedTerms = new Set();

  init().catch((error) => {
    els.summary.textContent = t("history.loadFailed", { message: error.message || error }, currentLanguage());
  });

  async function init() {
    await ensureStorageSchema(chrome.storage.local);
    const params = new URLSearchParams(location.search);
    activePageUrl = params.get("page") || "";
    activeHost = params.get("host") || "";
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    const activeUrl = safeUrl(activeTab?.url);
    activePageUrl = activePageUrl || (activeUrl ? `${activeUrl.origin}${activeUrl.pathname}${activeUrl.search}` : "");
    activeHost = activeHost || activeUrl?.hostname || "";

    const stored = await chrome.storage.local.get([STORAGE_KEYS.settings, STORAGE_KEYS.memories]);
    settings = mergeSettings(stored[STORAGE_KEYS.settings]);
    memories = stored[STORAGE_KEYS.memories] || {};
    applyPageLanguage();

    els.search.addEventListener("input", render);
    els.scopeFilter.addEventListener("change", render);
    els.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
    els.list.addEventListener("click", handleListClick);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }
      if (changes[STORAGE_KEYS.memories]) {
        memories = changes[STORAGE_KEYS.memories].newValue || {};
        render();
      }
      if (changes[STORAGE_KEYS.settings]) {
        settings = mergeSettings(changes[STORAGE_KEYS.settings].newValue);
        applyPageLanguage();
        render();
      }
    });

    render();
  }

  function render() {
    groups = filterGroups(buildGroups());
    const answerCount = groups.reduce((sum, group) => sum + group.cards.length, 0);
    els.summary.textContent = t("history.summary", { terms: groups.length, answers: answerCount }, currentLanguage());

    if (!groups.length) {
      els.list.innerHTML = `<p class="empty">${escapeHtml(t("history.empty", currentLanguage()))}</p>`;
      return;
    }

    els.list.innerHTML = groups.map(renderGroup).join("");
  }

  function buildGroups() {
    const map = new Map();
    Object.values(memories)
      .filter((memory) => memory?.saved)
      .forEach((memory) => {
        const key = memory.termKey || normalize(memory.term).toLowerCase();
        const group = map.get(key) || { key, term: memory.term, memories: [], cards: [] };
        group.memories.push(memory);
        (memory.cards || []).forEach((card) => {
          group.cards.push({ ...card, memory });
        });
        map.set(key, group);
      });

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        cards: group.cards.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
        latestMemory: group.memories.sort((a, b) => (b.updatedAt || b.savedAt || 0) - (a.updatedAt || a.savedAt || 0))[0]
      }))
      .sort((a, b) => (b.latestMemory?.updatedAt || b.latestMemory?.savedAt || 0) - (a.latestMemory?.updatedAt || a.latestMemory?.savedAt || 0));
  }

  function filterGroups(items) {
    const query = normalize(els.search.value).toLowerCase();
    const scope = els.scopeFilter.value;
    return items
      .filter((group) => !query || searchableText(group).includes(query))
      .filter((group) => {
        if (scope === "currentPage") {
          return activePageUrl && group.memories.some((memory) => memory.pageUrl === activePageUrl);
        }
        if (scope === "currentSite") {
          return activeHost && group.memories.some((memory) => memory.siteHost === activeHost);
        }
        if (scope === "global") {
          return group.memories.some((memory) => memory.scope === "all");
        }
        return true;
      });
  }

  function renderGroup(group) {
    const latest = group.cards[0] || {};
    const memory = latest.memory || group.latestMemory || {};
    const isExpanded = expandedTerms.has(group.key);
    return `
      <article class="memory${isExpanded ? " expanded" : ""}" data-term-key="${escapeHtml(group.key)}">
        <header class="memory-header">
          <div>
            <h3 class="term">${escapeHtml(group.term || "")}</h3>
            <p class="summary-text">${escapeHtml(snippet(latest.response || t("history.noSummary", currentLanguage()), isExpanded ? 1200 : 260))}</p>
            <p class="meta">
              <span>${escapeHtml(memory.siteHost || t("history.unknownSite", currentLanguage()))}</span>
              <span>${escapeHtml(formatDateTime(memory.savedAt || latest.createdAt))}</span>
              <span>${escapeHtml(t("history.linkedLocations", { count: group.memories.length }, currentLanguage()))}</span>
              <span>${escapeHtml(t("history.answerCount", { count: group.cards.length }, currentLanguage()))}</span>
            </p>
          </div>
          <div class="actions">
            <button class="button" type="button" data-action="copy-group">${escapeHtml(t("history.copy", currentLanguage()))}</button>
            <button class="button" type="button" data-action="open-page">${escapeHtml(t("history.openSource", currentLanguage()))}</button>
            ${group.cards.length > 1 ? `<button class="button" type="button" data-action="toggle-expand">${escapeHtml(isExpanded ? t("history.collapse", currentLanguage()) : t("history.expand", currentLanguage()))}</button>` : ""}
            <span class="more-wrap">
              <button class="button" type="button" data-action="toggle-more">${escapeHtml(t("history.more", currentLanguage()))}</button>
              <span class="more-menu hidden">
                <button class="button danger" type="button" data-action="delete-group">${escapeHtml(t("history.delete", currentLanguage()))}</button>
              </span>
            </span>
          </div>
        </header>
        ${isExpanded ? renderCards(group.cards) : ""}
      </article>
    `;
  }

  function renderCards(cards) {
    return `
      <div class="answer-list">
        ${cards.map((card) => `
          <article class="answer-card">
            <header>
              <h3>${escapeHtml(card.kind === "excerpt" ? t("history.excerptAnswer", currentLanguage()) : t("history.fullAnswer", currentLanguage()))}</h3>
              <p class="meta">${escapeHtml(formatDateTime(card.createdAt || card.memory?.savedAt))}</p>
            </header>
            <p>${escapeHtml(card.response || t("history.noAnswer", currentLanguage()))}</p>
            ${(card.followups || []).map((item) => `
              <p><strong>${escapeHtml(item.query || t("history.followup", currentLanguage()))}</strong><br>${escapeHtml(item.response || "")}</p>
            `).join("")}
          </article>
        `).join("")}
      </div>
    `;
  }

  async function handleListClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    const group = groups.find((item) => item.key === button.closest("[data-term-key]")?.dataset.termKey);
    if (!group) {
      return;
    }

    const action = button.dataset.action;
    if (action === "toggle-more") {
      toggleMore(button);
    } else if (action === "toggle-expand") {
      toggleSet(expandedTerms, group.key);
      render();
    } else if (action === "copy-group") {
      await copyText(groupToText(group));
    } else if (action === "open-page") {
      openSourceThread(group);
    } else if (action === "delete-group") {
      await deleteGroup(group);
    }
  }

  function openSourceThread(group) {
    const memory = group.latestMemory || group.memories[0];
    if (!memory?.pageUrl) {
      return;
    }
    chrome.tabs.create({ url: memory.pageUrl }, (tab) => {
      if (!tab?.id) {
        return;
      }
      const listener = (tabId, info) => {
        if (tabId !== tab.id || info.status !== "complete") {
          return;
        }
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.openMemory,
          memoryId: memory.id
        }).catch(() => {});
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  function toggleMore(button) {
    const menu = button.closest(".more-wrap")?.querySelector(".more-menu");
    if (!menu) {
      return;
    }
    document.querySelectorAll(".more-menu").forEach((item) => {
      if (item !== menu) {
        item.classList.add("hidden");
      }
    });
    menu.classList.toggle("hidden");
  }

  function toggleSet(set, key) {
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
  }

  async function deleteGroup(group) {
    const confirmed = window.confirm(t("history.deleteConfirm", { term: group.term }, currentLanguage()));
    if (!confirmed) {
      return;
    }
    const next = { ...memories };
    group.memories.forEach((memory) => delete next[memory.id]);
    memories = next;
    expandedTerms.delete(group.key);
    await chrome.storage.local.set({ [STORAGE_KEYS.memories]: memories });
    render();
  }

  async function copyText(text) {
    await navigator.clipboard.writeText(text);
    els.summary.textContent = t("history.copied", currentLanguage());
    window.clearTimeout(copyText.timer);
    copyText.timer = window.setTimeout(render, 1200);
  }

  function groupToText(group) {
    return [
      t("history.term", { term: group.term }, currentLanguage()),
      t("history.source", { source: group.latestMemory?.pageTitle || group.latestMemory?.pageUrl || "" }, currentLanguage()),
      "",
      ...group.cards.map((card) => [
        card.kind === "excerpt" ? t("history.excerptAnswer", currentLanguage()) : t("history.fullAnswer", currentLanguage()),
        card.response || "",
        ...(card.followups || []).flatMap((item) => [
          t("history.followupLabel", { query: item.query || "" }, currentLanguage()),
          t("history.answerLabel", { answer: item.response || "" }, currentLanguage())
        ])
      ].join("\n"))
    ].join("\n\n");
  }

  function searchableText(group) {
    return normalize([
      group.term,
      ...group.memories.flatMap((memory) => [memory.pageTitle, memory.pageUrl, memory.siteHost]),
      ...group.cards.flatMap((card) => [card.query, card.response])
    ].join(" ")).toLowerCase();
  }

  function safeUrl(url) {
    try {
      const parsed = new URL(url);
      return /^https?:$/i.test(parsed.protocol) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function snippet(text, length) {
    const clean = normalize(text);
    return clean.length > length ? `${clean.slice(0, length)}...` : clean;
  }

  function formatDateTime(value) {
    if (!value) {
      return t("history.unknownTime", currentLanguage());
    }
    return new Date(value).toLocaleString();
  }

  function currentLanguage() {
    return getEffectiveLanguage(settings);
  }

  function applyPageLanguage() {
    applyI18n(document, currentLanguage());
    document.title = t("app.historyTitle", currentLanguage());
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
