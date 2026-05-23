from google import genai
import json

with open('config.json') as f:
    config = json.load(f)

client = genai.Client(api_key=config['gemini_api_key'])

print("FULL MODEL LISTING:")
try:
    models = list(client.models.list())
    for m in models:
        print(f"- {m.name}")
except Exception as e:
    print(f"Error: {e}")
