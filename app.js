import { getStroke } from "./vendor/perfect-freehand-package/package/dist/esm/index.mjs";

import { browserFiles } from "./web/browser-files.js";
import { createAudioEffects } from "./modules/audio-effects.js";
import { fillCanvas, renderImageContained, resizeCanvasToDisplaySize } from "./modules/canvas-utils.js";
import { createSettingsStore, THEME_COLORS } from "./modules/app-settings.js";
import { findAutoCropBox as findContentCropBox } from "./modules/auto-crop.js";
import {
  clampPointToRect,
  fitFileCropPreview,
  fitImagePreview,
  imageCropToPreviewRect,
  imageSquareToPreviewRect,
  makeCenteredSquare,
  makeRect,
  previewRectToImageCrop,
  previewSquareToImageCrop,
} from "./modules/crop-geometry.js";
import { renderAreaCropPreview, renderFileCropPreview } from "./modules/crop-preview-renderer.js";
import { createDeleteMotionMap, packDeleteParticles } from "./modules/delete-particles.js";
import { createDeleteEffectController } from "./modules/delete-effect-controller.js";
import { cloneStrokes, createHistory } from "./modules/history.js";
import {
  canCropSourceItem,
  createApiUrl as apiUrl,
  createVersionedImageUrl,
  findLibraryItemForFile,
  getFolderFromSelectedFile,
  getLibraryItemKey,
  parseDirectoryListing,
  sortLibraryItems,
} from "./modules/library-utils.js";
import { createLibraryApi } from "./modules/library-api.js";
import { createLibraryRenderer } from "./modules/library-renderer.js";
import { createMediaLoader } from "./modules/media-loader.js";
import { createImageCropService } from "./modules/image-crop-service.js";
import { createPdfService } from "./modules/pdf-service.js";
import { createRequestGate } from "./modules/request-gate.js";
import { createSpriteAnimation } from "./modules/sprite-animation.js";
import { calculateRangePercent, normalizeColor, shortenMiddle } from "./modules/ui-utils.js";

const appShell = document.querySelector(".app-shell");
const canvas = document.querySelector("#practiceCanvas");
const context = canvas.getContext("2d");
const clearButton = document.querySelector("#clearButton");
const gauntletCanvas = document.querySelector("#gauntletAnimation");
const undoButton = document.querySelector("#undoButton");
const timeGauntletCanvas = document.querySelector("#timeGauntletAnimation");
const swapMenuButton = document.querySelector("#swapMenuButton");
const currentThemeButton = document.querySelector("#currentThemeButton");
const darkThemeButton = document.querySelector("#darkThemeButton");
const violetThemeButton = document.querySelector("#violetThemeButton");
const sunsetThemeButton = document.querySelector("#sunsetThemeButton");
const chooseFileButton = document.querySelector("#chooseFileButton");
const penSizeInput = document.querySelector("#penSize");
const backgroundOpacityInput = document.querySelector("#backgroundOpacity");
const backgroundScaleInput = document.querySelector("#backgroundScale");
const penSizeValue = document.querySelector("#penSizeValue");
const backgroundOpacityValue = document.querySelector("#backgroundOpacityValue");
const backgroundScaleValue = document.querySelector("#backgroundScaleValue");
const gridToggle = document.querySelector("#gridToggle");
const backgroundToggle = document.querySelector("#backgroundToggle");
const pointerModeButton = document.querySelector("#pointerModeButton");
const handModeButton = document.querySelector("#handModeButton");
const brushModeButton = document.querySelector("#brushModeButton");
const cropButton = document.querySelector("#cropButton");
const fileCropButton = document.querySelector("#fileCropButton");
const cropDialog = document.querySelector("#cropDialog");
const cropCanvas = document.querySelector("#cropCanvas");
const cropContext = cropCanvas.getContext("2d");
const applyCropButton = document.querySelector("#applyCropButton");
const resetCropButton = document.querySelector("#resetCropButton");
const closeCropButton = document.querySelector("#closeCropButton");
const fileCropDialog = document.querySelector("#fileCropDialog");
const fileCropCanvas = document.querySelector("#fileCropCanvas");
const fileCropContext = fileCropCanvas.getContext("2d");
const closeFileCropButton = document.querySelector("#closeFileCropButton");
const autoCropButton = document.querySelector("#autoCropButton");
const applyFileCropButton = document.querySelector("#applyFileCropButton");
const libraryTitle = document.querySelector("#libraryTitle");
const folderPathInput = document.querySelector("#folderPathInput");
const libraryList = document.querySelector("#libraryList");
const refreshLibraryButton = document.querySelector("#refreshLibraryButton");
const sortByDateButton = document.querySelector("#sortByDateButton");
const sortByNameButton = document.querySelector("#sortByNameButton");
const pressureModeButton = document.querySelector("#pressureModeButton");
const colorSwatches = Array.from(document.querySelectorAll(".color-swatch[data-color-index]"));
const colorPickerButton = document.querySelector("#colorPickerButton");
const colorPickerInput = document.querySelector("#colorPickerInput");
const rangeInputs = Array.from(document.querySelectorAll('input[type="range"]'));

const GAUNTLET_FRAME_SIZE = 80;
const GAUNTLET_FRAME_COUNT = 48;
const GAUNTLET_FRAME_DURATION = 10;
const gauntletAnimation = createSpriteAnimation({
  canvas: gauntletCanvas,
  source: "./assets/thanos_snap.png",
  frameSize: GAUNTLET_FRAME_SIZE,
  frameCount: GAUNTLET_FRAME_COUNT,
  frameDuration: GAUNTLET_FRAME_DURATION,
});
const timeGauntletAnimation = createSpriteAnimation({
  canvas: timeGauntletCanvas,
  source: "./assets/thanos_time.png",
  frameSize: GAUNTLET_FRAME_SIZE,
  frameCount: GAUNTLET_FRAME_COUNT,
  frameDuration: GAUNTLET_FRAME_DURATION,
});
const { playPreparedDeleteSound, playReverseSound, stopDeleteSounds } = createAudioEffects({
  deleteRate: 2,
  reverseRate: 2,
});

