export function fitImagePreview(image, canvas, padding) {
  const availableWidth = Math.max(1, canvas.width - padding * 2);
  const availableHeight = Math.max(1, canvas.height - padding * 2);
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
    scale,
  };
}

export function imageCropToPreviewRect(crop, preview) {
  if (!crop || !preview) {
    return null;
  }
  return {
    x: preview.x + crop.x * preview.scale,
    y: preview.y + crop.y * preview.scale,
    width: crop.width * preview.scale,
    height: crop.height * preview.scale,
  };
}

export function clampPointToRect(point, rect) {
  return {
    x: Math.min(Math.max(point.x, rect.x), rect.x + rect.width),
    y: Math.min(Math.max(point.y, rect.y), rect.y + rect.height),
  };
}

export function makeRect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function previewRectToImageCrop(rect, preview) {
  return {
    x: Math.round((rect.x - preview.x) / preview.scale),
    y: Math.round((rect.y - preview.y) / preview.scale),
    width: Math.round(rect.width / preview.scale),
    height: Math.round(rect.height / preview.scale),
  };
}

export function fitFileCropPreview(image, canvas, outerPadding, canvasPadding) {
  const space = {
    x: -outerPadding,
    y: -outerPadding,
    width: image.width + outerPadding * 2,
    height: image.height + outerPadding * 2,
  };
  const preview = fitImagePreview(space, canvas, canvasPadding);
  return { ...preview, space };
}

export function makeCenteredSquare(center, side, preview, minimumSide) {
  const maxSide = Math.min(
    preview.width,
    preview.height,
    (center.x - preview.x) * 2,
    (preview.x + preview.width - center.x) * 2,
    (center.y - preview.y) * 2,
    (preview.y + preview.height - center.y) * 2,
  );
  const squareSide = Math.max(minimumSide, Math.min(side, maxSide));
  return {
    x: center.x - squareSide / 2,
    y: center.y - squareSide / 2,
    width: squareSide,
    height: squareSide,
  };
}

export function previewSquareToImageCrop(rect, preview) {
  const x = Math.round((rect.x - preview.x) / preview.scale + preview.space.x);
  const y = Math.round((rect.y - preview.y) / preview.scale + preview.space.y);
  const side = Math.round(rect.width / preview.scale);
  return { x, y, width: side, height: side };
}

export function imageSquareToPreviewRect(crop, preview) {
  return {
    x: preview.x + (crop.x - preview.space.x) * preview.scale,
    y: preview.y + (crop.y - preview.space.y) * preview.scale,
    width: crop.width * preview.scale,
    height: crop.height * preview.scale,
  };
}
