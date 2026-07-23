"""Generate 160×160 square-crop JPEG thumbnails."""
from pathlib import Path
from PIL import Image

THUMBS_DIR = Path(__file__).parent.parent / "data" / "thumbnails"
THUMBS_DIR.mkdir(parents=True, exist_ok=True)
SIZE = (160, 160)


def make(source: str | Path, file_id: str) -> Path:
    dest = THUMBS_DIR / f"{file_id}.jpg"
    if dest.exists():
        return dest
    with Image.open(source) as img:
        img = img.convert("RGB")
        w, h = img.size
        s = min(w, h)
        img = img.crop(((w-s)//2, (h-s)//2, (w+s)//2, (h+s)//2))
        img.resize(SIZE, Image.LANCZOS).save(dest, "JPEG", quality=75, optimize=True)
    return dest
