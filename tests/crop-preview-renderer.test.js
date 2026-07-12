import assert from "node:assert/strict";
import test from "node:test";

import { renderAreaCropPreview, renderFileCropPreview } from "../modules/crop-preview-renderer.js";

function recordingContext() {
  const calls = [];
  const context = { calls };
  for (const method of [
    "beginPath", "clearRect", "clip", "drawImage", "fillRect", "lineTo", "moveTo", "rect", "restore", "save", "stroke", "strokeRect",
  ]) {
    context[method] = (...args) => calls.push([method, ...args]);
  }
  return context;
}

test("area preview draws base image and selected region", () => {
  const context = recordingContext();
  renderAreaCropPreview({
    canvas: { width: 200, height: 100 },
    context,
    image: { width: 100, height: 50 },
    preview: { x: 10, y: 10, width: 180, height: 90, scale: 1.8 },
    selection: { x: 20, y: 20, width: 50, height: 40 },
    pixelRatio: 2,
  });
  assert.equal(context.calls.filter(([name]) => name === "drawImage").length, 2);
  assert.ok(context.calls.some(([name]) => name === "strokeRect"));
});

test("file preview skips selection overlay when selection is absent", () => {
  const context = recordingContext();
  renderFileCropPreview({
    canvas: { width: 200, height: 100 },
    context,
    image: { width: 100, height: 50 },
    preview: { x: 10, y: 10, scale: 1, space: { x: -20, y: -20 } },
    selection: null,
    pixelRatio: 1,
  });
  assert.equal(context.calls.filter(([name]) => name === "drawImage").length, 1);
  assert.equal(context.calls.some(([name]) => name === "strokeRect"), false);
});
