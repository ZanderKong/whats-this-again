import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("content UI keeps the dark-pill interaction contract and removes the 0.5.0 layer", () => {
  const content = readFileSync("src/content/content.js", "utf8");
  const ui = readFileSync("src/content/content-ui.js", "utf8");
  assert.match(content, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(content, /grid-template-columns: minmax\(0, 1fr\) 44px 44px/);
  assert.match(content, /\.input-shell \{[^}]*min-height: 44px;[^}]*border-radius: 999px/s);
  assert.match(content, /\.round-action \{[^}]*width: 44px;[^}]*height: 44px;[^}]*border-radius: 999px/s);
  assert.match(content, /--card-radius: 26px/);
  assert.match(content, /interaction-stack\.answer-collapsed/);
  assert.match(content, /answer-collapsed > :not\(\.thread-header\) \{ display: none !important; \}/);
  assert.match(content, /answer-collapsed \.quote-chip-toggle-icon \{ transform: rotate\(180deg\); \}/);
  assert.match(content, /\.quote-chip/);
  assert.match(content, /response-card \.response\.streaming::after/);
  assert.doesNotMatch(content, /annotation-standalone|send-standalone|composer-close|--iai-note-|response-collapsed-label/);
  assert.match(ui, /data-testid="answer-surface"/);
  assert.match(ui, /data-testid="composer-surface"/);
  assert.match(ui, /data-testid="annotation-action"/);
  assert.match(ui, /data-testid="send-action"/);
  assert.match(ui, /data-testid="answer-card"/);
  assert.match(ui, /class="quote-chip" type="button" data-action="toggle-answer-collapse"/);
  assert.doesNotMatch(ui, /response-collapsed-label/);
});

