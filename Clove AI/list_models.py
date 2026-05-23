import google.generativeai as genai
import json

with open('config.json', 'r') as f:
    config = json.load(f)

genai.configure(api_key=config['gemini_api_key'])

print("Available models:")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)
