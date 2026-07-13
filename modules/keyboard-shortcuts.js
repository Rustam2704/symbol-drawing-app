export function isEditableTarget(target) {
  const tagName = String(target?.tagName || "").toLowerCase();
  return ["input", "textarea", "select"].includes(tagName) || Boolean(target?.isContentEditable);
}

export function createKeyboardShortcutHandler({ onClear, onUndo }) {
  return function handleKeyboardShortcut(event) {
    if (event.repeat || isEditableTarget(event.target)) return;

    const key = String(event.key || "");
    if ((event.ctrlKey || event.metaKey) && event.code === "KeyZ" && !event.shiftKey) {
      event.preventDefault();
      onUndo();
      return;
    }
    if (key === "Delete") {
      event.preventDefault();
      onClear();
    } else if (key === "Backspace") {
      event.preventDefault();
      onUndo();
    }
  };
}
