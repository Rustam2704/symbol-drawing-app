import { loadDeleteTrajectoryFile } from "./delete-trajectory-codec.js";
import { loadDeleteParticleMap } from "./delete-particle-map-codec.js";

export const DELETE_CANVAS_WIDTH = 1000;
export const DELETE_CANVAS_HEIGHT = 1000;
export const DELETE_TRAJECTORY_COUNT = 1000;
export const DELETE_VIDEO_FPS = 60;
export const DELETE_TRAJECTORY_SAMPLE_FRAMES = 61;
export const DELETE_WAVE_FRAME_COUNT = 15;
export const DELETE_WAVE_ELEMENT_COUNT = 1000;
export const DELETE_RANDOM_TIME_SHIFT_SECONDS = 0.1;
export const DELETE_PACKED_TRAJECTORY_BASE = 1024;
export const DELETE_DELAY_CODE_MAX = 63;
export const DELETE_VIDEO_FORWARD_FRAMES = DELETE_TRAJECTORY_SAMPLE_FRAMES;
export const DELETE_VIDEO_FORWARD_END = (DELETE_VIDEO_FORWARD_FRAMES - 1) / DELETE_VIDEO_FPS;

// An erase point performs a vertex fetch, a trajectory texture lookup and a
// fragment write. A clear pixel is a single framebuffer operation. Once the
// weighted point cost reaches a full surface clear, clearing is cheaper.
const POINT_ERASE_COST = 4;
const CLEAR_PIXEL_COST = 1;

export function shouldUseFullDeleteClear(particleCount, width, height) {
  return particleCount * POINT_ERASE_COST >= width * height * CLEAR_PIXEL_COST;
}

const VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_position;
  attribute vec4 a_color;
  attribute float a_particle_data;
  uniform vec2 u_resolution;
  uniform float u_point_size;
  uniform float u_frame;
  uniform float u_frame_count;
  uniform float u_trajectory_count;
  uniform float u_delay_code_max;
  uniform float u_wave_frame_count;
  uniform float u_texture_width;
  uniform float u_texture_height;
  uniform float u_texture_rows_per_frame;
  uniform sampler2D u_trajectories;
  varying vec4 v_color;
  varying float v_trajectory_alpha;
  void main() {
    float trajectory = mod(a_particle_data, 1024.0);
    float delayCode = floor(a_particle_data / 1024.0);
    float delayFrames = delayCode / u_delay_code_max * u_wave_frame_count;
    float delayedFrame = clamp(u_frame - delayFrames, 0.0, u_frame_count - 1.0);
    float sampledFrame = floor(delayedFrame + 0.5);
    float textureColumn = mod(trajectory, u_texture_width);
    float textureRow = floor(trajectory / u_texture_width)
      + sampledFrame * u_texture_rows_per_frame;
    vec2 trajectoryUv = vec2(
      (textureColumn + 0.5) / u_texture_width,
      (textureRow + 0.5) / u_texture_height
    );
    vec3 encoded = texture2D(u_trajectories, trajectoryUv).rgb;
    vec2 delta = floor(encoded.rg * 255.0 + 0.5) - 128.0;
    vec2 position = a_position + delta;
    vec2 clip = vec2(
      (position.x + 0.5) / u_resolution.x * 2.0 - 1.0,
      1.0 - (position.y + 0.5) / u_resolution.y * 2.0
    );
    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = u_point_size;
    v_color = a_color;
    v_trajectory_alpha = encoded.b;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform float u_erase;
  varying vec4 v_color;
  varying float v_trajectory_alpha;
  void main() {
    gl_FragColor = u_erase > 0.5
      ? vec4(0.0)
      : vec4(v_color.rgb, v_color.a * v_trajectory_alpha);
  }
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Unable to compile trajectory shader");
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Unable to link trajectory shader");
  }
  return program;
}

