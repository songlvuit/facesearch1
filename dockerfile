# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.11-slim
WORKDIR /app/backend

# System deps for OpenCV + InsightFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Pre-download InsightFace buffalo_l model (SCRFD + ArcFace)
RUN python -c "import insightface; app=insightface.app.FaceAnalysis(name='buffalo_l',providers=['CPUExecutionProvider']); app.prepare(ctx_id=0)"

# Copy backend source
COPY backend/ ./
COPY --from=frontend-builder /app/backend/static ./static

VOLUME ["/app/data"]
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
