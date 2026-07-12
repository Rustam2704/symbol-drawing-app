import assert from "node:assert/strict";
import test from "node:test";

import {
  canCropSourceItem,
  createApiUrl,
  getFolderFromSelectedFile,
  sortLibraryItems,
} from "../modules/library-utils.js";

test("createApiUrl encodes values and preserves numeric zero", () => {
  assert.equal(
    createApiUrl("/api/file", { name: "你 好.png", page: 0 }, "http://localhost:5173"),
    "/api/file?name=%E4%BD%A0+%E5%A5%BD.png&page=0",
  );
});

test("library sorting is immutable and deterministic", () => {
  const items = [
    { name: "page10.png", mtime: 1 },
    { name: "page2.png", mtime: 2 },
  ];
  assert.deepEqual(sortLibraryItems(items, "name").map((item) => item.name), ["page2.png", "page10.png"]);
  assert.deepEqual(items.map((item) => item.name), ["page10.png", "page2.png"]);
  assert.deepEqual(sortLibraryItems(items, "date").map((item) => item.name), ["page2.png", "page10.png"]);
});

test("file helpers accept crop images and extract Windows folders", () => {
  assert.equal(canCropSourceItem({ type: "image", name: "symbol.webp" }), true);
  assert.equal(canCropSourceItem({ type: "pdf", name: "symbol.pdf" }), false);
  assert.equal(getFolderFromSelectedFile({ path: "D:\\images\\symbol.png" }), "D:\\images");
});