const settings = createSettingsStore();

const state = {
  drawing: false,
  panning: false,
  lastPoint: null,
  lastPanPoint: null,
  strokes: [],
  activeStroke: null,
  backgroundImage: null,
  crop: null,
  pdfDocument: null,
  pdfPage: 1,
  pdfPageCount: 0,
  backgroundTransparency: Number(backgroundOpacityInput.value),
  backgroundScale: Number(backgroundScaleInput.value),
  showGrid: true,
  showBackground: true,
  penSize: Number(penSizeInput.value),
  backgroundOffsetX: 0,
  backgroundOffsetY: 0,
  toolMode: "pointer",
  libraryItems: [],
  librarySort: "date",
  libraryMode: "folder",
  libraryFolder: "",
  fileSource: "local",
  pdfPages: [],
  sourceItem: null,
  cropRevisions: new Map(),
  penColor: "#1f1d1a",
  recentColors: ["#1f1d1a", "#237c6b", "#b3342d"],
  theme: settings.readTheme(),
  menusSwapped: settings.readBoolean("symbolPracticeMenusSwapped"),
};

const history = createHistory({ limit: 20 });

function recordHistory(kind) {
  const node = history.record(kind, state.strokes);
  updateUndoButton();
  return node;
}

const FILE_CROP_PADDING = 40;

const cropState = {
  selecting: false,
  previewRect: null,
  startPoint: null,
  selection: null,
};

const fileCropState = {
  selecting: false,
  previewRect: null,
  centerPoint: null,
  selection: null,
};

function getPdfLibrary() {
  return (
    globalThis.pdfjsLib ||
    (typeof window !== "undefined" ? window.pdfjsLib : null) ||
    document.defaultView?.pdfjsLib
  );
}

function fitCanvasToContainer() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));

  if (canvas.width === width && canvas.height === height) {
    return;
  }

  canvas.width = width;
  canvas.height = height;
  deleteMotionMap = null;
  drawScene();
  const prepareMotionMap = () => getDeleteMotionMap();
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(prepareMotionMap, { timeout: 500 });
  } else {
    window.setTimeout(prepareMotionMap, 0);
  }
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const ratioX = canvas.width / rect.width;
  const ratioY = canvas.height / rect.height;
  const pressure = event.pressure && event.pressure > 0 ? event.pressure : 0.55;

  return {
    x: (event.clientX - rect.left) * ratioX,
    y: (event.clientY - rect.top) * ratioY,
    pressure,
    size: state.penSize * (0.7 + pressure * 0.45) * (window.devicePixelRatio || 1),
  };
}

function clearCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawPaper() {
  const themeColors = THEME_COLORS[state.theme];
  context.fillStyle = themeColors.paper;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
  if (!state.showGrid) {
    return;
  }

  const themeColors = THEME_COLORS[state.theme];
  const shortSide = Math.min(canvas.width, canvas.height);
  const step = Math.max(36, Math.floor(shortSide / 8));
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  context.save();
  context.strokeStyle = themeColors.grid;
  context.lineWidth = 1;
  context.beginPath();

  for (let x = centerX % step; x < canvas.width; x += step) {
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
  }

  for (let y = centerY % step; y < canvas.height; y += step) {
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
  }
  context.stroke();

  context.strokeStyle = themeColors.guide;
  context.beginPath();
  context.moveTo(centerX, 0);
  context.lineTo(centerX, canvas.height);
  context.moveTo(0, centerY);
  context.lineTo(canvas.width, centerY);
  context.stroke();

  context.strokeStyle = themeColors.margin;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(canvas.width, canvas.height);
  context.moveTo(canvas.width, 0);
  context.lineTo(0, canvas.height);
  context.stroke();
  context.restore();
}

function drawBackgroundImage() {
  if (!state.backgroundImage || !state.showBackground) {
    return;
  }

  const image = state.backgroundImage;
  const crop = state.crop || { x: 0, y: 0, width: image.width, height: image.height };
  const scale = Math.min(canvas.width / crop.width, canvas.height / crop.height) * state.backgroundScale;
  const width = crop.width * scale;
  const height = crop.height * scale;
  const x = (canvas.width - width) / 2 + state.backgroundOffsetX;
  const y = (canvas.height - height) / 2 + state.backgroundOffsetY;

  context.save();
  context.globalAlpha = 1 - state.backgroundTransparency;
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, x, y, width, height);
  context.restore();
}

function drawStroke(stroke) {
  if (stroke.type === "freehand" || stroke.type === "brush" || stroke.type === "pressure") {
    drawFreehandStroke(stroke);
    return;
  }

  if (stroke.points.length < 2) {
    drawDot(stroke.points[0], stroke.color);
    return;
  }

  for (let index = 1; index < stroke.points.length; index += 1) {
    drawSegment(stroke.points[index - 1], stroke.points[index], stroke.color);
  }
}

