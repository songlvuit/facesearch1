"""
Face Search App — FastAPI server
- /api/*          → REST API
- /data/photos    → static full images
- /data/thumbnails→ static thumbnails
- /*              → React SPA (production build in ./static/)
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import db
from routers import photos, search, sync, auth

# ── App ───────────────────────────────────────────────────────────────────────
db.init_db()

app = FastAPI(title="Face Search API", docs_url="/api/docs", redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],   # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(photos.router)
app.include_router(search.router)
app.include_router(sync.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Static data files ─────────────────────────────────────────────────────────
DATA_DIR   = Path(__file__).parent.parent / "data"
PHOTOS_DIR = DATA_DIR / "photos"
THUMBS_DIR = DATA_DIR / "thumbnails"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
THUMBS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/data/photos",     StaticFiles(directory=str(PHOTOS_DIR)), name="photos")
app.mount("/data/thumbnails", StaticFiles(directory=str(THUMBS_DIR)), name="thumbnails")

# ── React SPA (production) ────────────────────────────────────────────────────
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        """Serve index.html for all non-API routes (client-side routing)."""
        index = STATIC_DIR / "index.html"
        return FileResponse(index)
