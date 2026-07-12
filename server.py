from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse
import json
import mimetypes
import os
import shutil
import tkinter as tk
from tkinter import filedialog

from server_library import (
    IMAGE_EXTENSIONS,
    IMAGES_DIR,
    LIBRARY_EXTENSIONS,
    ROOT,
    decode_image_data_url,
    make_item,
    resolve_folder,
    resolve_named_file,
    save_cropped_image,
)

PORT = int(os.environ.get("PORT", "5173"))


class DrawingAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        static_path = urlparse(self.path).path.lower()
        if static_path.endswith((".html", ".css", ".js", ".mjs")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

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
                if not path.is_file() or path.suffix.lower() not in LIBRARY_EXTENSIONS:
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
            if not file_path.is_file() or file_path.suffix.lower() not in LIBRARY_EXTENSIONS:
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
        try:
            payload = self.read_json()
            folder = resolve_folder(str(payload.get("folder") or ""))
            name = str(payload.get("name") or "")
            data_url = str(payload.get("dataUrl") or "")
            image_path = resolve_named_file(folder, name)

            if image_path.suffix.lower() not in IMAGE_EXTENSIONS:
                raise ValueError("Only image files can be cropped.")

            cropped_mime, cropped_bytes = decode_image_data_url(data_url)

            output_path, archived_path = save_cropped_image(
                folder, image_path, cropped_mime, cropped_bytes
            )
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


class DrawingAppServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    os.chdir(ROOT)
    with DrawingAppServer(("127.0.0.1", PORT), DrawingAppHandler) as server:
        print(f"Drawing app server: http://127.0.0.1:{PORT}")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nDrawing app server stopped.")