function drawFreehandStroke(stroke) {
  if (!stroke.points.length) {
    return;
  }

  const baseSize = Math.max(1, stroke.size || state.penSize * (window.devicePixelRatio || 1));
  const options = getFreehandOptions(stroke.type, baseSize);
  const inputPoints = stroke.points.map((point) => [point.x, point.y, point.pressure || 0.5]);
  const outline = getStroke(inputPoints, options);

  context.save();
  context.fillStyle = stroke.color;
  context.beginPath();
  outline.forEach(([x, y], index) => {
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.closePath();
  context.fill();
  context.restore();
}

function getFreehandOptions(type, size) {
  if (type === "pressure") {
    return {
      size,
      thinning: 0.72,
      smoothing: 0.58,
      streamline: 0.5,
      simulatePressure: false,
      start: { taper: 0, cap: true },
      end: { taper: 0, cap: true },
    };
  }

  if (type === "brush") {
    return {
      size: size * 1.28,
      thinning: 0.82,
      smoothing: 0.68,
      streamline: 0.62,
      simulatePressure: true,
      start: { taper: size * 0.8, cap: true },
      end: { taper: size * 1.4, cap: true },
    };
  }

  return {
    size,
    thinning: 0.45,
    smoothing: 0.52,
    streamline: 0.45,
    simulatePressure: true,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
  };
}

function drawSegment(prev, point, color) {
  context.save();
  context.strokeStyle = color;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = (prev.size + point.size) / 2;
  context.beginPath();
  context.moveTo(prev.x, prev.y);
  context.lineTo(point.x, point.y);
  context.stroke();
  context.restore();
}

function drawDot(point, color) {
  context.beginPath();
  context.fillStyle = color;
  context.arc(point.x, point.y, point.size / 2, 0, Math.PI * 2);
  context.fill();
}

function drawStrokes() {
  state.strokes.forEach(drawStroke);
}

function drawScene() {
  clearCanvas();
  drawPaper();
  drawBackgroundImage();
  drawGrid();
  drawStrokes();
}

let scheduledSceneFrame = null;

function scheduleSceneDraw() {
  if (scheduledSceneFrame !== null) return;
  scheduledSceneFrame = requestAnimationFrame(() => {
    scheduledSceneFrame = null;
    drawScene();
  });
}

let deleteMotionMap = null;
const deleteMaskCanvas = document.createElement("canvas");
const deleteMaskContext = deleteMaskCanvas.getContext("2d", { willReadFrequently: true });

function getDeleteMotionMap() {
  const pixelRatio = window.devicePixelRatio || 1;
  const particleSize = Math.max(2, Math.round(pixelRatio * 1.35));
  const key = `${canvas.width}x${canvas.height}:${particleSize}`;
  if (deleteMotionMap?.key === key) {
    return deleteMotionMap;
  }
  deleteMotionMap = createDeleteMotionMap({ width: canvas.width, height: canvas.height, pixelRatio });
  return deleteMotionMap;
}

function drawStrokeMask(maskContext, stroke, particleSize) {
  const scale = 1 / particleSize;
  maskContext.save();
  maskContext.fillStyle = stroke.color;
  maskContext.strokeStyle = stroke.color;

  if (stroke.type === "freehand" || stroke.type === "brush" || stroke.type === "pressure") {
    const baseSize = Math.max(1, stroke.size || state.penSize * (window.devicePixelRatio || 1));
    const outline = getStroke(
      stroke.points.map((point) => [point.x, point.y, point.pressure || 0.5]),
      getFreehandOptions(stroke.type, baseSize),
    );
    maskContext.beginPath();
    outline.forEach(([x, y], index) => {
      if (index === 0) maskContext.moveTo(x * scale, y * scale);
      else maskContext.lineTo(x * scale, y * scale);
    });
    maskContext.closePath();
    maskContext.fill();
  } else if (stroke.points.length === 1) {
    const point = stroke.points[0];
    maskContext.beginPath();
    maskContext.arc(point.x * scale, point.y * scale, point.size * scale / 2, 0, Math.PI * 2);
    maskContext.fill();
  } else {
    maskContext.lineCap = "round";
    maskContext.lineJoin = "round";
    maskContext.beginPath();
    stroke.points.forEach((point, index) => {
      if (index === 0) maskContext.moveTo(point.x * scale, point.y * scale);
      else maskContext.lineTo(point.x * scale, point.y * scale);
    });
    maskContext.lineWidth = Math.max(...stroke.points.map((point) => point.size)) * scale;
    maskContext.stroke();
  }
  maskContext.restore();
}

function createDeleteParticles(strokes) {
  const motionMap = getDeleteMotionMap();
  if (deleteMaskCanvas.width !== motionMap.columns || deleteMaskCanvas.height !== motionMap.rows) {
    deleteMaskCanvas.width = motionMap.columns;
    deleteMaskCanvas.height = motionMap.rows;
  } else {
    deleteMaskContext.clearRect(0, 0, deleteMaskCanvas.width, deleteMaskCanvas.height);
  }
  strokes.forEach((stroke) => drawStrokeMask(deleteMaskContext, stroke, motionMap.particleSize));
  const rgba = deleteMaskContext.getImageData(
    0,
    0,
    deleteMaskCanvas.width,
    deleteMaskCanvas.height,
  ).data;
  return packDeleteParticles(rgba, motionMap);
}

const deleteEffects = createDeleteEffectController({
  context,
  cloneStrokes,
  drawScene,
  getCurrentHistoryNode: () => history.current,
  getPixelRatio: () => window.devicePixelRatio || 1,
  setStrokes: (strokes) => {
    state.strokes = strokes;
  },
});

function deleteAllStrokes() {
  deleteEffects.settleReassembly();
  if (!state.strokes.length) {
    return;
  }

  playPreparedDeleteSound();
  gauntletAnimation.play();

  if (state.drawing) {
    state.drawing = false;
    state.activeStroke = null;
    state.lastPoint = null;
    recordHistory("draw");
  }

  // Redraw without active dust before capturing the vector strokes for this deletion.
  drawScene();
  const deletedStrokes = cloneStrokes(state.strokes);
  state.strokes = [];
  const deleteHistoryNode = recordHistory("delete");
  drawScene();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    updateUndoButton();
    return;
  }

  updateUndoButton();
  deleteEffects.start(deleteHistoryNode, createDeleteParticles(deletedStrokes));
}

function updateUndoButton() {
  undoButton.disabled = !history.canUndo;
}

function updateRangeValues() {
  penSizeValue.textContent = `${state.penSize.toFixed(1)} px`;
  backgroundOpacityValue.textContent = `${(state.backgroundTransparency * 100).toFixed(1)}%`;
  backgroundScaleValue.textContent = `${state.backgroundScale.toFixed(1)}x`;
}

function updateRangeFill(input) {
  input.style.setProperty("--range-progress", `${calculateRangePercent(input)}%`);
}

function updateColorPalette() {
  colorSwatches.forEach((button, index) => {
    const color = state.recentColors[index] || "#1f1d1a";
    button.style.backgroundColor = color;
    button.classList.toggle("active", color === state.penColor);
    button.setAttribute("aria-label", `Use ${color}`);
  });
  colorPickerInput.value = state.penColor;
}

function setPenColor(color) {
  const nextColor = normalizeColor(color);
  if (!/^#[0-9a-f]{6}$/.test(nextColor)) {
    return;
  }

  state.penColor = nextColor;
  if (!state.recentColors.includes(nextColor)) {
    state.recentColors = [nextColor, ...state.recentColors].slice(0, 3);
  }
  updateColorPalette();
}

function updateToggleButtons() {
  gridToggle.classList.toggle("active", state.showGrid);
  backgroundToggle.classList.toggle("active", state.showBackground);
  gridToggle.setAttribute("aria-pressed", String(state.showGrid));
  backgroundToggle.setAttribute("aria-pressed", String(state.showBackground));
}

function updateMenuSwap() {
  appShell.classList.toggle("menus-swapped", state.menusSwapped);
  swapMenuButton.classList.toggle("active", state.menusSwapped);
  swapMenuButton.setAttribute("aria-pressed", String(state.menusSwapped));
}

function setTheme(theme, { updatePen = true } = {}) {
  state.theme = THEME_COLORS[theme] ? theme : "current";
  document.documentElement.dataset.theme = state.theme;
  [[currentThemeButton, "current"], [darkThemeButton, "dark"], [violetThemeButton, "violet"], [sunsetThemeButton, "sunset"]]
    .forEach(([button, buttonTheme]) => {
      const isActive = state.theme === buttonTheme;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

  settings.writeTheme(state.theme);

  if (updatePen) {
    const colors = THEME_COLORS[state.theme].pens;
    state.recentColors = colors;
    setPenColor(colors[0]);
  }
  drawScene();
}

function setToolMode(mode) {
  state.toolMode = mode;
  pointerModeButton.classList.toggle("active", mode === "pointer");
  handModeButton.classList.toggle("active", mode === "hand");
  brushModeButton.classList.toggle("active", mode === "brush");
  pressureModeButton.classList.toggle("active", mode === "pressure");
  pointerModeButton.setAttribute("aria-pressed", String(mode === "pointer"));
  handModeButton.setAttribute("aria-pressed", String(mode === "hand"));
  brushModeButton.setAttribute("aria-pressed", String(mode === "brush"));
  pressureModeButton.setAttribute("aria-pressed", String(mode === "pressure"));
  updateCanvasCursor(false);
}

function updateCanvasCursor(isPanning) {
  if (state.toolMode === "hand") {
    canvas.style.cursor = "url('./assets/hand-cursor.svg') 16 19, grab";
    return;
  }

  if (state.toolMode === "pressure") {
    canvas.style.cursor = "url('./assets/stylus-cursor.svg') 2 2, crosshair";
    return;
  }

  if (state.toolMode === "brush") {
    canvas.style.cursor = "url('./assets/calligraphy-brush-cursor.svg') 5 3, crosshair";
    return;
  }

  canvas.style.cursor = "crosshair";
}

function updateFileCropButton() {
  const browserReadOnly = state.fileSource === "browser" && !browserFiles.canWrite();
  fileCropButton.disabled = !state.backgroundImage || !canCropSourceItem(state.sourceItem) || browserReadOnly;
}

function getFolderPathTextWidth(text) {
  const measuringCanvas = getFolderPathTextWidth.canvas || document.createElement("canvas");
  getFolderPathTextWidth.canvas = measuringCanvas;
  const measuringContext = measuringCanvas.getContext("2d");
  measuringContext.font = window.getComputedStyle(folderPathInput).font;
  return measuringContext.measureText(text).width;
}

function updateFolderPathDisplay(forceFull = false) {
  const fullPath = state.libraryFolder || "";
  folderPathInput.title = fullPath;

  if (forceFull || document.activeElement === folderPathInput) {
    folderPathInput.value = fullPath;
    return;
  }

  const style = window.getComputedStyle(folderPathInput);
  const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const availableWidth = Math.max(20, (folderPathInput.clientWidth || 120) - horizontalPadding + 11);
  folderPathInput.value = shortenMiddle(fullPath, availableWidth, getFolderPathTextWidth);
}

function setLibraryMode(mode) {
  state.libraryMode = mode;
  const isPdf = mode === "pdf";
  libraryTitle.textContent = isPdf ? "Pages" : "Images";
  sortByDateButton.disabled = isPdf;
  sortByNameButton.disabled = isPdf;
  folderPathInput.disabled = false;
  refreshLibraryButton.disabled = false;
}

function undoLastStroke() {
  deleteEffects.settleReassembly();
  if (!history.canUndo) {
    return;
  }

  timeGauntletAnimation.play();
  playReverseSound();
  const { undoneNode, targetNode } = history.undo();
  if (undoneNode.kind === "delete") {
    stopDeleteSounds();
  }
  const effectHandled = deleteEffects.undo(
    undoneNode,
    targetNode,
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  if (!effectHandled) {
    state.strokes = cloneStrokes(targetNode.strokes);
  }
  drawScene();
  updateUndoButton();
}

function startDrawing(event) {
  deleteEffects.settleReassembly();
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);

  if (state.toolMode === "hand") {
    state.panning = true;
    state.lastPanPoint = getPoint(event);
    updateCanvasCursor(true);
    return;
  }

  const point = getPoint(event);
  state.drawing = true;
  state.lastPoint = point;
  state.activeStroke = {
    type: state.toolMode === "brush" ? "brush" : state.toolMode === "pressure" ? "pressure" : "freehand",
    color: state.penColor,
    size: state.penSize * (window.devicePixelRatio || 1),
    points: [point],
  };
  state.strokes.push(state.activeStroke);
  if (state.activeStroke.type !== "pen") {
    drawScene();
  } else {
    drawDot(point, state.activeStroke.color);
  }
  updateUndoButton();
}

function continueDrawing(event) {
  if (state.panning && state.lastPanPoint) {
    event.preventDefault();
    const point = getPoint(event);
    state.backgroundOffsetX += point.x - state.lastPanPoint.x;
    state.backgroundOffsetY += point.y - state.lastPanPoint.y;
    state.lastPanPoint = point;
    scheduleSceneDraw();
    return;
  }

  if (!state.drawing || !state.activeStroke) {
    return;
  }

  event.preventDefault();
  const point = getPoint(event);
  const prev = state.lastPoint;
  state.activeStroke.points.push(point);
  state.lastPoint = point;
  if (state.activeStroke.type !== "pen") {
    drawScene();
  } else {
    drawSegment(prev, point, state.activeStroke.color);
  }
}

function stopDrawing(event) {
  if (state.panning) {
    state.panning = false;
    state.lastPanPoint = null;
    updateCanvasCursor(false);
  }

  if (!state.drawing) {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    return;
  }

  state.drawing = false;
  state.lastPoint = null;
  state.activeStroke = null;
  recordHistory("draw");

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

const mediaLoader = createMediaLoader();

const pdfService = createPdfService({
  pdfLibrary: getPdfLibrary(),
  workerSrc: "./vendor/pdf.worker.min.js",
  canvasToImage: mediaLoader.fromCanvas,
});
const libraryApi = createLibraryApi({ createUrl: apiUrl });
const libraryRequestGate = createRequestGate();
const imageCropService = createImageCropService();
const libraryRenderer = createLibraryRenderer({
  container: libraryList,
  getItemUrl: (item) => createVersionedImageUrl(item, state.cropRevisions, state.libraryFolder),
  onSelectItem: loadLibraryItem,
  onSelectPdfPage: setPdfPage,
  renderPdfThumbnail,
});

async function loadImage(file) {
  if (!file) {
    return;
  }

  cropButton.disabled = true;
  state.sourceItem = null;
  updateFileCropButton();

  try {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    let image;

    if (isPdf) {
      const pdfResult = await pdfService.readFile(file);
      image = pdfResult.image;
      state.pdfDocument = pdfResult.documentProxy;
      state.pdfPage = 1;
      state.pdfPageCount = pdfResult.pageCount;
      showPdfPages();
    } else {
      image = await mediaLoader.fromFile(file);
      state.pdfDocument = null;
      state.pdfPage = 1;
      state.pdfPageCount = 0;
      state.pdfPages = [];
      setLibraryMode("folder");
      renderLibrary();
    }

    state.backgroundImage = image;
    state.crop = null;
    state.showBackground = true;
    state.backgroundOffsetX = 0;
    state.backgroundOffsetY = 0;
    updateToggleButtons();
    cropButton.disabled = false;
    updateFileCropButton();
    drawScene();

    const selectedFolder = getFolderFromSelectedFile(file);
    if (selectedFolder) {
      await loadLibrary(selectedFolder);
    }
    state.sourceItem = findLibraryItemForFile(file, state.libraryItems);
    updateFileCropButton();
  } catch (error) {
    window.alert(error.message);
  }
}

async function chooseFileFromServer() {
  chooseFileButton.disabled = true;

  try {
    const payload = await libraryApi.selectFile({
      dir: state.libraryFolder,
      x: Math.round(window.screenX + window.outerWidth / 2),
      y: Math.round(window.screenY + window.outerHeight / 2),
    });
    if (!payload.item) {
      return;
    }

    await loadLibrary(payload.folder);
    const selectedItem =
      state.libraryItems.find(
        (item) =>
          item.name === payload.item.name &&
          item.folder === payload.item.folder &&
          item.type === payload.item.type,
      ) || payload.item;
    await loadLibraryItem(selectedItem);
  } catch (error) {
    await chooseBrowserFolder();
  } finally {
    chooseFileButton.disabled = false;
  }
}

async function chooseBrowserFolder() {
  chooseFileButton.disabled = true;
  try {
    const result = await browserFiles.chooseFolder();
    if (!result) {
      return;
    }
    state.fileSource = "browser";
    applyBrowserLibrary(result);
  } catch (error) {
    if (error.name !== "AbortError") {
      window.alert(error.message);
    }
  } finally {
    chooseFileButton.disabled = false;
  }
}

function applyBrowserLibrary(result) {
  state.libraryFolder = result.folder;
  state.libraryItems = result.items;
  folderPathInput.readOnly = true;
  folderPathInput.title = "Browsers do not expose the full local folder path.";
  chooseFileButton.textContent = "Choose folder";
  renderLibrary();
  updateFileCropButton();
}

function applyLoadedBackground(image) {
  state.backgroundImage = image;
  state.crop = null;
  state.showBackground = true;
  state.backgroundOffsetX = 0;
  state.backgroundOffsetY = 0;
  updateToggleButtons();
  cropButton.disabled = false;
  updateFileCropButton();
  drawScene();
}

async function loadLibraryItem(item) {
  cropButton.disabled = true;
  state.sourceItem = item;
  updateFileCropButton();

  try {
    if (item.type === "pdf") {
      const buffer = item.source === "browser"
        ? await (await browserFiles.getFile(item)).arrayBuffer()
        : await libraryApi.readBuffer(item.url);
      const pdfResult = await pdfService.readBuffer(buffer);
      state.pdfDocument = pdfResult.documentProxy;
      state.pdfPage = 1;
      state.pdfPageCount = pdfResult.pageCount;
      showPdfPages();
      applyLoadedBackground(pdfResult.image);
      return;
    }

    state.pdfDocument = null;
    state.pdfPage = 1;
    state.pdfPageCount = 0;
    state.pdfPages = [];
    setLibraryMode("folder");
    renderLibrary();
    applyLoadedBackground(
      item.source === "browser"
        ? await mediaLoader.fromFile(await browserFiles.getFile(item))
        : await mediaLoader.fromSource(createVersionedImageUrl(item, state.cropRevisions, state.libraryFolder)),
    );
  } catch (error) {
    cropButton.disabled = false;
    window.alert(error.message);
  }
}

async function setPdfPage(pageNumber) {
  if (!state.pdfDocument) {
    return;
  }

  const nextPage = Math.min(Math.max(Number(pageNumber) || 1, 1), state.pdfPageCount);
  if (nextPage === state.pdfPage) {
    return;
  }

  cropButton.disabled = true;
  updateFileCropButton();

  try {
    state.backgroundImage = await pdfService.renderPage(state.pdfDocument, nextPage);
    state.pdfPage = nextPage;
    state.crop = null;
    cropState.selection = null;
    state.backgroundOffsetX = 0;
    state.backgroundOffsetY = 0;
    cropButton.disabled = false;
    updateFileCropButton();
    drawScene();
    renderPdfPages();

    if (cropDialog.open) {
      fitCropCanvas();
      drawCropPreview();
    }
  } catch (error) {
    window.alert(error.message);
  }
}

function fitCropCanvas() {
  resizeCanvasToDisplaySize(cropCanvas, window.devicePixelRatio || 1);
}

function getPreviewRect() {
  const padding = 24 * (window.devicePixelRatio || 1);
  return fitImagePreview(state.backgroundImage, cropCanvas, padding);
}

function drawCropPreview() {
  if (!state.backgroundImage) {
    return;
  }

  const preview = getPreviewRect();
  cropState.previewRect = preview;
  const selection = cropState.selection || imageCropToPreviewRect(state.crop, cropState.previewRect);
  renderAreaCropPreview({
    canvas: cropCanvas,
    context: cropContext,
    image: state.backgroundImage,
    preview,
    selection,
    pixelRatio: window.devicePixelRatio || 1,
  });
}

function getCropPoint(event) {
  const rect = cropCanvas.getBoundingClientRect();
  const ratioX = cropCanvas.width / rect.width;
  const ratioY = cropCanvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * ratioX,
    y: (event.clientY - rect.top) * ratioY,
  };
}

function openCropDialog() {
  if (!state.backgroundImage) {
    return;
  }

  cropState.selection = null;
  cropDialog.showModal();
  requestAnimationFrame(() => {
    fitCropCanvas();
    drawCropPreview();
  });
}

function fitFileCropCanvas() {
  resizeCanvasToDisplaySize(fileCropCanvas, window.devicePixelRatio || 1);
}

function getFileCropPreviewRect() {
  const padding = 24 * (window.devicePixelRatio || 1);
  return fitFileCropPreview(state.backgroundImage, fileCropCanvas, FILE_CROP_PADDING, padding);
}

function getFileCropPoint(event) {
  const rect = fileCropCanvas.getBoundingClientRect();
  const ratioX = fileCropCanvas.width / rect.width;
  const ratioY = fileCropCanvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * ratioX,
    y: (event.clientY - rect.top) * ratioY,
  };
}

function drawFileCropPreview() {
  if (!state.backgroundImage) {
    return;
  }

  const preview = getFileCropPreviewRect();
  fileCropState.previewRect = preview;
  renderFileCropPreview({
    canvas: fileCropCanvas,
    context: fileCropContext,
    image: state.backgroundImage,
    preview,
    selection: fileCropState.selection,
    pixelRatio: window.devicePixelRatio || 1,
  });
}

function setDefaultFileCropSelection() {
  const preview = fileCropState.previewRect;
  const side = Math.min(preview.width, preview.height) * 0.86;
  fileCropState.selection = makeCenteredSquare(
    { x: preview.x + preview.width / 2, y: preview.y + preview.height / 2 },
    side,
    preview,
    8 * (window.devicePixelRatio || 1),
  );
}

function openFileCropDialog() {
  if (!state.backgroundImage || !canCropSourceItem(state.sourceItem)) {
    return;
  }

  fileCropState.selection = null;
  fileCropDialog.showModal();
  requestAnimationFrame(() => {
    fitFileCropCanvas();
    fileCropState.previewRect = getFileCropPreviewRect();
    setDefaultFileCropSelection();
    drawFileCropPreview();
  });
}

function findAutoCropBox() {
  const image = state.backgroundImage;
  const pixels = imageCropService.readPixels(image);
  return findContentCropBox({
    ...pixels,
    padding: FILE_CROP_PADDING,
  });
}

function applyAutoCrop() {
  const crop = findAutoCropBox();
  if (!crop) {
    setDefaultFileCropSelection();
    drawFileCropPreview();
    return;
  }

  fileCropState.selection = imageSquareToPreviewRect(crop, fileCropState.previewRect);
  drawFileCropPreview();
}

async function saveFileCrop() {
  if (!canCropSourceItem(state.sourceItem) || !fileCropState.selection) {
    return;
  }

  const crop = previewSquareToImageCrop(fileCropState.selection, fileCropState.previewRect);
  if (crop.width < 8 || crop.height < 8) {
    return;
  }

  applyFileCropButton.disabled = true;
  autoCropButton.disabled = true;

  try {
    const dataUrl = imageCropService.cropToDataUrl(
      state.backgroundImage,
      crop,
      state.sourceItem.name,
    );
    if (state.fileSource === "browser") {
      const saved = await browserFiles.saveCrop(state.sourceItem, dataUrl);
      fileCropState.selection = null;
      fileCropDialog.close();
      await loadLibrary();
      const updatedItem = state.libraryItems.find((item) => item.name === saved.name);
      if (updatedItem) {
        await loadLibraryItem(updatedItem);
      }
      return;
    }

    const payload = await libraryApi.cropImage({
      folder: state.sourceItem.folder || state.libraryFolder,
      name: state.sourceItem.name,
      dataUrl,
    });

    const nextRevision =
      (state.cropRevisions.get(getLibraryItemKey(state.sourceItem, state.libraryFolder)) || 0) + 1;
    state.sourceItem = {
      ...state.sourceItem,
      name: payload.name || state.sourceItem.name,
      folder: payload.folder || state.sourceItem.folder,
      url: payload.url || state.sourceItem.url,
      mtime: payload.mtime || state.sourceItem.mtime,
      size: payload.size || state.sourceItem.size,
    };
    state.cropRevisions.set(
      getLibraryItemKey(state.sourceItem, state.libraryFolder),
      nextRevision,
    );
    state.backgroundImage = await mediaLoader.fromSource(
      createVersionedImageUrl(state.sourceItem, state.cropRevisions, state.libraryFolder),
    );
    state.crop = null;
    fileCropState.selection = null;
    fileCropDialog.close();
    drawScene();
    await loadLibrary();
  } catch (error) {
    window.alert(error.message);
  } finally {
    applyFileCropButton.disabled = false;
    autoCropButton.disabled = false;
    updateFileCropButton();
  }
}

function showPdfPages() {
  setLibraryMode("pdf");
  state.pdfPages = Array.from({ length: state.pdfPageCount }, (_, index) => index + 1);
  renderPdfPages();
}

function renderPdfPages() {
  setLibraryMode("pdf");
  libraryRenderer.renderPdfPages(state.pdfPages);
}

async function renderPdfThumbnail(pageNumber, targetCanvas) {
  if (!state.pdfDocument) {
    return;
  }

  try {
    const source = await pdfService.renderPageCanvas(state.pdfDocument, pageNumber, 0.28);
    renderImageContained(targetCanvas, source, { pixelRatio: window.devicePixelRatio || 1 });
  } catch (error) {
    fillCanvas(targetCanvas, "#102024");
  }
}

function renderLibrary() {
  setLibraryMode("folder");
  updateFolderPathDisplay();
  const items = sortLibraryItems(state.libraryItems, state.librarySort);
  sortByDateButton.classList.toggle("active", state.librarySort === "date");
  sortByNameButton.classList.toggle("active", state.librarySort === "name");
  libraryRenderer.renderItems(items);
}

async function loadLibrary(folder = state.libraryFolder) {
  const request = libraryRequestGate.begin();
  setLibraryMode("folder");
  if (state.fileSource === "browser" && browserFiles.isActive()) {
    libraryList.innerHTML = '<div class="library-empty">Scanning images...</div>';
    const result = await browserFiles.scan();
    if (request.isCurrent()) applyBrowserLibrary(result);
    return;
  }
  if (folder) {
    state.libraryFolder = folder;
  }
  updateFolderPathDisplay();
  libraryList.innerHTML = '<div class="library-empty">Scanning images...</div>';

  try {
    const payload = await libraryApi.listImages(state.libraryFolder, { signal: request.signal });
    if (!request.isCurrent()) return;
    state.libraryFolder = payload.folder || state.libraryFolder;
    state.libraryItems = payload.items || [];
    state.fileSource = "local";
    folderPathInput.readOnly = false;
    chooseFileButton.textContent = "Choose image or PDF";
  } catch (error) {
    if (!request.isCurrent() || error.name === "AbortError") return;
    try {
      const html = await libraryApi.readDefaultDirectory({ signal: request.signal });
      if (!request.isCurrent()) return;
      state.libraryItems = parseDirectoryListing(html, {
        folder: state.libraryFolder,
        createUrl: apiUrl,
      });
    } catch (fallbackError) {
      if (!request.isCurrent() || fallbackError.name === "AbortError") return;
      state.libraryItems = [];
      state.fileSource = "browser";
      folderPathInput.readOnly = true;
      chooseFileButton.textContent = "Choose folder";
      libraryList.innerHTML = '<div class="library-empty">Choose a local folder to display its images and PDFs.</div>';
      return;
    }
  }

  renderLibrary();
}

clearButton.addEventListener("click", deleteAllStrokes);

document.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }
  if (event.key === "Delete") {
    event.preventDefault();
    deleteAllStrokes();
  } else if (event.key === "Backspace") {
    event.preventDefault();
    undoLastStroke();
  }
});

