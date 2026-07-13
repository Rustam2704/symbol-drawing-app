import { getStroke } from "./vendor/perfect-freehand-package/package/dist/esm/index.mjs";

import { browserFiles } from "./web/browser-files.js";
import { createAudioEffects } from "./modules/audio-effects.js";
import { createAsyncTaskQueue } from "./modules/async-task-queue.js";
import { queryAppElements } from "./modules/app-elements.js";
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
import { createDeleteEffectController } from "./modules/delete-effect-controller.js";
import {
  createDeleteParticleData,
  createDeleteTrajectoryRenderer,
} from "./modules/delete-trajectory-renderer.js";
import { createFrameScheduler } from "./modules/frame-scheduler.js";
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
import { createKeyboardShortcutHandler } from "./modules/keyboard-shortcuts.js?v=layout-independent-undo";
import { createPdfService } from "./modules/pdf-service.js";
import { createRequestGate } from "./modules/request-gate.js";
import { createSpriteAnimation } from "./modules/sprite-animation.js";
import { calculateRangePercent, getErrorMessage, normalizeColor, shortenMiddle } from "./modules/ui-utils.js";

const {
  appShell,
  backgroundCanvas,
  canvas,
  deleteEffectCanvas,
  clearButton,
  gauntletCanvas,
  undoButton,
  timeGauntletCanvas,
  swapMenuButton,
  personalThemeButton,
  currentThemeButton,
  darkThemeButton,
  violetThemeButton,
  sunsetThemeButton,
  chooseFileButton,
  penSizeInput,
  penRangeControl,
  penThumbPreview,
  backgroundOpacityInput,
  backgroundScaleInput,
  penSizeValue,
  backgroundOpacityValue,
  backgroundScaleValue,
  gridToggle,
  backgroundToggle,
  pointerModeButton,
  handModeButton,
  brushModeButton,
  pressureModeButton,
  cropButton,
  fileCropButton,
  cropDialog,
  cropCanvas,
  applyCropButton,
  resetCropButton,
  closeCropButton,
  fileCropDialog,
  fileCropCanvas,
  closeFileCropButton,
  autoCropButton,
  applyFileCropButton,
  libraryTitle,
  folderPathInput,
  libraryList,
  refreshLibraryButton,
  sortByDateButton,
  sortByNameButton,
  colorSwatches,
  personalThemeButtons,
  colorPickerButton,
  colorPickerPanel,
  colorPickerField,
  colorPickerFieldThumb,
  colorPickerHue,
  colorPickerPreview,
  colorPickerHex,
  rangeInputs,
} = queryAppElements(document);
const backgroundContext = backgroundCanvas.getContext("2d");
const context = canvas.getContext("2d");
const cropContext = cropCanvas.getContext("2d");
const fileCropContext = fileCropCanvas.getContext("2d");
function reportError(error) {
  window.alert(getErrorMessage(error));
}

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
const scheduleIdleWork = (callback) => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 1000 });
  } else {
    window.setTimeout(callback, 0);
  }
};
const {
  dispose: disposeAudioEffects,
  playPreparedDeleteSound,
  playReverseSound,
  stopDeleteSounds,
} = createAudioEffects({
  deleteRate: 2,
  reverseRate: 2,
  schedulePrepare: scheduleIdleWork,
});

const settings = createSettingsStore();

const RANGE_POSITION_MAX = 1000;
const colorPickerState = { hue: 0, saturation: 0, value: 0, pendingColor: "#1f1d1a", target: "pen", themeKey: null };
const UI_THEME_PALETTES = Object.freeze({
  current: { paper: "#fbfaf7", panel: "#ffffff", ink: "#202124", line: "#d8d2c8", accent: "#237c6b", accentStrong: "#155e50", danger: "#b3342d" },
  dark: { paper: "#070707", panel: "#1a1a1a", ink: "#808080", line: "#4d4d4d", accent: "#4d4d4d", accentStrong: "#808080", danger: "#1a1a1a" },
  violet: { paper: "#07052f", panel: "#211052", ink: "#b8f4f2", line: "#44206c", accent: "#922b91", accentStrong: "#10c0e0", danger: "#641d68" },
  sunset: { paper: "#062c3c", panel: "#0a4457", ink: "#d7f3ee", line: "#126c83", accent: "#f48470", accentStrong: "#ffe0aa", danger: "#bd5e62" },
});

