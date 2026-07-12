import assert from "node:assert/strict";
import test from "node:test";

import { renderImageContained, resizeCanvasToDisplaySize } from "../modules/canvas-utils.js";

function fakeCanvas(width, height) {
  const calls = [];
  const context = {
    calls,
    fillRect(...args) {
      calls.push(["fillRect", ...args]);
    },
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
  };
  return {
    width: 0,
    height: 0,
    context,
    getBoundingClientRect: () => ({ width, height }),
    getContext: () => context,
  };
}

test("canvas resizing applies pixel ratio", () => {
  const canvas = fakeCanvas(100.9, 50.4);
  assert.deepEqual(resizeCanvasToDisplaySize(canvas, 2), { width: 201, height: 100 });
});

test("contained rendering centers an image and paints background", () => {
  const canvas = fakeCanvas(100, 100);
  renderImageContained(canvas, { width: 200, height: 100 });
  assert.deepEqual(canvas.context.calls[0], ["fillRect", 0, 0, 100, 100]);
  assert.deepEqual(canvas.context.calls[1].slice(2), [0, 25, 100, 50]);
});
