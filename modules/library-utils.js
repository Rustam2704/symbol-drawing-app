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

export function getLibraryItemKey(item, defaultFolder = "") {
  return `${item.folder || defaultFolder}\\${item.name}`;
}

export function createVersionedImageUrl(item, cropRevisions, defaultFolder = "") {
  if (item.source === "browser") return item.url;
  const fileVersion = `${item.mtime || 0}-${item.size || 0}`;
  const cropRevision = cropRevisions.get(getLibraryItemKey(item, defaultFolder)) || 0;
  const separator = item.url.includes("?") ? "&" : "?";
  return `${item.url}${separator}v=${encodeURIComponent(`${fileVersion}-${cropRevision}`)}`;
}

export function findLibraryItemForFile(file, items) {
  if (!file || file.name.toLowerCase().endsWith(".pdf")) return null;
  return (
    items.find(
      (item) => item.type === "image" && item.name.toLowerCase() === file.name.toLowerCase(),
    ) || null
  );
}

export function parseDirectoryListing(
  html,
  { folder, createUrl, Parser = globalThis.DOMParser },
) {
  const parsed = new Parser().parseFromString(html, "text/html");
  const allowed = /\.(png|jpe?g|webp|ico|avif|gif|svg|pdf)$/i;
  return Array.from(parsed.querySelectorAll("a"))
    .map((link) => decodeURIComponent(link.getAttribute("href") || ""))
    .filter((href) => allowed.test(href))
    .map((href) => {
      const name = href.replace(/\/$/, "").split("/").pop();
      return {
        name,
        folder,
        url: createUrl("/api/file", { dir: folder, name }),
        type: /\.pdf$/i.test(name) ? "pdf" : "image",
        mtime: 0,
      };
    });
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
