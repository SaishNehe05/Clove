from google import genai
import json

with open('config.json') as f:
    config = json.load(f)

client = genai.Client(api_key=config['gemini_api_key'])

print("Listing available models using new SDK...")
try:
    for m in client.models.list():
        print(f"Name: {m.name}, Display Name: {m.display_name}")
except Exception as e:
    print(f"Error listing models: {e}")
