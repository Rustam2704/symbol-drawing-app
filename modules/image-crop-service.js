export function createImageCropService({ documentRef = document } = {}) {
  function readPixels(image) {
    const canvas = documentRef.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);
    return {
      data: context.getImageData(0, 0, canvas.width, canvas.height).data,
      width: canvas.width,
      height: canvas.height,
    };
  }

  function cropToDataUrl(image, crop, filename = "") {
    const output = documentRef.createElement("canvas");
    const context = output.getContext("2d");
    output.width = crop.width;
    output.height = crop.height;
    const extension = filename.split(".").pop()?.toLowerCase();

    if (extension === "jpg" || extension === "jpeg") {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, output.width, output.height);
    }

    const sourceX = Math.max(0, crop.x);
    const sourceY = Math.max(0, crop.y);
    const sourceRight = Math.min(image.width, crop.x + crop.width);
    const sourceBottom = Math.min(image.height, crop.y + crop.height);
    const sourceWidth = Math.max(0, sourceRight - sourceX);
    const sourceHeight = Math.max(0, sourceBottom - sourceY);
    if (sourceWidth > 0 && sourceHeight > 0) {
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        sourceX - crop.x,
        sourceY - crop.y,
        sourceWidth,
        sourceHeight,
      );
    }

    if (extension === "jpg" || extension === "jpeg") return output.toDataURL("image/jpeg", 0.96);
    if (extension === "webp") return output.toDataURL("image/webp", 0.96);
    return output.toDataURL("image/png");
  }

  return { cropToDataUrl, readPixels };
}
