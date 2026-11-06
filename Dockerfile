# ==============================================================================
# AutoClip Studio - Universal Cross-Platform Container (Linux / macOS / Windows)
# ==============================================================================
FROM node:20-bookworm-slim

# Install system dependencies: FFmpeg, Python3, and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python AI packages in virtual environment or with break-system-packages
RUN pip install --no-cache-dir --break-system-packages \
    faster-whisper \
    yt-dlp \
    opencv-python-headless

# Install Node dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy project source
COPY . .

# Set environment
ENV PORT=4173
ENV NODE_ENV=production
ENV AUTOCLIP_DATA_DIR=/app/work/data

# Volume for persistent jobs, videos, and settings
VOLUME [ "/app/work/data" ]

EXPOSE 4173

CMD ["node", "server.js"]
