import assert from "node:assert/strict";
import test from "node:test";

import {
  canCropSourceItem,
  createApiUrl,
  createVersionedImageUrl,
  findLibraryItemForFile,
  getFolderFromSelectedFile,
  getLibraryItemKey,
  parseDirectoryListing,
  sortLibraryItems,
} from "../modules/library-utils.js";

test("createApiUrl encodes values and preserves numeric zero", () => {
  assert.equal(
    createApiUrl("/api/file", { name: "你 好.png", page: 0 }, "http://localhost:5173"),
    "/api/file?name=%E4%BD%A0+%E5%A5%BD.png&page=0",
  );
});

test("library item identity and cache versions include crop revisions", () => {
  const item = { name: "symbol.png", folder: "images", url: "/api/file?name=symbol.png", mtime: 2, size: 3 };
  const revisions = new Map([[getLibraryItemKey(item), 4]]);
  assert.equal(getLibraryItemKey(item), "images\\symbol.png");
  assert.equal(createVersionedImageUrl(item, revisions), "/api/file?name=symbol.png&v=2-3-4");
  assert.equal(createVersionedImageUrl({ ...item, source: "browser", url: "blob:1" }, revisions), "blob:1");
});

test("library helpers match files and parse fallback listings", () => {
  const items = [{ type: "image", name: "Symbol.PNG" }];
  assert.equal(findLibraryItemForFile({ name: "symbol.png" }, items), items[0]);
  assert.equal(findLibraryItemForFile({ name: "pages.pdf" }, items), null);

  class Parser {
    parseFromString() {
      return {
        querySelectorAll: () => ["symbol.png", "notes.txt", "pages.pdf"].map((href) => ({
          getAttribute: () => href,
        })),
      };
    }
  }
  const parsed = parseDirectoryListing("", {
    folder: "images",
    createUrl: (path, params) => `${path}?name=${params.name}`,
    Parser,
  });
  assert.deepEqual(parsed.map(({ name, type }) => ({ name, type })), [
    { name: "symbol.png", type: "image" },
    { name: "pages.pdf", type: "pdf" },
  ]);
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
