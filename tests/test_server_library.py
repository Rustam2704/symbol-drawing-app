import base64
import tempfile
import unittest
from pathlib import Path

from server_library import decode_image_data_url, make_item, resolve_named_file


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


if __name__ == "__main__":
    unittest.main()