undoButton.addEventListener("click", undoLastStroke);

swapMenuButton.addEventListener("click", () => {
  state.menusSwapped = !state.menusSwapped;
  settings.writeBoolean("symbolPracticeMenusSwapped", state.menusSwapped);
  updateMenuSwap();
  fitCanvasToContainer();
});

currentThemeButton.addEventListener("click", () => setTheme("current"));
darkThemeButton.addEventListener("click", () => setTheme("dark"));
violetThemeButton.addEventListener("click", () => setTheme("violet"));
sunsetThemeButton.addEventListener("click", () => setTheme("sunset"));

rangeInputs.forEach((input) => {
  input.addEventListener("input", () => updateRangeFill(input));
  updateRangeFill(input);
});

colorSwatches.forEach((button) => {
  button.addEventListener("click", () => {
    const index = Number(button.dataset.colorIndex);
    setPenColor(state.recentColors[index]);
  });
});

colorPickerButton.addEventListener("click", () => {
  colorPickerInput.click();
});

colorPickerInput.addEventListener("change", () => {
  setPenColor(colorPickerInput.value);
});

chooseFileButton.addEventListener("click", chooseFileFromServer);

refreshLibraryButton.addEventListener("click", () => {
  loadLibrary();
});

folderPathInput.addEventListener("focus", () => {
  updateFolderPathDisplay(true);
  folderPathInput.select();
});

