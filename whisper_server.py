#!/usr/bin/env python3
"""
Whisper Transcription Server
Läuft parallel zu Next.js und transkribiert Audio-Dateien
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os
import sys

app = Flask(__name__)
CORS(app)  # Allow requests from Next.js

# Load Whisper model on startup
print("🔄 Loading Whisper model (base)...")
try:
    model = whisper.load_model("base")
    print("✅ Whisper model loaded successfully!")
except Exception as e:
    print(f"❌ Failed to load Whisper model: {e}")
    sys.exit(1)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "model": "base"})

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """Transcribe audio file"""
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    audio_file = request.files['file']
    
    if audio_file.filename == '':
        return jsonify({"error": "Empty filename"}), 400
    
    try:
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            audio_file.save(temp_file.name)
            temp_path = temp_file.name
        
        print(f"📥 Transcribing: {audio_file.filename} ({os.path.getsize(temp_path)} bytes)")
        
        # Transcribe
        result = model.transcribe(
            temp_path,
            language="de",
            task="transcribe",
            fp16=False  # Use CPU
        )
        
        # Cleanup
        os.remove(temp_path)
        
        transcript = result["text"].strip()
        print(f"✅ Transcription: {transcript[:100]}...")
        
        return jsonify({
            "text": transcript,
            "language": result.get("language", "de")
        })
    
    except Exception as e:
        print(f"❌ Transcription error: {e}")
        return jsonify({
            "error": "Transcription failed",
            "details": str(e)
        }), 500

if __name__ == '__main__':
    print("🚀 Starting Whisper Server on http://localhost:5000")
    print("📝 Endpoints:")
    print("   GET  /health      - Health check")
    print("   POST /transcribe  - Transcribe audio")
    print("")
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,
        threaded=True
    )
