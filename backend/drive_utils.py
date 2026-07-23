"""Google Drive — list & download images via Service Account."""
import io, json, os
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

PHOTOS_DIR      = Path(__file__).parent.parent / "data" / "photos"
CREDENTIALS_FILE = Path(__file__).parent.parent / "credentials.json"
SCOPES           = ["https://www.googleapis.com/auth/drive.readonly"]
IMAGE_MIMES      = {"image/jpeg","image/png","image/gif","image/webp","image/bmp","image/tiff"}
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


def _service():
    raw = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if raw:
        info = json.loads(raw)
    elif CREDENTIALS_FILE.exists():
        info = json.loads(CREDENTIALS_FILE.read_text())
    else:
        raise FileNotFoundError(
            "credentials.json not found. Place it in the project root or set GOOGLE_CREDENTIALS_JSON.")
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def list_images(folder_id: str) -> list[dict]:
    svc = _service()
    files, token = [], None
    while True:
        resp = svc.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            pageSize=200, pageToken=token,
            fields="nextPageToken,files(id,name,mimeType,size)",
        ).execute()
        files += [f for f in resp.get("files", []) if f.get("mimeType") in IMAGE_MIMES]
        token = resp.get("nextPageToken")
        if not token:
            break
    return files


def download_file_bytes(file_id: str) -> bytes:
    svc = _service()
    buf = io.BytesIO()
    dl  = MediaIoBaseDownload(buf, svc.files().get_media(fileId=file_id))
    done = False
    while not done:
        _, done = dl.next_chunk()
    return buf.getvalue()


def download_image(file_id: str, file_name: str) -> Path:
    dest = PHOTOS_DIR / file_name
    if dest.exists():
        return dest
    svc = _service()
    buf = io.BytesIO()
    dl  = MediaIoBaseDownload(buf, svc.files().get_media(fileId=file_id))
    done = False
    while not done:
        _, done = dl.next_chunk()
    dest.write_bytes(buf.getvalue())
    return dest