function configureTexture(gl) {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export function packDeleteTrajectoryTexture(asset, maxTextureSize) {
  const maxRowsPerFrame = Math.floor(maxTextureSize / asset.frameCount);
  if (maxRowsPerFrame < 1) {
    throw new Error("GPU texture size is too small for the delete trajectory frames");
  }
  const width = Math.ceil(asset.trajectoryCount / maxRowsPerFrame);
  const rowsPerFrame = Math.ceil(asset.trajectoryCount / width);
  const height = rowsPerFrame * asset.frameCount;
  if (width > maxTextureSize || height > maxTextureSize) {
    throw new Error("GPU texture size is too small for the delete trajectory table");
  }
  const bytes = new Uint8Array(width * height * 3);
  for (let frame = 0; frame < asset.frameCount; frame += 1) {
    const sourceStart = frame * asset.trajectoryCount * 3;
    const targetStart = frame * rowsPerFrame * width * 3;
    bytes.set(
      asset.trajectoryBytes.subarray(sourceStart, sourceStart + asset.trajectoryCount * 3),
      targetStart,
    );
  }
  return { bytes, width, height, rowsPerFrame };
}

export function createDeleteParticleData(imageData, originX, originY) {
  const { data, width, height } = imageData;
  let count = 0;
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] !== 0) count += 1;
  }

  const positions = new Uint16Array(count * 2);
  const colors = new Uint8Array(count * 4);
  let particleIndex = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = (y * width + x) * 4;
      if (data[pixelOffset + 3] === 0) continue;
      const sourceX = originX + x;
      const sourceY = originY + y;
      positions[particleIndex * 2] = sourceX;
      positions[particleIndex * 2 + 1] = sourceY;
      colors.set(data.subarray(pixelOffset, pixelOffset + 4), particleIndex * 4);
      particleIndex += 1;
    }
  }
  return { count, positions, colors };
}

function assertExpectedAsset(asset, width, height, trajectoryCount) {
  if (
    asset.width !== width ||
    asset.height !== height ||
    asset.trajectoryCount !== trajectoryCount ||
    asset.frameCount !== DELETE_TRAJECTORY_SAMPLE_FRAMES ||
    asset.fps !== DELETE_VIDEO_FPS
  ) {
    throw new Error("Delete trajectory asset does not match the renderer constants");
  }
}

