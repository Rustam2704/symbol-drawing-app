export function createPdfService({ pdfLibrary, workerSrc, canvasToImage }) {
  if (pdfLibrary && workerSrc) {
    pdfLibrary.GlobalWorkerOptions.workerSrc = workerSrc;
  }

  function requireLibrary() {
    if (!pdfLibrary) {
      throw new Error("PDF support did not load. Check your internet connection and reload.");
    }
    return pdfLibrary;
  }

  async function renderPageCanvas(documentProxy, pageNumber, scale = 1) {
    const page = await documentProxy.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  }

  async function renderPage(documentProxy, pageNumber) {
    const canvas = await renderPageCanvas(documentProxy, pageNumber, 2);
    return canvasToImage(canvas);
  }

  async function readBuffer(buffer) {
    const documentProxy = await requireLibrary().getDocument({ data: buffer }).promise;
    return {
      documentProxy,
      image: await renderPage(documentProxy, 1),
      pageCount: documentProxy.numPages,
    };
  }

  async function readFile(file) {
    return readBuffer(await file.arrayBuffer());
  }

  return { readBuffer, readFile, renderPage, renderPageCanvas };
}
