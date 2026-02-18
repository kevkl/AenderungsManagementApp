#!/bin/bash

set -e

echo "🐍 Setting up Python Whisper Server"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install: sudo apt install python3 python3-pip"
    exit 1
fi

echo "✅ Python: $(python3 --version)"

# Install system dependencies
echo ""
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y ffmpeg python3-pip python3-venv

# Create virtual environment
echo ""
echo "🔨 Creating virtual environment..."
python3 -m venv venv

# Activate and install packages
echo ""
echo "📥 Installing Python packages..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start servers:"
echo "  Terminal 1: ./start-whisper.sh"
echo "  Terminal 2: npm run dev"
