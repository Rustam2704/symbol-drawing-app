import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserFiles } from "../web/browser-files.js";

test("browser file scans filter entries and release object URLs", async () => {
  const revoked = [];
  let nextUrl = 0;
  const files = [
    { kind: "file", name: "symbol.png", getFile: async () => ({ name: "symbol.png", type: "image/png", size: 3 }) },
    { kind: "file", name: "notes.txt", getFile: async () => ({ name: "notes.txt" }) },
  ];
  const directory = {
    name: "practice",
    async *values() {
      yield* files;
    },
  };
  const browserFiles = createBrowserFiles({
    windowRef: { showDirectoryPicker: async () => directory },
    documentRef: {},
    urlApi: {
      createObjectURL: () => `blob:${++nextUrl}`,
      revokeObjectURL: (url) => revoked.push(url),
    },
  });

  const first = await browserFiles.chooseFolder();
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].url, "blob:1");
  await browserFiles.scan();
  assert.deepEqual(revoked, ["blob:1"]);
  browserFiles.dispose();
  assert.deepEqual(revoked, ["blob:1", "blob:2"]);
  assert.equal(browserFiles.isActive(), false);
});
