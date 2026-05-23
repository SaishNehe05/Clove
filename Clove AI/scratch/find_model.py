from google import genai
import json

with open('config.json') as f:
    config = json.load(f)

client = genai.Client(api_key=config['gemini_api_key'])

print("Searching for a suitable 'flash' model...")
found_model = None
try:
    for m in client.models.list():
        if "flash" in m.name.lower() and "preview" not in m.name.lower() and "audio" not in m.name.lower():
            found_model = m.name
            print(f"Found stable flash model: {m.name}")
            break
    
    if not found_model:
        # Fallback to the first available flash model
        for m in client.models.list():
            if "flash" in m.name.lower():
                found_model = m.name
                print(f"Fallback flash model: {m.name}")
                break
                
    if found_model:
        # Strip models/ prefix if present, SDK usually handles it but let's be sure
        model_id = found_model.replace("models/", "")
        print(f"\nRecommended model ID: {model_id}")
    else:
        print("No flash models found!")

except Exception as e:
    print(f"Error: {e}")
