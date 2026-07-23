"""SQLite database layer."""
import json, sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "database.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with get_conn() as c:
        c.executescript("""
            CREATE TABLE IF NOT EXISTS photos (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id        TEXT UNIQUE NOT NULL,
                file_name      TEXT NOT NULL,
                local_path     TEXT NOT NULL,
                drive_link     TEXT,
                thumbnail_path TEXT,
                folder_id      TEXT,
                created_at     TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS hashtags (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
                tag      TEXT NOT NULL,
                UNIQUE(photo_id, tag)
            );
            CREATE TABLE IF NOT EXISTS face_embeddings (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_id       INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
                embedding_json TEXT NOT NULL,
                created_at     TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS synced_folders (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_id      TEXT UNIQUE NOT NULL,
                folder_name    TEXT,
                last_synced_at TEXT,
                photo_count    INTEGER DEFAULT 0,
                added_at       TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tag      ON hashtags(tag);
            CREATE INDEX IF NOT EXISTS idx_emb      ON face_embeddings(photo_id);
        """)
    # Migrate older DBs
    with get_conn() as c:
        existing = {r[1] for r in c.execute("PRAGMA table_info(photos)")}
        for col in ("drive_link TEXT", "thumbnail_path TEXT", "folder_id TEXT"):
            name = col.split()[0]
            if name not in existing:
                c.execute(f"ALTER TABLE photos ADD COLUMN {col}")
    with get_conn() as c:
        c.execute("CREATE INDEX IF NOT EXISTS idx_folder ON photos(folder_id)")


# ── Photos ────────────────────────────────────────────────────────────────────

def upsert_photo(file_id, file_name, local_path,
                 drive_link=None, thumbnail_path=None, folder_id=None) -> int:
    with get_conn() as c:
        c.execute(
            """INSERT INTO photos (file_id,file_name,local_path,drive_link,thumbnail_path,folder_id,created_at)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(file_id) DO UPDATE SET
                 file_name=excluded.file_name, local_path=excluded.local_path,
                 drive_link=COALESCE(excluded.drive_link,drive_link),
                 thumbnail_path=COALESCE(excluded.thumbnail_path,thumbnail_path),
                 folder_id=COALESCE(excluded.folder_id,folder_id)""",
            (file_id, file_name, local_path, drive_link, thumbnail_path,
             folder_id, datetime.utcnow().isoformat()),
        )
        return c.execute("SELECT id FROM photos WHERE file_id=?", (file_id,)).fetchone()["id"]


def file_id_exists(file_id: str) -> bool:
    with get_conn() as c:
        return c.execute("SELECT 1 FROM photos WHERE file_id=?", (file_id,)).fetchone() is not None


def get_all_photos() -> list:
    with get_conn() as c:
        return c.execute("SELECT * FROM photos ORDER BY created_at DESC").fetchall()


def get_photo_by_id(pid: int):
    with get_conn() as c:
        return c.execute("SELECT * FROM photos WHERE id=?", (pid,)).fetchone()


def search_photos(query: str) -> list:
    with get_conn() as c:
        by_name = c.execute(
            "SELECT * FROM photos WHERE file_name LIKE ? ORDER BY created_at DESC",
            (f"%{query}%",)).fetchall()
        try:
            q = query.strip().lstrip("#").lower()
            by_tag = c.execute(
                "SELECT p.* FROM photos p JOIN hashtags h ON h.photo_id=p.id WHERE h.tag=? ORDER BY p.created_at DESC",
                (q,)).fetchall()
        except Exception:
            by_tag = []
    seen, result = set(), []
    for p in list(by_name) + list(by_tag):
        if p["id"] not in seen:
            seen.add(p["id"]); result.append(p)
    return result


# ── Folders ───────────────────────────────────────────────────────────────────

