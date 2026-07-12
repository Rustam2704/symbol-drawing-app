import assert from "node:assert/strict";
import test from "node:test";

import { createFrameScheduler } from "../modules/frame-scheduler.js";

test("frame scheduler coalesces work and supports cancellation", () => {
  const callbacks = [];
  const cancelled = [];
  let runs = 0;
  const scheduler = createFrameScheduler(() => runs++, {
    requestFrame(callback) {
      callbacks.push(callback);
      return callbacks.length;
    },
    cancelFrame: (id) => cancelled.push(id),
  });
  scheduler.schedule();
  scheduler.schedule();
  assert.equal(callbacks.length, 1);
  callbacks[0]();
  assert.equal(runs, 1);
  scheduler.schedule();
  scheduler.cancel();
  assert.deepEqual(cancelled, [2]);
});
