const selectors = {
  appShell: ".app-shell",
  canvas: "#practiceCanvas",
  clearButton: "#clearButton",
  gauntletCanvas: "#gauntletAnimation",
  undoButton: "#undoButton",
  timeGauntletCanvas: "#timeGauntletAnimation",
  swapMenuButton: "#swapMenuButton",
  currentThemeButton: "#currentThemeButton",
  darkThemeButton: "#darkThemeButton",
  violetThemeButton: "#violetThemeButton",
  sunsetThemeButton: "#sunsetThemeButton",
  chooseFileButton: "#chooseFileButton",
  penSizeInput: "#penSize",
  backgroundOpacityInput: "#backgroundOpacity",
  backgroundScaleInput: "#backgroundScale",
  penSizeValue: "#penSizeValue",
  backgroundOpacityValue: "#backgroundOpacityValue",
  backgroundScaleValue: "#backgroundScaleValue",
  gridToggle: "#gridToggle",
  backgroundToggle: "#backgroundToggle",
  pointerModeButton: "#pointerModeButton",
  handModeButton: "#handModeButton",
  brushModeButton: "#brushModeButton",
  pressureModeButton: "#pressureModeButton",
  cropButton: "#cropButton",
  fileCropButton: "#fileCropButton",
  cropDialog: "#cropDialog",
  cropCanvas: "#cropCanvas",
  applyCropButton: "#applyCropButton",
  resetCropButton: "#resetCropButton",
  closeCropButton: "#closeCropButton",
  fileCropDialog: "#fileCropDialog",
  fileCropCanvas: "#fileCropCanvas",
  closeFileCropButton: "#closeFileCropButton",
  autoCropButton: "#autoCropButton",
  applyFileCropButton: "#applyFileCropButton",
  libraryTitle: "#libraryTitle",
  folderPathInput: "#folderPathInput",
  libraryList: "#libraryList",
  refreshLibraryButton: "#refreshLibraryButton",
  sortByDateButton: "#sortByDateButton",
  sortByNameButton: "#sortByNameButton",
  colorPickerButton: "#colorPickerButton",
  colorPickerInput: "#colorPickerInput",
};

export function queryAppElements(documentRef = document) {
  const elements = {};
  for (const [name, selector] of Object.entries(selectors)) {
    const element = documentRef.querySelector(selector);
    if (!element) throw new Error(`Required application element was not found: ${selector}`);
    elements[name] = element;
  }

  elements.colorSwatches = Array.from(
    documentRef.querySelectorAll(".color-swatch[data-color-index]"),
  );
  elements.rangeInputs = Array.from(documentRef.querySelectorAll('input[type="range"]'));
  if (!elements.colorSwatches.length || !elements.rangeInputs.length) {
    throw new Error("Required application control groups were not found.");
  }
  return elements;
}
