from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import db
from routers.auth import require_admin

router = APIRouter(prefix="/api/events", tags=["events"])


class EventBody(BaseModel):
    name: str
    description: str | None = None


class FolderBody(BaseModel):
    folder_id: str


@router.get("")
def list_events():
    return db.get_all_events()


@router.post("", dependencies=[Depends(require_admin)])
def create_event(body: EventBody):
    eid = db.create_event(body.name, body.description)
    return db.get_event(eid)


@router.put("/{slug}", dependencies=[Depends(require_admin)])
def update_event(slug: str, body: EventBody):
    ev = db.get_event_by_slug(slug)
    if not ev:
        raise HTTPException(404, "Event not found")
    db.update_event(ev["id"], body.name, body.description)
    return db.get_event(ev["id"])


@router.delete("/{slug}", dependencies=[Depends(require_admin)])
def delete_event(slug: str):
    ev = db.get_event_by_slug(slug)
    if not ev:
        raise HTTPException(404, "Event not found")
    db.delete_event(ev["id"])
    return {"ok": True}


@router.post("/{slug}/folders", dependencies=[Depends(require_admin)])
def add_folder(slug: str, body: FolderBody):
    ev = db.get_event_by_slug(slug)
    if not ev:
        raise HTTPException(404, "Event not found")
    db.add_folder_to_event(ev["id"], body.folder_id)
    return db.get_event(ev["id"])


@router.delete("/{slug}/folders/{folder_id}", dependencies=[Depends(require_admin)])
def remove_folder(slug: str, folder_id: str):
    ev = db.get_event_by_slug(slug)
    if not ev:
        raise HTTPException(404, "Event not found")
    db.remove_folder_from_event(ev["id"], folder_id)
    return db.get_event(ev["id"])
