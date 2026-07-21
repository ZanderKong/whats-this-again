import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

function loadConstants() {
  const context = vm.createContext({ globalThis: {}, Date, Math, navigator: { language: "zh-CN" } });
  context.globalThis = context;
  vm.runInContext(readFileSync("src/shared/constants.js", "utf8"), context);
  return context.InlineAIConstants;
}

function storage(initial) {
  const data = structuredClone(initial);
  return {
    data,
    async get(keys) { return Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, structuredClone(data[key])])); },
    async set(patch) { Object.assign(data, structuredClone(patch)); },
    async remove(keys) { keys.forEach((key) => delete data[key]); }
  };
}

test("migrates schema 1 to 4 while preserving settings and memories", async () => {
  const C = loadConstants();
  const area = storage({ inlineai_schema_version: 1, inlineai_settings: { model: "keep" }, inlineai_memories: { m1: { id: "m1" } }, inlineai_terms: {}, inlineai_answers: {} });
  await C.ensureStorageSchema(area);
  assert.equal(area.data.inlineai_schema_version, 4);
  assert.equal(area.data.inlineai_settings.model, "keep");
  assert.equal(area.data.inlineai_memories.m1.id, "m1");
  assert.deepEqual(area.data.inlineai_annotation_batches, {});
  assert.deepEqual(area.data.inlineai_active_annotation_batches, {});
  assert.equal("inlineai_terms" in area.data, false);
});

test("preserves existing annotations and is idempotent", async () => {
  const C = loadConstants();
  const initial = { inlineai_schema_version: 4, inlineai_memories: {}, inlineai_annotation_batches: { b1: { id: "b1" } }, inlineai_active_annotation_batches: { page: "b1" } };
  const area = storage(initial);
  await C.ensureStorageSchema(area);
  await C.ensureStorageSchema(area);
  assert.deepEqual(area.data.inlineai_annotation_batches, initial.inlineai_annotation_batches);
  assert.deepEqual(area.data.inlineai_active_annotation_batches, initial.inlineai_active_annotation_batches);
});

test("migrates arbitrary theme colors to the curated default", async () => {
  const C = loadConstants();
  const area = storage({
    inlineai_schema_version: 2,
    inlineai_settings: { model: "keep", highlightColor: "#123456" },
    inlineai_memories: {},
    inlineai_annotation_batches: {},
    inlineai_active_annotation_batches: {}
  });
  await C.ensureStorageSchema(area);
  assert.equal(area.data.inlineai_schema_version, 4);
  assert.equal(area.data.inlineai_settings.model, "keep");
  assert.equal(area.data.inlineai_settings.highlightColor, "#c98257");
});

test("splits legacy thread cards into one saved card per answer without duplication", async () => {
  const C = loadConstants();
  const area = storage({
    inlineai_schema_version: 3,
    inlineai_settings: { model: "keep" },
    inlineai_memories: {
      mem1: {
        id: "mem1",
        term: "term",
        cards: [{
          id: "root-answer",
          query: "root question",
          response: "root answer",
          createdAt: 10,
          followups: [{ id: "follow-answer", query: "follow question", response: "follow answer", createdAt: 20 }]
        }]
      }
    },
    inlineai_annotation_batches: {},
    inlineai_active_annotation_batches: {}
  });

  await C.ensureStorageSchema(area);
  const cards = structuredClone(area.data.inlineai_memories.mem1.cards);
  await C.ensureStorageSchema(area);
  assert.equal(area.data.inlineai_schema_version, 4);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map((card) => card.sourceMessageId), ["root-answer", "follow-answer"]);
  assert.deepEqual(cards.map((card) => card.parentMessageId), ["", "root-answer"]);
  assert.equal(cards.some((card) => "followups" in card), false);
  assert.deepEqual(area.data.inlineai_memories.mem1.cards, cards);
});

test("preserves all five curated theme presets", () => {
  const C = loadConstants();
  assert.equal(C.THEME_COLORS.length, 5);
  for (const preset of C.THEME_COLORS) {
    assert.equal(C.mergeSettings({ highlightColor: preset.value }).highlightColor, preset.value);
    for (const key of ["strong", "soft", "foreground", "border", "shadow", "rgb"]) {
      assert.ok(preset[key], `${preset.id} is missing ${key}`);
    }
  }
});
