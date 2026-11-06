#!/usr/bin/env bash
# ==============================================================================
# AUTOCLIPIN Pro Studio - Linux One-Click Setup Script
# Supports Ubuntu, Debian, Fedora, Arch Linux, Linux Mint, Pop!_OS
# ==============================================================================

set -e

echo ""
echo "🐧 ======================================================"
echo "   AUTOCLIPIN Pro Studio - Linux Installation & Setup"
echo "=========================================================="
echo ""

# Detect Linux Distribution
if [ -f /etc/debian_version ]; then
  echo "📦 Debian/Ubuntu-based distribution detected."
  sudo apt update
  sudo apt install -y ffmpeg python3 python3-pip python3-venv nodejs npm git
elif [ -f /etc/fedora-release ] || [ -f /etc/redhat-release ]; then
  echo "📦 Fedora/RHEL-based distribution detected."
  sudo dnf install -y ffmpeg python3 python3-pip nodejs git
elif [ -f /etc/arch-release ]; then
  echo "📦 Arch Linux detected."
  sudo pacman -Sy --noconfirm ffmpeg python python-pip nodejs npm git
else
  echo "⚠️ Generic Linux detected. Please ensure ffmpeg, python3, and node are installed."
fi

# 2. Set up Python virtual environment
echo ""
echo "🐍 Setting up Python virtual environment for Faster-Whisper & OpenCV..."
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate

pip install --upgrade pip
pip install faster-whisper yt-dlp opencv-python

echo "✅ Python AI dependencies installed successfully!"

# 3. Install Node.js NPM Packages
echo ""
echo "📦 Installing Node dependencies..."
npm install

echo ""
echo "🎉 ======================================================"
echo "   Setup Complete! Starting AUTOCLIPIN Studio..."
echo "   Local URL: http://localhost:4173"
echo "=========================================================="
echo ""

npm start
