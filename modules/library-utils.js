const imageExtensionPattern = /\.(png|jpe?g|webp|ico|avif|gif|svg)$/i;
const nameCollator =
  typeof Intl !== "undefined" && Intl.Collator
    ? new Intl.Collator("zh-u-co-pinyin", { numeric: true, sensitivity: "base" })
    : null;

export function canCropSourceItem(item) {
  return item?.type === "image" && imageExtensionPattern.test(item.name);
}

export function compareNames(a, b) {
  if (nameCollator) {
    return nameCollator.compare(a, b);
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function createApiUrl(path, params = {}, origin = window.location.origin) {
  const url = new URL(path, origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return `${url.pathname}${url.search}`;
}

export function getFolderFromSelectedFile(file) {
  const rawPath = file?.path || file?.mozFullPath || "";
  if (!rawPath || !/[\\/]/.test(rawPath)) {
    return "";
  }
  return rawPath.replace(/[\\/][^\\/]*$/, "");
}

export function sortLibraryItems(items, sortMode) {
  const sorted = [...items];
  if (sortMode === "name") {
    return sorted.sort((a, b) => compareNames(a.name, b.name));
  }
  return sorted.sort((a, b) => {
    const dateDelta = (b.mtime || 0) - (a.mtime || 0);
    return dateDelta || compareNames(a.name, b.name);
  });
}
