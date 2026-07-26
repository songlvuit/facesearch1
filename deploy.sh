#!/usr/bin/env bash
# Deploy script — chạy trên VPS lần đầu
set -e

echo "▶ Cài Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "▶ Cài Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

echo "▶ Tạo thư mục app..."
mkdir -p /opt/face-search
cd /opt/face-search

echo "▶ Tạo thư mục data..."
mkdir -p data/photos data/thumbnails data/fullsize

echo "✅ Xong! Tiếp theo:"
echo "  1. Copy file lên VPS: scp -r . user@vps:/opt/face-search/"
echo "  2. Copy credentials.json lên VPS"
echo "  3. cd /opt/face-search && docker compose up -d"
