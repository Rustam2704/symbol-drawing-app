import assert from "node:assert/strict";
import test from "node:test";

import { findAutoCropBox } from "../modules/auto-crop.js";

function pixels(width, height, color = [255, 255, 255, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) data.set(color, index * 4);
  return data;
}

test("auto crop finds content against a solid background", () => {
  const data = pixels(10, 8);
  for (let y = 2; y <= 5; y += 1) {
    for (let x = 3; x <= 6; x += 1) data.set([0, 0, 0, 255], (y * 10 + x) * 4);
  }
  assert.deepEqual(findAutoCropBox({ data, width: 10, height: 8 }), { x: 2, y: 1, width: 5, height: 5 });
});

test("auto crop finds opaque content on transparency", () => {
  const data = pixels(6, 6, [0, 0, 0, 0]);
  data.set([20, 30, 40, 255], (2 * 6 + 2) * 4);
  assert.deepEqual(findAutoCropBox({ data, width: 6, height: 6, padding: 2 }), { x: 1, y: 1, width: 1, height: 1 });
});

test("auto crop returns null when no foreground exists", () => {
  assert.equal(findAutoCropBox({ data: pixels(4, 4), width: 4, height: 4 }), null);
});
