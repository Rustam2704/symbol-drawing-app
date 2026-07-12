export function createLibraryRenderer({
  container,
  getItemUrl,
  onSelectItem,
  onSelectPdfPage,
  renderPdfThumbnail,
}) {
  function renderEmpty(message) {
    const empty = document.createElement("div");
    empty.className = "library-empty";
    empty.textContent = message;
    container.append(empty);
  }

  function renderItems(items) {
    container.innerHTML = "";
    if (!items.length) {
      renderEmpty("No images found in the images folder.");
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const button = document.createElement("button");
      button.className = "library-item";
      button.type = "button";
      button.title = item.name;
      button.addEventListener("click", () => onSelectItem(item));

      if (item.type === "pdf") {
        const thumb = document.createElement("div");
        thumb.className = "library-pdf-thumb";
        thumb.textContent = "PDF";
        button.append(thumb);
      } else {
        const image = document.createElement("img");
        image.src = getItemUrl(item);
        image.alt = "";
        image.loading = "lazy";
        button.append(image);
      }

      const name = document.createElement("span");
      name.className = "library-name";
      name.textContent = item.name.replace(/\.[^.]+$/, "");
      button.append(name);
      fragment.append(button);
    }
    container.append(fragment);
  }

  function renderPdfPages(pages) {
    container.innerHTML = "";
    if (!pages.length) {
      renderEmpty("No PDF pages found.");
      return;
    }

    const fragment = document.createDocumentFragment();
    const thumbnails = [];
    for (const pageNumber of pages) {
      const button = document.createElement("button");
      button.className = "library-item";
      button.type = "button";
      button.title = `Page ${pageNumber}`;
      button.addEventListener("click", () => onSelectPdfPage(pageNumber));

      const thumb = document.createElement("canvas");
      thumb.className = "library-page-thumb";
      button.append(thumb);

      const name = document.createElement("span");
      name.className = "library-name";
      name.textContent = `Page ${pageNumber}`;
      button.append(name);
      fragment.append(button);
      thumbnails.push([pageNumber, thumb]);
    }
    container.append(fragment);
    thumbnails.forEach(([pageNumber, thumb]) => renderPdfThumbnail(pageNumber, thumb));
  }

  return { renderItems, renderPdfPages };
}
