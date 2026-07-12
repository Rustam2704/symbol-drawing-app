import assert from "node:assert/strict";
import test from "node:test";

import { createImageCropService } from "../modules/image-crop-service.js";

function fakeDocument() {
  const canvases = [];
  return {
    canvases,
    createElement() {
      const calls = [];
      const context = {
        calls,
        drawImage(...args) {
          calls.push(["drawImage", ...args]);
        },
        fillRect(...args) {
          calls.push(["fillRect", ...args]);
        },
        getImageData() {
          return { data: new Uint8ClampedArray(16) };
        },
      };
      const canvas = {
        width: 0,
        height: 0,
        context,
        getContext: () => context,
        toDataURL: (type = "image/png", quality) => `${type}:${quality ?? ""}`,
      };
      canvases.push(canvas);
      return canvas;
    },
  };
}

test("crop service reads source pixels", () => {
  const documentRef = fakeDocument();
  const service = createImageCropService({ documentRef });
  const result = service.readPixels({ width: 2, height: 2 });
  assert.equal(result.data.length, 16);
  assert.deepEqual([result.width, result.height], [2, 2]);
});

test("crop service pads out-of-bounds JPEG crops and preserves format", () => {
  const documentRef = fakeDocument();
  const service = createImageCropService({ documentRef });
  const result = service.cropToDataUrl(
    { width: 100, height: 80 },
    { x: -10, y: 5, width: 50, height: 50 },
    "image.jpg",
  );
  assert.equal(result, "image/jpeg:0.96");
  assert.equal(documentRef.canvases[0].context.calls[0][0], "fillRect");
  assert.deepEqual(documentRef.canvases[0].context.calls[1].slice(2, 6), [0, 5, 40, 50]);
});
