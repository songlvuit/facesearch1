"""Face embedding extraction (YOLOv11 detect + DeepFace Facenet512 embed) + vectorised search."""
from __future__ import annotations
from pathlib import Path
import numpy as np

EMBED_MODEL  = "Facenet512"
YOLO_MODEL_PATH = Path(__file__).parent.parent / "models" / "yolov11_face.pt"
CONF_THRESHOLD  = 0.25   # YOLO confidence threshold
FACE_PAD        = 0.15   # padding ratio around detected face box

_yolo_model = None


def _get_yolo():
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        if not YOLO_MODEL_PATH.exists():
            raise FileNotFoundError(
                f"YOLO model not found at {YOLO_MODEL_PATH}. "
                "Đặt file model vào thư mục models/yolov11_face.pt"
            )
        _yolo_model = YOLO(str(YOLO_MODEL_PATH))
    return _yolo_model


class NoFaceError(ValueError):
    pass


def _detect_and_crop(image_path: str | Path):
    """Run YOLOv11 on image, return list of cropped face arrays (numpy BGR)."""
    import cv2
    img = cv2.imread(str(image_path))
    if img is None:
        raise NoFaceError(f"Cannot read image: {image_path}")

    h, w = img.shape[:2]
    results = _get_yolo()(str(image_path), conf=CONF_THRESHOLD, verbose=False)
    boxes = results[0].boxes

    if boxes is None or len(boxes) == 0:
        raise NoFaceError(f"No face detected in {image_path}")

    crops = []
    for box in boxes.xyxy.cpu().numpy():
        x1, y1, x2, y2 = box[:4]
        # add padding
        pw = (x2 - x1) * FACE_PAD
        ph = (y2 - y1) * FACE_PAD
        x1 = max(0, int(x1 - pw))
        y1 = max(0, int(y1 - ph))
        x2 = min(w, int(x2 + pw))
        y2 = min(h, int(y2 + ph))
        crops.append(img[y1:y2, x1:x2])

    return crops


def extract_embedding(image_path: str | Path) -> list[float]:
    """Detect face with YOLOv11, embed largest crop with Facenet512."""
    from deepface import DeepFace
    import cv2

    crops = _detect_and_crop(image_path)
    crop = max(crops, key=lambda c: c.shape[0] * c.shape[1])

    # DeepFace accepts numpy array (BGR) directly — no temp file needed
    crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    try:
        res = DeepFace.represent(
            crop_rgb,
            model_name=EMBED_MODEL,
            detector_backend="skip",
            enforce_detection=False,
            align=False,
        )
        if not res:
            raise NoFaceError(f"Embedding failed for {image_path}")
        return res[0]["embedding"]
    except Exception as e:
        if isinstance(e, NoFaceError):
            raise
        raise NoFaceError(str(e)) from e


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
    idx  = np.where(mask)[0]
    top  = idx[np.argsort(-sims[idx])[:top_k]]
    return [{"photo_id": ids[i], "similarity": float(sims[i])} for i in top]