folderPathInput.addEventListener("blur", () => {
  if (state.fileSource === "browser") {
    updateFolderPathDisplay();
    return;
  }
  const nextFolder = folderPathInput.value.trim();
  if (nextFolder && nextFolder !== state.libraryFolder) {
    loadLibrary(nextFolder);
    return;
  }
  updateFolderPathDisplay();
});

folderPathInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    folderPathInput.blur();
  }
});

sortByDateButton.addEventListener("click", () => {
  if (state.libraryMode === "pdf") {
    return;
  }
  state.librarySort = "date";
  renderLibrary();
});

sortByNameButton.addEventListener("click", () => {
  if (state.libraryMode === "pdf") {
    return;
  }
  state.librarySort = "name";
  renderLibrary();
});

penSizeInput.addEventListener("input", () => {
  state.penSize = Number(penSizeInput.value);
  updateRangeValues();
});

backgroundOpacityInput.addEventListener("input", () => {
  state.backgroundTransparency = Number(backgroundOpacityInput.value);
  updateRangeValues();
  scheduleSceneDraw();
});

backgroundScaleInput.addEventListener("input", () => {
  state.backgroundScale = Number(backgroundScaleInput.value);
  updateRangeValues();
  scheduleSceneDraw();
});

gridToggle.addEventListener("click", () => {
  state.showGrid = !state.showGrid;
  updateToggleButtons();
  drawScene();
});

