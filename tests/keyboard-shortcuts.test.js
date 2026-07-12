import assert from "node:assert/strict";
import test from "node:test";

import { createKeyboardShortcutHandler, isEditableTarget } from "../modules/keyboard-shortcuts.js";

function keyboardEvent(key, overrides = {}) {
  let prevented = false;
  return {
    key,
    target: { tagName: "CANVAS" },
    preventDefault() {
      prevented = true;
    },
    get prevented() {
      return prevented;
    },
    ...overrides,
  };
}

test("keyboard shortcuts route clear and undo commands", () => {
  const actions = [];
  const handler = createKeyboardShortcutHandler({
    onClear: () => actions.push("clear"),
    onUndo: () => actions.push("undo"),
  });
  const deleteEvent = keyboardEvent("Delete");
  const backspaceEvent = keyboardEvent("Backspace");
  const ctrlZEvent = keyboardEvent("z", { ctrlKey: true });
  handler(deleteEvent);
  handler(backspaceEvent);
  handler(ctrlZEvent);
  assert.deepEqual(actions, ["clear", "undo", "undo"]);
  assert.equal(deleteEvent.prevented, true);
  assert.equal(ctrlZEvent.prevented, true);
});

test("keyboard shortcuts ignore editing and repeated events", () => {
  let actions = 0;
  const handler = createKeyboardShortcutHandler({ onClear: () => actions++, onUndo: () => actions++ });
  handler(keyboardEvent("Delete", { target: { tagName: "INPUT" } }));
  handler(keyboardEvent("Backspace", { repeat: true }));
  assert.equal(actions, 0);
  assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
});