function exponentialRangeValue(position, centerValue) {
  return centerValue * (10 ** ((Number(position) / (RANGE_POSITION_MAX / 2)) - 1));
}

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
  backgroundScale: exponentialRangeValue(backgroundScaleInput.value, 1),
  showGrid: true,
  showBackground: true,
  penSize: exponentialRangeValue(penSizeInput.value, 10),
  backgroundOffsetX: 0,
  backgroundOffsetY: 0,
  toolMode: "pressure",
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
  themeBase: "current",
  personalThemePalette: null,
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
  const workspace = canvas.parentElement;
  const displayWidth = Math.max(1, workspace.clientWidth);
  const displayHeight = Math.max(1, workspace.clientHeight);
  const displaySide = Math.max(displayWidth, displayHeight);
  for (const target of [backgroundCanvas, canvas]) {
    target.style.width = `${displaySide}px`;
    target.style.height = `${displaySide}px`;
  }
  const effectSide = displaySide;
  deleteEffectCanvas.style.width = `${effectSide}px`;
  deleteEffectCanvas.style.height = `${effectSide}px`;
  deleteTrajectoryRenderer.resize(
    effectSide,
    effectSide,
    window.devicePixelRatio || 1,
  );
}

function getCanvasScale() {
  const rect = canvas.getBoundingClientRect();
  return canvas.width / Math.max(1, rect.width);
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
    size: state.penSize * (0.7 + pressure * 0.45) * getCanvasScale(),
  };
}

