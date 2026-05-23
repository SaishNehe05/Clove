try:
    import pyttsx3
except ImportError:
    pyttsx3 = None
import threading
import requests
import base64
import os

class VoiceEngine:
    def __init__(self, api_key=None, voice_id="EXAVITQu4vr4xnNLMQyz"):
        self.api_key = api_key
        self.voice_id = voice_id
        self.local_engine = pyttsx3.init() if pyttsx3 else None
        if self.local_engine:
            self._setup_local_voice()

    def _setup_local_voice(self):
        if not self.local_engine: return
        try:
            voices = self.local_engine.getProperty('voices')
            for voice in voices:
                if "Zira" in voice.name or "Female" in voice.name:
                    self.local_engine.setProperty('voice', voice.id)
                    break
            self.local_engine.setProperty('rate', 175)
        except:
            pass

    def get_audio_data(self, text):
        """Fetches audio from ElevenLabs and returns base64 string. Fallbacks to None if fails."""
        if not self.api_key:
            print("[VOICE] No ElevenLabs API Key found. Skipping premium voice.")
            return None
            
        try:
            print(f"[VOICE] Requesting ElevenLabs audio for: {text[:30]}...")
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"
            headers = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": self.api_key
            }
            data = {
                "text": text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75
                }
            }
            
            response = requests.post(url, json=data, headers=headers)
            if response.status_code == 200:
                print("[VOICE] ElevenLabs audio successfully generated.")
                return base64.b64encode(response.content).decode('utf-8')
            else:
                print(f"[VOICE] ElevenLabs Error: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"[VOICE] Connection Error during ElevenLabs request: {str(e)}")
            return None

    def speak_local(self, text):
        """Standard local TTS fallback."""
        if not self.local_engine:
            print("[VOICE] Local text-to-speech engine is not available in the cloud.")
            return
            
        def _speak():
            try:
                self.local_engine.say(text)
                self.local_engine.runAndWait()
            except:
                pass
        threading.Thread(target=_speak).start()
