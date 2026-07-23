# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build   # outputs to ../backend/static/

# Stage 2: Python runtime
FROM python:3.11-slim
WORKDIR /app/backend

# System deps for OpenCV + DeepFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Install ultralytics with CPU-only torch (saves ~1.5GB vs default GPU build)
RUN pip install --no-cache-dir \
    "torch>=2.0.0" \
    "torchvision>=0.15.0" \
    --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir "ultralytics>=8.3.0"

# Pre-download Facenet512 weights so first request isn't slow
RUN python -c "from deepface import DeepFace; DeepFace.build_model('Facenet512')"

# Copy backend source directly into WORKDIR (/app/backend)
COPY backend/ ./
COPY models/  /app/models/
COPY --from=frontend-builder /app/backend/static ./static

# Data volume (DB + photos + thumbnails)
VOLUME ["/app/data"]

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]