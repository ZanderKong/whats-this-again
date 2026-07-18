import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("content UI retains reduced-motion and stable interaction hooks", () => {
  const content = readFileSync("src/content/content.js", "utf8");
  const ui = readFileSync("src/content/content-ui.js", "utf8");
  assert.match(content, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(ui, /data-testid=\"answer-surface\"/);
  assert.match(ui, /data-testid=\"composer-surface\"/);
  assert.match(ui, /data-testid=\"annotation-action\"/);
  assert.match(ui, /data-testid=\"send-action\"/);
});

test("settings removes arbitrary color input but keeps preset controls", () => {
  const options = readFileSync("src/options/options.html", "utf8");
  assert.doesNotMatch(options, /type=\"color\"/);
  assert.match(options, /id=\"theme-presets\"/);
  assert.match(options, /id=\"open-onboarding\"/);
});

test("onboarding exposes keyboard-focusable headings and live status", () => {
  const onboarding = readFileSync("src/onboarding/onboarding.html", "utf8");
  assert.match(onboarding, /id=\"step-title\" tabindex=\"-1\"/);
  assert.match(onboarding, /role=\"status\" aria-live=\"polite\"/);
  assert.match(onboarding, /id=\"skip\"/);
  assert.match(onboarding, /id=\"back\"/);
  assert.match(onboarding, /id=\"next\"/);
});
