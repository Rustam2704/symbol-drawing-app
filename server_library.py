import base64
import mimetypes
import re
from pathlib import Path
from urllib.parse import quote, unquote


ROOT = Path(__file__).resolve().parent
IMAGES_DIR = ROOT / "images"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".ico", ".avif", ".gif", ".svg"}
LIBRARY_EXTENSIONS = IMAGE_EXTENSIONS | {".pdf"}


def resolve_folder(raw_folder=""):
    if raw_folder:
        folder = Path(unquote(raw_folder)).expanduser()
        folder = folder.resolve() if folder.is_absolute() else (ROOT / folder).resolve()
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


def decode_image_data_url(data_url):
    match = re.fullmatch(r"data:(image/[^;]+);base64,(.+)", data_url, re.DOTALL)
    if not match:
        raise ValueError("Invalid cropped image data.")
    try:
        content = base64.b64decode(match.group(2), validate=True)
    except (ValueError, base64.binascii.Error) as error:
        raise ValueError("Invalid cropped image data.") from error
    if not content:
        raise ValueError("Cropped image is empty.")
    return match.group(1).lower(), content