export function createDeleteTrajectoryRenderer({
  canvas,
  assetUrl,
  mapUrl,
  logicalWidth = DELETE_CANVAS_WIDTH,
  logicalHeight = DELETE_CANVAS_HEIGHT,
  trajectoryCount = DELETE_TRAJECTORY_COUNT,
  fetchImpl = fetch,
}) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL is required for the delete animation");
  if (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1) {
    throw new Error("Vertex textures are required for the delete animation");
  }

  const program = createProgram(gl);
  gl.useProgram(program);
  gl.uniform2f(
    gl.getUniformLocation(program, "u_resolution"),
    logicalWidth,
    logicalHeight,
  );
  gl.uniform1f(gl.getUniformLocation(program, "u_frame_count"), DELETE_TRAJECTORY_SAMPLE_FRAMES);
  gl.uniform1f(gl.getUniformLocation(program, "u_trajectory_count"), trajectoryCount);
  gl.uniform1f(gl.getUniformLocation(program, "u_delay_code_max"), DELETE_DELAY_CODE_MAX);
  gl.uniform1f(gl.getUniformLocation(program, "u_wave_frame_count"), DELETE_WAVE_FRAME_COUNT);
  gl.uniform1i(gl.getUniformLocation(program, "u_trajectories"), 0);
  const frameUniform = gl.getUniformLocation(program, "u_frame");
  const eraseUniform = gl.getUniformLocation(program, "u_erase");
  const pointSizeUniform = gl.getUniformLocation(program, "u_point_size");
  const positionAttribute = gl.getAttribLocation(program, "a_position");
  const colorAttribute = gl.getAttribLocation(program, "a_color");
  const particleDataAttribute = gl.getAttribLocation(program, "a_particle_data");
  gl.enableVertexAttribArray(positionAttribute);
  gl.enableVertexAttribArray(colorAttribute);
  gl.enableVertexAttribArray(particleDataAttribute);

  const trajectoryTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, trajectoryTexture);
  configureTexture(gl);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA,
  );

  let asset = null;
  let particleMap = null;
  let loadError = null;
  const gpuEffects = new Map();
  let previousFrames = [];
  const pointSizeRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);

  function updatePointSize() {
    const logicalScale = Math.min(
      canvas.width / logicalWidth,
      canvas.height / logicalHeight,
    );
    const pointSize = Math.max(
      pointSizeRange[0],
      Math.min(pointSizeRange[1], logicalScale),
    );
    gl.useProgram(program);
    gl.uniform1f(pointSizeUniform, pointSize);
  }

  updatePointSize();

  const ready = Promise.all([
    loadDeleteTrajectoryFile(assetUrl, fetchImpl),
    loadDeleteParticleMap(mapUrl, fetchImpl),
  ])
    .then(([loadedAsset, loadedMap]) => {
      assertExpectedAsset(loadedAsset, logicalWidth, logicalHeight, trajectoryCount);
      if (
        loadedMap.width !== logicalWidth
        || loadedMap.height !== logicalHeight
        || loadedMap.trajectoryCount !== trajectoryCount
        || loadedMap.delayCodeMax !== DELETE_DELAY_CODE_MAX
      ) {
        throw new Error("Delete particle map does not match the renderer constants");
      }
      asset = loadedAsset;
      particleMap = loadedMap;
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      const packed = packDeleteTrajectoryTexture(asset, maxTextureSize);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, trajectoryTexture);
      gl.uniform1f(gl.getUniformLocation(program, "u_texture_width"), packed.width);
      gl.uniform1f(gl.getUniformLocation(program, "u_texture_height"), packed.height);
      gl.uniform1f(
        gl.getUniformLocation(program, "u_texture_rows_per_frame"),
        packed.rowsPerFrame,
      );
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGB,
        packed.width,
        packed.height,
        0,
        gl.RGB,
        gl.UNSIGNED_BYTE,
        packed.bytes,
      );
      for (const effect of gpuEffects.values()) uploadParticleData(effect);
      return loadedAsset;
    })
    .catch((error) => {
      loadError = error;
      throw error;
    });

  function deleteBuffers(effect) {
    if (!effect) return;
    gl.deleteBuffer(effect.positionBuffer);
    gl.deleteBuffer(effect.colorBuffer);
    gl.deleteBuffer(effect.particleDataBuffer);
  }

  function uploadParticleData(effect) {
    if (!particleMap) return;
    const values = new Uint16Array(effect.count);
    for (let index = 0; index < effect.count; index += 1) {
      const x = effect.positions[index * 2];
      const y = effect.positions[index * 2 + 1];
      values[index] = particleMap.particleValues[y * logicalWidth + x];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, effect.particleDataBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
  }

  function setEffectParticles(id, particles) {
    deleteBuffers(gpuEffects.get(id));
    const effect = {
      count: particles.count,
      positions: particles.positions,
      positionBuffer: gl.createBuffer(),
      colorBuffer: gl.createBuffer(),
      particleDataBuffer: gl.createBuffer(),
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, effect.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particles.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, effect.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particles.colors, gl.STATIC_DRAW);
    uploadParticleData(effect);
    gpuEffects.set(id, effect);
  }

  function removeEffect(id) {
    deleteBuffers(gpuEffects.get(id));
    gpuEffects.delete(id);
  }

  function bindEffect(effect) {
    gl.bindBuffer(gl.ARRAY_BUFFER, effect.positionBuffer);
    gl.vertexAttribPointer(positionAttribute, 2, gl.UNSIGNED_SHORT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, effect.colorBuffer);
    gl.vertexAttribPointer(colorAttribute, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, effect.particleDataBuffer);
    gl.vertexAttribPointer(particleDataAttribute, 1, gl.UNSIGNED_SHORT, false, 0, 0);
  }

  function drawCommands(commands, erase) {
    gl.uniform1f(eraseUniform, erase ? 1 : 0);
    for (const command of commands) {
      const effect = gpuEffects.get(command.id);
      if (!effect?.count) continue;
      gl.uniform1f(frameUniform, command.frame);
      bindEffect(effect);
      gl.drawArrays(gl.POINTS, 0, effect.count);
    }
  }

  function drawEffects(commands) {
    if (!asset) return false;
    const normalized = commands.map((command) => ({
      id: command.id,
      frame: Math.max(0, Math.min(asset.frameCount - 1, Math.round(command.frame))),
    }));
    const previousParticleCount = previousFrames.reduce(
      (total, command) => total + (gpuEffects.get(command.id)?.count || 0),
      0,
    );
    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (shouldUseFullDeleteClear(previousParticleCount, canvas.width, canvas.height)) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else if (previousFrames.length) {
      gl.disable(gl.BLEND);
      drawCommands(previousFrames, true);
      gl.enable(gl.BLEND);
    }
    drawCommands(normalized, false);
    previousFrames = normalized;
    return true;
  }

  function clear() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    previousFrames = [];
  }

  function resize(displayWidth, displayHeight, pixelRatio = 1) {
    // Keep the complete logical particle field and downscale only the finished
    // canvas. Rasterizing 1000 logical points into fewer framebuffer pixels
    // aliases neighboring points into a stable moire grid.
    const nextWidth = Math.max(logicalWidth, Math.round(displayWidth * pixelRatio));
    const nextHeight = Math.max(logicalHeight, Math.round(displayHeight * pixelRatio));
    if (canvas.width === nextWidth && canvas.height === nextHeight) return false;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    updatePointSize();
    clear();
    return true;
  }

  function getStatus() {
    if (loadError) return "failed";
    return asset && particleMap ? "ready" : "loading";
  }

  return { clear, drawEffects, getStatus, ready, removeEffect, resize, setEffectParticles };
}