def upsert_folder(folder_id: str, folder_name: str | None = None) -> None:
    with get_conn() as c:
        c.execute(
            """INSERT INTO synced_folders (folder_id,folder_name,added_at) VALUES (?,?,?)
               ON CONFLICT(folder_id) DO UPDATE SET folder_name=COALESCE(excluded.folder_name,folder_name)""",
            (folder_id, folder_name, datetime.utcnow().isoformat()))


def update_folder_sync(folder_id: str, photo_count: int) -> None:
    with get_conn() as c:
        c.execute("UPDATE synced_folders SET last_synced_at=?,photo_count=? WHERE folder_id=?",
                  (datetime.utcnow().isoformat(), photo_count, folder_id))


def get_all_folders() -> list:
    with get_conn() as c:
        return c.execute("SELECT * FROM synced_folders ORDER BY added_at DESC").fetchall()


def delete_folder(folder_id: str) -> None:
    with get_conn() as c:
        c.execute("DELETE FROM synced_folders WHERE folder_id=?", (folder_id,))


# ── Hashtags ──────────────────────────────────────────────────────────────────

def add_tag(photo_id: int, tag: str) -> None:
    tag = tag.strip().lstrip("#").lower()
    if not tag:
        return
    with get_conn() as c:
        c.execute("INSERT OR IGNORE INTO hashtags (photo_id,tag) VALUES (?,?)", (photo_id, tag))


def remove_tag(photo_id: int, tag: str) -> None:
    with get_conn() as c:
        c.execute("DELETE FROM hashtags WHERE photo_id=? AND tag=?",
                  (photo_id, tag.strip().lstrip("#").lower()))


def get_tags(photo_id: int) -> list[str]:
    with get_conn() as c:
        return [r[0] for r in c.execute(
            "SELECT tag FROM hashtags WHERE photo_id=? ORDER BY tag", (photo_id,))]


def get_photos_by_tag(tag: str) -> list:
    with get_conn() as c:
        return c.execute(
            "SELECT p.* FROM photos p JOIN hashtags h ON h.photo_id=p.id WHERE h.tag=? ORDER BY p.created_at DESC",
            (tag.strip().lstrip("#").lower(),)).fetchall()


def get_all_tags() -> list[str]:
    with get_conn() as c:
        return [r[0] for r in c.execute("SELECT DISTINCT tag FROM hashtags ORDER BY tag")]


# ── Embeddings ────────────────────────────────────────────────────────────────

def save_embedding(photo_id: int, embedding: list[float]) -> None:
    with get_conn() as c:
        c.execute("DELETE FROM face_embeddings WHERE photo_id=?", (photo_id,))
        c.execute("INSERT INTO face_embeddings (photo_id,embedding_json,created_at) VALUES (?,?,?)",
                  (photo_id, json.dumps(embedding), datetime.utcnow().isoformat()))


def get_all_embeddings() -> list[dict]:
    with get_conn() as c:
        return [{"photo_id": r[0], "embedding": json.loads(r[1])}
                for r in c.execute("SELECT photo_id,embedding_json FROM face_embeddings")]


def has_embedding(photo_id: int) -> bool:
    with get_conn() as c:
        return c.execute("SELECT 1 FROM face_embeddings WHERE photo_id=?", (photo_id,)).fetchone() is not None


def get_unindexed_photos() -> list:
    with get_conn() as c:
        return c.execute(
            "SELECT * FROM photos WHERE id NOT IN (SELECT photo_id FROM face_embeddings)"
        ).fetchall()


# ── Stats ─────────────────────────────────────────────────────────────────────

def get_stats() -> dict:
    with get_conn() as c:
        total   = c.execute("SELECT COUNT(*) FROM photos").fetchone()[0]
        indexed = c.execute("SELECT COUNT(*) FROM face_embeddings").fetchone()[0]
        folders = c.execute("SELECT COUNT(*) FROM synced_folders").fetchone()[0]
        tagged  = c.execute("SELECT COUNT(DISTINCT photo_id) FROM hashtags").fetchone()[0]
    return {"total": total, "indexed": indexed, "unindexed": total - indexed,
            "folders": folders, "tagged": tagged}
