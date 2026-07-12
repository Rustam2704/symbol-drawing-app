export function findAutoCropBox({ data, width, height, padding = 0 }) {
  if (!width || !height || data.length < width * height * 4) {
    return null;
  }

  const samples = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4,
  ];
  const transparentCorners = samples.filter((index) => data[index + 3] < 16).length >= 2;
  const background = samples.reduce(
    (acc, index) => {
      acc.r += data[index];
      acc.g += data[index + 1];
      acc.b += data[index + 2];
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );
  background.r /= samples.length;
  background.g /= samples.length;
  background.b /= samples.length;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      let isForeground = alpha >= 16;
      if (!transparentCorners) {
        if (alpha < 16) continue;
        const distance =
          Math.abs(data[index] - background.r) +
          Math.abs(data[index + 1] - background.g) +
          Math.abs(data[index + 2] - background.b);
        isForeground = distance >= 72;
      }
      if (!isForeground) continue;
      found = true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!found) return null;

  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const maxSide = Math.min(width + padding * 2, height + padding * 2);
  const side = Math.min(Math.max(contentWidth, contentHeight) * 1.18, maxSide);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    x: Math.round(Math.min(Math.max(centerX - side / 2, -padding), width + padding - side)),
    y: Math.round(Math.min(Math.max(centerY - side / 2, -padding), height + padding - side)),
    width: Math.round(side),
    height: Math.round(side),
  };
}
