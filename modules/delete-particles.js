function deterministicNoise(index, salt) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function createDeleteMotionMap({ width, height, pixelRatio }) {
  const particleSize = Math.max(2, Math.round(pixelRatio * 1.35));
  const columns = Math.ceil(width / particleSize);
  const rows = Math.ceil(height / particleSize);
  const cellCount = columns * rows;
  const velocityX = new Float32Array(cellCount);
  const velocityY = new Float32Array(cellCount);
  const duration = new Float32Array(cellCount);

  for (let index = 0; index < cellCount; index += 1) {
    const angle = deterministicNoise(index, 1) * Math.PI * 2;
    const velocity = (42 + deterministicNoise(index, 2) * 42) * pixelRatio * 0.2;
    velocityX[index] = Math.cos(angle) * velocity;
    velocityY[index] = Math.sin(angle) * velocity;
    duration[index] = (0.7 + deterministicNoise(index, 3) * 0.8) / 2;
  }

  return {
    key: `${width}x${height}:${particleSize}`,
    particleSize,
    columns,
    rows,
    velocityX,
    velocityY,
    duration,
  };
}

export function packDeleteParticles(rgba, motionMap) {
  const cellCount = motionMap.columns * motionMap.rows;
  let particleCount = 0;
  for (let index = 0; index < cellCount; index += 1) {
    if (rgba[index * 4 + 3] > 0) particleCount += 1;
  }

  const sx = new Float32Array(particleCount);
  const sy = new Float32Array(particleCount);
  const vx = new Float32Array(particleCount);
  const vy = new Float32Array(particleCount);
  const duration = new Float32Array(particleCount);
  const colorIndex = new Uint16Array(particleCount);
  const colors = new Map();
  const palette = [];
  let particleIndex = 0;
  let maxDuration = 0;

  for (let index = 0; index < cellCount; index += 1) {
    if (rgba[index * 4 + 3] === 0) continue;
    const red = rgba[index * 4];
    const green = rgba[index * 4 + 1];
    const blue = rgba[index * 4 + 2];
    const colorKey = (red << 16) | (green << 8) | blue;
    if (!colors.has(colorKey)) {
      colors.set(colorKey, palette.length);
      palette.push(`rgb(${red} ${green} ${blue})`);
    }
    sx[particleIndex] = (index % motionMap.columns) * motionMap.particleSize;
    sy[particleIndex] = Math.floor(index / motionMap.columns) * motionMap.particleSize;
    vx[particleIndex] = motionMap.velocityX[index];
    vy[particleIndex] = motionMap.velocityY[index];
    duration[particleIndex] = motionMap.duration[index];
    colorIndex[particleIndex] = colors.get(colorKey);
    maxDuration = Math.max(maxDuration, duration[particleIndex]);
    particleIndex += 1;
  }

  return {
    count: particleCount,
    size: motionMap.particleSize,
    sx,
    sy,
    vx,
    vy,
    duration,
    colorIndex,
    palette,
    maxDuration,
  };
}
