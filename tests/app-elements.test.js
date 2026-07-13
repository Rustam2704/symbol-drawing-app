import assert from "node:assert/strict";
import test from "node:test";

import { queryAppElements } from "../modules/app-elements.js";

test("application DOM contract resolves required elements and groups", () => {
  const documentRef = {
    querySelector: (selector) => ({ selector }),
    querySelectorAll: (selector) => selector.includes("personal-theme-colors")
      ? Array.from({ length: 7 }, () => ({ selector }))
      : [{ selector }],
  };
  const elements = queryAppElements(documentRef);
  assert.equal(elements.canvas.selector, "#practiceCanvas");
  assert.equal(elements.colorSwatches.length, 1);
  assert.equal(elements.personalThemeButtons.length, 7);
  assert.equal(elements.rangeInputs.length, 1);
});

test("application DOM contract fails fast for missing markup", () => {
  assert.throws(
    () => queryAppElements({ querySelector: () => null, querySelectorAll: () => [] }),
    /Required application element/,
  );
});