backgroundToggle.addEventListener("click", () => {
  state.showBackground = !state.showBackground;
  updateToggleButtons();
  drawScene();
});

pointerModeButton.addEventListener("click", () => setToolMode("pointer"));
handModeButton.addEventListener("click", () => setToolMode("hand"));
brushModeButton.addEventListener("click", () => setToolMode("brush"));
pressureModeButton.addEventListener("click", () => setToolMode("pressure"));

cropButton.addEventListener("click", openCropDialog);
fileCropButton.addEventListener("click", openFileCropDialog);

closeCropButton.addEventListener("click", () => {
  cropDialog.close();
});

closeFileCropButton.addEventListener("click", () => {
  fileCropDialog.close();
});

resetCropButton.addEventListener("click", () => {
  state.crop = null;
  cropState.selection = null;
  drawCropPreview();
  drawScene();
});

applyCropButton.addEventListener("click", () => {
  if (cropState.selection && cropState.selection.width > 6 && cropState.selection.height > 6) {
    state.crop = previewRectToImageCrop(cropState.selection, cropState.previewRect);
  }
  cropDialog.close();
  drawScene();
});

cropCanvas.addEventListener("pointerdown", (event) => {
  if (!state.backgroundImage) {
    return;
  }

  event.preventDefault();
  cropCanvas.setPointerCapture(event.pointerId);
  cropState.selecting = true;
  cropState.startPoint = clampPointToRect(getCropPoint(event), cropState.previewRect);
  cropState.selection = makeRect(cropState.startPoint, cropState.startPoint);
  drawCropPreview();
});

