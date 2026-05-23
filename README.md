#🧠 Clove AI - Futuristic OS Desktop Assistant

Clove AI is a state-of-the-art, desktop-integrated artificial intelligence assistant designed for system automation, intelligent control, computer vision, and seamless conversational companionship. It sports a premium cosmic moon-themed dark user interface with dynamic animations, built-in system telemetry, and offline-ready speech recognition.

✨ Features

🎙️ Robust Speech Recognition (ChatGPT-Style)**
  - Fully decoupled from browser permissions. Powered by a local Python audio pipeline, allowing microphone recording and Google Speech-to-Text transcription to work seamlessly even when opened directly from the filesystem (`file:///` protocol).
  - Activate recording instantly with `Ctrl + Space` or by clicking the microphone button.
  🖥️ Screen Analysis & Computer Vision**
  - Instant screen analysis with OCR capabilities (via Tesseract) and multimodal understanding. Use the quick action or tell Clove to "read screen" or "take a screenshot" to analyze active applications.
  ⚙️ OS & System Automation**
  - Control app launches (e.g., "open notepad", "open chrome"), adjust system volume (e.g., "set volume to 50"), and perform web searches natively.
  📂 Documents & Attachments**
  - Share files, photos, and videos with Clove using the inline attachment menu.
  🔍 In-Chat Search**
  - Fast, responsive client-side message filter. Easily search and highlight conversations using the top-bar finder.
  📊 Real-time Telemetry & Widgets**
  - Monitors and displays live system metrics (CPU, RAM, Disk, and Network status) and a synchronized cosmic clock.
  ☁️ Cloud Sync & Supabase Integration**
  - Safe, synchronized conversation logs and multi-session chat histories synced directly to your cloud Supabase database.

---

🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphism and animations), JavaScript ES6, Canvas-based celestial particle system.
- **Backend**: Python 3 (Flask, Flask-SocketIO, event-driven architecture).
- **AI Core**: Google Gemini API (Multimodal / Text generation).
- **Speech & Audio**: PyAudio, SpeechRecognition API, pyttsx3, ElevenLabs API (Optional Premium Voice).
- **System Automation**: PyAutoGUI, Psutil, PyCaw, Keyboard/Mouse hooks, Tesseract OCR.

🚀 Getting Started

#Prerequisites

1. **Python 3.10+**: Ensure Python is installed and added to your system path.
2. **Tesseract OCR (Optional for screen reading)**:
   - Download and install Tesseract OCR for Windows from [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki).
   - Verify the path to `tesseract.exe` matches the configuration in `config.json` (defaults to `C:\Program Files\Tesseract-OCR\tesseract.exe`).

#Installation

1. Clone or download the Clove AI repository.
2. Open your terminal in the project directory and install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

#Configuration

Customize settings and credentials by editing [config.json](file:///c:/Users/darsh/OneDrive/Desktop/Clove%20AI/config.json) or updating them directly inside the app's settings panel:

```json
{
    "gemini_api_key": "YOUR_GEMINI_API_KEY",
    "assistant_name": "Clove",
    "tesseract_path": "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
    "elevenlabs_api_key": "YOUR_ELEVENLABS_API_KEY",
    "voice_id": "hpp4J3VqNfWAUOO0d1Us",
    "supabase_url": "YOUR_SUPABASE_PROJECT_URL",
    "supabase_key": "YOUR_SUPABASE_ANON_KEY"
}
```

#Running Clove AI

Double-click the [start.bat](file:///c:/Users/darsh/OneDrive/Desktop/Clove%20AI/start.bat) file on Windows, or launch it manually from your terminal:

```bash
python app.py
```

Once started:
1. Open [index.html](file:///c:/Users/darsh/OneDrive/Desktop/Clove%20AI/index.html) directly from your file system (e.g., double-clicking it) to run it locally.
2. Sign in or register to begin chatting with Clove!
