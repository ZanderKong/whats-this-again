import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const context = vm.createContext({ globalThis: {} });
context.globalThis = context;
vm.runInContext(readFileSync("src/content/panel-layout.js", "utf8"), context);
const Layout = context.InlineAIPanelLayout;

test("new floating panels cascade away from an existing collapsed panel", () => {
  const first = { left: 220, top: 180, width: 360, height: 42, right: 580, bottom: 222 };
  const next = Layout.placePanel({
    anchor: { left: 310, top: 130, width: 60, height: 22, right: 370, bottom: 152 },
    width: 360,
    height: 240,
    viewport: { width: 1200, height: 800 },
    occupied: [first]
  });

  assert.equal(Layout.intersects(next, first), false);
  assert.equal(first.left, 220);
  assert.equal(first.top, 180);
});

test("panel placement remains inside the viewport when cascade reaches an edge", () => {
  const placed = Layout.placePanel({
    anchor: { left: 980, top: 720, width: 10, height: 10, right: 990, bottom: 730 },
    width: 420,
    height: 300,
    viewport: { width: 1024, height: 768 },
    occupied: [{ left: 592, top: 456, width: 420, height: 300, right: 1012, bottom: 756 }]
  });

  assert.ok(placed.left >= Layout.MARGIN);
  assert.ok(placed.top >= Layout.MARGIN);
  assert.ok(placed.right <= 1024 - Layout.MARGIN);
  assert.ok(placed.bottom <= 768 - Layout.MARGIN);
});
