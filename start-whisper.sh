#!/bin/bash

set -e

echo "🚀 Starting Whisper Server..."

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Run: ./setup-python-whisper.sh first"
    exit 1
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Check if flask is installed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "❌ Flask not installed in venv!"
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Start Flask server
echo ""
python3 whisper_server.py
