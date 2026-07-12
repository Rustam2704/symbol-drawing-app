import assert from "node:assert/strict";
import test from "node:test";

import { cloneStrokes, createHistory } from "../modules/history.js";

function stroke(x) {
  return [{ type: "freehand", color: "#000000", points: [{ x, y: x, pressure: 0.5 }] }];
}

test("cloneStrokes creates independent point data", () => {
  const original = stroke(1);
  const copy = cloneStrokes(original);
  copy[0].points[0].x = 99;
  assert.equal(original[0].points[0].x, 1);
});

test("history keeps only the configured number of undo actions", () => {
  const history = createHistory({ limit: 20 });
  for (let index = 1; index <= 25; index += 1) {
    history.record("draw", stroke(index));
  }

  let undoCount = 0;
  while (history.canUndo) {
    history.undo();
    undoCount += 1;
  }
  assert.equal(undoCount, 20);
});

test("recorded snapshots do not change when source strokes mutate", () => {
  const history = createHistory();
  const strokes = stroke(3);
  const node = history.record("draw", strokes);
  strokes[0].points[0].x = 10;
  assert.equal(node.strokes[0].points[0].x, 3);
});
