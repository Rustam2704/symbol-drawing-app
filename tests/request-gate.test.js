import assert from "node:assert/strict";
import test from "node:test";

import { createRequestGate } from "../modules/request-gate.js";

test("request gate invalidates and aborts superseded work", () => {
  const gate = createRequestGate();
  const first = gate.begin();
  assert.equal(first.isCurrent(), true);
  const second = gate.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);
  gate.cancel();
  assert.equal(second.signal.aborted, true);
  assert.equal(second.isCurrent(), false);
});
