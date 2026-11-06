#!/usr/bin/env bash
# ==============================================================================
# AutoClip Pro Studio - macOS One-Click Setup Script
# Supports Intel (x86_64) and Apple Silicon (M1/M2/M3/M4 arm64)
# ==============================================================================

set -e

echo ""
echo "🍎 ======================================================"
echo "   AutoClip Pro Studio - macOS Installation & Setup"
echo "=========================================================="
echo ""

# 1. Check / Install Homebrew
if ! command -v brew &> /dev/null; then
  echo "⚠️ Homebrew not found. Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# 2. Install FFmpeg & Python 3.12+ if missing
echo "📦 Checking system dependencies (FFmpeg, Python3, Node.js)..."
if ! command -v ffmpeg &> /dev/null; then
  echo "📥 Installing FFmpeg via Homebrew..."
  brew install ffmpeg
else
  echo "✅ FFmpeg is installed."
fi

if ! command -v python3 &> /dev/null; then
  echo "📥 Installing Python 3 via Homebrew..."
  brew install python@3.12
else
  echo "✅ Python 3 is installed ($(python3 --version))."
fi

if ! command -v node &> /dev/null; then
  echo "📥 Installing Node.js via Homebrew..."
  brew install node@20
else
  echo "✅ Node.js is installed ($(node --version))."
fi

# 3. Create & Activate Python Virtual Environment
echo ""
echo "🐍 Setting up Python virtual environment for Faster-Whisper & OpenCV..."
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate

# Upgrade pip & install faster-whisper (Apple Silicon utilizes NEON vector extensions)
pip install --upgrade pip
pip install faster-whisper yt-dlp opencv-python

echo "✅ Python AI dependencies installed successfully!"

# 4. Install Node.js NPM Packages
echo ""
echo "📦 Installing Node dependencies..."
npm install

echo ""
echo "🎉 ======================================================"
echo "   Setup Complete! Starting AutoClip Studio..."
echo "   Local URL: http://localhost:4173"
echo "=========================================================="
echo ""

# Launch Desktop App
npm start
