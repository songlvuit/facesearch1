import tempfile
from pathlib import Path
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
import db, face_utils

router = APIRouter(prefix="/api/search", tags=["search"])

# Module-level embedding cache
_cache: dict = {"matrix": None, "ids": [], "raw": []}


def _refresh():
    raw = db.get_all_embeddings()
    if not raw:
        _cache.update({"matrix": None, "ids": [], "raw": []})
        return
    mat, ids = face_utils.build_matrix(raw)
    _cache.update({"matrix": mat, "ids": ids, "raw": raw})


@router.post("/invalidate")
def invalidate():
    _cache["matrix"] = None
    return {"ok": True}


@router.post("")
async def search_by_face(
    file: UploadFile = File(...),
    top_k: int = Form(default=12),
    threshold: float = Form(default=0.4),
    event_id: int = Form(default=None),
):
    suffix = Path(file.filename or "img").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)

    try:
        q_emb = face_utils.extract_embedding(tmp_path)
    except face_utils.NoFaceError:
        raise HTTPException(422, "No face detected in the uploaded image.")
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

    if event_id is not None:
        raw = db.get_embeddings_by_event(event_id)
        if not raw:
            return {"results": [], "total": 0}
        matrix_cache = None
    else:
        if _cache["matrix"] is None:
            _refresh()
        if _cache["matrix"] is None:
            raise HTTPException(400, "No face index yet. Run a sync first.")
        raw = _cache["raw"]
        matrix_cache = (_cache["matrix"], _cache["ids"])

    hits = face_utils.search(q_emb, raw, top_k, threshold, matrix_cache=matrix_cache)

    results = []
    for h in hits:
        p = db.get_photo_by_id(h["photo_id"])
        if p:
            results.append({
                "photo_id":  h["photo_id"],
                "similarity": round(h["similarity"], 4),
                "file_name":  p["file_name"],
                "drive_link": p["drive_link"],
                "tags":       db.get_tags(h["photo_id"]),
                "thumbnail_url": (
                    f"/data/thumbnails/{Path(p['thumbnail_path']).name}"
                    if p["thumbnail_path"] and Path(p["thumbnail_path"]).exists()
                    else f"/api/photos/{h['photo_id']}/image"
                ),
            })
    return {"results": results, "total": len(results)}
