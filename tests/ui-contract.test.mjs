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
  assert.match(content, /answer-collapsed > :not\(#thread-header\) \{ display: none !important; \}/);
  assert.match(content, /answer-collapsed \.quote-chip-toggle-icon \{ transform: rotate\(180deg\); \}/);
  assert.match(content, /#quote-chip/);
  assert.match(content, /response-card \.response\.streaming::after/);
  assert.doesNotMatch(content, /annotation-standalone|send-standalone|composer-close|--iai-note-|response-collapsed-label/);
  assert.match(ui, /data-testid="answer-surface"/);
  assert.match(ui, /data-testid="composer-surface"/);
  assert.match(ui, /data-testid="annotation-action"/);
  assert.match(ui, /data-testid="send-action"/);
  assert.match(ui, /data-testid="answer-card"/);
  assert.match(ui, /id="quote-chip" class="quote-chip" type="button" data-action="toggle-answer-collapse"/);
  assert.doesNotMatch(ui, /response-collapsed-label/);
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
