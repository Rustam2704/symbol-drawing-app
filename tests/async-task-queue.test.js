import assert from "node:assert/strict";
import test from "node:test";

import { createAsyncTaskQueue } from "../modules/async-task-queue.js";

test("async queue limits concurrency and drains in order", async () => {
  const queue = createAsyncTaskQueue({ concurrency: 2 });
  const releases = [];
  let running = 0;
  let maxRunning = 0;
  const tasks = [1, 2, 3].map((value) => queue.run(() => new Promise((resolve) => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    releases.push(() => {
      running -= 1;
      resolve(value);
    });
  })));
  await Promise.resolve();
  assert.equal(queue.activeCount, 2);
  assert.equal(queue.pendingCount, 1);
  releases.shift()();
  await new Promise((resolve) => setTimeout(resolve, 0));
  releases.splice(0).forEach((release) => release());
  assert.deepEqual(await Promise.all(tasks), [1, 2, 3]);
  assert.equal(maxRunning, 2);
});

test("async queue rejects pending work when cleared", async () => {
  const queue = createAsyncTaskQueue({ concurrency: 1 });
  let release;
  const active = queue.run(() => new Promise((resolve) => { release = resolve; }));
  const pending = queue.run(() => 2);
  await Promise.resolve();
  queue.clear();
  await assert.rejects(pending, { name: "AbortError" });
  release(1);
  assert.equal(await active, 1);
});
