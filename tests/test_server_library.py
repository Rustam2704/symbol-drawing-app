import base64
import tempfile
import unittest
from pathlib import Path
from threading import Thread
from urllib.request import urlopen

from server import DrawingAppHandler, DrawingAppServer
from server_library import (
    decode_image_data_url,
    make_item,
    resolve_named_file,
    resolve_selected_library_file,
    save_cropped_image,
)


class ServerLibraryTests(unittest.TestCase):
    def test_make_item_describes_images_and_pdfs(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "你 好.png"
            image.write_bytes(b"png")
            item = make_item(image)
            self.assertEqual(item["type"], "image")
            self.assertEqual(item["size"], 3)
            self.assertIn("%E4%BD%A0", item["url"])

    def test_resolve_named_file_rejects_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / "ok.png").write_bytes(b"ok")
            self.assertEqual(resolve_named_file(folder, "ok.png"), (folder / "ok.png").resolve())
            with self.assertRaisesRegex(ValueError, "Invalid file name"):
                resolve_named_file(folder, "../outside.png")

    def test_decode_image_data_url(self):
        payload = base64.b64encode(b"image").decode("ascii")
        mime, content = decode_image_data_url(f"data:image/png;base64,{payload}")
        self.assertEqual(mime, "image/png")
        self.assertEqual(content, b"image")
        with self.assertRaisesRegex(ValueError, "Invalid cropped image data"):
            decode_image_data_url("not-data")

    def test_static_source_files_require_revalidation(self):
        server = DrawingAppServer(("127.0.0.1", 0), DrawingAppHandler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with urlopen(f"http://127.0.0.1:{server.server_port}/app.js") as response:
                self.assertEqual(response.headers.get("Cache-Control"), "no-cache")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_server_uses_daemon_threads_and_reusable_address(self):
        self.assertTrue(DrawingAppServer.daemon_threads)
        self.assertTrue(DrawingAppServer.allow_reuse_address)

    def test_selected_library_file_is_resolved_and_validated(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            image_path = folder / "symbol.PNG"
            image_path.write_bytes(b"image")
            unsupported_path = folder / "notes.txt"
            unsupported_path.write_text("notes", encoding="utf-8")

            self.assertEqual(resolve_selected_library_file(image_path), image_path.resolve())
            with self.assertRaisesRegex(ValueError, "not supported"):
                resolve_selected_library_file(unsupported_path)
            with self.assertRaisesRegex(ValueError, "not found"):
                resolve_selected_library_file(folder / "missing.png")

    def test_crop_save_replaces_png_atomically_and_archives_original(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            image = folder / "symbol.png"
            image.write_bytes(b"original")
            output, archived = save_cropped_image(folder, image, "image/png", b"cropped")
            self.assertEqual(output, image)
            self.assertEqual(output.read_bytes(), b"cropped")
            self.assertEqual(archived.read_bytes(), b"original")
            self.assertEqual(list(folder.glob(".*.tmp")), [])

    def test_crop_save_changes_jpeg_to_png_after_successful_write(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            image = folder / "symbol.jpg"
            image.write_bytes(b"jpeg")
            output, archived = save_cropped_image(folder, image, "image/png", b"png")
            self.assertEqual(output.name, "symbol.png")
            self.assertEqual(output.read_bytes(), b"png")
            self.assertFalse(image.exists())
            self.assertEqual(archived.read_bytes(), b"jpeg")

    def test_repeated_crop_preserves_every_archived_revision(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            image = folder / "symbol.png"
            image.write_bytes(b"original")

            _, first_archive = save_cropped_image(folder, image, "image/png", b"first crop")
            _, second_archive = save_cropped_image(folder, image, "image/png", b"second crop")

            self.assertEqual(first_archive.name, "symbol.png")
            self.assertEqual(first_archive.read_bytes(), b"original")
            self.assertEqual(second_archive.name, "symbol.2.png")
            self.assertEqual(second_archive.read_bytes(), b"first crop")
            self.assertEqual(image.read_bytes(), b"second crop")


if __name__ == "__main__":
    unittest.main()
