import requests
from core.memory_system import MemorySystem

memory = MemorySystem()
api_key = memory.get_config("elevenlabs_api_key")

if not api_key:
    print("No API key found.")
else:
    url = "https://api.elevenlabs.io/v1/models"
    headers = {"xi-api-key": api_key}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        models = response.json()
        for model in models:
            print(f"ID: {model['model_id']} | Name: {model['name']}")
    else:
        print(f"Error: {response.status_code} - {response.text}")
