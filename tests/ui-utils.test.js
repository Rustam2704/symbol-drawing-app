import assert from "node:assert/strict";
import test from "node:test";

import { calculateRangePercent, getErrorMessage, normalizeColor, shortenMiddle } from "../modules/ui-utils.js";

test("range percentages are normalized and clamped", () => {
  assert.equal(calculateRangePercent({ min: 0, max: 10, value: 2.5 }), 25);
  assert.equal(calculateRangePercent({ min: 0, max: 10, value: 20 }), 100);
  assert.equal(calculateRangePercent({ min: 5, max: 5, value: 5 }), 0);
});

test("colors are normalized", () => {
  assert.equal(normalizeColor("  #AABBCC "), "#aabbcc");
  assert.equal(normalizeColor(null), "");
});

test("errors are normalized for user-facing reporting", () => {
  assert.equal(getErrorMessage(new Error("Failed")), "Failed");
  assert.equal(getErrorMessage("Stopped"), "Stopped");
  assert.equal(getErrorMessage(null), "Unexpected error.");
});

test("middle shortening respects the measurement callback", () => {
  const measure = (text) => text.length;
  assert.equal(shortenMiddle("short", 10, measure), "short");
  const shortened = shortenMiddle("D:\\projects\\Drawing-app\\images", 14, measure);
  assert.ok(shortened.includes("..."));
  assert.ok(shortened.length <= 14);
  assert.ok(shortened.startsWith("D:"));
  assert.ok(shortened.endsWith("images"));
});