cropCanvas.addEventListener("pointermove", (event) => {
  if (!cropState.selecting) {
    return;
  }

  event.preventDefault();
  const point = clampPointToRect(getCropPoint(event), cropState.previewRect);
  cropState.selection = makeRect(cropState.startPoint, point);
  drawCropPreview();
});

cropCanvas.addEventListener("pointerup", (event) => {
  cropState.selecting = false;
  if (cropCanvas.hasPointerCapture(event.pointerId)) {
    cropCanvas.releasePointerCapture(event.pointerId);
  }
});

cropCanvas.addEventListener("pointercancel", () => {
  cropState.selecting = false;
});

autoCropButton.addEventListener("click", applyAutoCrop);
applyFileCropButton.addEventListener("click", saveFileCrop);

fileCropCanvas.addEventListener("pointerdown", (event) => {
  if (!state.backgroundImage || !fileCropState.previewRect) {
    return;
  }

  event.preventDefault();
  fileCropCanvas.setPointerCapture(event.pointerId);
  fileCropState.selecting = true;
  fileCropState.centerPoint = clampPointToRect(getFileCropPoint(event), fileCropState.previewRect);
  fileCropState.selection = makeCenteredSquare(
    fileCropState.centerPoint,
    8,
    fileCropState.previewRect,
    8 * (window.devicePixelRatio || 1),
  );
  drawFileCropPreview();
});

