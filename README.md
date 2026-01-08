# 🎙️ Voice Transcriber MVP

A simple web app that transcribes voice recordings using OpenAI's Whisper API, hosted on Netlify.

## Features

- Upload audio files (M4A, MP3, WAV, MP4, WebM, OGG, FLAC)
- Instant transcription using OpenAI Whisper
- Copy transcript to clipboard
- Download as text file
- No conversion needed - M4A from phone works directly

## Limitations

- **25 MB max file size** (OpenAI API limit)
- **~15 minutes max recording** at typical phone quality (192 kbps)
- Netlify function timeout may affect very large files

For longer recordings, trim them first or upgrade to a chunked processing approach.

## Setup

### 1. Deploy to Netlify

1. Go to [Netlify](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub account
4. Select this repository
5. Deploy settings:
   - Build command: (leave blank)
   - Publish directory: `.`

### 2. Add Environment Variable

In Netlify dashboard:
1. Go to Site configuration → Environment variables
2. Add new variable:
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key (get from https://platform.openai.com/api-keys)

### 3. Redeploy

After adding the environment variable, trigger a redeploy:
- Deploys → Trigger deploy → Deploy site

## Usage

1. Open your Netlify site URL
2. Click the upload area or drag & drop an audio file
3. Click "Transcribe"
4. Wait for the transcript (may take a minute)
5. Copy or download the result

## Cost

OpenAI Whisper API pricing: ~$0.006 per minute of audio
- 10 min recording ≈ $0.06
- 1 hour ≈ $0.36

## Tech Stack

- HTML/CSS/JavaScript (frontend)
- Netlify Functions (serverless backend)
- OpenAI Whisper API (transcription)
- Busboy (file upload parsing)
