const BACKGROUND = "#f8f6f0";
const OVERLAY = "rgba(32, 33, 36, 0.36)";
const ACCENT = "#237c6b";

function clearPreview(canvas, context) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

export function renderAreaCropPreview({ canvas, context, image, preview, selection, pixelRatio }) {
  clearPreview(canvas, context);
  context.drawImage(image, preview.x, preview.y, preview.width, preview.height);
  if (!selection) return;

  context.save();
  context.fillStyle = OVERLAY;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    (selection.x - preview.x) / preview.scale,
    (selection.y - preview.y) / preview.scale,
    selection.width / preview.scale,
    selection.height / preview.scale,
    selection.x,
    selection.y,
    selection.width,
    selection.height,
  );
  context.strokeStyle = ACCENT;
  context.lineWidth = 3 * pixelRatio;
  context.strokeRect(selection.x, selection.y, selection.width, selection.height);
  context.restore();
}

export function renderFileCropPreview({ canvas, context, image, preview, selection, pixelRatio }) {
  clearPreview(canvas, context);
  const imageRect = {
    x: preview.x - preview.space.x * preview.scale,
    y: preview.y - preview.space.y * preview.scale,
    width: image.width * preview.scale,
    height: image.height * preview.scale,
  };
  context.drawImage(image, imageRect.x, imageRect.y, imageRect.width, imageRect.height);
  if (!selection) return;

  context.save();
  context.fillStyle = OVERLAY;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.beginPath();
  context.rect(selection.x, selection.y, selection.width, selection.height);
  context.clip();
  context.drawImage(image, imageRect.x, imageRect.y, imageRect.width, imageRect.height);
  context.restore();

  context.save();
  context.strokeStyle = ACCENT;
  context.lineWidth = 3 * pixelRatio;
  context.strokeRect(selection.x, selection.y, selection.width, selection.height);
  const centerX = selection.x + selection.width / 2;
  const centerY = selection.y + selection.height / 2;
  context.strokeStyle = "rgba(35, 124, 107, 0.65)";
  context.lineWidth = 1.5 * pixelRatio;
  context.beginPath();
  context.moveTo(centerX - 8, centerY);
  context.lineTo(centerX + 8, centerY);
  context.moveTo(centerX, centerY - 8);
  context.lineTo(centerX, centerY + 8);
  context.stroke();
  context.restore();
}