function clearStrokeLayer() {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function clearBackgroundLayer() {
  backgroundContext.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
}

function hexWithAlpha(hex, alpha) {
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getActiveThemePalette() {
  return state.personalThemePalette || UI_THEME_PALETTES[state.theme] || UI_THEME_PALETTES.current;
}

function updatePersonalThemeButtons() {
  const palette = getActiveThemePalette();
  personalThemeButtons.forEach((button) => {
    const key = button.dataset.themeColor;
    button.style.background = palette[key];
    button.classList.toggle(
      "active",
      !colorPickerPanel.hidden && colorPickerState.target === "theme" && colorPickerState.themeKey === key,
    );
  });
  const storedPersonalTheme = settings.readPersonalTheme();
  const previewPalette = state.theme === "personal"
    ? palette
    : storedPersonalTheme?.palette || UI_THEME_PALETTES.current;
  const previewKeys = ["paper", "panel", "accent", "accentStrong"];
  Array.from(personalThemeButton.children).forEach((swatch, index) => {
    swatch.style.background = previewPalette[previewKeys[index]];
  });
}

function applyPersonalThemePalette() {
  const palette = getActiveThemePalette();
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--paper", palette.paper);
  rootStyle.setProperty("--panel", palette.panel);
  rootStyle.setProperty("--ink", palette.ink);
  rootStyle.setProperty("--line", palette.line);
  rootStyle.setProperty("--accent", palette.accent);
  rootStyle.setProperty("--accent-strong", palette.accentStrong);
  rootStyle.setProperty("--danger", palette.danger);
  rootStyle.setProperty("--theme-surface", `color-mix(in srgb, ${palette.panel} 94%, transparent)`);
  rootStyle.setProperty("--theme-soft", palette.panel);
  rootStyle.setProperty("--theme-border", palette.line);
  rootStyle.setProperty(
    "--theme-body-background",
    `radial-gradient(circle at 50% 10%, color-mix(in srgb, ${palette.accentStrong} 28%, transparent), transparent 28%), linear-gradient(150deg, ${palette.paper} 0%, ${palette.panel} 58%, ${palette.line} 100%)`,
  );
  rootStyle.setProperty("--shadow", `0 18px 45px color-mix(in srgb, ${palette.ink} 28%, transparent)`);
  updatePersonalThemeButtons();
}

function drawPaper() {
  backgroundContext.fillStyle = getActiveThemePalette().paper;
  backgroundContext.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
}

function drawGrid() {
  if (!state.showGrid) {
    return;
  }

  const palette = getActiveThemePalette();
  const shortSide = Math.min(canvas.width, canvas.height);
  const step = Math.max(36, Math.floor(shortSide / 8));
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  backgroundContext.save();
  backgroundContext.strokeStyle = hexWithAlpha(palette.line, 0.32);
  backgroundContext.lineWidth = 1;
  backgroundContext.beginPath();

  for (let x = centerX % step; x < canvas.width; x += step) {
    backgroundContext.moveTo(x, 0);
    backgroundContext.lineTo(x, canvas.height);
  }

  for (let y = centerY % step; y < canvas.height; y += step) {
    backgroundContext.moveTo(0, y);
    backgroundContext.lineTo(canvas.width, y);
  }
  backgroundContext.stroke();

  backgroundContext.strokeStyle = hexWithAlpha(palette.accentStrong, 0.42);
  backgroundContext.beginPath();
  backgroundContext.moveTo(centerX, 0);
  backgroundContext.lineTo(centerX, canvas.height);
  backgroundContext.moveTo(0, centerY);
  backgroundContext.lineTo(canvas.width, centerY);
  backgroundContext.stroke();

  backgroundContext.strokeStyle = hexWithAlpha(palette.danger, 0.42);
  backgroundContext.beginPath();
  backgroundContext.moveTo(0, 0);
  backgroundContext.lineTo(canvas.width, canvas.height);
  backgroundContext.moveTo(canvas.width, 0);
  backgroundContext.lineTo(0, canvas.height);
  backgroundContext.stroke();
  backgroundContext.restore();
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

  backgroundContext.save();
  backgroundContext.globalAlpha = 1 - state.backgroundTransparency;
  backgroundContext.drawImage(image, crop.x, crop.y, crop.width, crop.height, x, y, width, height);
  backgroundContext.restore();
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

  const baseSize = Math.max(1, stroke.size || state.penSize * getCanvasScale());
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

function drawBackgroundLayer() {
  clearBackgroundLayer();
  drawPaper();
  drawBackgroundImage();
  drawGrid();
}

function drawStrokeLayer() {
  clearStrokeLayer();
  drawStrokes();
}

const backgroundDrawScheduler = createFrameScheduler(drawBackgroundLayer);
const scheduleBackgroundDraw = backgroundDrawScheduler.schedule;

function getDeleteBounds(strokes) {
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let hasPoints = false;
  for (const stroke of strokes) {
    let strokeWidth = Math.max(1, stroke.size || 0);
    for (const point of stroke.points) strokeWidth = Math.max(strokeWidth, point.size || 0);
    const padding = strokeWidth / 2 + 2;
    for (const point of stroke.points) {
      hasPoints = true;
      minX = Math.min(minX, point.x - padding);
      minY = Math.min(minY, point.y - padding);
      maxX = Math.max(maxX, point.x + padding);
      maxY = Math.max(maxY, point.y + padding);
    }
  }
  if (!hasPoints) return null;
  const x = Math.max(0, Math.floor(minX));
  const y = Math.max(0, Math.floor(minY));
  const right = Math.min(canvas.width, Math.ceil(maxX));
  const bottom = Math.min(canvas.height, Math.ceil(maxY));
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

function createDeleteParticles(strokes, seed) {
  const bounds = getDeleteBounds(strokes);
  if (!bounds) return null;
  const pixels = context.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
  return createDeleteParticleData(pixels, bounds.x, bounds.y, seed);
}

const deleteTrajectoryRenderer = createDeleteTrajectoryRenderer({
  canvas: deleteEffectCanvas,
  assetUrl: "./assets/delete-trajectories-1000x1000-1000-js-wave-shift-010s.dtv",
  mapUrl: "./assets/delete-particle-map-1000x1000-1000-wave-shift-010s.dpm",
});
deleteTrajectoryRenderer.ready.catch(reportError);
let layoutUpdatePending = false;

function flushPendingLayoutUpdate() {
  if (!layoutUpdatePending) return;
  layoutUpdatePending = false;
  layoutResizeScheduler.schedule();
}

const deleteEffects = createDeleteEffectController({
  cloneStrokes,
  drawStrokes: drawStrokeLayer,
  getCurrentHistoryNode: () => history.current,
  onFinish: flushPendingLayoutUpdate,
  renderer: deleteTrajectoryRenderer,
  effectType: "1000",
  setStrokes: (strokes) => {
    state.strokes = strokes;
  },
});

function deleteAllStrokes() {
  if (deleteEffects.canRestartDelete(history.current.id)) {
    playPreparedDeleteSound();
    gauntletAnimation.play();
    const deleteHistoryNode = recordHistory("delete");
    deleteEffects.restartDelete(deleteHistoryNode.parent.id, deleteHistoryNode);
    updateUndoButton();
    return;
  }
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

  const deletedStrokes = cloneStrokes(state.strokes);
  state.strokes = [];
  const deleteHistoryNode = recordHistory("delete");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    drawStrokeLayer();
    updateUndoButton();
    return;
  }

  const particles = createDeleteParticles(deletedStrokes, deleteHistoryNode.id);
  drawStrokeLayer();
  updateUndoButton();
  deleteEffects.start(deleteHistoryNode, particles);
}

function updateUndoButton() {
  undoButton.disabled = !history.canUndo;
}

function updateRangeValues() {
  penSizeValue.textContent = `${state.penSize.toFixed(1)} px`;
  backgroundOpacityValue.textContent = `${(state.backgroundTransparency * 100).toFixed(1)}%`;
  backgroundScaleValue.textContent = `${state.backgroundScale.toFixed(1)}x`;
}

function updatePenThumbPreview() {
  const progress = calculateRangePercent(penSizeInput);
  penThumbPreview.style.left = `${progress}%`;
  penThumbPreview.style.setProperty("--pen-preview-size", `${state.penSize}px`);
  penThumbPreview.style.setProperty("--pen-preview-color", state.penColor);
}

function hexToHsv(hex) {
  const value = normalizeColor(hex).slice(1);
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * (((blue - red) / delta) + 2);
    else hue = 60 * (((red - green) / delta) + 4);
  }
  return {
    hue: (hue + 360) % 360,
    saturation: maximum ? delta / maximum : 0,
    value: maximum,
  };
}

function hsvToHex(hue, saturation, value) {
  const chroma = value * saturation;
  const segment = ((hue % 360) + 360) % 360 / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const pairs = [[chroma, secondary, 0], [secondary, chroma, 0], [0, chroma, secondary], [0, secondary, chroma], [secondary, 0, chroma], [chroma, 0, secondary]];
  const [red, green, blue] = pairs[Math.floor(segment) % 6];
  const match = value - chroma;
  return `#${[red, green, blue].map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function updateColorPickerVisuals() {
  const { hue, saturation, value } = colorPickerState;
  const color = hsvToHex(hue, saturation, value);
  colorPickerState.pendingColor = color;
  colorPickerField.style.setProperty("--picker-hue", `hsl(${hue} 100% 50%)`);
  colorPickerFieldThumb.style.left = `${saturation * 100}%`;
  colorPickerFieldThumb.style.top = `${(1 - value) * 100}%`;
  colorPickerFieldThumb.style.background = color;
  colorPickerHue.value = String(Math.round(hue));
  colorPickerPreview.style.background = color;
  colorPickerHex.value = color;
}

function openColorPicker(color = state.penColor, target = "pen", themeKey = null) {
  Object.assign(colorPickerState, hexToHsv(color), { target, themeKey });
  colorPickerPanel.hidden = false;
  colorPickerButton.setAttribute("aria-expanded", "true");
  updateColorPickerVisuals();
  updatePersonalThemeButtons();
}

function closeColorPicker({ apply = true } = {}) {
  if (colorPickerPanel.hidden) return;
  if (apply && colorPickerState.target === "theme" && colorPickerState.themeKey) {
    const baseTheme = state.theme === "personal" ? state.themeBase : state.theme;
    const sourcePalette = state.theme === "personal"
      ? getActiveThemePalette()
      : UI_THEME_PALETTES[baseTheme];
    const nextPersonalPalette = {
      ...sourcePalette,
      [colorPickerState.themeKey]: colorPickerState.pendingColor,
    };
    settings.writePersonalTheme(baseTheme, nextPersonalPalette);
    setTheme("personal", { updatePen: false });
  } else if (apply) {
    setPenColor(colorPickerState.pendingColor);
  }
  colorPickerPanel.hidden = true;
  colorPickerButton.setAttribute("aria-expanded", "false");
  updatePersonalThemeButtons();
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
  updatePenThumbPreview();
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
  if (theme === "personal") {
    let personalTheme = settings.readPersonalTheme();
    if (!personalTheme) {
      const baseTheme = Object.hasOwn(THEME_COLORS, state.theme) ? state.theme : "current";
      personalTheme = { baseTheme, palette: { ...UI_THEME_PALETTES[baseTheme] } };
      settings.writePersonalTheme(personalTheme.baseTheme, personalTheme.palette);
    }
    state.theme = "personal";
    state.themeBase = personalTheme.baseTheme;
    state.personalThemePalette = { ...personalTheme.palette };
  } else {
    state.theme = Object.hasOwn(THEME_COLORS, theme) ? theme : "current";
    state.themeBase = state.theme;
    state.personalThemePalette = { ...UI_THEME_PALETTES[state.theme] };
  }
  document.documentElement.dataset.theme = state.themeBase;
  [[personalThemeButton, "personal"], [currentThemeButton, "current"], [darkThemeButton, "dark"], [violetThemeButton, "violet"], [sunsetThemeButton, "sunset"]]
    .forEach(([button, buttonTheme]) => {
      const isActive = state.theme === buttonTheme;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

  settings.writeTheme(state.theme);
  applyPersonalThemePalette();

  if (updatePen) {
    const colors = THEME_COLORS[state.themeBase].pens;
    state.recentColors = colors;
    setPenColor(colors[0]);
  }
  drawBackgroundLayer();
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
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const effectHandled = deleteEffects.undo(undoneNode, targetNode, reducedMotion);
  if (!effectHandled) {
    state.strokes = cloneStrokes(targetNode.strokes);
  }
  drawStrokeLayer();
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
    size: state.penSize * getCanvasScale(),
    points: [point],
  };
  state.strokes.push(state.activeStroke);
  if (state.activeStroke.type !== "pen") {
    drawStrokeLayer();
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
    scheduleBackgroundDraw();
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
    drawStrokeLayer();
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
const pdfThumbnailQueue = createAsyncTaskQueue({ concurrency: 2 });
const libraryRequestGate = createRequestGate();
const mediaLoadRequestGate = createRequestGate();
const pdfPageRequestGate = createRequestGate();
const imageCropService = createImageCropService();
const libraryRenderer = createLibraryRenderer({
  container: libraryList,
  getItemUrl: (item) => createVersionedImageUrl(item, state.cropRevisions, state.libraryFolder),
  onSelectItem: loadLibraryItem,
  onSelectPdfPage: setPdfPage,
  renderPdfThumbnail,
});

function setPdfDocument(documentProxy = null, pageCount = 0) {
  pdfPageRequestGate.cancel();
  pdfThumbnailQueue.clear();
  const previousDocument = state.pdfDocument;
  state.pdfDocument = documentProxy;
  state.pdfPage = 1;
  state.pdfPageCount = pageCount;
  state.pdfPages = [];
  if (previousDocument && previousDocument !== documentProxy) {
    pdfService.disposeDocument(previousDocument);
  }
}

async function loadImage(file) {
  if (!file) {
    return;
  }

  const request = mediaLoadRequestGate.begin();
  cropButton.disabled = true;
  state.sourceItem = null;
  updateFileCropButton();

  try {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    let image;

    if (isPdf) {
      const pdfResult = await pdfService.readFile(file);
      if (!request.isCurrent()) {
        pdfService.disposeDocument(pdfResult.documentProxy);
        return;
      }
      image = pdfResult.image;
      setPdfDocument(pdfResult.documentProxy, pdfResult.pageCount);
      showPdfPages();
    } else {
      image = await mediaLoader.fromFile(file);
      if (!request.isCurrent()) return;
      setPdfDocument();
      setLibraryMode("folder");
      renderLibrary();
    }

    applyLoadedBackground(image);

    const selectedFolder = getFolderFromSelectedFile(file);
    if (selectedFolder) {
      await loadLibrary(selectedFolder);
    }
    if (!request.isCurrent()) return;
    state.sourceItem = findLibraryItemForFile(file, state.libraryItems);
    updateFileCropButton();
  } catch (error) {
    if (request.isCurrent()) reportError(error);
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
      reportError(error);
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
  drawBackgroundLayer();
}

async function loadLibraryItem(item) {
  const request = mediaLoadRequestGate.begin();
  cropButton.disabled = true;
  state.sourceItem = item;
  updateFileCropButton();

  try {
    if (item.type === "pdf") {
      const buffer = item.source === "browser"
        ? await (await browserFiles.getFile(item)).arrayBuffer()
        : await libraryApi.readBuffer(item.url);
      if (!request.isCurrent()) return;
      const pdfResult = await pdfService.readBuffer(buffer);
      if (!request.isCurrent()) {
        pdfService.disposeDocument(pdfResult.documentProxy);
        return;
      }
      setPdfDocument(pdfResult.documentProxy, pdfResult.pageCount);
      showPdfPages();
      applyLoadedBackground(pdfResult.image);
      return;
    }

    const image = item.source === "browser"
      ? await mediaLoader.fromFile(await browserFiles.getFile(item))
      : await mediaLoader.fromSource(
          createVersionedImageUrl(item, state.cropRevisions, state.libraryFolder),
        );
    if (!request.isCurrent()) return;
    setPdfDocument();
    setLibraryMode("folder");
    renderLibrary();
    applyLoadedBackground(image);
  } catch (error) {
    if (request.isCurrent()) {
      cropButton.disabled = false;
      reportError(error);
    }
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

  const documentProxy = state.pdfDocument;
  const request = pdfPageRequestGate.begin();
  cropButton.disabled = true;
  updateFileCropButton();

  try {
    const image = await pdfService.renderPage(documentProxy, nextPage);
    if (!request.isCurrent() || state.pdfDocument !== documentProxy) return;
    state.backgroundImage = image;
    state.pdfPage = nextPage;
    state.crop = null;
    cropState.selection = null;
    state.backgroundOffsetX = 0;
    state.backgroundOffsetY = 0;
    cropButton.disabled = false;
    updateFileCropButton();
    drawBackgroundLayer();
    renderPdfPages();

    if (cropDialog.open) {
      fitCropCanvas();
      drawCropPreview();
    }
  } catch (error) {
    if (request.isCurrent()) reportError(error);
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
    drawBackgroundLayer();
    await loadLibrary();
  } catch (error) {
    reportError(error);
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
  const documentProxy = state.pdfDocument;
  if (!documentProxy) {
    return;
  }

  try {
    const source = await pdfThumbnailQueue.run(() =>
      pdfService.renderPageCanvas(documentProxy, pageNumber, 0.28),
    );
    if (state.pdfDocument !== documentProxy) return;
    renderImageContained(targetCanvas, source, { pixelRatio: window.devicePixelRatio || 1 });
  } catch (error) {
    if (error.name === "AbortError") return;
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
const handleKeyboardShortcut = createKeyboardShortcutHandler({
  onClear: deleteAllStrokes,
  onUndo: undoLastStroke,
});
window.addEventListener("keydown", handleKeyboardShortcut);

undoButton.addEventListener("click", undoLastStroke);

swapMenuButton.addEventListener("click", () => {
  state.menusSwapped = !state.menusSwapped;
  settings.writeBoolean("symbolPracticeMenusSwapped", state.menusSwapped);
  updateMenuSwap();
  layoutResizeScheduler.schedule();
});

personalThemeButton.addEventListener("click", () => setTheme("personal"));
currentThemeButton.addEventListener("click", () => setTheme("current"));
darkThemeButton.addEventListener("click", () => setTheme("dark"));
violetThemeButton.addEventListener("click", () => setTheme("violet"));
sunsetThemeButton.addEventListener("click", () => setTheme("sunset"));

rangeInputs.forEach((input) => {
  input.addEventListener("input", () => updateRangeFill(input));
  updateRangeFill(input);
});

function setPenRangeAdjusting(adjusting) {
  penRangeControl.classList.toggle("adjusting", adjusting);
}

penSizeInput.addEventListener("pointerdown", () => setPenRangeAdjusting(true));
penSizeInput.addEventListener("keydown", () => setPenRangeAdjusting(true));
penSizeInput.addEventListener("keyup", () => setPenRangeAdjusting(false));
penSizeInput.addEventListener("blur", () => setPenRangeAdjusting(false));
window.addEventListener("pointerup", () => setPenRangeAdjusting(false));
window.addEventListener("pointercancel", () => setPenRangeAdjusting(false));

colorSwatches.forEach((button) => {
  button.addEventListener("click", () => {
    const index = Number(button.dataset.colorIndex);
    setPenColor(state.recentColors[index]);
  });
});

colorPickerButton.addEventListener("click", () => {
  if (colorPickerPanel.hidden) openColorPicker(state.penColor, "pen");
  else closeColorPicker();
});

personalThemeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.themeColor;
    if (!colorPickerPanel.hidden) closeColorPicker();
    openColorPicker(getActiveThemePalette()[key], "theme", key);
  });
});

function updateColorFromField(event) {
  const rect = colorPickerField.getBoundingClientRect();
  colorPickerState.saturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  colorPickerState.value = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  updateColorPickerVisuals();
}

colorPickerField.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  colorPickerField.setPointerCapture(event.pointerId);
  updateColorFromField(event);
});
colorPickerField.addEventListener("pointermove", (event) => {
  if (colorPickerField.hasPointerCapture(event.pointerId)) updateColorFromField(event);
});

colorPickerHue.addEventListener("input", () => {
  colorPickerState.hue = Number(colorPickerHue.value);
  updateColorPickerVisuals();
});

colorPickerHex.addEventListener("input", () => {
  const color = normalizeColor(colorPickerHex.value);
  if (!/^#[0-9a-f]{6}$/.test(color)) return;
  Object.assign(colorPickerState, hexToHsv(color));
  updateColorPickerVisuals();
});

document.addEventListener("pointerdown", (event) => {
  if (
    !colorPickerPanel.hidden
    && !colorPickerPanel.contains(event.target)
    && !colorPickerButton.contains(event.target)
    && !event.target.closest(".personal-theme-colors")
  ) {
    closeColorPicker();
  }
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
  state.penSize = exponentialRangeValue(penSizeInput.value, 10);
  updateRangeValues();
  updatePenThumbPreview();
});

backgroundOpacityInput.addEventListener("input", () => {
  state.backgroundTransparency = Number(backgroundOpacityInput.value);
  updateRangeValues();
  scheduleBackgroundDraw();
});

backgroundScaleInput.addEventListener("input", () => {
  state.backgroundScale = exponentialRangeValue(backgroundScaleInput.value, 1);
  updateRangeValues();
  scheduleBackgroundDraw();
});

gridToggle.addEventListener("click", () => {
  state.showGrid = !state.showGrid;
  updateToggleButtons();
  drawBackgroundLayer();
});

backgroundToggle.addEventListener("click", () => {
  state.showBackground = !state.showBackground;
  updateToggleButtons();
  drawBackgroundLayer();
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
  drawBackgroundLayer();
});

applyCropButton.addEventListener("click", () => {
  if (cropState.selection && cropState.selection.width > 6 && cropState.selection.height > 6) {
    state.crop = previewRectToImageCrop(cropState.selection, cropState.previewRect);
  }
  cropDialog.close();
  drawBackgroundLayer();
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

function updateLayoutAfterResize() {
  if (deleteEffects.isActive()) {
    layoutUpdatePending = true;
    return;
  }
  layoutUpdatePending = false;
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

const layoutResizeScheduler = createFrameScheduler(updateLayoutAfterResize);
window.addEventListener("resize", layoutResizeScheduler.schedule);

window.addEventListener(
  "pagehide",
  () => {
    libraryRequestGate.cancel();
    mediaLoadRequestGate.cancel();
    pdfPageRequestGate.cancel();
    pdfThumbnailQueue.clear();
    backgroundDrawScheduler.cancel();
    layoutResizeScheduler.cancel();
    browserFiles.dispose();
    disposeAudioEffects();
    gauntletAnimation.dispose();
    timeGauntletAnimation.dispose();
    pdfService.disposeDocument(state.pdfDocument);
    window.removeEventListener("keydown", handleKeyboardShortcut);
    window.removeEventListener("resize", layoutResizeScheduler.schedule);
  },
  { once: true },
);

setTheme(state.theme, { updatePen: state.theme !== "current" });
updateMenuSwap();
fitCanvasToContainer();
updateUndoButton();
updateRangeValues();
updateColorPalette();
updateToggleButtons();
setToolMode("pressure");
updateFileCropButton();
loadLibrary();
