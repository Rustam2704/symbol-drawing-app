import assert from "node:assert/strict";
import test from "node:test";

import { createDeleteEffectController } from "../modules/delete-effect-controller.js";
import { DELETE_VIDEO_FORWARD_FRAMES } from "../modules/delete-trajectory-renderer.js";

function createHarness() {
  let frameCallback;
  let currentNode = { id: 1, strokes: [] };
  let strokes = [];
  let strokeDraws = 0;
  let finishCalls = 0;
  const draws = [];
  const buffers = new Map();
  const renderer = {
    clear() {},
    drawEffects(commands) {
      draws.push(commands.map((command) => ({ ...command })));
      return true;
    },
    getStatus() { return "ready"; },
    removeEffect(id) { buffers.delete(id); },
    setEffectParticles(id, particles) { buffers.set(id, particles); },
  };
  const cloneStrokes = (value) => value.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }));
  const controller = createDeleteEffectController({
    cancelFrame() {},
    cloneStrokes,
    drawStrokes() { strokeDraws += 1; },
    getCurrentHistoryNode: () => currentNode,
    onFinish() { finishCalls += 1; },
    renderer,
    requestFrame(callback) { frameCallback = callback; return 1; },
    setStrokes(value) { strokes = value; },
  });
  return {
    buffers,
    controller,
    draws,
    get frameCallback() { return frameCallback; },
    get finishCalls() { return finishCalls; },
    get strokeDraws() { return strokeDraws; },
    get strokes() { return strokes; },
    set currentNode(node) { currentNode = node; },
  };
}

const particles = () => ({
  count: 2,
  positions: new Uint16Array([1, 1, 2, 2]),
  colors: new Uint8Array(8),
  trajectories: new Uint8Array(2),
});

test("reverse playback uses every second recorded frame", () => {
  const harness = createHarness();
  const deleteNode = { id: 2, kind: "delete" };
  const targetNode = { id: 1, strokes: [{ points: [{ x: 5, y: 5 }] }] };
  harness.currentNode = targetNode;

  assert.equal(harness.controller.start(deleteNode, particles()), true);
  harness.frameCallback(0);
  harness.frameCallback(17);
  assert.equal(harness.draws.at(-1)[0].frame, 1);

  assert.equal(harness.controller.undo(deleteNode, targetNode, false), true);
  harness.frameCallback(34);
  harness.frameCallback(51);
  assert.equal(harness.draws.at(-2)[0].frame, 0);
  assert.equal(harness.strokes[0].points[0].x, 5);
  assert.equal(harness.strokeDraws, 1);
  assert.equal(harness.controller.isActive(), false);
});

test("sequential deletes animate independently in one RAF loop", () => {
  const harness = createHarness();
  const first = { id: 2, kind: "delete" };
  const second = { id: 4, kind: "delete" };
  harness.controller.start(first, particles());
  harness.frameCallback(0);
  harness.frameCallback(34);
  harness.controller.start(second, particles());

  const simultaneous = harness.draws.at(-1);
  assert.equal(simultaneous.length, 2);
  assert.ok(simultaneous[0].frame > simultaneous[1].frame);

  harness.frameCallback(51);
  harness.frameCallback(68);
  const advanced = harness.draws.at(-1);
  assert.equal(advanced.length, 2);
  assert.ok(advanced[0].frame > advanced[1].frame);
});

test("Delete during Undo reverses the existing effect without rebuilding particles", () => {
  const harness = createHarness();
  const originalDelete = { id: 2, kind: "delete" };
  const targetNode = { id: 1, strokes: [{ points: [{ x: 3, y: 3 }] }] };
  const sourceParticles = particles();
  harness.currentNode = targetNode;
  harness.controller.start(originalDelete, sourceParticles);
  harness.frameCallback(0);
  harness.frameCallback(100);
  harness.controller.undo(originalDelete, targetNode, false);
  harness.frameCallback(117);
  harness.frameCallback(134);
  const reverseFrame = harness.draws.at(-1)[0].frame;

  assert.equal(harness.controller.canRestartDelete(targetNode.id), true);
  const replacementDelete = { id: 3, kind: "delete" };
  assert.equal(harness.controller.restartDelete(targetNode.id, replacementDelete), true);
  assert.equal(replacementDelete.deleteEffect.particles, sourceParticles);
  assert.equal(harness.draws.at(-1)[0].frame, reverseFrame);

  harness.frameCallback(151);
  harness.frameCallback(168);
  assert.ok(harness.draws.at(-1)[0].frame > reverseFrame);
  assert.equal(harness.buffers.size, 1);
});

test("delete animation waits while its trajectory file is loading", () => {
  let frameCallback;
  const renderer = {
    drawEffects() { throw new Error("must not draw before loading"); },
    getStatus() { return "loading"; },
    removeEffect() {},
    setEffectParticles() {},
  };
  const controller = createDeleteEffectController({
    cloneStrokes: (value) => value,
    drawStrokes() {},
    getCurrentHistoryNode: () => ({ id: 1 }),
    renderer,
    requestFrame(callback) { frameCallback = callback; return 1; },
    setStrokes() {},
  });
  controller.start({ id: 2 }, particles());
  frameCallback(100);
  assert.equal(typeof frameCallback, "function");
});

test("completed forward animation reaches the final stored frame", () => {
  const harness = createHarness();
  harness.controller.start({ id: 2 }, particles());
  harness.frameCallback(0);
  for (let timestamp = 17; timestamp <= 1_050 && harness.controller.isActive(); timestamp += 17) {
    harness.frameCallback(timestamp);
  }
  const renderedFrames = harness.draws.flat().map((command) => command.frame);
  assert.ok(renderedFrames.includes(DELETE_VIDEO_FORWARD_FRAMES - 1));
  assert.equal(harness.finishCalls, 1);
});
