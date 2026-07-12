import assert from "node:assert/strict";
import test from "node:test";

import { createSettingsStore } from "../modules/app-settings.js";

test("settings store persists valid preferences", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const settings = createSettingsStore(storage);
  settings.writeBoolean("swapped", true);
  settings.writeTheme("violet");
  assert.equal(settings.readBoolean("swapped"), true);
  assert.equal(settings.readTheme(), "violet");
});

test("settings store falls back safely when storage fails", () => {
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  const settings = createSettingsStore(storage);
  assert.equal(settings.readTheme(), "current");
  assert.equal(settings.readBoolean("swapped"), false);
  assert.doesNotThrow(() => settings.writeTheme("dark"));
});

test("unknown themes resolve to current", () => {
  const settings = createSettingsStore({ getItem: () => "unknown", setItem() {} });
  assert.equal(settings.readTheme(), "current");
});
