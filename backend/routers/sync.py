"""Full-pipeline sync: download → thumbnail → embedding → DB (one pass per photo)."""
import threading, uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import db, drive_utils, face_utils, thumbnail_utils
from routers.auth import require_admin

router = APIRouter(prefix="/api/sync", tags=["sync"], dependencies=[Depends(require_admin)])

_jobs: dict[str, dict] = {}
_lock = threading.Lock()
DRIVE_VIEW = "https://drive.google.com/file/d/{}/view"


def _upd(job_id, **kw):
    with _lock:
        _jobs[job_id].update(kw)


def _run(job_id: str, folder_id: str, skip_existing: bool):
    _upd(job_id, status="listing")
    try:
        files = drive_utils.list_images(folder_id)
    except Exception as e:
        _upd(job_id, status="error", error=str(e)); return

    new_files = [f for f in files if not (skip_existing and db.file_id_exists(f["id"]))]
    _upd(job_id, status="running", total=len(files), new=len(new_files),
         done=0, downloaded=0, thumbnailed=0, indexed=0,
         skipped=len(files)-len(new_files), failed=0, errors=[])

    for i, f in enumerate(new_files):
        # 1. Download
        try:
            local = drive_utils.download_image(f["id"], f["name"])
            _upd(job_id, downloaded=_jobs[job_id]["downloaded"]+1)
        except Exception as e:
            with _lock:
                _jobs[job_id]["failed"] += 1
                _jobs[job_id]["errors"].append({"file": f["name"], "error": str(e)})
            continue

        # 2. Thumbnail + fullsize
        thumb, full = None, None
        try:
            thumb, full = thumbnail_utils.make(local, f["id"])
            _upd(job_id, thumbnailed=_jobs[job_id]["thumbnailed"]+1)
        except Exception:
            pass

        # 3. Save metadata
        pid = db.upsert_photo(
            file_id=f["id"], file_name=f["name"], local_path=str(local),
            drive_link=DRIVE_VIEW.format(f["id"]),
            thumbnail_path=str(thumb) if thumb else None,
            fullsize_path=str(full) if full else None,
            folder_id=folder_id,
        )

        # 4. Embedding
        try:
            db.save_embedding(pid, face_utils.extract_embedding(local))
            _upd(job_id, indexed=_jobs[job_id]["indexed"]+1)
        except face_utils.NoFaceError:
            pass
        except Exception as e:
            with _lock:
                _jobs[job_id]["errors"].append({"file": f["name"], "step": "embed", "error": str(e)})

        _upd(job_id, done=i+1)

    db.update_folder_sync(folder_id, len(new_files))
    _upd(job_id, status="finished")


class SyncBody(BaseModel):
    folder_id:     str
    folder_name:   str | None = None
    skip_existing: bool = True


@router.post("/start")
def start_sync(body: SyncBody):
    db.upsert_folder(body.folder_id, body.folder_name)
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = dict(status="pending", folder_id=body.folder_id,
                             total=0, new=0, done=0, downloaded=0,
                             thumbnailed=0, indexed=0, skipped=0, failed=0, errors=[])
    threading.Thread(target=_run, args=(job_id, body.folder_id, body.skip_existing), daemon=True).start()
    return {"job_id": job_id}


@router.get("/status/{job_id}")
def status(job_id: str):
    with _lock:
        j = _jobs.get(job_id)
    if not j:
        raise HTTPException(404, "Job not found")
    return j


@router.get("/folders")
def list_folders():
    return [dict(r) for r in db.get_all_folders()]


@router.delete("/folders/{folder_id}")
def del_folder(folder_id: str):
    db.delete_folder(folder_id)
    return {"ok": True}


@router.get("/stats")
def stats():
    return db.get_stats()


