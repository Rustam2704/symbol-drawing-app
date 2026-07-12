import assert from "node:assert/strict";
import test from "node:test";

import {
  clampPointToRect,
  fitFileCropPreview,
  fitImagePreview,
  imageCropToPreviewRect,
  imageSquareToPreviewRect,
  makeCenteredSquare,
  makeRect,
  previewRectToImageCrop,
  previewSquareToImageCrop,
} from "../modules/crop-geometry.js";

test("image crop round-trips through preview coordinates", () => {
  const preview = fitImagePreview({ width: 1000, height: 500 }, { width: 600, height: 400 }, 20);
  const crop = { x: 100, y: 50, width: 400, height: 200 };
  assert.deepEqual(previewRectToImageCrop(imageCropToPreviewRect(crop, preview), preview), crop);
});

test("file crop square round-trips through padded preview", () => {
  const preview = fitFileCropPreview({ width: 500, height: 300 }, { width: 800, height: 600 }, 40, 24);
  const crop = { x: -20, y: 10, width: 320, height: 320 };
  assert.deepEqual(previewSquareToImageCrop(imageSquareToPreviewRect(crop, preview), preview), crop);
});

test("selection helpers clamp and normalize geometry", () => {
  const bounds = { x: 10, y: 20, width: 100, height: 80 };
  assert.deepEqual(clampPointToRect({ x: -5, y: 200 }, bounds), { x: 10, y: 100 });
  assert.deepEqual(makeRect({ x: 8, y: 9 }, { x: 2, y: 4 }), { x: 2, y: 4, width: 6, height: 5 });
  const square = makeCenteredSquare({ x: 60, y: 60 }, 200, bounds, 8);
  assert.deepEqual(square, { x: 20, y: 20, width: 80, height: 80 });
});
