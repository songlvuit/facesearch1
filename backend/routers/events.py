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


@router.put("/{event_id}", dependencies=[Depends(require_admin)])
def update_event(event_id: int, body: EventBody):
    if not db.get_event(event_id):
        raise HTTPException(404, "Event not found")
    db.update_event(event_id, body.name, body.description)
    return db.get_event(event_id)


@router.delete("/{event_id}", dependencies=[Depends(require_admin)])
def delete_event(event_id: int):
    if not db.get_event(event_id):
        raise HTTPException(404, "Event not found")
    db.delete_event(event_id)
    return {"ok": True}


@router.post("/{event_id}/folders", dependencies=[Depends(require_admin)])
def add_folder(event_id: int, body: FolderBody):
    if not db.get_event(event_id):
        raise HTTPException(404, "Event not found")
    db.add_folder_to_event(event_id, body.folder_id)
    return db.get_event(event_id)


@router.delete("/{event_id}/folders/{folder_id}", dependencies=[Depends(require_admin)])
def remove_folder(event_id: int, folder_id: str):
    db.remove_folder_from_event(event_id, folder_id)
    return db.get_event(event_id)