def _run_reindex(job_id: str):
    photos = db.get_unindexed_photos()
    _upd(job_id, status="running", total=len(photos), done=0, indexed=0, failed=0, errors=[])
    for i, p in enumerate(photos):
        try:
            db.save_embedding(p["id"], face_utils.extract_embedding(p["local_path"]))
            _upd(job_id, indexed=_jobs[job_id]["indexed"] + 1)
        except face_utils.NoFaceError:
            pass
        except Exception as e:
            with _lock:
                _jobs[job_id]["failed"] += 1
                _jobs[job_id]["errors"].append({"file": p["file_name"], "error": str(e)})
        _upd(job_id, done=i + 1)
    _upd(job_id, status="finished")


@router.post("/reindex")
def start_reindex():
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = dict(status="pending", total=0, done=0, indexed=0, failed=0, errors=[])
    threading.Thread(target=_run_reindex, args=(job_id,), daemon=True).start()
    return {"job_id": job_id}


class ImportBody(BaseModel):
    file_id: str   # Google Drive file ID của face_index.json


def _run_import(job_id: str, file_id: str):
    import json
    _upd(job_id, status="downloading")
    try:
        import io
        data = drive_utils.download_file_bytes(file_id)
        records = json.loads(data)
    except Exception as e:
        _upd(job_id, status="error", error=str(e)); return

    _upd(job_id, status="running", total=len(records), done=0, indexed=0, skipped=0, errors=[])
    for i, r in enumerate(records):
        try:
            pid = db.upsert_photo(
                file_id=r["file_id"], file_name=r["file_name"],
                local_path=r.get("local_path", ""),
                drive_link=r.get("drive_link"),
                folder_id=r.get("folder_id"),
            )
            if r.get("embedding"):
                db.save_embedding(pid, r["embedding"])
                _upd(job_id, indexed=_jobs[job_id]["indexed"] + 1)
            else:
                _upd(job_id, skipped=_jobs[job_id]["skipped"] + 1)
        except Exception as e:
            with _lock:
                _jobs[job_id]["errors"].append({"file": r.get("file_name"), "error": str(e)})
        _upd(job_id, done=i + 1)

    _upd(job_id, status="finished")


@router.post("/import-colab")
def import_colab(body: ImportBody):
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = dict(status="pending", total=0, done=0, indexed=0, skipped=0, errors=[])
    threading.Thread(target=_run_import, args=(job_id, body.file_id), daemon=True).start()
    return {"job_id": job_id}


class PushBody(BaseModel):
    records: list[dict]
    api_key: str | None = None


def _run_push(job_id: str, records: list[dict]):
    _upd(job_id, status="running", total=len(records), done=0, indexed=0, skipped=0, errors=[])
    for i, r in enumerate(records):
        try:
            pid = db.upsert_photo(
                file_id=r["file_id"], file_name=r["file_name"],
                local_path=r.get("local_path", ""),
                drive_link=r.get("drive_link"),
                folder_id=r.get("folder_id"),
            )
            if r.get("embedding"):
                db.save_embedding(pid, r["embedding"])
                _upd(job_id, indexed=_jobs[job_id]["indexed"] + 1)
            else:
                _upd(job_id, skipped=_jobs[job_id]["skipped"] + 1)
        except Exception as e:
            with _lock:
                _jobs[job_id]["errors"].append({"file": r.get("file_name"), "error": str(e)})
        _upd(job_id, done=i + 1)
    _upd(job_id, status="finished")


@router.post("/push")
def push_embeddings(body: PushBody):
    """Colab gọi endpoint này để push embeddings trực tiếp, không cần Drive file ID."""
    import os
    api_key = os.environ.get("PUSH_API_KEY")
    if api_key and body.api_key != api_key:
        from fastapi import HTTPException
        raise HTTPException(401, "Invalid API key")
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = dict(status="pending", total=0, done=0, indexed=0, skipped=0, errors=[])
    threading.Thread(target=_run_push, args=(job_id, body.records), daemon=True).start()
    return {"job_id": job_id}
