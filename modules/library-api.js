export function createLibraryApi({ createUrl, fetchImpl = fetch }) {
  async function requestJson(url, options, fallbackMessage) {
    const response = await fetchImpl(url, options);
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `${fallbackMessage} (${response.status})`);
    }
    return payload;
  }

  return {
    async selectFile(params) {
      return requestJson(
        createUrl("/api/select-file", params),
        { cache: "no-store" },
        "File picker failed",
      );
    },

    async listImages(folder, { signal } = {}) {
      return requestJson(
        createUrl("/api/images", { dir: folder }),
        { cache: "no-store", signal },
        "API unavailable",
      );
    },

    async cropImage({ folder, name, dataUrl }) {
      return requestJson(
        "/api/crop-image",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder, name, dataUrl }),
        },
        "Crop failed",
      );
    },

    async readBuffer(url) {
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`File loading failed (${response.status})`);
      }
      return response.arrayBuffer();
    },

    async readDefaultDirectory({ signal } = {}) {
      const response = await fetchImpl("/images/", { cache: "no-store", signal });
      if (!response.ok) {
        throw new Error(`Folder listing unavailable (${response.status})`);
      }
      return response.text();
    },
  };
}
