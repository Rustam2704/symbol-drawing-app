from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse
import base64
import json
import mimetypes
import os
import re
import shutil
import tkinter as tk
from tkinter import filedialog


ROOT = Path(__file__).resolve().parent
IMAGES_DIR = ROOT / "images"
PORT = int(os.environ.get("PORT", "5173"))
ALLOWED_LIBRARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".ico", ".avif", ".gif", ".svg", ".pdf"}


def resolve_folder(raw_folder=""):
    if raw_folder:
        folder = Path(unquote(raw_folder)).expanduser()
        if not folder.is_absolute():
            folder = (ROOT / folder).resolve()
        else:
            folder = folder.resolve()
    else:
        folder = IMAGES_DIR.resolve()

    if not folder.exists() or not folder.is_dir():
        raise ValueError("Folder was not found.")

    return folder


def resolve_named_file(folder, name):
    if name != Path(name).name or not name:
        raise ValueError("Invalid file name.")

    file_path = (folder / name).resolve()
    if folder.resolve() not in file_path.parents or not file_path.is_file():
        raise ValueError("File was not found.")

    return file_path


def make_item(path):
    folder = path.parent.resolve()
    stat = path.stat()
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return {
        "name": path.name,
        "folder": str(folder),
        "url": f"/api/file?dir={quote(str(folder))}&name={quote(path.name)}",
        "type": "pdf" if path.suffix.lower() == ".pdf" else "image",
        "mime": mime_type,
        "mtime": stat.st_mtime,
        "ctime": stat.st_ctime,
        "size": stat.st_size,
    }


class DrawingAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/images":
            self.send_images()
            return

        if parsed.path == "/api/file":
            self.send_file()
            return

        if parsed.path == "/api/select-folder":
            self.select_folder()
            return

        if parsed.path == "/api/select-file":
            self.select_file()
            return

        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path == "/api/crop-image":
            self.crop_image()
            return

        self.send_error(404)

    def send_images(self):
        items = []
        try:
            query = parse_qs(urlparse(self.path).query)
            folder = resolve_folder(query.get("dir", [""])[0])

            for path in sorted(folder.iterdir(), key=lambda item: item.name.casefold()):
                if not path.is_file() or path.suffix.lower() not in ALLOWED_LIBRARY_EXTENSIONS:
                    continue
                items.append(make_item(path))
            payload = {"folder": str(folder), "items": items}
        except Exception as error:
            self.send_json(400, {"items": [], "error": str(error)})
            return

        payload = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_file(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            folder = resolve_folder(query.get("dir", [""])[0])
            name = query.get("name", [""])[0]
            file_path = resolve_named_file(folder, name)
            mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            stat = file_path.stat()

            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Cache-Control", "public, max-age=31536000")
            self.send_header("Content-Length", str(stat.st_size))
            self.end_headers()
            with file_path.open("rb") as handle:
                shutil.copyfileobj(handle, self.wfile)
        except Exception as error:
            self.send_error(404, str(error))

    def select_folder(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            initial = query.get("dir", [""])[0]
            initial_dir = str(resolve_folder(initial)) if initial else str(IMAGES_DIR.resolve())
            dialog_x = int(float(query.get("x", ["120"])[0]))
            dialog_y = int(float(query.get("y", ["120"])[0]))

            root = tk.Tk()
            root.geometry(f"1x1+{dialog_x}+{dialog_y}")
            root.attributes("-topmost", True)
            root.attributes("-alpha", 0.01)
            root.update_idletasks()
            root.lift()
            selected = filedialog.askdirectory(parent=root, initialdir=initial_dir, title="Select image folder")
            root.destroy()

            self.send_json(200, {"ok": True, "folder": selected})
        except Exception as error:
            self.send_json(400, {"ok": False, "error": str(error)})

    def select_file(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            initial = query.get("dir", [""])[0]
            initial_dir = str(resolve_folder(initial)) if initial else str(IMAGES_DIR.resolve())
            dialog_x = int(float(query.get("x", ["120"])[0]))
            dialog_y = int(float(query.get("y", ["120"])[0]))

            root = tk.Tk()
            root.geometry(f"1x1+{dialog_x}+{dialog_y}")
            root.attributes("-topmost", True)
            root.attributes("-alpha", 0.01)
            root.update_idletasks()
            root.lift()
            selected = filedialog.askopenfilename(
                parent=root,
                initialdir=initial_dir,
                title="Choose image or PDF",
                filetypes=[
                    ("Images and PDF", "*.png *.jpg *.jpeg *.webp *.ico *.avif *.gif *.svg *.pdf"),
                    ("Images", "*.png *.jpg *.jpeg *.webp *.ico *.avif *.gif *.svg"),
                    ("PDF", "*.pdf"),
                    ("All files", "*.*"),
                ],
            )
            root.destroy()

            if not selected:
                self.send_json(200, {"ok": True, "item": None, "folder": ""})
                return

            file_path = Path(selected).resolve()
            if not file_path.is_file() or file_path.suffix.lower() not in ALLOWED_LIBRARY_EXTENSIONS:
                raise ValueError("Selected file type is not supported.")

            self.send_json(200, {"ok": True, "folder": str(file_path.parent), "item": make_item(file_path)})
        except Exception as error:
            self.send_json(400, {"ok": False, "error": str(error)})

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 30 * 1024 * 1024:
            raise ValueError("Invalid request size.")

        return json.loads(self.rfile.read(length).decode("utf-8"))

    def crop_image(self):
        allowed = {".png", ".jpg", ".jpeg", ".webp", ".ico", ".avif", ".gif", ".svg"}

        try:
            payload = self.read_json()
            folder = resolve_folder(str(payload.get("folder") or ""))
            name = str(payload.get("name") or "")
            data_url = str(payload.get("dataUrl") or "")
            image_path = resolve_named_file(folder, name)

            if image_path.suffix.lower() not in allowed:
                raise ValueError("Only image files can be cropped.")

            match = re.fullmatch(r"data:(image/[^;]+);base64,(.+)", data_url, re.DOTALL)
            if not match:
                raise ValueError("Invalid cropped image data.")

            cropped_mime = match.group(1).lower()
            cropped_bytes = base64.b64decode(match.group(2), validate=True)
            if not cropped_bytes:
                raise ValueError("Cropped image is empty.")

            old_dir = folder / "old"
            old_dir.mkdir(parents=True, exist_ok=True)
            archived_path = old_dir / image_path.name
            shutil.copy2(str(image_path), str(archived_path))

            output_path = image_path
            if image_path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
                output_path = image_path.with_suffix(".png")
                if output_path.exists() and output_path != image_path:
                    raise ValueError(f"Cropped PNG already exists: {output_path.name}")
                image_path.unlink()
            elif cropped_mime == "image/png" and image_path.suffix.lower() not in {".png"}:
                output_path = image_path.with_suffix(".png")
                if output_path.exists() and output_path != image_path:
                    raise ValueError(f"Cropped PNG already exists: {output_path.name}")
                image_path.unlink()

            output_path.write_bytes(cropped_bytes)
            stat = output_path.stat()
            self.send_json(
                200,
                {
                    "ok": True,
                    "folder": str(folder),
                    "name": output_path.name,
                    "oldName": archived_path.name,
                    "mtime": stat.st_mtime,
                    "size": stat.st_size,
                    "url": f"/api/file?dir={quote(str(folder))}&name={quote(output_path.name)}",
                },
            )
        except Exception as error:
            self.send_json(400, {"ok": False, "error": str(error)})


if __name__ == "__main__":
    os.chdir(ROOT)
    with ThreadingHTTPServer(("127.0.0.1", PORT), DrawingAppHandler) as server:
        print(f"Drawing app server: http://127.0.0.1:{PORT}")
        server.serve_forever()