test("content bootstraps a minimal selection UI before creating the full interaction shell", () => {
  const content = readFileSync("src/content/content.js", "utf8");
  assert.match(content, /function createShadowUi\(\)[\s\S]*?<button id="bubble" class="hidden"/);
  assert.match(content, /function createInteractionPanel\(state\)[\s\S]*?UI\.interactionShell/);
  assert.match(content, /function showInteractionSurfaces\(visible\) \{\s*ensureFullUi\(\)/);
  assert.match(content, /function bindBubbleEvents\(\)[\s\S]*?pointerdown[\s\S]*?pointerup/);
  assert.match(content, /function bindFullUiEvents\(\) \{\s*bindBubbleEvents\(\)/);
  assert.match(content, /interactionPanels = new Map/);
  assert.match(content, /panelState\.streaming = true/);
  assert.match(content, /streamApi\(panelInstance,/);
  assert.match(content, /toggle-answer-collapse[\s\S]*?!panelState\?\.streaming/);
  assert.doesNotMatch(content, /pinCurrentPanelSnapshot/);
  assert.doesNotMatch(content, /controls\.forEach\(\(control\) =>/);
  assert.match(content, /const cards = \(memory\.cards \|\| \[\]\)\.filter\(\(card\) => card\.id !== cardId\)/);
});

test("explanation panels have independent DOM state and stream ports", () => {
  const content = readFileSync("src/content/content.js", "utf8");
  assert.match(content, /const interactionPanels = new Map\(\)/);
  assert.match(content, /function createInteractionPanel\(state\)/);
  assert.match(content, /function closeInteractionPanel\(value = activePanelId\)/);
  assert.match(content, /function streamApi\(instance, \{ messages, onChunk \}\)/);
  assert.match(content, /instance\.port = port/);
  assert.doesNotMatch(content, /if \(activePort\) \{\s*activePort\.disconnect\(\)/);
  assert.doesNotMatch(content, /pinCurrentPanelSnapshot/);
});

test("history hover ignores collapsed panels but still avoids expanded surfaces", () => {
  const content = readFileSync("src/content/content.js", "utf8");
  const ui = readFileSync("src/content/content-ui.js", "utf8");
  const updateHistoryHint = content.match(/function updateHistoryHint\(point\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(updateHistoryHint, /!canShowHistoryHint\(\)/);
  assert.doesNotMatch(updateHistoryHint, /panelIsOpen\(\)/);
  assert.match(content, /function canShowHistoryHint\(\)[\s\S]*?visibleInteractionPanels\(\)/);
  assert.match(ui, /function canShowHistoryHint\(\{ annotationOpen = false, panels = \[\] \} = \{\}\)/);
});

test("privacy disclosure documents the existing model data flow without changing context behavior", () => {
  const constants = readFileSync("src/shared/constants.js", "utf8");
  const options = readFileSync("src/options/options.html", "utf8");
  const onboarding = readFileSync("src/onboarding/onboarding.html", "utf8");
  const readme = readFileSync("README.md", "utf8");
  const readmeEn = readFileSync("README.en.md", "utf8");
  const site = readFileSync("docs/index.html", "utf8");
  const siteEn = readFileSync("docs/en/index.html", "utf8");
  assert.match(constants, /options\.privacyNotice/);
  assert.match(constants, /onboarding\.modelBody[\s\S]*?敏感内容/);
  assert.match(options, /data-i18n="options\.privacyNotice"/);
  assert.match(onboarding, /id="connection-panel"/);
  assert.match(readme, /并非操作系统密码库/);
  assert.match(readmeEn, /not an operating-system password vault/);
  assert.match(site, /不是系统密码库/);
  assert.match(siteEn, /not a system password vault/);
  assert.match(constants, /includePageContext: true/);
});

test("internal prototype and delivery artifacts are ignored", () => {
  const ignore = readFileSync(".gitignore", "utf8");
  for (const path of [
    "ui-mockup.html",
    "whats_this_again_prototype_ui_onboarding_prompt_plan.md",
    "IMPLEMENTATION_REPORT.md",
    "docs/test-report.md",
    "docs/ui-prototype-audit.md"
  ]) {
    assert.match(ignore, new RegExp(`^${path.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")}$`, "m"));
  }
});

test("settings removes arbitrary color input but keeps preset controls", () => {
  const options = readFileSync("src/options/options.html", "utf8");
  assert.doesNotMatch(options, /type="color"/);
  assert.match(options, /id="theme-presets"/);
  assert.match(options, /id="open-onboarding"/);
});

test("onboarding exposes keyboard-focusable headings and live status", () => {
  const onboarding = readFileSync("src/onboarding/onboarding.html", "utf8");
  assert.match(onboarding, /id="step-title" tabindex="-1"/);
  assert.match(onboarding, /role="status" aria-live="polite"/);
  assert.match(onboarding, /id="skip"/);
  assert.match(onboarding, /id="back"/);
  assert.match(onboarding, /id="next"/);
});

test("popup uses the compact paper layout without record counters", () => {
  const popup = readFileSync("src/popup/popup.html", "utf8");
  const script = readFileSync("src/popup/popup.js", "utf8");
  const css = readFileSync("src/popup/popup.css", "utf8");
  assert.match(popup, /class="connection-row"/);
  assert.match(popup, /id="api-state"/);
  assert.doesNotMatch(popup, /memory-count|annotation-count|class="meta"/);
  assert.doesNotMatch(script, /memoryCount|annotationCount|STORAGE_KEYS\.memories/);
  assert.match(css, /--paper: #fdfaf0/);
  assert.match(css, /\.theme-section/);
});

test("history uses pill filters and expandable cards for answers and annotations", () => {
  const html = readFileSync("src/history/history.html", "utf8");
  const script = readFileSync("src/history/history.js", "utf8");
  const css = readFileSync("src/history/history.css", "utf8");
  assert.match(html, /class="filter-chip active" data-scope="all"/);
  assert.doesNotMatch(html, /<select id="scope-filter">/);
  assert.match(script, /data-action="toggle-expand"/);
  assert.match(script, /data-action="toggle-annotation"/);
  assert.match(script, /renderStoredMarkdown/);
  assert.match(script, /const initialExpansionApplied = \{ explanations: false, annotations: false \}/);
  assert.doesNotMatch(script, /groups\.length && !groups\.some\(\(group\) => expandedTerms\.has\(group\.key\)\)/);
  assert.match(css, /\.history-tabs/);
  assert.match(css, /\.memory-toggle/);
  assert.match(css, /--paper: #fdfaf0/);
});
