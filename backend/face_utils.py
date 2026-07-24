"""Face embedding extraction (InsightFace: SCRFD detect + ArcFace embed) + vectorised search."""
from __future__ import annotations
from pathlib import Path
import numpy as np

DET_SIZE = (640, 640)   # detection input size
DET_THRESH = 0.5        # face detection confidence threshold

_app = None


def _get_app():
    global _app
    if _app is None:
        import insightface
        _app = insightface.app.FaceAnalysis(
            name="buffalo_l",           # SCRFD detector + ArcFace R100 embedder
            providers=["CPUExecutionProvider"],
        )
        _app.prepare(ctx_id=0, det_size=DET_SIZE, det_thresh=DET_THRESH)
    return _app


class NoFaceError(ValueError):
    pass


def extract_embedding(image_path: str | Path) -> list[float]:
    """Detect + embed với InsightFace. Trả về embedding của mặt lớn nhất."""
    import cv2
    img = cv2.imread(str(image_path))
    if img is None:
        raise NoFaceError(f"Cannot read image: {image_path}")

    faces = _get_app().get(img)
    if not faces:
        raise NoFaceError(f"No face detected in {image_path}")

    # Lấy mặt có bbox lớn nhất
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return face.embedding.tolist()


def build_matrix(embeddings: list[dict]) -> tuple[np.ndarray, list[int]]:
    """Pre-normalised (N, D) float32 matrix + photo_id list."""
    ids = [e["photo_id"] for e in embeddings]
    mat = np.array([e["embedding"] for e in embeddings], dtype=np.float32)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    mat /= np.where(norms == 0, 1.0, norms)
    return mat, ids


def search(query_emb: list[float], embeddings: list[dict],
           top_k: int = 12, threshold: float = 0.4,
           matrix_cache: tuple | None = None) -> list[dict]:
    mat, ids = matrix_cache if matrix_cache else build_matrix(embeddings)
    q = np.array(query_emb, dtype=np.float32)
    q /= max(np.linalg.norm(q), 1e-9)
    sims = mat @ q
    mask = sims >= threshold
    if not mask.any():
        return []
    idx = np.where(mask)[0]
    top = idx[np.argsort(-sims[idx])[:top_k]]
    return [{"photo_id": ids[i], "similarity": float(sims[i])} for i in top]
