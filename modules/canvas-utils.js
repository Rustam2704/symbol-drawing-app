export function resizeCanvasToDisplaySize(canvas, pixelRatio = 1) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * pixelRatio));
  const height = Math.max(1, Math.floor(rect.height * pixelRatio));
  canvas.width = width;
  canvas.height = height;
  return { width, height };
}

export function fillCanvas(canvas, color) {
  const context = canvas.getContext("2d");
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return context;
}

export function renderImageContained(canvas, source, { pixelRatio = 1, background = "#102024" } = {}) {
  resizeCanvasToDisplaySize(canvas, pixelRatio);
  const context = fillCanvas(canvas, background);
  const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
}
