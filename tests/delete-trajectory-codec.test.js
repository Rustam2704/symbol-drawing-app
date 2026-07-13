import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { decodeDeleteTrajectoryFile } from "../modules/delete-trajectory-codec.js";
import {
  createDeleteParticleData,
  packDeleteTrajectoryTexture,
  shouldUseFullDeleteClear,
} from "../modules/delete-trajectory-renderer.js";

test("DTV2 loads the active 1000-trajectory asset", async () => {
  const file = await readFile(new URL(
    "../assets/delete-trajectories-1000x1000-1000-js-wave-shift-010s.dtv",
    import.meta.url,
  ));
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const asset = decodeDeleteTrajectoryFile(buffer);

  assert.equal(asset.width, 1000);
  assert.equal(asset.height, 1000);
  assert.equal(asset.trajectoryCount, 1000);
  assert.equal(asset.frameCount, 61);
  assert.equal(asset.fps, 60);
  assert.equal(file.byteLength, 16 + 1000 * 61 * 3);
});

test("particle compaction keeps only non-transparent RGBA pixels", () => {
  const imageData = {
    width: 3,
    height: 2,
    data: new Uint8ClampedArray([
      10, 20, 30, 255, 0, 0, 0, 0, 40, 50, 60, 128,
      0, 0, 0, 0, 70, 80, 90, 1, 0, 0, 0, 0,
    ]),
  };
  const particles = createDeleteParticleData(imageData, 100, 200, 7);

  assert.equal(particles.count, 3);
  assert.deepEqual([...particles.positions], [100, 200, 102, 200, 101, 201]);
  assert.deepEqual([...particles.colors], [10, 20, 30, 255, 40, 50, 60, 128, 70, 80, 90, 1]);
});

test("compact delete decoder rejects a bad signature", () => {
  const buffer = new ArrayBuffer(16);
  assert.throws(() => decodeDeleteTrajectoryFile(buffer), /invalid signature/);
});

test("RGB trajectory texture packing preserves every frame with padded rows", () => {
  const asset = {
    trajectoryCount: 5,
    frameCount: 2,
    trajectoryBytes: new Uint8Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    ]),
  };
  const packed = packDeleteTrajectoryTexture(asset, 4);

  assert.equal(packed.width, 3);
  assert.equal(packed.rowsPerFrame, 2);
  assert.equal(packed.height, 4);
  assert.equal(packed.width * 3 % 4, 1);
  assert.deepEqual([...packed.bytes.subarray(0, 15)], [...asset.trajectoryBytes.subarray(0, 15)]);
  assert.deepEqual([...packed.bytes.subarray(18, 33)], [...asset.trajectoryBytes.subarray(15)]);
});

test("full clear starts when weighted point erasure reaches the framebuffer cost", () => {
  assert.equal(shouldUseFullDeleteClear(249_999, 1000, 1000), false);
  assert.equal(shouldUseFullDeleteClear(250_000, 1000, 1000), true);
});
