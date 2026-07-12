import assert from "node:assert/strict";
import test from "node:test";

import { createDeleteEffectController } from "../modules/delete-effect-controller.js";

function particles() {
  return {
    count: 1,
    size: 2,
    sx: new Float32Array([1]),
    sy: new Float32Array([2]),
    vx: new Float32Array([0]),
    vy: new Float32Array([0]),
    duration: new Float32Array([0.05]),
    colorIndex: new Uint16Array([0]),
    palette: ["rgb(1 2 3)"],
    maxDuration: 0.05,
  };
}

test("delete controller owns forward and reverse animation lifecycle", () => {
  let frameCallback;
  let currentNode = { id: 1, strokes: [] };
  let strokes = [{ points: [{ x: 1, y: 1 }] }];
  let fills = 0;
  const context = {
    globalAlpha: 1,
    fillStyle: "",
    fillRect() {
      fills += 1;
    },
  };
  const cloneStrokes = (value) => value.map((stroke) => ({ ...stroke, points: stroke.points.map((p) => ({ ...p })) }));
  const controller = createDeleteEffectController({
    context,
    cloneStrokes,
    drawScene() {},
    getCurrentHistoryNode: () => currentNode,
    requestFrame(callback) {
      frameCallback = callback;
      return 1;
    },
    setStrokes(value) {
      strokes = value;
    },
  });
  const deleteNode = { id: 2, kind: "delete" };
  assert.equal(controller.start(deleteNode, particles()), true);
  assert.ok(deleteNode.deleteEffect);
  frameCallback(0);
  frameCallback(100);
  assert.ok(fills > 0);
  assert.equal(context.globalAlpha, 1);

  const targetNode = { id: 1, strokes: [{ points: [{ x: 5, y: 5 }] }] };
  currentNode = targetNode;
  assert.equal(controller.undo(deleteNode, targetNode, false), true);
  assert.deepEqual(strokes, []);
  frameCallback(200);
  frameCallback(300);
  assert.equal(strokes[0].points[0].x, 5);
});
