(function inlineAiHistory() {
  const C = globalThis.InlineAIConstants;
  const {
    STORAGE_KEYS,
    MESSAGE_TYPES,
    ensureStorageSchema
  } = C;

  const els = {
    search: document.getElementById("search"),
    scopeFilter: document.getElementById("scope-filter"),
    summary: document.getElementById("summary"),
    list: document.getElementById("history-list"),
    openOptions: document.getElementById("open-options")
  };

  let memories = {};
  let activePageUrl = "";
  let activeHost = "";
  let groups = [];
  const expandedTerms = new Set();

  init().catch((error) => {
    els.summary.textContent = `读取失败：${error.message || error}`;
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

    const stored = await chrome.storage.local.get([STORAGE_KEYS.memories]);
    memories = stored[STORAGE_KEYS.memories] || {};

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
    });

    render();
  }

  function render() {
    groups = filterGroups(buildGroups());
    const answerCount = groups.reduce((sum, group) => sum + group.cards.length, 0);
    els.summary.textContent = `共 ${groups.length} 个保存词，${answerCount} 条回答。`;

    if (!groups.length) {
      els.list.innerHTML = `<p class="empty">没有匹配的历史解释。临时解释不会出现在这里，点击回答卡片里的“保存”后才会进入历史。</p>`;
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
            <p class="summary-text">${escapeHtml(snippet(latest.response || "暂无回答摘要。", isExpanded ? 1200 : 260))}</p>
            <p class="meta">
              <span>${escapeHtml(memory.siteHost || "未知网站")}</span>
              <span>${escapeHtml(formatDateTime(memory.savedAt || latest.createdAt))}</span>
              <span>关联位置 ${group.memories.length}</span>
              <span>共 ${group.cards.length} 条回答</span>
            </p>
          </div>
          <div class="actions">
            <button class="button" type="button" data-action="copy-group">复制</button>
            <button class="button" type="button" data-action="open-page">打开原文</button>
            ${group.cards.length > 1 ? `<button class="button" type="button" data-action="toggle-expand">${isExpanded ? "收起" : "展开"}</button>` : ""}
            <span class="more-wrap">
              <button class="button" type="button" data-action="toggle-more">更多</button>
              <span class="more-menu hidden">
                <button class="button danger" type="button" data-action="delete-group">删除</button>
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
              <h3>${escapeHtml(card.kind === "excerpt" ? "节选回答" : "完整回答")}</h3>
              <p class="meta">${escapeHtml(formatDateTime(card.createdAt || card.memory?.savedAt))}</p>
            </header>
            <p>${escapeHtml(card.response || "暂无回答。")}</p>
            ${(card.followups || []).map((item) => `
              <p><strong>${escapeHtml(item.query || "追问")}</strong><br>${escapeHtml(item.response || "")}</p>
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
    const confirmed = window.confirm(`删除“${group.term}”的所有历史回答？`);
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
    els.summary.textContent = "已复制。";
    window.clearTimeout(copyText.timer);
    copyText.timer = window.setTimeout(render, 1200);
  }

  function groupToText(group) {
    return [
      `词语：${group.term}`,
      `来源：${group.latestMemory?.pageTitle || group.latestMemory?.pageUrl || ""}`,
      "",
      ...group.cards.map((card) => [
        card.kind === "excerpt" ? "节选回答" : "完整回答",
        card.response || "",
        ...(card.followups || []).flatMap((item) => [`追问：${item.query || ""}`, `回答：${item.response || ""}`])
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
      return "未知时间";
    }
    return new Date(value).toLocaleString();
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
