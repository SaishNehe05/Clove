import requests
import json
from core.memory_system import MemorySystem

memory = MemorySystem()
api_key = memory.get_config("elevenlabs_api_key")

if not api_key:
    print("No API key found.")
else:
    url = "https://api.elevenlabs.io/v1/voices"
    headers = {"xi-api-key": api_key}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        voices = response.json()["voices"]
        for voice in voices:
            print(f"ID: {voice['voice_id']} | Name: {voice['name']} | Gender: {voice.get('labels', {}).get('gender', 'N/A')}")
    else:
        print(f"Error: {response.status_code} - {response.text}")
