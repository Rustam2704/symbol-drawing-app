import assert from "node:assert/strict";
import test from "node:test";

import { createPdfService } from "../modules/pdf-service.js";

test("PDF service loads, renders, and disposes documents", async () => {
  let destroyed = false;
  const documentProxy = {
    numPages: 2,
    async getPage() {
      return {
        getViewport: ({ scale }) => ({ width: 100 * scale, height: 50 * scale }),
        render: () => ({ promise: Promise.resolve() }),
      };
    },
    destroy() {
      destroyed = true;
    },
  };
  const pdfLibrary = {
    GlobalWorkerOptions: {},
    getDocument: () => ({ promise: Promise.resolve(documentProxy) }),
  };
  const service = createPdfService({
    pdfLibrary,
    workerSrc: "worker.js",
    canvasToImage: async (canvas) => ({ width: canvas.width, height: canvas.height }),
    documentRef: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({}),
      }),
    },
  });
  const result = await service.readBuffer(new ArrayBuffer(1));
  assert.equal(pdfLibrary.GlobalWorkerOptions.workerSrc, "worker.js");
  assert.equal(result.pageCount, 2);
  assert.deepEqual(result.image, { width: 200, height: 100 });
  service.disposeDocument(documentProxy);
  assert.equal(destroyed, true);
});
