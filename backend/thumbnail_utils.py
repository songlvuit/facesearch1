"""Generate thumbnails: 160×160 (grid preview) + 2048×2048 (download)."""
from pathlib import Path
from PIL import Image

THUMBS_DIR  = Path(__file__).parent.parent / "data" / "thumbnails"
FULL_DIR    = Path(__file__).parent.parent / "data" / "fullsize"
THUMBS_DIR.mkdir(parents=True, exist_ok=True)
FULL_DIR.mkdir(parents=True, exist_ok=True)

THUMB_SIZE = (160, 160)
FULL_SIZE  = (2048, 2048)


def _square_crop(img: Image.Image, size: tuple) -> Image.Image:
    w, h = img.size
    s = min(w, h)
    img = img.crop(((w-s)//2, (h-s)//2, (w+s)//2, (h+s)//2))
    return img.resize(size, Image.LANCZOS)


def make(source: str | Path, file_id: str) -> tuple[Path, Path]:
    """Tạo thumbnail 160px và fullsize 2048px. Trả về (thumb_path, full_path)."""
    thumb_dest = THUMBS_DIR / f"{file_id}.jpg"
    full_dest  = FULL_DIR   / f"{file_id}.jpg"

    if not thumb_dest.exists() or not full_dest.exists():
        with Image.open(source) as img:
            img = img.convert("RGB")
            if not thumb_dest.exists():
                _square_crop(img, THUMB_SIZE).save(thumb_dest, "JPEG", quality=75, optimize=True)
            if not full_dest.exists():
                _square_crop(img, FULL_SIZE).save(full_dest, "JPEG", quality=85, optimize=True)

    return thumb_dest, full_dest
