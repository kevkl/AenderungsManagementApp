import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const WHISPER_SERVER_URL = process.env.WHISPER_SERVER_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log('📥 Received audio:', audioFile.name, audioFile.size, 'bytes');

    // Forward to Python Whisper server
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);

    const response = await fetch(`${WHISPER_SERVER_URL}/transcribe`, {
      method: 'POST',
      body: whisperFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Whisper server error');
    }

    const data = await response.json();
    console.log('✅ Transcription:', data.text);

    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error('❌ Transcription error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Transcription failed', 
        details: errorMessage,
        help: 'Is Whisper server running? Start with: ./start-whisper.sh'
      }, 
      { status: 500 }
    );
  }
}