fileCropCanvas.addEventListener("pointermove", (event) => {
  if (!fileCropState.selecting || !fileCropState.centerPoint) {
    return;
  }

  event.preventDefault();
  const point = clampPointToRect(getFileCropPoint(event), fileCropState.previewRect);
  const side = Math.max(
    Math.abs(point.x - fileCropState.centerPoint.x),
    Math.abs(point.y - fileCropState.centerPoint.y),
  ) * 2;
  fileCropState.selection = makeCenteredSquare(
    fileCropState.centerPoint,
    side,
    fileCropState.previewRect,
    8 * (window.devicePixelRatio || 1),
  );
  drawFileCropPreview();
});

fileCropCanvas.addEventListener("pointerup", (event) => {
  fileCropState.selecting = false;
  fileCropState.centerPoint = null;
  if (fileCropCanvas.hasPointerCapture(event.pointerId)) {
    fileCropCanvas.releasePointerCapture(event.pointerId);
  }
});

fileCropCanvas.addEventListener("pointercancel", () => {
  fileCropState.selecting = false;
  fileCropState.centerPoint = null;
});

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", continueDrawing);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("lostpointercapture", stopDrawing);

let resizeFrame = null;

function updateLayoutAfterResize() {
  resizeFrame = null;
  fitCanvasToContainer();
  updateFolderPathDisplay();
  if (cropDialog.open) {
    fitCropCanvas();
    drawCropPreview();
  }
  if (fileCropDialog.open) {
    fitFileCropCanvas();
    fileCropState.previewRect = getFileCropPreviewRect();
    if (fileCropState.selection) {
      fileCropState.selection = imageSquareToPreviewRect(
        previewSquareToImageCrop(fileCropState.selection, fileCropState.previewRect),
        fileCropState.previewRect,
      );
    } else {
      setDefaultFileCropSelection();
    }
    drawFileCropPreview();
  }
}

window.addEventListener("resize", () => {
  if (resizeFrame !== null) {
    return;
  }
  resizeFrame = window.requestAnimationFrame(updateLayoutAfterResize);
});

window.addEventListener(
  "pagehide",
  () => {
    libraryRequestGate.cancel();
    browserFiles.dispose();
  },
  { once: true },
);

window.addEventListener("keydown", (event) => {
  const target = event.target;
  const isEditing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;

  if (isEditing) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
    event.preventDefault();
    undoLastStroke();
  }
});

setTheme(state.theme, { updatePen: state.theme !== "current" });
updateMenuSwap();
fitCanvasToContainer();
updateUndoButton();
updateRangeValues();
updateColorPalette();
updateToggleButtons();
setToolMode("pointer");
updateFileCropButton();
loadLibrary();
