import time
import json
from google import genai
from google.genai import types

# Load API key from config.json
with open('config.json', 'r') as f:
    config = json.load(f)

api_key = config['gemini_api_key']
client = genai.Client(api_key=api_key)

models_to_test = [
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview'
]

system_instruction = "You are Clove, a smart and friendly AI desktop assistant. Speak naturally."

print("Starting latency test for Gemini models streaming response...")

for model in models_to_test:
    print(f"\n--- Testing Model: {model} ---")
    start_time = time.time()
    first_chunk_time = None
    chunks_count = 0
    full_text = ""
    
    try:
        stream = client.models.generate_content_stream(
            model=model,
            contents=[types.Content(role='user', parts=[types.Part.from_text(text="Hello, who are you? Write a 2 sentence response.")])],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
                max_output_tokens=512,
            )
        )
        
        for chunk in stream:
            if chunk.text:
                if first_chunk_time is None:
                    first_chunk_time = time.time() - start_time
                    print(f"Time to first chunk: {first_chunk_time:.3f} seconds")
                full_text += chunk.text
                chunks_count += 1
                
        total_time = time.time() - start_time
        print(f"Total stream time: {total_time:.3f} seconds")
        print(f"Chunks received: {chunks_count}")
        print(f"Response: {full_text.strip()}")
    except Exception as e:
        print(f"Error testing {model}: {e}")
