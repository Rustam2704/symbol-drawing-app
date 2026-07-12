export function createMediaLoader({
  ImageClass = globalThis.Image,
  FileReaderClass = globalThis.FileReader,
} = {}) {
  function fromSource(source) {
    return new Promise((resolve, reject) => {
      const image = new ImageClass();
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => reject(new Error("Could not load image.")), { once: true });
      image.src = source;
    });
  }

  function fromCanvas(canvas) {
    return fromSource(canvas.toDataURL("image/png"));
  }

  function fromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReaderClass();
      reader.addEventListener(
        "load",
        async () => {
          try {
            resolve(await fromSource(reader.result));
          } catch (error) {
            reject(error);
          }
        },
        { once: true },
      );
      reader.addEventListener("error", () => reject(new Error("Could not read image.")), { once: true });
      reader.readAsDataURL(file);
    });
  }

  return { fromCanvas, fromFile, fromSource };
}
