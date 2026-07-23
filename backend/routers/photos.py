from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, RedirectResponse
import db

router = APIRouter(prefix="/api/photos", tags=["photos"])


def _row(p) -> dict:
    d = dict(p)
    d["tags"]          = db.get_tags(d["id"])
    d["has_embedding"] = db.has_embedding(d["id"])
    thumb = d.get("thumbnail_path")
    local = d.get("local_path", "")
    if thumb and Path(thumb).exists():
        d["thumbnail_url"] = f"/data/thumbnails/{Path(thumb).name}"
    elif local and Path(local).exists():
        d["thumbnail_url"] = f"/api/photos/{d['id']}/image"
    elif d.get("drive_link"):
        # Ảnh import từ Colab không có file local — dùng Drive preview
        file_id = d["drive_link"].split("/d/")[1].split("/")[0]
        d["thumbnail_url"] = f"https://drive.google.com/thumbnail?id={file_id}&sz=w320"
    else:
        d["thumbnail_url"] = None
    return d


@router.get("")
def list_photos(q: str = Query(default="")):
    photos = db.search_photos(q) if q else db.get_all_photos()
    return [_row(p) for p in photos]


@router.get("/tags/all")
def all_tags():
    return db.get_all_tags()


@router.get("/{photo_id}")
def get_photo(photo_id: int):
    p = db.get_photo_by_id(photo_id)
    if not p:
        raise HTTPException(404, "Not found")
    return _row(p)


@router.get("/{photo_id}/image")
def serve_image(photo_id: int):
    p = db.get_photo_by_id(photo_id)
    if not p:
        raise HTTPException(404)
    local = p["local_path"]
    if local and Path(local).exists():
        return FileResponse(Path(local))
    # Fallback: redirect to Drive thumbnail
    if p["drive_link"]:
        file_id = p["drive_link"].split("/d/")[1].split("/")[0]
        return RedirectResponse(f"https://drive.google.com/thumbnail?id={file_id}&sz=w320")
    raise HTTPException(404, "File missing on disk")


@router.post("/{photo_id}/tags")
def add_tag(photo_id: int, body: dict):
    if not db.get_photo_by_id(photo_id):
        raise HTTPException(404)
    for t in body.get("tag", "").split(","):
        db.add_tag(photo_id, t)
    return db.get_tags(photo_id)


@router.delete("/{photo_id}/tags/{tag}")
def del_tag(photo_id: int, tag: str):
    if not db.get_photo_by_id(photo_id):
        raise HTTPException(404)
    db.remove_tag(photo_id, tag)
    return db.get_tags(photo_id)
