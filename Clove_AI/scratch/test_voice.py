import sys
import os
sys.path.append(os.getcwd())
from core.voice_engine import VoiceEngine
from core.memory_system import MemorySystem

memory = MemorySystem()
api_key = memory.get_config("elevenlabs_api_key")
voice_id = memory.get_config("voice_id", "EXAVITQu4vr4xnNLMQyz")

print(f"Testing ElevenLabs with key: {api_key[:5]}...")
voice = VoiceEngine(api_key=api_key, voice_id=voice_id)
audio = voice.get_audio_data("Hello, I am Clove. Testing premium voice.")

if audio:
    print("SUCCESS: Audio generated (base64 length:", len(audio), ")")
else:
    print("FAILED: No audio generated.")
