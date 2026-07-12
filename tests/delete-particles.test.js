import assert from "node:assert/strict";
import test from "node:test";

import { createDeleteMotionMap, packDeleteParticles } from "../modules/delete-particles.js";

test("motion maps are deterministic for a canvas size", () => {
  const first = createDeleteMotionMap({ width: 8, height: 4, pixelRatio: 1 });
  const second = createDeleteMotionMap({ width: 8, height: 4, pixelRatio: 1 });
  assert.equal(first.key, second.key);
  assert.deepEqual(first.velocityX, second.velocityX);
  assert.deepEqual(first.duration, second.duration);
});

test("particle packing keeps occupied pixels and deduplicates colors", () => {
  const motionMap = createDeleteMotionMap({ width: 4, height: 2, pixelRatio: 1 });
  const rgba = new Uint8ClampedArray(motionMap.columns * motionMap.rows * 4);
  rgba.set([10, 20, 30, 255], 0);
  rgba.set([10, 20, 30, 128], 4);
  const particles = packDeleteParticles(rgba, motionMap);
  assert.equal(particles.count, 2);
  assert.deepEqual(particles.palette, ["rgb(10 20 30)"]);
  assert.deepEqual([...particles.sx], [0, motionMap.particleSize]);
});
