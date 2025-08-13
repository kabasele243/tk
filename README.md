# Audio/Video Transcription Application

A modern React-based web application for transcribing audio and video files using AI-powered speech recognition.

## Features

- **Multi-format Support**: Upload MP3, WAV, M4A, FLAC, MP4, AVI, MOV, MKV files
- **Drag & Drop Interface**: Intuitive file upload with visual feedback
- **Queue System**: Process files one by one to avoid API overload
- **Real-time Status**: Track processing progress and file status
- **Download Results**: Export transcriptions as downloadable TXT files
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Built with Tailwind CSS and React

## Backend API

This application connects to a Whisper AI transcription backend running on `http://0.0.0.0:8080/transcribe`.

**API Endpoint**: `POST /transcribe`
- **Input**: Multipart form data with audio/video file
- **Output**: JSON with transcription text, duration, and processing time
- **Supported Formats**: MP3, WAV, M4A, FLAC, MP4 (audio extracted automatically)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Backend transcription service running on port 8080

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the application

### Usage

1. **Upload Files**: Drag and drop audio/video files or click to browse
2. **Processing**: Files are automatically queued and processed one by one
3. **Monitor Progress**: Watch real-time status updates for each file
4. **Download Results**: Click the download button to save transcriptions as TXT files
5. **Manage Files**: Remove completed or failed files as needed

## Project Structure

```
src/
├── pages/
│   ├── Dashboard.jsx          # Main dashboard with transcription card
│   └── Transcribe.jsx         # Transcription interface
├── partials/
│   └── Sidebar.jsx            # Navigation sidebar
└── App.jsx                    # Main app routing
```

## Technologies Used

- **Frontend**: React 18, React Router DOM
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **API**: Fetch API for backend communication

## Development

- **Build**: `npm run build`
- **Preview**: `npm run preview`
- **Development**: `npm run dev`

## License

This project is part of the Mosaic React template.
