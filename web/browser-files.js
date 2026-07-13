const ALLOWED_FILE_PATTERN = /\.(png|jpe?g|webp|ico|avif|gif|svg|pdf)$/i;

export function createBrowserFiles({
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  urlApi = globalThis.URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  let directoryHandle = null;
  let selectedFiles = [];
  let objectUrls = [];

  function releaseObjectUrls() {
    objectUrls.forEach((url) => urlApi.revokeObjectURL(url));
    objectUrls = [];
  }

  function makeItem(file, handle = null) {
    const url = urlApi.createObjectURL(file);
    objectUrls.push(url);
    return {
      name: file.name,
      folder: directoryHandle?.name || "Selected folder",
      url,
      type: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
      mime: file.type || "application/octet-stream",
      mtime: file.lastModified || 0,
      size: file.size,
      file,
      handle,
      source: "browser",
    };
  }

  function chooseDirectoryWithInput() {
    return new Promise((resolve) => {
      const input = documentRef.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.webkitdirectory = true;
      input.accept = "image/*,.pdf";
      input.addEventListener("change", () => resolve(Array.from(input.files || [])), { once: true });
      input.click();
    });
  }

  const api = {
    isActive() {
      return Boolean(directoryHandle || selectedFiles.length);
    },

    canWrite() {
      return Boolean(directoryHandle);
    },

    async chooseFolder() {
      if ("showDirectoryPicker" in windowRef) {
        directoryHandle = await windowRef.showDirectoryPicker({ mode: "readwrite" });
        selectedFiles = [];
        return api.scan();
      }
      directoryHandle = null;
      selectedFiles = await chooseDirectoryWithInput();
      if (!selectedFiles.length) return null;
      return api.scan();
    },

    async scan() {
      releaseObjectUrls();
      const items = [];
      if (directoryHandle) {
        for await (const handle of directoryHandle.values()) {
          if (handle.kind !== "file" || !ALLOWED_FILE_PATTERN.test(handle.name)) continue;
          items.push(makeItem(await handle.getFile(), handle));
        }
        return { folder: directoryHandle.name, items, writable: true };
      }

      for (const file of selectedFiles) {
        const relativeParts = (file.webkitRelativePath || file.name).split("/");
        if (relativeParts.length <= 2 && ALLOWED_FILE_PATTERN.test(file.name)) items.push(makeItem(file));
      }
      const relativePath = selectedFiles[0]?.webkitRelativePath || "";
      return {
        folder: relativePath.split("/")[0] || "Selected folder",
        items,
        writable: false,
      };
    },

    async getFile(item) {
      return item.handle ? item.handle.getFile() : item.file;
    },

    async saveCrop(item, dataUrl) {
      if (!directoryHandle || !item.handle) {
        throw new Error("This browser only granted read access. Choose the folder in Chrome or Edge to edit files.");
      }
      const croppedBlob = await (await fetchImpl(dataUrl)).blob();
      const originalFile = await item.handle.getFile();
      const oldDirectory = await directoryHandle.getDirectoryHandle("crop-originals-signs-app", { create: true });
      const archiveHandle = await oldDirectory.getFileHandle(item.name, { create: true });
      const archiveWriter = await archiveHandle.createWritable();
      await archiveWriter.write(originalFile);
      await archiveWriter.close();

      const extension = item.name.split(".").pop().toLowerCase();
      const shouldUsePng = croppedBlob.type === "image/png" && extension !== "png";
      const outputName = shouldUsePng ? item.name.replace(/\.[^.]+$/, ".png") : item.name;
      let outputHandle = item.handle;
      if (outputName !== item.name) {
        try {
          await directoryHandle.getFileHandle(outputName);
          throw new Error(`Cropped PNG already exists: ${outputName}`);
        } catch (error) {
          if (error.name !== "NotFoundError") throw error;
        }
        outputHandle = await directoryHandle.getFileHandle(outputName, { create: true });
      }

      const writer = await outputHandle.createWritable();
      await writer.write(croppedBlob);
      await writer.close();
      if (outputName !== item.name) await directoryHandle.removeEntry(item.name);
      return { name: outputName, folder: directoryHandle.name };
    },

    dispose() {
      releaseObjectUrls();
      directoryHandle = null;
      selectedFiles = [];
    },
  };

  return api;
}

export const browserFiles = createBrowserFiles();
