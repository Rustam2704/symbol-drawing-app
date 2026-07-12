import assert from "node:assert/strict";
import test from "node:test";

import { createLibraryApi } from "../modules/library-api.js";

function response({ ok = true, status = 200, json, text = "", buffer = new ArrayBuffer(0) }) {
  return {
    ok,
    status,
    async json() {
      if (json instanceof Error) throw json;
      return json;
    },
    async text() {
      return text;
    },
    async arrayBuffer() {
      return buffer;
    },
  };
}

test("listImages delegates URL creation and returns JSON", async () => {
  const calls = [];
  const api = createLibraryApi({
    createUrl: (path, params) => `${path}?dir=${params.dir}`,
    fetchImpl: async (...args) => {
      calls.push(args);
      return response({ json: { folder: "images", items: [] } });
    },
  });
  assert.deepEqual(await api.listImages("images"), { folder: "images", items: [] });
  assert.equal(calls[0][0], "/api/images?dir=images");
  assert.deepEqual(calls[0][1], { cache: "no-store" });
});

test("cropImage sends JSON and surfaces server errors", async () => {
  let request;
  const api = createLibraryApi({
    createUrl: () => "",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response({ ok: false, status: 400, json: { ok: false, error: "Bad crop" } });
    },
  });
  await assert.rejects(
    api.cropImage({ folder: "images", name: "a.png", dataUrl: "data:image/png;base64,AA==" }),
    /Bad crop/,
  );
  assert.equal(request.url, "/api/crop-image");
  assert.equal(JSON.parse(request.options.body).name, "a.png");
});
