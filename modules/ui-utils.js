export function calculateRangePercent({ min = 0, max = 100, value }) {
  const numericMin = Number(min) || 0;
  const numericMax = Number(max) || 100;
  const numericValue = Number(value);
  if (numericMax === numericMin) return 0;
  return Math.max(0, Math.min(100, ((numericValue - numericMin) / (numericMax - numericMin)) * 100));
}

export function normalizeColor(color) {
  return String(color || "").trim().toLowerCase();
}

export function shortenMiddle(text, maxWidth, measureText) {
  if (!text || measureText(text) <= maxWidth) return text;

  let low = 2;
  let high = text.length - 1;
  let best = `${text.slice(0, 1)}...${text.slice(-1)}`;
  while (low <= high) {
    const visibleCount = Math.floor((low + high) / 2);
    const headLength = Math.max(1, Math.ceil(visibleCount * 0.45));
    const tailLength = Math.max(1, visibleCount - headLength);
    const candidate = `${text.slice(0, headLength)}...${text.slice(-tailLength)}`;
    if (measureText(candidate) <= maxWidth) {
      best = candidate;
      low = visibleCount + 1;
    } else {
      high = visibleCount - 1;
    }
  }
  return best;
}
