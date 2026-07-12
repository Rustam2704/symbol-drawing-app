import assert from "node:assert/strict";
import test from "node:test";

import { createMediaLoader } from "../modules/media-loader.js";

class FakeImage {
  listeners = new Map();
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
  set src(value) {
    this.source = value;
    queueMicrotask(() => this.listeners.get(value === "bad" ? "error" : "load")?.());
  }
}

class FakeReader {
  listeners = new Map();
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
  readAsDataURL(file) {
    this.result = file.result;
    queueMicrotask(() => this.listeners.get(file.fail ? "error" : "load")?.());
  }
}

test("media loader resolves image sources and canvases", async () => {
  const loader = createMediaLoader({ ImageClass: FakeImage, FileReaderClass: FakeReader });
  assert.equal((await loader.fromSource("image-data")).source, "image-data");
  assert.equal((await loader.fromCanvas({ toDataURL: () => "canvas-data" })).source, "canvas-data");
});

test("media loader reads files and normalizes failures", async () => {
  const loader = createMediaLoader({ ImageClass: FakeImage, FileReaderClass: FakeReader });
  assert.equal((await loader.fromFile({ result: "file-data" })).source, "file-data");
  await assert.rejects(loader.fromSource("bad"), /Could not load image/);
  await assert.rejects(loader.fromFile({ fail: true }), /Could not read image/);
});
